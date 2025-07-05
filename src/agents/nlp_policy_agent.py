"""
NLP Policy Agent for Bio Vault insurance claim evaluation
ASI integration with swappable LLM backends for multi-agent consensus
Supports Claude, GPT-4, ASI1 through adapter pattern
"""
import os
import json
import time
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from abc import ABC, abstractmethod
import random
from io import BytesIO

import anthropic
import openai
import requests
import aiohttp
import PyPDF2
import pdfplumber
from cryptography.fernet import Fernet

from .base_agent import BaseEvaluationAgent
from .schemas import (
    AgentVerdict, VerdictType, CoverageReason, 
    PolicySummary, InvoiceSummary, ExecutionContext
)
from pydantic import BaseModel, ValidationError


class LLMAdapter(ABC):
    """Abstract base class for LLM adapters - enables multi-agent with different models"""
    
    @abstractmethod
    async def extract_policy_data(self, policy_text: str) -> Dict[str, Any]:
        """Extract structured policy data"""
        pass
    
    @abstractmethod
    async def extract_invoice_data(self, invoice_text: str) -> Dict[str, Any]:
        """Extract structured invoice data"""
        pass
    
    @abstractmethod
    async def evaluate_claim(self, policy: PolicySummary, invoice: InvoiceSummary, 
                           policy_text: str, invoice_text: str) -> Dict[str, Any]:
        """Evaluate insurance claim"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if model is available"""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return model identifier for logging/metrics"""
        pass


class ClaudeLLMAdapter(LLMAdapter):
    """Claude-specific LLM adapter with retry logic and optimized prompts"""
    
    def __init__(self, api_key: str, model_name: str = "claude-3-5-sonnet-20241022", max_retries: int = 3, base_delay: float = 1.0):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model_name = model_name
        self.max_retries = max_retries
        self.base_delay = base_delay
        
        # Claude-optimized model configuration
        self.model_config = {
            "policy_extraction": {
                "model": self._model_name,  # Use specified model for complex document understanding
                "max_tokens": 4000,
                "temperature": 0.1
            },
            "invoice_extraction": {
                "model": self._model_name,  # Use specified model for structured data
                "max_tokens": 2000,
                "temperature": 0.1
            },
            "claim_evaluation": {
                "model": self._model_name,  # Use specified model for complex decisions
                "max_tokens": 3000,
                "temperature": 0.2
            }
        }
    
    @property
    def model_name(self) -> str:
        return self._model_name
    
    async def _call_with_retry(self, config_key: str, prompt: str) -> str:
        """Call Claude API with exponential backoff retry logic"""
        config = self.model_config[config_key]
        
        for attempt in range(self.max_retries):
            try:
                response = await self.client.messages.create(
                    **config,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
                
            except anthropic.RateLimitError as e:
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(delay)
                
            except anthropic.APITimeoutError as e:
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
                
            except Exception as e:
                # For other errors, don't retry
                raise
    
    async def extract_policy_data(self, policy_text: str) -> Dict[str, Any]:
        """Extract structured policy data using Claude's document understanding"""
        prompt = f"""
You are an expert insurance policy analyst. Extract key information from this insurance policy document.

POLICY DOCUMENT:
{policy_text[:8000]}

Extract the following information and respond in JSON format:
{{
    "policy_number": "string",
    "coverage_type": "string (e.g., 'comprehensive_health', 'dental', 'vision')",
    "annual_limit": number,
    "deductible": number or null,
    "copay_percentage": number or null (0-100),
    "exclusions": ["array", "of", "exclusion", "categories"],
    "covered_services": ["array", "of", "covered", "services"],
    "effective_dates": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}},
    "special_conditions": ["array", "of", "special", "conditions"] or null
}}

Focus on exact policy numbers, dates, numerical limits, and specific exclusions/inclusions.
If information is unclear or missing, use null for that field.
        """
        
        response_text = await self._call_with_retry("policy_extraction", prompt)
        return json.loads(response_text)
    
    async def extract_invoice_data(self, invoice_text: str) -> Dict[str, Any]:
        """Extract structured invoice data using Claude's billing expertise"""
        prompt = f"""
You are an expert medical billing analyst. Extract key information from this medical invoice/claim.

INVOICE DOCUMENT:
{invoice_text[:6000]}

Extract the following information and respond in JSON format:
{{
    "invoice_number": "string",
    "service_type": "string (e.g., 'dental_cleaning', 'routine_checkup', 'emergency_care')",
    "amount": number,
    "service_date": "YYYY-MM-DD",
    "provider_id": "string",
    "provider_name": "string or null",
    "diagnosis_codes": ["array", "of", "ICD10", "codes"] or null,
    "procedure_codes": ["array", "of", "CPT", "codes"] or null,
    "itemized_charges": {{"service_name": amount}} or null
}}

Focus on exact invoice numbers, dates, monetary amounts, provider info, and medical codes.
If information is unclear or missing, use null for that field.
        """
        
        response_text = await self._call_with_retry("invoice_extraction", prompt)
        return json.loads(response_text)
    
    async def evaluate_claim(self, policy: PolicySummary, invoice: InvoiceSummary, 
                           policy_text: str, invoice_text: str) -> Dict[str, Any]:
        """Evaluate insurance claim using Claude's reasoning capabilities"""
        prompt = f"""
You are a world-class insurance claim evaluator with deep expertise in policy interpretation.

POLICY SUMMARY:
{policy.json()}

INVOICE SUMMARY:
{invoice.json()}

FULL POLICY TEXT (for reference):
{policy_text[:4000]}

FULL INVOICE TEXT (for reference):
{invoice_text[:2000]}

Evaluate whether this claim should be COVERED, NOT_COVERED, PARTIAL_COVERAGE, or REQUIRES_REVIEW.

Respond in JSON format:
{{
    "verdict": "COVERED|NOT_COVERED|PARTIAL_COVERAGE|REQUIRES_REVIEW",
    "coverage_amount": number or null,
    "primary_reason": "Clear, concise explanation",
    "supporting_reasons": [
        {{
            "clause_reference": "Policy section reference or null",
            "explanation": "Detailed explanation",
            "confidence": 0.0-1.0
        }}
    ],
    "ambiguity_detected": boolean,
    "ambiguous_clauses": ["list", "of", "unclear", "clauses"] or null,
    "requires_human_review": boolean,
    "review_reasons": ["reasons", "for", "review"] or null
}}

Evaluation criteria:
1. Service type coverage under policy
2. Amount within policy limits  
3. Provider eligibility
4. Deductible and copay calculations
5. Exclusion analysis
6. Date validity (service within policy period)

Mark requires_human_review=true for ambiguous policy language, edge cases, claims near limits, or missing critical information.
Be thorough but decisive. Provide specific policy references when possible.
        """
        
        response_text = await self._call_with_retry("claim_evaluation", prompt)
        return json.loads(response_text)
    
    async def health_check(self) -> bool:
        """Check Claude API health"""
        try:
            response = await self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Health check"}]
            )
            return bool(response.content)
        except Exception:
            return False


