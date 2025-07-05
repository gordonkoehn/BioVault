"""
Base agent class for insurance claim evaluation
"""
import os
import time
import json
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from uagents import Agent, Context, Model
from uagents.setup import fund_agent_if_low
import base64

from schemas import (
    AgentVerdict, VerdictType, CoverageReason, 
    PolicySummary, InvoiceSummary, ExecutionContext,
    AgentSignature, ClaimEvaluationRequest
)


class BaseEvaluationAgent(ABC):
    """Abstract base class for all evaluation agents"""
    
    def __init__(
        self, 
        agent_id: str,
        agent_type: str,
        seed_phrase: str,
        endpoint: str,
        port: int,
        keys_dir: str = "./agent_keys",
        max_workers: int = 4,
        walrus_vault_path: Optional[str] = None
    ):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.agent_version = "1.0.0"
        self.execution_environment = os.getenv("EXECUTION_ENVIRONMENT", "asi_sgx_node_v1")
        self.keys_dir = Path(keys_dir)
        self.keys_dir.mkdir(exist_ok=True, mode=0o700)  # Secure directory permissions
        
        # Configurable Walrus vault path
        self.allowed_base = Path(
            walrus_vault_path or os.getenv("WALRUS_VAULT_PATH", "/tmp/walrus_vault")
        ).resolve()
        
        # Thread pool for CPU-bound operations
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Initialize uAgent
        self.agent = Agent(
            name=agent_id,
            seed=seed_phrase,
            endpoint=[f"{endpoint}:{port}"],
            port=port
        )
        
        # Setup logging with proper configuration
        self.logger = self._setup_logging()
        
        # Note: ASI native signing will be used via uAgent's built-in identity
        self.logger.info(f"Agent address: {self.agent.address}")
        
        # Setup handlers
        self._setup_handlers()
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging with proper handlers and formatting"""
        logger = logging.getLogger(f"agent.{self.agent_id}")
        
        # Only configure if no handlers exist
        if not logger.hasHandlers():
            # Console handler
            console_handler = logging.StreamHandler()
            console_formatter = logging.Formatter(
                '[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            console_handler.setFormatter(console_formatter)
            logger.addHandler(console_handler)
            
            # File handler for agent-specific logs
            log_dir = Path("./logs")
            log_dir.mkdir(exist_ok=True)
            file_handler = logging.FileHandler(
                log_dir / f"{self.agent_id}.log",
                mode='a'
            )
            file_formatter = logging.Formatter(
                '[%(asctime)s] [%(levelname)s] %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            file_handler.setFormatter(file_formatter)
            logger.addHandler(file_handler)
            
            # Set log level from environment or default to INFO
            log_level = os.getenv("LOG_LEVEL", "INFO")
            logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        return logger
        
    def _validate_inputs(self, policy_path: str, invoice_path: str, decryption_key: str) -> Tuple[bool, Optional[str]]:
        """Validate and sanitize inputs"""
        try:
            # Validate paths
            policy_path_obj = Path(policy_path).resolve()
            invoice_path_obj = Path(invoice_path).resolve()
            
            # Check for directory traversal
            if not str(policy_path_obj).startswith(str(self.allowed_base)):
                return False, f"Policy path outside allowed directory: {self.allowed_base}"
            if not str(invoice_path_obj).startswith(str(self.allowed_base)):
                return False, f"Invoice path outside allowed directory: {self.allowed_base}"
            
            # Check file existence
            if not policy_path_obj.exists():
                return False, "Policy file does not exist"
            if not invoice_path_obj.exists():
                return False, "Invoice file does not exist"
            
            # Check file extensions
            if not policy_path_obj.suffix.lower() == '.pdf':
                return False, "Policy file must be PDF"
            if not invoice_path_obj.suffix.lower() == '.pdf':
                return False, "Invoice file must be PDF"
            
            # Validate decryption key format (basic check)
            if not decryption_key or len(decryption_key) < 32:
                return False, "Invalid decryption key format"
            
            # Check file sizes (prevent DoS)
            max_file_size = 50 * 1024 * 1024  # 50MB
            if policy_path_obj.stat().st_size > max_file_size:
                return False, "Policy file too large"
            if invoice_path_obj.stat().st_size > max_file_size:
                return False, "Invoice file too large"
            
            return True, None
            
        except Exception as e:
            return False, f"Input validation error: {str(e)}"
        
    def _setup_handlers(self):
        """Setup message handlers for the agent"""
        
        @self.agent.on_message(model=ClaimEvaluationRequest)
        async def handle_evaluation_request(ctx: Context, sender: str, msg: ClaimEvaluationRequest):
            """Handle incoming claim evaluation requests"""
            start_time = time.time()
            ctx.logger.info(f"Received evaluation request for claim {msg.claim_id} from {sender}")
            
            try:
                # Validate inputs first
                is_valid, error_msg = self._validate_inputs(
                    msg.policy_pdf_path,
                    msg.invoice_pdf_path,
                    msg.decryption_key
                )
                
                if not is_valid:
                    ctx.logger.error(f"Input validation failed for claim {msg.claim_id}: {error_msg}")
                    error_verdict = self._create_error_verdict(msg.claim_id, error_msg)
                    await ctx.send(sender, error_verdict)
                    return
                
                # Process the claim
                verdict = await self.evaluate_claim(
                    msg.policy_pdf_path,
                    msg.invoice_pdf_path,
                    msg.decryption_key,
                    msg.claim_id
                )
                
                # Add processing time
                verdict.processing_time_ms = int((time.time() - start_time) * 1000)
                
                # Sign the verdict using ASI native signing
                verdict.signature = self.sign_verdict_asi_native(verdict)
                
                # Send verdict back
                await ctx.send(sender, verdict)
                ctx.logger.info(
                    f"Sent verdict for claim {msg.claim_id} - "
                    f"Decision: {verdict.verdict}, Time: {verdict.processing_time_ms}ms"
                )
                
            except Exception as e:
                ctx.logger.error(f"Error processing claim {msg.claim_id}: {str(e)}", exc_info=True)
                # Create error verdict
                error_verdict = self._create_error_verdict(msg.claim_id, str(e))
                error_verdict.processing_time_ms = int((time.time() - start_time) * 1000)
                await ctx.send(sender, error_verdict)
    
    @abstractmethod
    async def evaluate_claim(
        self, 
        policy_path: str, 
        invoice_path: str,
        decryption_key: str,
        claim_id: str
    ) -> AgentVerdict:
        """
        Evaluate an insurance claim against a policy
        Must be implemented by concrete agent classes
        """
        pass
    
    @abstractmethod
    async def extract_policy_data(self, policy_pdf_path: str, decryption_key: str) -> PolicySummary:
        """Extract structured data from policy PDF"""
        pass
    
    @abstractmethod
    async def extract_invoice_data(self, invoice_pdf_path: str, decryption_key: str) -> InvoiceSummary:
        """Extract structured data from invoice PDF"""
        pass
    
    async def run_in_executor(self, func, *args):
        """Run CPU-bound operations in thread executor to avoid blocking event loop"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self.executor, func, *args)
    
    def sign_verdict_asi_native(self, verdict: AgentVerdict, message_id: str = None) -> AgentSignature:
        """
        Sign the verdict using ASI native signing mechanisms with proper hashing
        Production implementation following Agentverse signing conventions
        """
        import hashlib
        
        # Validate wallet funding before signing (Agentverse requirement)
        try:
            if hasattr(self.agent.wallet, 'is_funded') and not self.agent.wallet.is_funded():
                raise RuntimeError("Wallet not funded for signing - please fund wallet for Agentverse operations")
        except AttributeError:
            # Wallet doesn't have is_funded method, continue with signing
            self.logger.debug("Wallet funding check not available, proceeding with signing")
        
        # Select fields to sign (deterministic order for consistent signatures)
        signed_fields = [
            "agent_id", "agent_type", "timestamp", "verdict", 
            "coverage_amount", "primary_reason"
        ]
        
        # Include message_id for replay protection if provided
        if message_id:
            signed_fields.append("message_id")
        
        # Create signing payload with deterministic serialization
        payload = {}
        for field in signed_fields:
            if field == "message_id" and message_id:
                payload[field] = message_id
            elif hasattr(verdict, field):
                value = getattr(verdict, field)
                # Convert datetime to ISO format with millisecond precision
                if isinstance(value, datetime):
                    value = value.isoformat(timespec="milliseconds")
                # Convert Enum to string
                elif hasattr(value, 'value'):
                    value = value.value
                payload[field] = value
        
        # Deterministic JSON serialization for consistent signatures
        payload_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        
        try:
            # Hash the payload with SHA256 matching Agentverse convention
            payload_hash = hashlib.sha256(payload_json.encode('utf-8')).digest()
            
            # Use uAgent's built-in wallet signing on the hash
            signature_bytes = self.agent.wallet.sign(payload_hash)
            
            # Convert signature to hex string for storage
            signature_hex = signature_bytes.hex()
            
            self.logger.debug(f"Signed verdict hash with ASI wallet: {self.agent.wallet.address()}")
            
            return AgentSignature(
                value=signature_hex,
                algorithm="secp256k1",  
                signed_fields=signed_fields,
                signer_address=self.agent.wallet.address()  # Include wallet address for verification
            )
            
        except Exception as e:
            self.logger.error(f"ASI native signing failed: {e}")
            # Fallback to deterministic placeholder for testing
            fallback_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()[:12]
            return AgentSignature(
                value=f"SIGNING_ERROR_{fallback_hash}",
                algorithm="secp256k1_fallback",
                signed_fields=signed_fields,
                signer_address=getattr(self.agent.wallet, 'address', lambda: 'unknown_wallet')()
            )
    
    def _create_execution_context(self, model_version: str) -> ExecutionContext:
        """Create execution context for audit trail"""
        return ExecutionContext(
            agent_version=self.agent_version,
            model_version=model_version,
            execution_environment=self.execution_environment,
            attestation_proof=None  # TODO: Implement TEE attestation
        )
    
    def _create_error_verdict(self, claim_id: str, error_message: str) -> AgentVerdict:
        """Create an error verdict when processing fails"""
        return AgentVerdict(
            agent_id=self.agent_id,
            agent_type=self.agent_type,
            verdict=VerdictType.REQUIRES_REVIEW,
            primary_reason=f"Error processing claim: {error_message}",
            supporting_reasons=[],
            policy_summary=PolicySummary(
                policy_number="ERROR",
                coverage_type="unknown",
                annual_limit=0,
                exclusions=[],
                covered_services=[],
                effective_dates={"start": "", "end": ""}
            ),
            invoice_summary=InvoiceSummary(
                invoice_number="ERROR",
                service_type="unknown",
                amount=0,
                service_date="",
                provider_id="unknown"
            ),
            ambiguity_detected=True,
            requires_human_review=True,
            review_reasons=[error_message],
            processing_time_ms=0,
            execution_context=self._create_execution_context("error")
        )
    
    async def run(self):
        """Run the agent"""
        self.logger.info(f"Starting agent {self.agent_id} on {self.agent.address}")
        try:
            await self.agent.run()
        except Exception as e:
            self.logger.error(f"Agent runtime error: {e}", exc_info=True)
            raise
        finally:
            # Cleanup thread pool
            self.logger.info("Shutting down thread pool executor")
            self.executor.shutdown(wait=True)
    
    def get_agent_address(self) -> str:
        """Get the agent's ASI address for identity verification"""
        return str(self.agent.address)
    
    def __del__(self):
        """Cleanup when agent is destroyed"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)