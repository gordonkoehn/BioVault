"""
Message models for uAgents distributed communication
Ensures proper JSON serialization, error handling, deduplication, and versioning
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import hashlib
import uuid


# Global schema version for all messages
SCHEMA_VERSION = "1.0.0"


def generate_nonce() -> str:
    """Generate unique nonce for message deduplication"""
    return str(uuid.uuid4())


def generate_message_id(prefix: str) -> str:
    """Generate unique message ID"""
    timestamp = datetime.utcnow().timestamp()
    return f"{prefix}_{timestamp}_{generate_nonce()[:8]}"


class BaseMessage(BaseModel):
    """Base class for all uAgents messages with versioning and deduplication"""
    schema_version: str = Field(default=SCHEMA_VERSION, description="Global schema version")
    message_id: str = Field(description="Unique message identifier")
    nonce: str = Field(default_factory=generate_nonce, description="Deduplication key")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class SimpleVerdictMessage(BaseModel):
    """Simplified verdict message for uAgents serialization"""
    agent_id: str
    verdict: str  # COVERED, NOT_COVERED, PARTIAL_COVERAGE, REQUIRES_REVIEW
    coverage_amount: Optional[float] = None
    primary_reason: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    requires_human_review: bool
    processing_time_ms: int
    model_name: str
    timestamp: datetime

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ClaimEvaluationMessage(BaseMessage):
    """Message for requesting claim evaluation from agents"""
    claim_id: str
    policy_path: str
    invoice_path: str
    decryption_key: str
    requester_address: str
    timeout_seconds: int = 120
    message_id: str = Field(default_factory=lambda: generate_message_id("eval"))


class VerdictResponseMessage(BaseMessage):
    """Response message containing agent verdict"""
    claim_id: str
    request_message_id: str  # Original request message ID
    verdict: SimpleVerdictMessage
    success: bool
    error_message: Optional[str] = None
    error_type: Optional[str] = None  # TimeoutError, ValidationError, etc.
    agent_address: str
    message_id: str = Field(default_factory=lambda: generate_message_id("verdict"))


class ConsensusRequestMessage(BaseMessage):
    """Message for requesting consensus evaluation"""
    claim_id: str
    policy_path: str
    invoice_path: str
    decryption_key: str
    requester_address: str
    consensus_threshold: float = 1.0
    agent_timeout: int = 120
    message_id: str = Field(default_factory=lambda: generate_message_id("consensus"))


class SimpleConsensusResult(BaseModel):
    """Simplified consensus result for uAgents"""
    claim_id: str
    unanimous_verdict: Optional[str] = None  # Final consensus verdict
    agreement_ratio: float = Field(ge=0.0, le=1.0)
    agent_verdicts: List[SimpleVerdictMessage]
    dissenting_agents: List[str] = Field(default_factory=list)
    consensus_coverage_amount: Optional[float] = None
    processing_time_ms: int
    evaluation_timestamp: datetime

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ConsensusResponseMessage(BaseMessage):
    """Response message containing consensus result"""
    claim_id: str
    request_message_id: str  # Original request message ID
    consensus_result: SimpleConsensusResult
    success: bool
    error_message: Optional[str] = None
    error_type: Optional[str] = None
    orchestrator_address: str
    message_id: str = Field(default_factory=lambda: generate_message_id("consensus_resp"))


class HealthCheckMessage(BaseMessage):
    """Async health check request message"""
    requester_address: str
    check_type: str = "health_check"
    timeout_seconds: int = 10
    message_id: str = Field(default_factory=lambda: generate_message_id("health"))


class HealthResponseMessage(BaseMessage):
    """Async health check response"""
    agent_id: str
    agent_address: str
    request_message_id: str  # Original health check message ID
    status: str  # healthy, degraded, unhealthy
    llm_backend: str
    last_evaluation_time: Optional[datetime] = None
    total_evaluations: int = 0
    error_rate: float = 0.0
    message_id: str = Field(default_factory=lambda: generate_message_id("health_resp"))


class AgentRegistrationMessage(BaseMessage):
    """Message for agent registration with orchestrator"""
    agent_id: str
    agent_address: str
    agent_type: str
    llm_backend: str
    capabilities: List[str] = Field(default_factory=list)
    max_concurrent_evaluations: int = 1
    discovery_version: str = "1.0.0"
    message_id: str = Field(default_factory=lambda: generate_message_id("register"))


class AgentDiscoveryMessage(BaseMessage):
    """Message for discovering available agents via uAgents broadcast"""
    requester_address: str
    required_capabilities: List[str] = Field(default_factory=list)
    discovery_version: str = "1.0.0"
    timeout_seconds: int = 30
    message_id: str = Field(default_factory=lambda: generate_message_id("discovery"))


class AgentListMessage(BaseMessage):
    """Response with list of available agents"""
    agents: List[AgentRegistrationMessage]
    total_agents: int
    orchestrator_address: str
    request_message_id: str  # Original discovery message ID
    message_id: str = Field(default_factory=lambda: generate_message_id("agent_list"))


class AgentPingMessage(BaseMessage):
    """Lightweight ping for network connectivity"""
    requester_address: str
    message_id: str = Field(default_factory=lambda: generate_message_id("ping"))


class AgentPongMessage(BaseMessage):
    """Pong response for connectivity check"""
    responder_address: str
    request_message_id: str  # Original ping message ID
    ping_timestamp: datetime
    round_trip_ms: Optional[int] = None
    message_id: str = Field(default_factory=lambda: generate_message_id("pong"))


# Message deduplication manager
class MessageDeduplicator:
    """Manages message deduplication using nonce tracking"""
    
    def __init__(self, max_cache_size: int = 10000):
        self.seen_nonces: set = set()
        self.max_cache_size = max_cache_size
    
    def is_duplicate(self, message: BaseMessage) -> bool:
        """Check if message is a duplicate based on nonce"""
        if message.nonce in self.seen_nonces:
            return True
        
        # Add to cache and manage size
        self.seen_nonces.add(message.nonce)
        if len(self.seen_nonces) > self.max_cache_size:
            # Remove oldest 20% of entries (simple FIFO approximation)
            oldest_nonces = list(self.seen_nonces)[:int(self.max_cache_size * 0.2)]
            for nonce in oldest_nonces:
                self.seen_nonces.discard(nonce)
        
        return False
    
    def mark_processed(self, nonce: str):
        """Explicitly mark a nonce as processed"""
        self.seen_nonces.add(nonce)


# Message type registry for uAgents protocol handling
MESSAGE_TYPES = {
    "claim_evaluation": ClaimEvaluationMessage,
    "verdict_response": VerdictResponseMessage,
    "consensus_request": ConsensusRequestMessage,
    "consensus_response": ConsensusResponseMessage,
    "health_check": HealthCheckMessage,
    "health_response": HealthResponseMessage,
    "agent_registration": AgentRegistrationMessage,
    "agent_discovery": AgentDiscoveryMessage,
    "agent_list": AgentListMessage,
    "agent_ping": AgentPingMessage,
    "agent_pong": AgentPongMessage,
}


def serialize_for_uagents(message: BaseMessage) -> Dict[str, Any]:
    """Serialize Pydantic model for uAgents messaging"""
    return message.dict()


def deserialize_from_uagents(data: Dict[str, Any], message_type: str) -> BaseMessage:
    """Deserialize uAgents message to Pydantic model with version checking"""
    if message_type not in MESSAGE_TYPES:
        raise ValueError(f"Unknown message type: {message_type}")
    
    # Check schema version compatibility
    schema_version = data.get("schema_version", "unknown")
    if schema_version != SCHEMA_VERSION:
        # Could implement backward compatibility logic here
        raise ValueError(f"Incompatible schema version: {schema_version}, expected: {SCHEMA_VERSION}")
    
    message_class = MESSAGE_TYPES[message_type]
    return message_class(**data)


def create_error_response(request_message: BaseMessage, error_type: str, error_message: str) -> BaseMessage:
    """Create standardized error response for any request message"""
    
    error_data = {
        "request_message_id": request_message.message_id,
        "success": False,
        "error_type": error_type,
        "error_message": error_message,
        "agent_address": "unknown"
    }
    
    # Determine response type based on request
    if isinstance(request_message, ClaimEvaluationMessage):
        error_data["claim_id"] = request_message.claim_id
        error_data["verdict"] = None
        return VerdictResponseMessage(**error_data)
    
    elif isinstance(request_message, ConsensusRequestMessage):
        error_data["claim_id"] = request_message.claim_id
        error_data["consensus_result"] = None
        error_data["orchestrator_address"] = "unknown"
        return ConsensusResponseMessage(**error_data)
    
    elif isinstance(request_message, HealthCheckMessage):
        error_data["agent_id"] = "unknown"
        error_data["status"] = "unhealthy"
        error_data["llm_backend"] = "unknown"
        return HealthResponseMessage(**error_data)
    
    else:
        raise ValueError(f"No error response type defined for {type(request_message)}")


# Global deduplicator instance
message_deduplicator = MessageDeduplicator()