class GPT4LLMAdapter(LLMAdapter):
    """GPT-4 adapter with strict Pydantic validation and hot-swappable configuration"""
    
    def __init__(self, api_key: str = None, model_name: str = "gpt-4-1106-preview", 
                 max_retries: int = 3, base_delay: float = 1.0, strict_validation: bool = True):
        # In production: Use OpenAI Enterprise API with zero data retention
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._model_name = model_name
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.strict_validation = strict_validation
        self.retry_count = 0
        self.logger = None
        
        self._initialize_client()
        
        self.model_config = {
            "policy_extraction": {
                "model": self._model_name,
                "max_tokens": 4000,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "timeout": 60
            },
            "invoice_extraction": {
                "model": self._model_name,
                "max_tokens": 2000,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "timeout": 45
            },
            "claim_evaluation": {
                "model": self._model_name,
                "max_tokens": 3000,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "timeout": 60
            }
        }
    
    def _initialize_client(self):
        """Initialize OpenAI client"""
        if not self._api_key:
            raise ValueError("OpenAI API key required")
        self.client = openai.AsyncOpenAI(api_key=self._api_key)
    
    def hot_swap_model(self, new_model: str, new_api_key: str = None):
        """Hot-swap model with logging"""
        old_model = self._model_name
        
        if new_api_key:
            self._api_key = new_api_key
            self._initialize_client()
        
        self._model_name = new_model
        for config in self.model_config.values():
            config["model"] = new_model
            
        if self.logger:
            self.logger.info(f"Model switched from {old_model} to {new_model}")
    
    @property
    def model_name(self) -> str:
        return f"gpt-4-{self._model_name.split('-')[-1]}"
    
    def set_logger(self, logger):
        self.logger = logger
    
    def _validate_with_pydantic(self, data: Dict[str, Any], schema_class) -> Dict[str, Any]:
        """Strict Pydantic validation with fallback defaults"""
        try:
            validated = schema_class(**data)
            return validated.dict()
        except ValidationError as e:
            if self.strict_validation:
                if self.logger:
                    self.logger.error(f"Pydantic validation failed: {e}")
                raise ValueError(f"Schema validation error: {e}")
            else:
                # Fallback mode: create valid object with defaults
                if self.logger:
                    self.logger.warning(f"Validation failed, using defaults: {e}")
                try:
                    validated = schema_class()
                    return validated.dict()
                except Exception:
                    # Last resort defaults
                    return {}
    
    async def _call_with_retry(self, config_key: str, prompt: str) -> str:
        """Enhanced API call with monitoring"""
        config = self.model_config[config_key]
        
        for attempt in range(self.max_retries):
            try:
                if self.logger:
                    self.logger.debug(f"GPT-4 call {attempt+1}/{self.max_retries} for {config_key}")
                
                response = await self.client.chat.completions.create(
                    model=config["model"],
                    max_tokens=config["max_tokens"],
                    temperature=config["temperature"],
                    response_format=config["response_format"],
                    timeout=config["timeout"],
                    messages=[{"role": "user", "content": prompt}]
                )
                
                result = response.choices[0].message.content
                if self.logger:
                    self.logger.debug(f"GPT-4 success: {len(result)} chars")
                return result
                
            except openai.RateLimitError as e:
                self.retry_count += 1
                if self.logger:
                    self.logger.warning(f"Rate limit: {e}")
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(delay)
                
            except openai.APITimeoutError as e:
                self.retry_count += 1
                if self.logger:
                    self.logger.warning(f"Timeout: {e}")
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
                
            except Exception as e:
                if self.logger:
                    self.logger.error(f"API error: {e}")
                raise
    
    async def extract_policy_data(self, policy_text: str) -> Dict[str, Any]:
        """Extract with Pydantic validation"""
        prompt = f"""Extract insurance policy data as JSON:

{policy_text[:8000]}

JSON format:
{{
    "policy_number": "string",
    "coverage_type": "string", 
    "annual_limit": number,
    "deductible": number or null,
    "copay_percentage": number or null,
    "exclusions": ["array"],
    "covered_services": ["array"],
    "effective_dates": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}},
    "special_conditions": ["array"] or null
}}"""
        
        response_text = await self._call_with_retry("policy_extraction", prompt)
        try:
            data = json.loads(response_text)
            return self._validate_with_pydantic(data, PolicySummary)
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON decode error: {response_text}")
            raise ValueError(f"Invalid JSON: {e}")
    
    async def extract_invoice_data(self, invoice_text: str) -> Dict[str, Any]:
        """Extract with Pydantic validation"""
        prompt = f"""Extract invoice data as JSON:

{invoice_text[:6000]}

JSON format:
{{
    "invoice_number": "string",
    "service_type": "string",
    "amount": number,
    "service_date": "YYYY-MM-DD", 
    "provider_id": "string",
    "provider_name": "string or null",
    "diagnosis_codes": ["array"] or null,
    "procedure_codes": ["array"] or null,
    "itemized_charges": {{"key": value}} or null
}}"""
        
        response_text = await self._call_with_retry("invoice_extraction", prompt)
        try:
            data = json.loads(response_text)
            return self._validate_with_pydantic(data, InvoiceSummary)
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON decode error: {response_text}")
            raise ValueError(f"Invalid JSON: {e}")
    
    async def evaluate_claim(self, policy: PolicySummary, invoice: InvoiceSummary,
                           policy_text: str, invoice_text: str) -> Dict[str, Any]:
        """Evaluate with validation"""
        prompt = f"""Evaluate claim as JSON:

POLICY: {policy.json()}
INVOICE: {invoice.json()}

JSON format:
{{
    "verdict": "COVERED|NOT_COVERED|PARTIAL_COVERAGE|REQUIRES_REVIEW",
    "coverage_amount": number or null,
    "primary_reason": "string",
    "supporting_reasons": [
        {{
            "clause_reference": "string or null",
            "explanation": "string", 
            "confidence": 0.0-1.0
        }}
    ],
    "ambiguity_detected": boolean,
    "ambiguous_clauses": ["array"] or null,
    "requires_human_review": boolean,
    "review_reasons": ["array"] or null
}}"""
        
        response_text = await self._call_with_retry("claim_evaluation", prompt)
        try:
            data = json.loads(response_text)
            # Manual validation for evaluation response (no direct Pydantic model)
            if self.strict_validation:
                required_fields = ["verdict", "primary_reason", "supporting_reasons", 
                                 "ambiguity_detected", "requires_human_review"]
                for field in required_fields:
                    if field not in data:
                        raise ValueError(f"Missing required field: {field}")
            return data
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON decode error: {response_text}")
            raise ValueError(f"Invalid JSON: {e}")
    
    async def health_check(self) -> bool:
        """Health check"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                max_tokens=5,
                timeout=10,
                messages=[{"role": "user", "content": "OK"}]
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            if self.logger:
                self.logger.warning(f"Health check failed: {e}")
            return False


class ASI1LLMAdapter(LLMAdapter):
    """ASI1-specific LLM adapter using Fetch.ai's ASI-1 Mini API"""
    
    def __init__(self, api_key: str = None, model_name: str = "asi1-mini", 
                 max_retries: int = 3, base_delay: float = 1.0):
        self._api_key = api_key or os.getenv("ASI_API_KEY")
        self._model_name = model_name
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.api_endpoint = "https://api.asi1.ai/v1/chat/completions"
        self.logger = None
        
        if not self._api_key:
            raise ValueError("ASI API key required - set ASI_API_KEY environment variable")
        
        # ASI1-optimized model configuration
        self.model_config = {
            "policy_extraction": {
                "model": self._model_name,
                "max_tokens": 4000,
                "temperature": 0.1,
                "stream": False
            },
            "invoice_extraction": {
                "model": self._model_name,
                "max_tokens": 2000,
                "temperature": 0.1,
                "stream": False
            },
            "claim_evaluation": {
                "model": self._model_name,
                "max_tokens": 3000,
                "temperature": 0.2,
                "stream": False
            }
        }
    
    @property
    def model_name(self) -> str:
        return f"asi-{self._model_name}"
    
    def set_logger(self, logger):
        self.logger = logger
    
    async def _call_with_retry(self, config_key: str, prompt: str) -> str:
        """Call ASI API with retry logic"""
        config = self.model_config[config_key]
        
        for attempt in range(self.max_retries):
            try:
                if self.logger:
                    self.logger.debug(f"ASI1 call {attempt+1}/{self.max_retries} for {config_key}")
                
                # Prepare request payload
                payload = {
                    "model": config["model"],
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": config["temperature"],
                    "max_tokens": config["max_tokens"],
                    "stream": config["stream"]
                }
                
                headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': f'Bearer {self._api_key}'
                }
                
                # Make async HTTP request
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        self.api_endpoint,
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=60)
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            if self.logger:
                                self.logger.debug(f"ASI1 raw response: {result}")
                            
                            if 'choices' in result and len(result['choices']) > 0:
                                response_text = result['choices'][0]['message']['content']
                                
                                # ASI API returns JSON wrapped in markdown code blocks - extract it
                                if response_text.startswith('```json') and response_text.endswith('```'):
                                    response_text = response_text[7:-3].strip()  # Remove ```json and ```
                                elif response_text.startswith('```') and response_text.endswith('```'):
                                    response_text = response_text[3:-3].strip()  # Remove generic ```
                                
                                if self.logger:
                                    self.logger.debug(f"ASI1 success: {len(response_text)} chars")
                                return response_text
                            else:
                                raise Exception(f"Unexpected ASI API response format: {result}")
                        else:
                            error_text = await response.text()
                            if self.logger:
                                self.logger.error(f"ASI API error {response.status}: {error_text}")
                            raise Exception(f"ASI API error {response.status}: {error_text}")
                
            except asyncio.TimeoutError:
                if self.logger:
                    self.logger.warning(f"ASI API timeout on attempt {attempt+1}")
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
                
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"ASI API error on attempt {attempt+1}: {e}")
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(delay)
    
    async def extract_policy_data(self, policy_text: str) -> Dict[str, Any]:
        """Extract structured policy data using ASI1"""
        prompt = f"""You are an expert insurance policy analyst. Extract key information from this insurance policy document and respond ONLY with valid JSON.

POLICY DOCUMENT:
{policy_text[:8000]}

Extract the following information and respond in JSON format:
{{
    "policy_number": "string",
    "coverage_type": "string (e.g., 'comprehensive_health', 'dental', 'vision')",
    "annual_limit": number,
    "deductible": number or null,
    "copay_percentage": number or null (0-100),
    "exclusions": ["array", "of", "exclusion", "categories"],
    "covered_services": ["array", "of", "covered", "services"],
    "effective_dates": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}},
    "special_conditions": ["array", "of", "special", "conditions"] or null
}}

Focus on exact policy numbers, dates, numerical limits, and specific exclusions/inclusions.
If information is unclear or missing, use null for that field.
Respond with ONLY the JSON object, no additional text."""
        
        response_text = await self._call_with_retry("policy_extraction", prompt)
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON parsing failed for policy extraction. Response: '{response_text}', Error: {e}")
            raise Exception(f"ASI API returned invalid JSON for policy extraction: {response_text[:200]}...")
    
    async def extract_invoice_data(self, invoice_text: str) -> Dict[str, Any]:
        """Extract structured invoice data using ASI1"""
        prompt = f"""You are an expert medical billing analyst. Extract key information from this medical invoice/claim and respond ONLY with valid JSON.

INVOICE DOCUMENT:
{invoice_text[:6000]}

Extract the following information and respond in JSON format:
{{
    "invoice_number": "string",
    "service_type": "string (e.g., 'dental_cleaning', 'routine_checkup', 'emergency_care')",
    "amount": number,
    "service_date": "YYYY-MM-DD",
    "provider_id": "string",
    "provider_name": "string or null",
    "diagnosis_codes": ["array", "of", "ICD10", "codes"] or null,
    "procedure_codes": ["array", "of", "CPT", "codes"] or null,
    "itemized_charges": {{"service_name": amount}} or null
}}

Focus on exact invoice numbers, dates, monetary amounts, provider info, and medical codes.
If information is unclear or missing, use null for that field.
Respond with ONLY the JSON object, no additional text."""
        
        response_text = await self._call_with_retry("invoice_extraction", prompt)
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON parsing failed for invoice extraction. Response: '{response_text}', Error: {e}")
            raise Exception(f"ASI API returned invalid JSON for invoice extraction: {response_text[:200]}...")
    
    async def evaluate_claim(self, policy: PolicySummary, invoice: InvoiceSummary,
                           policy_text: str, invoice_text: str) -> Dict[str, Any]:
        """Evaluate insurance claim using ASI1"""
        prompt = f"""You are a world-class insurance claim evaluator with deep expertise in policy interpretation. Evaluate this claim and respond ONLY with valid JSON.

POLICY SUMMARY:
{policy.json()}

INVOICE SUMMARY:
{invoice.json()}

FULL POLICY TEXT (for reference):
{policy_text[:4000]}

FULL INVOICE TEXT (for reference):
{invoice_text[:2000]}

Evaluate whether this claim should be COVERED, NOT_COVERED, PARTIAL_COVERAGE, or REQUIRES_REVIEW.

Respond in JSON format:
{{
    "verdict": "COVERED|NOT_COVERED|PARTIAL_COVERAGE|REQUIRES_REVIEW",
    "coverage_amount": number or null,
    "primary_reason": "Clear, concise explanation",
    "supporting_reasons": [
        {{
            "clause_reference": "Policy section reference or null",
            "explanation": "Detailed explanation",
            "confidence": 0.0-1.0
        }}
    ],
    "ambiguity_detected": boolean,
    "ambiguous_clauses": ["list", "of", "unclear", "clauses"] or null,
    "requires_human_review": boolean,
    "review_reasons": ["reasons", "for", "review"] or null
}}

Evaluation criteria:
1. Service type coverage under policy
2. Amount within policy limits  
3. Provider eligibility
4. Deductible and copay calculations
5. Exclusion analysis
6. Date validity (service within policy period)

Mark requires_human_review=true for ambiguous policy language, edge cases, claims near limits, or missing critical information.
Be thorough but decisive. Provide specific policy references when possible.
Respond with ONLY the JSON object, no additional text."""
        
        response_text = await self._call_with_retry("claim_evaluation", prompt)
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            if self.logger:
                self.logger.error(f"JSON parsing failed for claim evaluation. Response: '{response_text}', Error: {e}")
            raise Exception(f"ASI API returned invalid JSON for claim evaluation: {response_text[:200]}...")
    
    async def health_check(self) -> bool:
        """Check ASI API health"""
        try:
            payload = {
                "model": self._model_name,
                "messages": [{"role": "user", "content": "Health check"}],
                "max_tokens": 10,
                "temperature": 0.1,
                "stream": False
            }
            
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': f'Bearer {self._api_key}'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.api_endpoint,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
                    
        except Exception as e:
            if self.logger:
                self.logger.warning(f"ASI health check failed: {e}")
            return False


