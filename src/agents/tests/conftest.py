"""
Pytest configuration and shared fixtures for Bio Vault agent testing
Enhanced with signature verification, message tracking, and parametrized tests
"""
import pytest
import asyncio
import tempfile
import os
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Tuple

from src.agents.schemas import (
    PolicySummary, InvoiceSummary, AgentVerdict, VerdictType,
    CoverageReason, AgentSignature, ExecutionContext
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_policy_data():
    """Sample policy data for testing"""
    return {
        "policy_number": "POL-2024-001",
        "coverage_type": "comprehensive_health",
        "annual_limit": 50000.0,
        "deductible": 1000.0,
        "copay_percentage": 20.0,
        "exclusions": ["cosmetic_surgery", "experimental_treatments"],
        "covered_services": ["routine_checkup", "emergency_care", "dental_cleaning"],
        "effective_dates": {"start": "2024-01-01", "end": "2024-12-31"},
        "special_conditions": ["pre_approval_required_for_surgery"]
    }


@pytest.fixture
def sample_invoice_data():
    """Sample invoice data for testing"""
    return {
        "invoice_number": "INV-2024-001",
        "service_type": "routine_checkup",
        "amount": 250.0,
        "service_date": "2024-03-15",
        "provider_id": "PROV-12345",
        "provider_name": "City Health Clinic",
        "diagnosis_codes": ["Z00.00"],
        "procedure_codes": ["99213"],
        "itemized_charges": {"consultation": 150.0, "lab_work": 100.0}
    }


@pytest.fixture
def sample_policy_summary(sample_policy_data):
    """Create PolicySummary from sample data"""
    return PolicySummary(**sample_policy_data)


@pytest.fixture
def sample_invoice_summary(sample_invoice_data):
    """Create InvoiceSummary from sample data"""
    return InvoiceSummary(**sample_invoice_data)


@pytest.fixture
def sample_agent_verdict(sample_policy_summary, sample_invoice_summary):
    """Create sample AgentVerdict for testing"""
    return AgentVerdict(
        agent_id="test_agent_001",
        agent_type="nlp_policy",
        verdict=VerdictType.COVERED,
        coverage_amount=200.0,  # After deductible and copay
        primary_reason="Routine checkup is covered under policy",
        supporting_reasons=[
            CoverageReason(
                clause_reference="Section 3.1",
                explanation="Routine checkups are explicitly covered",
                confidence=0.95
            )
        ],
        policy_summary=sample_policy_summary,
        invoice_summary=sample_invoice_summary,
        ambiguity_detected=False,
        requires_human_review=False,
        processing_time_ms=1500,
        execution_context=ExecutionContext(
            agent_version="1.0.0",
            model_version="claude-3-opus",
            execution_environment="test_environment",
            attestation_proof=None
        )
    )


@pytest.fixture
def temp_pdf_files():
    """Create temporary PDF files for testing"""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create dummy PDF content (minimal valid PDF)
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Sample Policy) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000104 00000 n 
0000000178 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
269
%%EOF"""
        
        policy_path = os.path.join(temp_dir, "test_policy.pdf")
        invoice_path = os.path.join(temp_dir, "test_invoice.pdf")
        
        with open(policy_path, "wb") as f:
            f.write(pdf_content)
        with open(invoice_path, "wb") as f:
            f.write(pdf_content.replace(b"Sample Policy", b"Sample Invoice"))
        
        yield {"policy_path": policy_path, "invoice_path": invoice_path}


@pytest.fixture
def mock_llm_responses():
    """Mock LLM API responses for testing"""
    return {
        "policy_extraction": {
            "policy_number": "POL-2024-001",
            "coverage_type": "comprehensive_health",
            "annual_limit": 50000,
            "deductible": 1000,
            "copay_percentage": 20,
            "exclusions": ["cosmetic_surgery"],
            "covered_services": ["routine_checkup", "emergency_care"],
            "effective_dates": {"start": "2024-01-01", "end": "2024-12-31"},
            "special_conditions": None
        },
        "invoice_extraction": {
            "invoice_number": "INV-2024-001",
            "service_type": "routine_checkup", 
            "amount": 250,
            "service_date": "2024-03-15",
            "provider_id": "PROV-12345",
            "provider_name": "City Health Clinic",
            "diagnosis_codes": ["Z00.00"],
            "procedure_codes": ["99213"],
            "itemized_charges": {"consultation": 150, "lab_work": 100}
        },
        "claim_evaluation": {
            "verdict": "COVERED",
            "coverage_amount": 200,
            "primary_reason": "Routine checkup is covered",
            "supporting_reasons": [
                {
                    "clause_reference": "Section 3.1",
                    "explanation": "Routine checkups are covered",
                    "confidence": 0.95
                }
            ],
            "ambiguity_detected": False,
            "ambiguous_clauses": None,
            "requires_human_review": False,
            "review_reasons": None
        }
    }


class MockWallet:
    """Enhanced mock wallet with signature verification"""
    
    def __init__(self, wallet_id: str = "test"):
        self._address = f"wallet_{hash(wallet_id) % 100000:05d}"
        self._funded = True
        self._private_key = hashlib.sha256(wallet_id.encode()).digest()
        self._public_key = hashlib.sha256(self._private_key + b"_public").digest()
    
    def address(self) -> str:
        return self._address
    
    def is_funded(self) -> bool:
        return self._funded
    
    def set_funded(self, funded: bool):
        """Set funding status for testing"""
        self._funded = funded
    
    def sign(self, data: bytes) -> bytes:
        """Mock signing with deterministic but verifiable signature"""
        # Combine private key with data for deterministic signature
        signature_material = self._private_key + data
        return hashlib.sha256(signature_material).digest()
    
    def verify(self, data: bytes, signature: bytes) -> bool:
        """Verify signature against this wallet's private key"""
        expected_signature = self.sign(data)
        return signature == expected_signature
    
    def get_public_key(self) -> bytes:
        """Get public key for verification"""
        return self._public_key


