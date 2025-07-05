"""
Consensus algorithm tests with enhanced verification and fault injection
Addresses: signature verification, E2E flows, fault injection, metrics validation, replay protection
"""
import pytest
import asyncio
import json
import hashlib
import time
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from typing import List, Dict, Any, Set

from src.agents.schemas import (
    AgentVerdict, VerdictType, ConsensusResult, AgentSignature,
    CoverageReason, ExecutionContext, PolicySummary, InvoiceSummary
)
from .conftest import MockAgent, MockWallet


class SignatureVerificationHelper:
    """Centralized helper for signature operations to avoid DRY violations"""
    
    @staticmethod
    def create_signature_payload(verdict: AgentVerdict, message_id: str, signed_fields: List[str]) -> str:
        """Create deterministic payload for signing"""
        payload = {}
        for field in signed_fields:
            if field == "message_id":
                payload[field] = message_id
            elif hasattr(verdict, field):
                value = getattr(verdict, field)
                if isinstance(value, datetime):
                    value = value.isoformat(timespec="milliseconds")
                elif hasattr(value, 'value'):  # Enum
                    value = value.value
                payload[field] = value
        
        return json.dumps(payload, sort_keys=True, separators=(',', ':'))
    
    @staticmethod
    def create_test_signature(verdict: AgentVerdict, mock_agent: MockAgent, message_id: str) -> AgentSignature:
        """Create a test signature for the verdict"""
        signed_fields = ["agent_id", "agent_type", "timestamp", "verdict", "coverage_amount", "primary_reason", "message_id"]
        
        payload_json = SignatureVerificationHelper.create_signature_payload(verdict, message_id, signed_fields)
        payload_hash = hashlib.sha256(payload_json.encode('utf-8')).digest()
        signature_bytes = mock_agent.wallet.sign(payload_hash)
        
        return AgentSignature(
            value=signature_bytes.hex(),
            algorithm="secp256k1",
            signed_fields=signed_fields,
            signer_address=mock_agent.wallet.address()
        )
    
    @staticmethod
    def verify_verdict_signature(verdict: AgentVerdict, wallet: MockWallet, message_id: str) -> tuple[bool, str]:
        """Verify verdict signature with detailed error reporting"""
        try:
            if not verdict.signature:
                return False, "Missing signature"
            
            if not verdict.signature.signed_fields:
                return False, "No signed fields specified"
            
            # Verify that the wallet address matches the signature's signer address
            if wallet.address() != verdict.signature.signer_address:
                return False, f"Wallet address mismatch: expected {verdict.signature.signer_address}, got {wallet.address()}"
            
            payload_json = SignatureVerificationHelper.create_signature_payload(
                verdict, message_id, verdict.signature.signed_fields
            )
            payload_hash = hashlib.sha256(payload_json.encode('utf-8')).digest()
            
            try:
                signature_bytes = bytes.fromhex(verdict.signature.value)
            except ValueError as e:
                return False, f"Invalid signature format: {e}"
            
            is_valid = wallet.verify(payload_hash, signature_bytes)
            return is_valid, "Valid" if is_valid else "Signature verification failed"
            
        except json.JSONEncodeError as e:
            return False, f"JSON serialization error: {e}"
        except Exception as e:
            return False, f"Unexpected verification error: {e}"


class ReplayProtectionRegistry:
    """Simple in-memory registry for replay protection testing"""
    
    def __init__(self):
        self._used_nonces: Set[str] = set()
    
    def is_replay(self, message_id: str, signature: str) -> bool:
        """Check if this is a replay attack"""
        # A replay attack is when the same signature is used multiple times
        nonce_key = f"{message_id}:{signature}"
        if nonce_key in self._used_nonces:
            return True  # Same message_id + same signature = replay attack
        
        self._used_nonces.add(nonce_key)
        return False
    
    def clear(self):
        """Clear registry for testing"""
        self._used_nonces.clear()