class NLPPolicyAgent(BaseEvaluationAgent):
    """
    NLP-powered policy evaluation agent with swappable LLM backends
    Designed for multi-agent consensus with different model types (Claude, GPT-4, etc.)
    """
    
    def __init__(
        self,
        agent_id: str = "nlp_policy_agent_001",
        seed_phrase: str = None,
        endpoint: str = "http://localhost",
        port: int = 8001,
        llm_adapter: Optional[LLMAdapter] = None,
        **kwargs
    ):
        # Initialize ASI agent
        super().__init__(
            agent_id=agent_id,
            agent_type="nlp_policy",
            seed_phrase=seed_phrase or os.getenv("AGENT_SEED"),
            endpoint=endpoint,
            port=port,
            **kwargs
        )
        
        # Initialize LLM adapter (default to Claude, but swappable for multi-agent consensus)
        self.llm_adapter = llm_adapter or ClaudeLLMAdapter(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_retries=3,
            base_delay=1.0
        )
        
        # Inject logger into adapter if supported
        if hasattr(self.llm_adapter, 'set_logger'):
            self.llm_adapter.set_logger(self.logger)
        
        # Performance metrics for ASI monitoring
        self.performance_metrics = {
            "total_evaluations": 0,
            "successful_evaluations": 0,
            "failed_evaluations": 0,
            "average_processing_time": 0,
            "llm_api_calls": 0,
            "retry_attempts": 0,
            "pdf_parsing_failures": 0,
            "model_name": self.llm_adapter.model_name
        }
        
        self.logger.info(f"NLP Policy Agent initialized - Agent ID: {self.agent_id}")
        self.logger.info(f"ASI Address: {self.get_agent_address()}")
        self.logger.info(f"LLM Backend: {self.llm_adapter.model_name}")
    
    async def evaluate_claim(
        self, 
        policy_path: str, 
        invoice_path: str,
        decryption_key: str,
        claim_id: str
    ) -> AgentVerdict:
        """
        Primary evaluation method with swappable LLM backend
        Enables multi-agent consensus with different models
        """
        start_time = time.time()
        self.performance_metrics["total_evaluations"] += 1
        
        try:
            self.logger.info(f"Starting claim evaluation {claim_id} with {self.llm_adapter.model_name}")
            
            # Phase 1: Parallel document extraction (model-agnostic)
            self.logger.debug("Phase 1: Document extraction")
            policy_task = self.run_in_executor(
                self._extract_and_decrypt_pdf, policy_path, decryption_key
            )
            invoice_task = self.run_in_executor(
                self._extract_and_decrypt_pdf, invoice_path, decryption_key
            )
            
            policy_text, invoice_text = await asyncio.gather(policy_task, invoice_task)
            
            # Phase 2: Concurrent structured data extraction (LLM-specific)
            self.logger.debug("Phase 2: Structured data extraction")
            policy_data = await self.llm_adapter.extract_policy_data(policy_text)
            invoice_data = await self.llm_adapter.extract_invoice_data(invoice_text)
            
            policy_summary = PolicySummary(**policy_data)
            invoice_summary = InvoiceSummary(**invoice_data)
            
            # Phase 3: Claim evaluation (LLM-specific)
            self.logger.debug("Phase 3: Claim evaluation")
            evaluation_result = await self.llm_adapter.evaluate_claim(
                policy_summary, invoice_summary, policy_text, invoice_text
            )
            
            # Phase 4: Construct verdict (model-agnostic)
            verdict = self._construct_verdict(
                evaluation_result, policy_summary, invoice_summary, 
                start_time, claim_id
            )
            
            # Update metrics
            self.performance_metrics["successful_evaluations"] += 1
            self.performance_metrics["llm_api_calls"] += 3  # 3 API calls per evaluation
            self._update_performance_metrics(time.time() - start_time)
            
            self.logger.info(
                f"Claim {claim_id} evaluated by {self.llm_adapter.model_name}: {verdict.verdict} "
                f"(Processing: {verdict.processing_time_ms}ms)"
            )
            
            return verdict
            
        except Exception as e:
            self.performance_metrics["failed_evaluations"] += 1
            self.logger.error(
                f"Error evaluating claim {claim_id} with {self.llm_adapter.model_name}: {str(e)}", 
                exc_info=True
            )
            raise
    
    async def extract_policy_data(self, policy_pdf_path: str, decryption_key: str) -> PolicySummary:
        """Extract structured policy data using configured LLM"""
        policy_text = await self.run_in_executor(
            self._extract_and_decrypt_pdf, policy_pdf_path, decryption_key
        )
        policy_data = await self.llm_adapter.extract_policy_data(policy_text)
        return PolicySummary(**policy_data)
    
    async def extract_invoice_data(self, invoice_pdf_path: str, decryption_key: str) -> InvoiceSummary:
        """Extract structured invoice data using configured LLM"""
        invoice_text = await self.run_in_executor(
            self._extract_and_decrypt_pdf, invoice_pdf_path, decryption_key
        )
        invoice_data = await self.llm_adapter.extract_invoice_data(invoice_text)
        return InvoiceSummary(**invoice_data)
    
    def _extract_and_decrypt_pdf(self, pdf_path: str, decryption_key: str) -> str:
        """
        Extract text from encrypted PDF using PyPDF2/pdfplumber
        Model-agnostic PDF processing for any LLM backend
        """
        try:
            # Check if file is encrypted or unencrypted
            if decryption_key.startswith("test_key_for_unencrypted"):
                # Skip decryption for testing with unencrypted PDFs
                with open(pdf_path, 'rb') as pdf_file:
                    decrypted_data = pdf_file.read()
            else:
                # Decrypt file using Walrus key
                fernet = Fernet(decryption_key.encode())
                
                with open(pdf_path, 'rb') as encrypted_file:
                    encrypted_data = encrypted_file.read()
                    decrypted_data = fernet.decrypt(encrypted_data)
            
            # Extract text using robust dual-method approach
            text_content = ""
            
            # Method 1: PyPDF2 for basic extraction
            try:
                pdf_reader = PyPDF2.PdfReader(BytesIO(decrypted_data))
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
            except Exception as e:
                self.logger.warning(f"PyPDF2 extraction failed: {e}")
            
            # Method 2: pdfplumber for complex layouts (fallback)
            if len(text_content.strip()) < 100:
                try:
                    with pdfplumber.open(BytesIO(decrypted_data)) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text()
                            if page_text:
                                text_content += page_text + "\n"
                except Exception as e:
                    self.logger.warning(f"pdfplumber extraction failed: {e}")
            
            if len(text_content.strip()) < 50:
                self.performance_metrics["pdf_parsing_failures"] += 1
                raise ValueError("PDF text extraction yielded insufficient content")
            
            return text_content.strip()
            
        except Exception as e:
            self.performance_metrics["pdf_parsing_failures"] += 1
            self.logger.error(f"PDF extraction failed for {pdf_path}: {e}")
            raise
    
    def _construct_verdict(
        self, 
        evaluation_result: Dict[str, Any], 
        policy_summary: PolicySummary,
        invoice_summary: InvoiceSummary,
        start_time: float,
        claim_id: str
    ) -> AgentVerdict:
        """Construct AgentVerdict from LLM evaluation result"""
        
        # Convert string verdict to enum
        verdict_type = VerdictType(evaluation_result["verdict"])
        
        # Convert supporting reasons to CoverageReason objects
        supporting_reasons = [
            CoverageReason(**reason) for reason in evaluation_result["supporting_reasons"]
        ]
        
        return AgentVerdict(
            agent_id=self.agent_id,
            agent_type=self.agent_type,
            verdict=verdict_type,
            coverage_amount=evaluation_result.get("coverage_amount"),
            primary_reason=evaluation_result["primary_reason"],
            supporting_reasons=supporting_reasons,
            policy_summary=policy_summary,
            invoice_summary=invoice_summary,
            ambiguity_detected=evaluation_result["ambiguity_detected"],
            ambiguous_clauses=evaluation_result.get("ambiguous_clauses"),
            requires_human_review=evaluation_result["requires_human_review"],
            review_reasons=evaluation_result.get("review_reasons"),
            processing_time_ms=int((time.time() - start_time) * 1000),
            execution_context=self._create_execution_context(self.llm_adapter.model_name)
        )
    
    def _update_performance_metrics(self, processing_time: float):
        """Update performance metrics for ASI monitoring"""
        current_avg = self.performance_metrics["average_processing_time"]
        total_evals = self.performance_metrics["successful_evaluations"]
        
        # Calculate rolling average
        new_avg = ((current_avg * (total_evals - 1)) + processing_time) / total_evals
        self.performance_metrics["average_processing_time"] = new_avg
        
        # Log metrics periodically
        if total_evals % 10 == 0:
            self.logger.info(f"Performance metrics: {self.performance_metrics}")
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for ASI monitoring dashboard"""
        return self.performance_metrics.copy()
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for ASI monitoring"""
        llm_healthy = await self.llm_adapter.health_check()
        
        return {
            "agent_id": self.agent_id,
            "agent_address": self.get_agent_address(),
            "llm_backend": self.llm_adapter.model_name,
            "llm_healthy": llm_healthy,
            "performance_metrics": self.get_performance_metrics(),
            "status": "healthy" if llm_healthy else "degraded"
        }
    
    def swap_llm_adapter(self, new_adapter: LLMAdapter):
        """
        Swap LLM adapter for multi-agent consensus or fallback scenarios
        Enables runtime switching between Claude, GPT-4, local models, etc.
        """
        old_model = self.llm_adapter.model_name
        self.llm_adapter = new_adapter
        
        # Inject logger into new adapter
        if hasattr(new_adapter, 'set_logger'):
            new_adapter.set_logger(self.logger)
            
        self.performance_metrics["model_name"] = new_adapter.model_name
        
        self.logger.info(f"LLM adapter changed from {old_model} to {new_adapter.model_name}")
        
    def get_current_llm_model(self) -> str:
        """Get current LLM model name for consensus coordination"""
        return self.llm_adapter.model_name