class MockAgent:
    """Enhanced mock uAgent with message tracking"""
    
    def __init__(self, name: str, address: str = None, wallet_id: str = None):
        self.name = name
        self.address = address or f"agent1{hash(name) % 10000:04d}"
        self.wallet = MockWallet(wallet_id or name)
        self._message_handlers = {}
        self._sent_messages: List[Tuple[str, Any]] = []  # Track sent messages
        self._health_status = "healthy"
    
    def on_message(self, model):
        """Mock message handler decorator"""
        def decorator(func):
            self._message_handlers[model] = func
            return func
        return decorator
    
    async def send(self, recipient: str, message):
        """Mock send with message tracking"""
        self._sent_messages.append((recipient, message))
        # Log for debugging
        print(f"[MOCK] {self.name} -> {recipient}: {type(message).__name__}")
    
    def get_sent_messages(self) -> List[Tuple[str, Any]]:
        """Get all sent messages for testing"""
        return self._sent_messages.copy()
    
    def clear_sent_messages(self):
        """Clear sent messages for new test"""
        self._sent_messages.clear()
    
    def set_health_status(self, status: str):
        """Set health status for testing"""
        self._health_status = status
    
    def get_health_status(self) -> str:
        return self._health_status


@pytest.fixture
def mock_agent():
    """Create mock agent for testing"""
    return MockAgent("test_agent")


@pytest.fixture
def multi_mock_agents():
    """Create multiple mock agents for consensus testing"""
    return {
        "claude_agent": MockAgent("claude_agent", wallet_id="claude"),
        "gpt4_agent": MockAgent("gpt4_agent", wallet_id="gpt4"),
        "orchestrator": MockAgent("orchestrator", wallet_id="orchestrator")
    }


@pytest.fixture(params=[
    "unanimous_covered",
    "unanimous_not_covered", 
    "disagreement",
    "partial_consensus",
    "timeout_scenario",
    "mixed_confidence"
])
def consensus_scenario(request):
    """Parametrized consensus test scenarios"""
    scenarios = {
        "unanimous_covered": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.95},
                {"agent_id": "gpt4_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.93}
            ],
            "expected_consensus": True,
            "expected_verdict": "COVERED",
            "expected_coverage": 200
        },
        "unanimous_not_covered": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "NOT_COVERED", "coverage_amount": None, "confidence": 0.98},
                {"agent_id": "gpt4_agent", "verdict": "NOT_COVERED", "coverage_amount": None, "confidence": 0.96}
            ],
            "expected_consensus": True,
            "expected_verdict": "NOT_COVERED",
            "expected_coverage": None
        },
        "disagreement": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.85},
                {"agent_id": "gpt4_agent", "verdict": "NOT_COVERED", "coverage_amount": None, "confidence": 0.88}
            ],
            "expected_consensus": False,
            "expected_verdict": None,
            "expected_coverage": None
        },
        "partial_consensus": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "PARTIAL_COVERAGE", "coverage_amount": 150, "confidence": 0.90},
                {"agent_id": "gpt4_agent", "verdict": "PARTIAL_COVERAGE", "coverage_amount": 160, "confidence": 0.87}
            ],
            "expected_consensus": True,
            "expected_verdict": "PARTIAL_COVERAGE",
            "expected_coverage": 155  # Average
        },
        "timeout_scenario": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.95, "timeout": False},
                {"agent_id": "gpt4_agent", "verdict": "TIMEOUT", "coverage_amount": None, "confidence": 0.0, "timeout": True}
            ],
            "expected_consensus": False,
            "expected_verdict": None,
            "expected_coverage": None
        },
        "mixed_confidence": {
            "agents": [
                {"agent_id": "claude_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.95},
                {"agent_id": "gpt4_agent", "verdict": "COVERED", "coverage_amount": 200, "confidence": 0.60}  # Low confidence
            ],
            "expected_consensus": True,
            "expected_verdict": "COVERED", 
            "expected_coverage": 200
        }
    }
    return scenarios[request.param]


