"""
Structured JSON schemas for agent verdicts and communications
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from enum import Enum


class VerdictType(str, Enum):
    """Possible verdict types for insurance claim evaluation"""
    COVERED = "COVERED"
    NOT_COVERED = "NOT_COVERED"
    PARTIAL_COVERAGE = "PARTIAL_COVERAGE"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class CoverageReason(BaseModel):
    """Individual reason supporting the coverage decision"""
    clause_reference: Optional[str] = Field(
        None, 
        description="Reference to specific policy clause (e.g., 'Section 3.2.1')"
    )
    explanation: str = Field(
        ..., 
        description="Clear explanation of how this clause applies"
    )
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Confidence score for this reasoning (0-1)"
    )


class PolicySummary(BaseModel):
    """Structured summary of insurance policy details"""
    policy_number: str = Field(..., description="Unique policy identifier")
    coverage_type: str = Field(..., description="Type of coverage (e.g., 'comprehensive_health')")
    annual_limit: float = Field(..., description="Annual coverage limit in currency units")
    deductible: Optional[float] = Field(None, description="Annual deductible amount")
    copay_percentage: Optional[float] = Field(None, description="Copay percentage (0-100)")
    exclusions: List[str] = Field(default_factory=list, description="List of exclusion categories")
    covered_services: List[str] = Field(default_factory=list, description="List of covered service types")
    effective_dates: Dict[str, str] = Field(
        ..., 
        description="Policy effective dates",
        example={"start": "2024-01-01", "end": "2024-12-31"}
    )
    special_conditions: Optional[List[str]] = Field(
        None, 
        description="Any special conditions or riders"
    )


class InvoiceSummary(BaseModel):
    """Structured summary of invoice/claim details"""
    invoice_number: str = Field(..., description="Unique invoice identifier")
    service_type: str = Field(..., description="Type of service provided")
    amount: float = Field(..., description="Total invoice amount")
    service_date: str = Field(..., description="Date service was provided (ISO format)")
    provider_id: str = Field(..., description="Healthcare provider identifier")
    provider_name: Optional[str] = Field(None, description="Healthcare provider name")
    diagnosis_codes: Optional[List[str]] = Field(None, description="ICD-10 or similar diagnosis codes")
    procedure_codes: Optional[List[str]] = Field(None, description="CPT or similar procedure codes")
    itemized_charges: Optional[Dict[str, float]] = Field(
        None, 
        description="Breakdown of charges by service"
    )


class AgentSignature(BaseModel):
    """Enhanced signature for agent registry verification with Agentverse compatibility"""
    value: str = Field(..., description="Hex encoded signature")
    algorithm: str = Field(..., description="Signature algorithm (e.g., 'secp256k1')")
    signed_fields: List[str] = Field(
        ..., 
        description="List of fields included in signature"
    )
    signer_address: str = Field(..., description="Wallet address of the signing agent")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, 
        description="When the signature was created (for replay protection)"
    )
    
class ExecutionContext(BaseModel):
    """Execution environment and versioning information"""
    agent_version: str = Field(..., description="Agent software version")
    model_version: str = Field(..., description="LLM model version used")
    execution_environment: str = Field(
        ..., 
        description="Execution environment (e.g., 'asi_sgx_node_v1')"
    )
    attestation_proof: Optional[str] = Field(
        None, 
        description="TEE attestation proof if applicable"
    )


class AgentVerdict(BaseModel):
    """Structured output format for individual agent decisions"""
    agent_id: str = Field(..., description="Unique identifier for the agent (registered in ASI Agentverse)")
    agent_type: str = Field(..., description="Type of agent (e.g., 'claude_nlp', 'gpt4_nlp')")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Core verdict
    verdict: VerdictType = Field(..., description="Coverage decision")
    coverage_amount: Optional[float] = Field(
        None, 
        description="Covered amount if applicable"
    )
    
    # Reasoning
    primary_reason: str = Field(
        ..., 
        description="Main reason for the verdict in plain language"
    )
    supporting_reasons: List[CoverageReason] = Field(
        default_factory=list,
        description="Detailed reasons with policy references"
    )
    
    # Structured context
    policy_summary: PolicySummary = Field(
        ..., 
        description="Structured policy details relevant to the claim"
    )
    invoice_summary: InvoiceSummary = Field(
        ..., 
        description="Structured invoice/claim details analyzed"
    )
    
    # Flags and metadata
    ambiguity_detected: bool = Field(
        False, 
        description="Whether policy language was ambiguous"
    )
    ambiguous_clauses: Optional[List[str]] = Field(
        None,
        description="Specific clauses that were ambiguous"
    )
    requires_human_review: bool = Field(
        False, 
        description="Whether human review is recommended"
    )
    review_reasons: Optional[List[str]] = Field(
        None,
        description="Reasons for recommending human review"
    )
    processing_time_ms: int = Field(
        ..., 
        description="Time taken to process in milliseconds"
    )
    
    # Security and auditability
    signature: Optional[AgentSignature] = Field(
        None, 
        description="Cryptographic signature of the verdict"
    )
    execution_context: ExecutionContext = Field(
        ...,
        description="Execution environment details for auditability"
    )
    
    @validator('coverage_amount')
    def validate_coverage_amount(cls, v, values):
        """Ensure coverage_amount is provided for PARTIAL_COVERAGE verdicts"""
        if 'verdict' in values and values['verdict'] == VerdictType.PARTIAL_COVERAGE:
            if v is None:
                raise ValueError('coverage_amount is required when verdict is PARTIAL_COVERAGE')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "agent_id": "agent_claude_001",
                "agent_type": "claude_nlp",
                "verdict": "COVERED",
                "coverage_amount": 850.00,
                "primary_reason": "Dental cleaning is covered under preventive care",
                "supporting_reasons": [
                    {
                        "clause_reference": "Section 4.1 - Preventive Care",
                        "explanation": "Policy explicitly covers routine dental cleanings twice per year",
                        "confidence": 0.95
                    }
                ],
                "policy_summary": {
                    "policy_number": "POL-123456",
                    "coverage_type": "comprehensive_health",
                    "annual_limit": 50000,
                    "deductible": 1000,
                    "copay_percentage": 20,
                    "exclusions": ["cosmetic_procedures", "experimental_treatments"],
                    "covered_services": ["preventive_care", "emergency_care", "hospitalization"],
                    "effective_dates": {"start": "2024-01-01", "end": "2024-12-31"}
                },
                "invoice_summary": {
                    "invoice_number": "INV-789",
                    "service_type": "dental_cleaning",
                    "amount": 850.00,
                    "service_date": "2024-01-15",
                    "provider_id": "DEN-456",
                    "provider_name": "SmileCare Dental",
                    "procedure_codes": ["D1110"]
                },
                "ambiguity_detected": False,
                "requires_human_review": False,
                "processing_time_ms": 1250,
                "execution_context": {
                    "agent_version": "1.0.0",
                    "model_version": "claude-3-opus-20240229",
                    "execution_environment": "asi_sgx_node_v1"
                }
            }
        }


class ConsensusResult(BaseModel):
    """
    Result of consensus evaluation across multiple agents.
    Note: has_consensus is computed dynamically by the consensus engine based on
    agreement_ratio and consensus_threshold, not stored in this schema.
    """
    consensus_id: str = Field(..., description="Unique ID for this consensus evaluation")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Individual verdicts
    agent_verdicts: List[AgentVerdict] = Field(
        ..., 
        description="All individual agent verdicts"
    )
    
    # Consensus metrics (has_consensus computed by business logic)
    agreement_ratio: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Fraction of agents agreeing on the verdict (0.0-1.0)"
    )
    consensus_threshold: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Required agreement ratio for consensus (default 1.0 for MVP)"
    )
    final_verdict: Optional[VerdictType] = Field(
        None, 
        description="Final verdict if consensus reached (null if no consensus)"
    )
    consensus_confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Overall confidence in the consensus"
    )
    
    # Detailed agreement analysis
    verdict_distribution: Dict[str, int] = Field(
        ...,
        description="Count of agents per verdict type"
    )
    dissenting_agents: List[str] = Field(
        default_factory=list,
        description="Agent IDs that disagreed with the majority verdict"
    )
    dissent_reasons: Optional[Dict[str, str]] = Field(
        None,
        description="Primary reasons from dissenting agents"
    )
    
    # Aggregated data
    coverage_amounts: List[float] = Field(
        default_factory=list,
        description="All proposed coverage amounts"
    )
    average_coverage_amount: Optional[float] = Field(
        None,
        description="Average of all proposed coverage amounts"
    )
    coverage_amount_variance: Optional[float] = Field(
        None,
        description="Variance in proposed coverage amounts"
    )
    average_processing_time_ms: float = Field(
        ..., 
        description="Average processing time across agents"
    )
    
    # Audit trail
    consensus_algorithm: str = Field(
        default="flat_unanimous",
        description="Algorithm used for consensus (e.g., 'flat_unanimous', 'weighted_majority')"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "consensus_id": "consensus_123",
                "agreement_ratio": 1.0,
                "consensus_threshold": 1.0,
                "final_verdict": "COVERED",
                "consensus_confidence": 0.92,
                "verdict_distribution": {"COVERED": 2, "NOT_COVERED": 0},
                "dissenting_agents": [],
                "coverage_amounts": [850.00, 850.00],
                "average_coverage_amount": 850.00,
                "coverage_amount_variance": 0.0,
                "average_processing_time_ms": 1375.5,
                "consensus_algorithm": "flat_unanimous",
                "agent_verdicts": ["... list of AgentVerdict objects ..."]
            }
        }


class ClaimEvaluationRequest(BaseModel):
    """Request format for claim evaluation"""
    claim_id: str = Field(..., description="Unique claim identifier")
    policy_pdf_path: str = Field(..., description="Path to encrypted policy PDF")
    invoice_pdf_path: str = Field(..., description="Path to encrypted invoice PDF")
    decryption_key: str = Field(..., description="Key to decrypt the documents")
    requester_id: str = Field(..., description="ID of the requesting entity")
    consensus_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Override default consensus threshold (MVP default is 1.0)"
    )
    

class ClaimEvaluationResponse(BaseModel):
    """Response format for claim evaluation - supports both single agent and consensus responses"""
    claim_id: str
    agent_verdict: Optional[AgentVerdict] = Field(
        None,
        description="Single agent verdict (for individual agent responses)"
    )
    consensus_result: Optional[ConsensusResult] = Field(
        None,
        description="Consensus result (for orchestrator responses)"
    )
    success: bool = Field(
        default=True,
        description="Whether the evaluation was successful"
    )
    error_message: Optional[str] = Field(
        None,
        description="Error message if evaluation failed"
    )
    proof_of_evaluation: Optional[str] = Field(
        None,
        description="Cryptographic proof of the evaluation"
    )
    proof_algorithm: str = Field(
        default="aggregate_signatures",
        description="Algorithm used for proof generation"
    )
    insurer_notification_sent: bool = Field(
        False,
        description="Whether insurer has been notified"
    )
    notification_timestamp: Optional[datetime] = Field(
        None,
        description="When insurer was notified"
    )