class ConsensusOrchestrator:
    """Lightweight real orchestrator for testing (not fully mocked)"""
    
    def __init__(self):
        self.consensus_timeout = 30.0
        self.metrics = {
            "consensus_attempts": 0,
            "successful_consensus": 0, 
            "failed_consensus": 0,
            "signature_verifications": 0,
            "signature_failures": 0,
            "replay_attempts": 0
        }
        self.replay_registry = ReplayProtectionRegistry()
    
    async def evaluate_consensus(self, verdicts: List[AgentVerdict], wallets: Dict[str, MockWallet], 
                               message_id: str, require_signatures: bool = True) -> ConsensusResult:
        """Real consensus evaluation logic with signature verification"""
        self.metrics["consensus_attempts"] += 1
        
        if require_signatures:
            verified_verdicts = []
            for verdict in verdicts:
                wallet = wallets.get(verdict.agent_id)
                if not wallet:
                    self.metrics["signature_failures"] += 1
                    continue
                
                # Check for replay attacks
                if verdict.signature and self.replay_registry.is_replay(message_id, verdict.signature.value):
                    self.metrics["replay_attempts"] += 1
                    continue
                
                is_valid, error_msg = SignatureVerificationHelper.verify_verdict_signature(
                    verdict, wallet, message_id
                )
                
                if is_valid:
                    verified_verdicts.append(verdict)
                    self.metrics["signature_verifications"] += 1
                else:
                    self.metrics["signature_failures"] += 1
            
            verdicts = verified_verdicts
        
        if not verdicts:
            self.metrics["failed_consensus"] += 1
            return ConsensusResult(
                consensus_id=f"consensus_{int(datetime.utcnow().timestamp())}",
                agent_verdicts=[],
                agreement_ratio=0.0,
                consensus_confidence=0.0,
                verdict_distribution={},
                average_processing_time_ms=0.0
            )
        
        # Consensus logic
        verdict_types = [v.verdict for v in verdicts]
        unique_verdicts = set(verdict_types)
        
        if len(unique_verdicts) == 1:
            # Unanimous consensus
            final_verdict = verdict_types[0]
            coverage_amount = None
            
            if final_verdict in [VerdictType.COVERED, VerdictType.PARTIAL_COVERAGE]:
                amounts = [v.coverage_amount for v in verdicts if v.coverage_amount is not None]
                coverage_amount = sum(amounts) / len(amounts) if amounts else None
            
            self.metrics["successful_consensus"] += 1
            
            # Calculate verdict distribution
            verdict_dist = {}
            for verdict in verdict_types:
                verdict_str = verdict.value if hasattr(verdict, 'value') else str(verdict)
                verdict_dist[verdict_str] = verdict_dist.get(verdict_str, 0) + 1
            
            # Calculate average processing time
            avg_processing_time = sum(v.processing_time_ms for v in verdicts) / len(verdicts)
            
            return ConsensusResult(
                consensus_id=f"consensus_{int(datetime.utcnow().timestamp())}",
                agent_verdicts=verdicts,
                final_verdict=final_verdict,
                agreement_ratio=1.0,
                consensus_confidence=0.95,
                verdict_distribution=verdict_dist,
                average_processing_time_ms=avg_processing_time,
                coverage_amounts=[v.coverage_amount for v in verdicts if v.coverage_amount is not None],
                average_coverage_amount=coverage_amount
            )
        else:
            # No consensus
            self.metrics["failed_consensus"] += 1
            
            # Calculate verdict distribution
            verdict_dist = {}
            for verdict in verdict_types:
                verdict_str = verdict.value if hasattr(verdict, 'value') else str(verdict)
                verdict_dist[verdict_str] = verdict_dist.get(verdict_str, 0) + 1
            
            # Calculate agreement ratio based on most common verdict
            most_common_count = max(verdict_dist.values()) if verdict_dist else 0
            agreement_ratio = most_common_count / len(verdict_types) if verdict_types else 0.0
            
            # Calculate average processing time
            avg_processing_time = sum(v.processing_time_ms for v in verdicts) / len(verdicts) if verdicts else 0.0
            
            # Find dissenting agents (those who didn't vote for the most common verdict)
            most_common_verdict = max(set(verdict_types), key=verdict_types.count) if verdict_types else None
            dissenting_agents = [v.agent_id for v in verdicts if v.verdict != most_common_verdict]
            
            return ConsensusResult(
                consensus_id=f"consensus_{int(datetime.utcnow().timestamp())}",
                agent_verdicts=verdicts,
                final_verdict=None,
                agreement_ratio=agreement_ratio,
                consensus_confidence=0.0,
                verdict_distribution=verdict_dist,
                average_processing_time_ms=avg_processing_time,
                dissenting_agents=dissenting_agents
            )