@pytest.fixture
def health_check_scenarios():
    """Health check test scenarios"""
    return {
        "all_healthy": {
            "agents": [
                {"agent_id": "claude_agent", "status": "healthy", "error_rate": 0.0},
                {"agent_id": "gpt4_agent", "status": "healthy", "error_rate": 0.0}
            ],
            "expected_overall": "healthy"
        },
        "mixed_health": {
            "agents": [
                {"agent_id": "claude_agent", "status": "healthy", "error_rate": 0.0},
                {"agent_id": "gpt4_agent", "status": "degraded", "error_rate": 0.1}
            ],
            "expected_overall": "degraded"
        },
        "unhealthy_system": {
            "agents": [
                {"agent_id": "claude_agent", "status": "unhealthy", "error_rate": 0.5},
                {"agent_id": "gpt4_agent", "status": "unhealthy", "error_rate": 0.7}
            ],
            "expected_overall": "unhealthy"
        }
    }


@pytest.fixture
def test_environment_config():
    """Test environment configuration"""
    return {
        "LOG_LEVEL": "DEBUG",
        "WALRUS_VAULT_PATH": "/tmp/test_vault",
        "AGENT_SEED": "test_agent_seed_123",
        "ORCHESTRATOR_SEED": "test_orchestrator_seed_123",
        "TEST_MODE": "true"
    }


@pytest.fixture
def signature_test_data():
    """Data for testing signature verification"""
    return {
        "valid_payload": b"test_payload_for_signing",
        "invalid_payload": b"tampered_payload",
        "test_message": "Test message for signature verification"
    }


# Import BaseEvaluationAgent for testing
from src.agents.base_agent import BaseEvaluationAgent


class TestableEvaluationAgent(BaseEvaluationAgent):
    """Concrete implementation of BaseEvaluationAgent for testing"""
    
    async def evaluate_claim(self, policy_path: str, invoice_path: str, 
                           decryption_key: str, claim_id: str) -> AgentVerdict:
        """Mock implementation for testing"""
        # Create mock policy and invoice summaries
        policy_summary = PolicySummary(
            policy_number="TEST-POL-001",
            coverage_type="test_coverage",
            annual_limit=10000,
            exclusions=[],
            covered_services=["test_service"],
            effective_dates={"start": "2024-01-01", "end": "2024-12-31"}
        )
        
        invoice_summary = InvoiceSummary(
            invoice_number="TEST-INV-001",
            service_type="test_service",
            amount=100,
            service_date="2024-03-15",
            provider_id="TEST-PROV-001"
        )
        
        return AgentVerdict(
            agent_id=self.agent_id,
            agent_type=self.agent_type,
            verdict=VerdictType.COVERED,
            coverage_amount=100,
            primary_reason="Test claim approved",
            supporting_reasons=[],
            policy_summary=policy_summary,
            invoice_summary=invoice_summary,
            ambiguity_detected=False,
            requires_human_review=False,
            processing_time_ms=100,
            execution_context=self._create_execution_context("test-model-v1")
        )
    
    async def extract_policy_data(self, policy_pdf_path: str, decryption_key: str) -> PolicySummary:
        """Mock implementation for testing"""
        return PolicySummary(
            policy_number="TEST-POL-001",
            coverage_type="test_coverage",
            annual_limit=10000,
            exclusions=[],
            covered_services=["test_service"],
            effective_dates={"start": "2024-01-01", "end": "2024-12-31"}
        )
    
    async def extract_invoice_data(self, invoice_pdf_path: str, decryption_key: str) -> InvoiceSummary:
        """Mock implementation for testing"""
        return InvoiceSummary(
            invoice_number="TEST-INV-001",
            service_type="test_service",
            amount=100,
            service_date="2024-03-15",
            provider_id="TEST-PROV-001"
        )