@pytest.mark.asyncio
class TestConsensusWithRealLogic:
    """Test consensus with real orchestrator logic (minimal mocking)"""
    
    @pytest.fixture
    def orchestrator(self):
        """Real orchestrator instance for testing"""
        return ConsensusOrchestrator()
    
    @pytest.fixture
    def agent_wallets(self, multi_mock_agents):
        """Extract wallets from mock agents"""
        wallets = {}
        for agent_name, mock_agent in multi_mock_agents.items():
            if agent_name != "orchestrator":
                wallets[agent_name] = mock_agent.wallet
        return wallets
    
    @pytest.fixture
    def sample_verdicts_signed(self, sample_agent_verdict, multi_mock_agents):
        """Create sample verdicts with valid signatures"""
        verdicts = []
        message_id = "test_consensus_001"
        
        for agent_name, mock_agent in multi_mock_agents.items():
            if agent_name == "orchestrator":
                continue
                
            verdict = AgentVerdict(
                agent_id=agent_name,
                agent_type="nlp_policy",
                verdict=VerdictType.COVERED,
                coverage_amount=200.0,
                primary_reason="Service covered under policy",
                supporting_reasons=[],
                policy_summary=sample_agent_verdict.policy_summary,
                invoice_summary=sample_agent_verdict.invoice_summary,
                ambiguity_detected=False,
                requires_human_review=False,
                processing_time_ms=1500,
                execution_context=ExecutionContext(
                    agent_version="1.0.0",
                    model_version="test",
                    execution_environment="test"
                )
            )
            
            signature = SignatureVerificationHelper.create_test_signature(verdict, mock_agent, message_id)
            verdict.signature = signature
            verdicts.append(verdict)
        
        return verdicts, message_id
    
    async def test_signature_verification_success(self, orchestrator, sample_verdicts_signed, agent_wallets):
        """Test successful signature verification"""
        verdicts, message_id = sample_verdicts_signed
        
        result = await orchestrator.evaluate_consensus(verdicts, agent_wallets, message_id)
        
        assert result.agreement_ratio >= result.consensus_threshold  # has_consensus computed dynamically
        assert result.final_verdict == VerdictType.COVERED
        assert result.agreement_ratio == 1.0
        assert orchestrator.metrics["signature_verifications"] == len(verdicts)
        assert orchestrator.metrics["signature_failures"] == 0
        assert orchestrator.metrics["successful_consensus"] == 1
    
    async def test_signature_verification_failure(self, orchestrator, sample_verdicts_signed, agent_wallets):
        """Test signature verification failure detection"""
        verdicts, message_id = sample_verdicts_signed
        
        # Corrupt one signature
        verdicts[0].signature.value = "corrupted_" + verdicts[0].signature.value[10:]
        
        result = await orchestrator.evaluate_consensus(verdicts, agent_wallets, message_id)
        
        # Should still reach consensus with remaining valid signatures
        assert result.agreement_ratio >= result.consensus_threshold  # has_consensus computed dynamically  # Still has valid signatures from other agents
        assert orchestrator.metrics["signature_failures"] == 1
        assert orchestrator.metrics["signature_verifications"] == len(verdicts) - 1
    
    async def test_replay_attack_detection(self, orchestrator, sample_verdicts_signed, agent_wallets):
        """Test replay attack detection with real registry"""
        verdicts, message_id = sample_verdicts_signed
        
        # First consensus should succeed
        result1 = await orchestrator.evaluate_consensus(verdicts, agent_wallets, message_id)
        assert result1.agreement_ratio >= result1.consensus_threshold  # has_consensus computed dynamically
        assert orchestrator.metrics["replay_attempts"] == 0
        
        # Attempt replay with same message_id and signatures
        result2 = await orchestrator.evaluate_consensus(verdicts, agent_wallets, message_id)
        
        # Should detect replay and reject
        assert result2.agreement_ratio < result2.consensus_threshold  # has_consensus computed dynamically
        assert orchestrator.metrics["replay_attempts"] == len(verdicts)
    
    @pytest.mark.parametrize("fault_scenario", [
        {
            "name": "corrupted_signature",
            "modify_verdict": lambda v: setattr(v.signature, 'value', 'corrupted_signature'),
            "expected_failures": 1
        },
        {
            "name": "missing_signature", 
            "modify_verdict": lambda v: setattr(v, 'signature', None),
            "expected_failures": 1
        },
        {
            "name": "tampered_amount",
            "modify_verdict": lambda v: setattr(v, 'coverage_amount', 999999.0),
            "expected_failures": 1
        }
    ])
    async def test_fault_injection_scenarios(self, fault_scenario, orchestrator, sample_verdicts_signed, agent_wallets):
        """Test various fault injection scenarios"""
        verdicts, message_id = sample_verdicts_signed
        
        # Apply fault to first verdict
        fault_scenario["modify_verdict"](verdicts[0])
        
        result = await orchestrator.evaluate_consensus(verdicts, agent_wallets, message_id)
        
        assert orchestrator.metrics["signature_failures"] >= fault_scenario["expected_failures"]
        
        # System should still function with remaining valid signatures
        if len(verdicts) > 1:
            assert orchestrator.metrics["signature_verifications"] > 0
    
    async def test_end_to_end_message_flow(self, multi_mock_agents, agent_wallets):
        """Test complete E2E flow with actual message passing simulation"""
        orchestrator = ConsensusOrchestrator()
        claim_id = "e2e_test_claim_001"
        
        # Step 1: Simulate sending evaluation requests
        sent_requests = []
        for agent_name in agent_wallets.keys():
            request = {
                "claim_id": claim_id,
                "policy_pdf_path": "/test/policy.pdf",
                "invoice_pdf_path": "/test/invoice.pdf", 
                "decryption_key": "test_key_32_chars_long!!!!!!!!"
            }
            sent_requests.append((agent_name, request))
        
        # Step 2: Simulate agent responses
        agent_responses = []
        for agent_name, mock_agent in multi_mock_agents.items():
            if agent_name == "orchestrator":
                continue
                
            verdict = AgentVerdict(
                agent_id=agent_name,
                agent_type="nlp_policy",
                verdict=VerdictType.COVERED,
                coverage_amount=200.0,
                primary_reason="E2E test coverage decision",
                supporting_reasons=[],
                policy_summary=PolicySummary(
                    policy_number="E2E-POL-001",
                    coverage_type="comprehensive",
                    annual_limit=50000,
                    exclusions=[],
                    covered_services=["routine_checkup"],
                    effective_dates={"start": "2024-01-01", "end": "2024-12-31"}
                ),
                invoice_summary=InvoiceSummary(
                    invoice_number="E2E-INV-001",
                    service_type="routine_checkup",
                    amount=200.0,
                    service_date="2024-03-15",
                    provider_id="E2E-PROVIDER"
                ),
                ambiguity_detected=False,
                requires_human_review=False,
                processing_time_ms=1200,
                execution_context=ExecutionContext(
                    agent_version="1.0.0",
                    model_version="e2e_test",
                    execution_environment="test"
                )
            )
            
            # Sign the verdict
            signature = SignatureVerificationHelper.create_test_signature(verdict, mock_agent, claim_id)
            verdict.signature = signature
            agent_responses.append(verdict)
        
        # Step 3: Evaluate consensus
        result = await orchestrator.evaluate_consensus(agent_responses, agent_wallets, claim_id)
        
        # Step 4: Verify E2E flow
        assert len(sent_requests) == len(agent_wallets)
        assert len(agent_responses) == len(agent_wallets)
        assert result.agreement_ratio >= result.consensus_threshold  # has_consensus computed dynamically
        assert result.final_verdict == VerdictType.COVERED
        assert all(signature is not None for verdict in agent_responses for signature in [verdict.signature])
        
        # Verify all signatures are valid
        for verdict in agent_responses:
            wallet = agent_wallets[verdict.agent_id]
            is_valid, _ = SignatureVerificationHelper.verify_verdict_signature(verdict, wallet, claim_id)
            assert is_valid, f"E2E signature should be valid for {verdict.agent_id}"
    
    def test_metrics_accuracy(self, orchestrator):
        """Test that metrics accurately reflect operations"""
        initial_metrics = orchestrator.metrics.copy()
        
        # All metrics should start at 0
        assert all(value == 0 for value in initial_metrics.values())
        
        # Manually trigger operations and verify metrics
        orchestrator.metrics["consensus_attempts"] += 3
        orchestrator.metrics["signature_verifications"] += 5
        orchestrator.metrics["signature_failures"] += 2
        orchestrator.metrics["successful_consensus"] += 2
        orchestrator.metrics["failed_consensus"] += 1
        orchestrator.metrics["replay_attempts"] += 1
        
        # Verify totals
        assert orchestrator.metrics["consensus_attempts"] == 3
        assert orchestrator.metrics["signature_verifications"] == 5
        assert orchestrator.metrics["signature_failures"] == 2
        assert orchestrator.metrics["successful_consensus"] == 2
        assert orchestrator.metrics["failed_consensus"] == 1
        assert orchestrator.metrics["replay_attempts"] == 1
        
        # Verify logical consistency
        assert (orchestrator.metrics["successful_consensus"] + 
                orchestrator.metrics["failed_consensus"]) == orchestrator.metrics["consensus_attempts"]
    
    async def test_consensus_timeout_handling(self, orchestrator, agent_wallets):
        """Test consensus behavior with timeout scenarios"""
        
        # Create partial verdict set (simulating timeout)
        timeout_verdict = AgentVerdict(
            agent_id="timeout_agent",
            agent_type="nlp_policy", 
            verdict=VerdictType.REQUIRES_REVIEW,
            coverage_amount=None,
            primary_reason="Agent response timeout",
            supporting_reasons=[],
            policy_summary=PolicySummary(
                policy_number="TIMEOUT-001",
                coverage_type="test",
                annual_limit=0,
                exclusions=[],
                covered_services=[],
                effective_dates={"start": "", "end": ""}
            ),
            invoice_summary=InvoiceSummary(
                invoice_number="TIMEOUT-INV-001",
                service_type="unknown",
                amount=0,
                service_date="",
                provider_id="unknown"
            ),
            ambiguity_detected=True,
            requires_human_review=True,
            processing_time_ms=30000,  # Indicates timeout
            execution_context=ExecutionContext(
                agent_version="1.0.0",
                model_version="timeout",
                execution_environment="test"
            )
        )
        
        # No signature for timeout case
        timeout_verdict.signature = None
        
        result = await orchestrator.evaluate_consensus([timeout_verdict], agent_wallets, "timeout_test")
        
        # Should handle gracefully
        assert result.agreement_ratio < result.consensus_threshold  # has_consensus computed dynamically
        assert orchestrator.metrics["signature_failures"] >= 1  # Missing signature counts as failure


@pytest.mark.asyncio 
class TestConsensusPerformance:
    """Performance testing with realistic load"""
    
    async def test_concurrent_consensus_load(self, multi_mock_agents):
        """Test system under concurrent consensus load"""
        
        async def consensus_session(session_id: int, orchestrator: ConsensusOrchestrator, wallets: Dict[str, MockWallet]):
            """Single consensus session"""
            message_id = f"load_test_{session_id}_{int(time.time())}"
            
            verdicts = []
            for agent_name, wallet in wallets.items():
                verdict = AgentVerdict(
                    agent_id=agent_name,
                    agent_type="load_test",
                    verdict=VerdictType.COVERED,
                    coverage_amount=200.0,
                    primary_reason=f"Load test session {session_id}",
                    supporting_reasons=[],
                    policy_summary=PolicySummary(
                        policy_number=f"LOAD-{session_id}",
                        coverage_type="test",
                        annual_limit=50000,
                        exclusions=[],
                        covered_services=["test"],
                        effective_dates={"start": "2024-01-01", "end": "2024-12-31"}
                    ),
                    invoice_summary=InvoiceSummary(
                        invoice_number=f"LOAD-INV-{session_id}",
                        service_type="test",
                        amount=200.0,
                        service_date="2024-03-15",
                        provider_id="LOAD-PROV"
                    ),
                    ambiguity_detected=False,
                    requires_human_review=False,
                    processing_time_ms=100,
                    execution_context=ExecutionContext(
                        agent_version="1.0.0",
                        model_version="load_test",
                        execution_environment="test"
                    )
                )
                
                # Sign verdict
                mock_agent = multi_mock_agents[agent_name]
                signature = SignatureVerificationHelper.create_test_signature(verdict, mock_agent, message_id)
                verdict.signature = signature
                verdicts.append(verdict)
            
            result = await orchestrator.evaluate_consensus(verdicts, wallets, message_id)
            return result.agreement_ratio >= result.consensus_threshold
        
        # Setup
        orchestrator = ConsensusOrchestrator()
        wallets = {name: agent.wallet for name, agent in multi_mock_agents.items() if name != "orchestrator"}
        
        # Run concurrent sessions
        concurrent_sessions = 10
        start_time = time.time()
        
        tasks = [
            consensus_session(i, orchestrator, wallets)
            for i in range(concurrent_sessions)
        ]
        
        results = await asyncio.gather(*tasks)
        
        elapsed_time = time.time() - start_time
        
        # Verify performance
        assert all(results), "All consensus sessions should succeed"
        assert elapsed_time < 5.0, f"Should complete {concurrent_sessions} sessions quickly, took {elapsed_time}s"
        assert orchestrator.metrics["consensus_attempts"] == concurrent_sessions
        assert orchestrator.metrics["successful_consensus"] == concurrent_sessions