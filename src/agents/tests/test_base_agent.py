"""
Unit tests for BaseEvaluationAgent
Enhanced tests for ASI signing, wallet verification, replay protection, and error handling
"""
import pytest
import json
import hashlib
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

from src.agents.base_agent import BaseEvaluationAgent
from src.agents.schemas import AgentVerdict, VerdictType, AgentSignature, ExecutionContext, PolicySummary, InvoiceSummary
from .conftest import MockAgent, TestableEvaluationAgent


class TestBaseEvaluationAgent:
    """Test suite for BaseEvaluationAgent"""
    
    @pytest.fixture
    def mock_base_agent(self, mock_agent, temp_pdf_files):
        """Create TestableEvaluationAgent with mock dependencies"""
        with patch('src.agents.base_agent.Agent', return_value=mock_agent):
            # Set walrus_vault_path to parent of temp files to allow access
            import os
            temp_parent = os.path.dirname(temp_pdf_files["policy_path"])
            agent = TestableEvaluationAgent(
                agent_id="test_base_agent",
                agent_type="test_type",
                seed_phrase="test_seed",
                endpoint="http://localhost",
                port=8001,
                walrus_vault_path=temp_parent
            )
            agent.agent = mock_agent  # Inject mock
            return agent
    
    def test_agent_initialization(self, mock_base_agent):
        """Test agent initializes with correct properties"""
        assert mock_base_agent.agent_id == "test_base_agent"
        assert mock_base_agent.agent_type == "test_type"
        assert mock_base_agent.execution_environment == "asi_sgx_node_v1"
        assert mock_base_agent.agent_version == "1.0.0"
    
    def test_input_validation_valid_inputs(self, mock_base_agent, temp_pdf_files):
        """Test input validation with valid files"""
        is_valid, error_msg = mock_base_agent._validate_inputs(
            temp_pdf_files["policy_path"],
            temp_pdf_files["invoice_path"],
            "test_key_32_characters_long_12345"
        )
        assert is_valid is True
        assert error_msg is None
    
    def test_input_validation_missing_files(self, mock_base_agent):
        """Test input validation with missing files"""
        is_valid, error_msg = mock_base_agent._validate_inputs(
            "/nonexistent/policy.pdf",
            "/nonexistent/invoice.pdf", 
            "test_key"
        )
        assert is_valid is False
        assert "outside allowed directory" in error_msg
    
    def test_input_validation_directory_traversal(self, mock_base_agent):
        """Test protection against directory traversal attacks"""
        is_valid, error_msg = mock_base_agent._validate_inputs(
            "../../../etc/passwd",
            "valid_file.pdf",
            "test_key"
        )
        assert is_valid is False
        assert "outside allowed directory" in error_msg
    
    def test_input_validation_large_files(self, mock_base_agent, temp_pdf_files):
        """Test file size limits"""
        import os
        # Create large file in the allowed directory
        large_file_path = os.path.join(os.path.dirname(temp_pdf_files["policy_path"]), "large_file.pdf")
        
        with open(large_file_path, "wb") as large_file:
            # Create file larger than 50MB limit
            large_file.write(b"x" * (51 * 1024 * 1024))
        
        try:
            is_valid, error_msg = mock_base_agent._validate_inputs(
                large_file_path,
                temp_pdf_files["invoice_path"],
                "test_key_32_characters_long_12345"
            )
            assert is_valid is False
            assert "too large" in error_msg
        finally:
            os.unlink(large_file_path)


class TestASINativeSigning:
    """Enhanced test suite for ASI native signing with wallet verification"""
    
    @pytest.fixture
    def test_verdict(self, sample_agent_verdict):
        """Sample verdict for signing tests"""
        return sample_agent_verdict
    
    @pytest.fixture
    def mock_agent_with_signing(self, mock_agent):
        """Mock agent with enhanced signing capabilities"""
        with patch('src.agents.base_agent.Agent', return_value=mock_agent):
            agent = TestableEvaluationAgent(
                agent_id="signing_test_agent",
                agent_type="test_type",
                seed_phrase="test_seed",
                endpoint="http://localhost",
                port=8001
            )
            agent.agent = mock_agent
            return agent
    
    def test_sign_verdict_basic(self, mock_agent_with_signing, test_verdict):
        """Test basic verdict signing"""
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        # Verify signature structure
        assert isinstance(signature, AgentSignature)
        assert signature.algorithm == "secp256k1"
        assert signature.signer_address.startswith("wallet_")
        assert len(signature.signed_fields) > 0
        assert "agent_id" in signature.signed_fields
        assert "verdict" in signature.signed_fields
    
    def test_signature_verification_against_wallet(self, mock_agent_with_signing, test_verdict):
        """Test that signatures verify correctly against the agent's wallet"""
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        # Reconstruct payload for verification
        payload = {}
        for field in signature.signed_fields:
            if hasattr(test_verdict, field):
                value = getattr(test_verdict, field)
                # Convert datetime to ISO format with millisecond precision
                if isinstance(value, datetime):
                    value = value.isoformat(timespec="milliseconds")
                # Convert Enum to string
                elif hasattr(value, 'value'):
                    value = value.value
                payload[field] = value
        
        payload_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        payload_hash = hashlib.sha256(payload_json.encode('utf-8')).digest()
        
        # Verify signature against wallet
        signature_bytes = bytes.fromhex(signature.value)
        assert mock_agent_with_signing.agent.wallet.verify(payload_hash, signature_bytes)
    
    def test_replay_attack_detection(self, mock_agent_with_signing, test_verdict):
        """Test that different message_ids produce different signatures (replay protection)"""
        signature1 = mock_agent_with_signing.sign_verdict_asi_native(test_verdict, "msg_1")
        signature2 = mock_agent_with_signing.sign_verdict_asi_native(test_verdict, "msg_2")
        
        # Different message_ids should produce different signatures
        assert signature1.value != signature2.value
        assert "message_id" in signature1.signed_fields
        assert "message_id" in signature2.signed_fields
        
        # Same message_id should produce same signature
        signature3 = mock_agent_with_signing.sign_verdict_asi_native(test_verdict, "msg_1")
        assert signature1.value == signature3.value
    
    def test_signature_deterministic(self, mock_agent_with_signing, test_verdict):
        """Test that signatures are deterministic for same input"""
        sig1 = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        sig2 = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        assert sig1.value == sig2.value
        assert sig1.signed_fields == sig2.signed_fields
    
    def test_signature_verification_fails_with_wrong_wallet(self, test_verdict):
        """Test that signature verification fails with wrong wallet"""
        # Create two agents with different wallets
        with patch('src.agents.base_agent.Agent'):
            agent1 = TestableEvaluationAgent(agent_id="agent1", agent_type="test", seed_phrase="test1", endpoint="http://localhost", port=8001)
            agent1.agent = MockAgent("agent1", wallet_id="wallet1")
            
            agent2 = TestableEvaluationAgent(agent_id="agent2", agent_type="test", seed_phrase="test2", endpoint="http://localhost", port=8002)
            agent2.agent = MockAgent("agent2", wallet_id="wallet2")
        
        # Sign with agent1
        signature = agent1.sign_verdict_asi_native(test_verdict)
        
        # Try to verify with agent2's wallet (should fail)
        payload = {}
        for field in signature.signed_fields:
            if hasattr(test_verdict, field):
                value = getattr(test_verdict, field)
                if isinstance(value, datetime):
                    value = value.isoformat(timespec="milliseconds")
                elif hasattr(value, 'value'):
                    value = value.value
                payload[field] = value
        
        payload_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        payload_hash = hashlib.sha256(payload_json.encode('utf-8')).digest()
        signature_bytes = bytes.fromhex(signature.value)
        
        # Verification should fail with wrong wallet
        assert not agent2.agent.wallet.verify(payload_hash, signature_bytes)
    
    def test_unfunded_wallet_handling(self, mock_agent_with_signing, test_verdict):
        """Test behavior when wallet is not funded"""
        # Set wallet as unfunded
        mock_agent_with_signing.agent.wallet.set_funded(False)
        
        # Should still sign but with fallback
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        assert isinstance(signature, AgentSignature)
        # Might be fallback signature if funding check is strict
    
    def test_signing_error_handling(self, mock_agent_with_signing, test_verdict):
        """Test signing error handling"""
        # Mock wallet sign method to raise exception
        original_sign = mock_agent_with_signing.agent.wallet.sign
        mock_agent_with_signing.agent.wallet.sign = Mock(side_effect=Exception("Signing failed"))
        
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        # Should return fallback signature
        assert isinstance(signature, AgentSignature)
        assert "SIGNING_ERROR_" in signature.value
        assert signature.algorithm == "secp256k1_fallback"
        
        # Restore original method
        mock_agent_with_signing.agent.wallet.sign = original_sign
    
    @pytest.mark.parametrize("algorithm", ["secp256k1"])  # Add more algorithms as supported
    def test_signing_algorithms(self, mock_agent_with_signing, test_verdict, algorithm):
        """Test different signing algorithms (parametrized for future expansion)"""
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        # For now, we only support secp256k1
        assert signature.algorithm == "secp256k1"
        assert len(signature.value) > 0
    
    def test_payload_serialization_consistency(self, mock_agent_with_signing, test_verdict):
        """Test that payload serialization is consistent"""
        # Create two identical verdicts
        verdict1 = test_verdict
        verdict2 = AgentVerdict(**test_verdict.dict())
        
        sig1 = mock_agent_with_signing.sign_verdict_asi_native(verdict1)
        sig2 = mock_agent_with_signing.sign_verdict_asi_native(verdict2)
        
        assert sig1.value == sig2.value  # Should be identical
    
    def test_signed_fields_inclusion(self, mock_agent_with_signing, test_verdict):
        """Test that all expected fields are included in signing"""
        signature = mock_agent_with_signing.sign_verdict_asi_native(test_verdict)
        
        expected_fields = [
            "agent_id", "agent_type", "timestamp", "verdict",
            "coverage_amount", "primary_reason"
        ]
        
        for field in expected_fields:
            assert field in signature.signed_fields
    
    def test_datetime_serialization_consistency(self, mock_agent_with_signing):
        """Test that datetime fields are serialized consistently"""
        # Create verdict with specific timestamp
        test_time = datetime(2024, 3, 15, 10, 30, 45, 123456)
        
        verdict = AgentVerdict(
            agent_id="test_agent",
            agent_type="test",
            timestamp=test_time,
            verdict=VerdictType.COVERED,
            coverage_amount=100.0,
            primary_reason="Test reason",
            supporting_reasons=[],
            policy_summary=PolicySummary(
                policy_number="TEST-001",
                coverage_type="test",
                annual_limit=10000,
                exclusions=[],
                covered_services=["test"],
                effective_dates={"start": "2024-01-01", "end": "2024-12-31"}
            ),
            invoice_summary=InvoiceSummary(
                invoice_number="INV-001",
                service_type="test",
                amount=100.0,
                service_date="2024-03-15",
                provider_id="TEST-PROV"
            ),
            ambiguity_detected=False,
            requires_human_review=False,
            processing_time_ms=1000,
            execution_context=ExecutionContext(
                agent_version="1.0.0",
                model_version="test",
                execution_environment="test"
            )
        )
        
        # Sign multiple times to verify consistency
        sig1 = mock_agent_with_signing.sign_verdict_asi_native(verdict)
        sig2 = mock_agent_with_signing.sign_verdict_asi_native(verdict)
        
        assert sig1.value == sig2.value  # Consistent datetime serialization


class TestAgentMessaging:
    """Test suite for agent message handling"""
    
    @pytest.fixture
    def agent_with_handlers(self, mock_agent):
        """Agent with message handlers set up"""
        with patch('src.agents.base_agent.Agent', return_value=mock_agent):
            agent = TestableEvaluationAgent(
                agent_id="messaging_test_agent",
                agent_type="test_type",
                seed_phrase="test_seed",
                endpoint="http://localhost",
                port=8001
            )
            agent.agent = mock_agent
            return agent
    
    def test_message_handler_registration(self, agent_with_handlers):
        """Test that message handlers are registered correctly"""
        # Verify handlers were registered during initialization
        assert len(agent_with_handlers.agent._message_handlers) > 0
    
    def test_get_agent_address(self, agent_with_handlers):
        """Test agent address retrieval"""
        address = agent_with_handlers.get_agent_address()
        assert isinstance(address, str)
        assert len(address) > 0
    
    def test_execution_context_creation(self, agent_with_handlers):
        """Test execution context creation"""
        context = agent_with_handlers._create_execution_context("test_model_v1")
        
        assert isinstance(context, ExecutionContext)
        assert context.agent_version == "1.0.0"
        assert context.model_version == "test_model_v1"
        assert context.execution_environment == "asi_sgx_node_v1"


@pytest.mark.asyncio
class TestAsyncOperations:
    """Enhanced test suite for async operations with error handling"""
    
    @pytest.fixture
    def async_agent(self, mock_agent):
        """Agent for async testing"""
        with patch('src.agents.base_agent.Agent', return_value=mock_agent):
            agent = TestableEvaluationAgent(
                agent_id="async_test_agent",
                agent_type="test_type",
                seed_phrase="test_seed",
                endpoint="http://localhost",
                port=8001
            )
            agent.agent = mock_agent
            return agent
    
    async def test_run_in_executor(self, async_agent):
        """Test thread executor functionality"""
        def cpu_bound_task(x, y):
            return x + y
        
        result = await async_agent.run_in_executor(cpu_bound_task, 5, 3)
        assert result == 8
    
    async def test_run_in_executor_exception(self, async_agent):
        """Test that exceptions in executor are properly propagated"""
        def faulty_task():
            raise ValueError("Expected error")
        
        with pytest.raises(ValueError, match="Expected error"):
            await async_agent.run_in_executor(faulty_task)
    
    async def test_run_in_executor_with_args(self, async_agent):
        """Test executor with various argument types"""
        def complex_task(data_dict, data_list, multiplier=2):
            return {
                "dict_sum": sum(data_dict.values()) * multiplier,
                "list_sum": sum(data_list) * multiplier
            }
        
        result = await async_agent.run_in_executor(
            complex_task,
            {"a": 1, "b": 2},
            [3, 4, 5],
            multiplier=3
        )
        
        assert result["dict_sum"] == 9  # (1+2) * 3
        assert result["list_sum"] == 36  # (3+4+5) * 3
    
    async def test_concurrent_operations(self, async_agent):
        """Test multiple concurrent operations"""
        import asyncio
        
        def slow_task(duration):
            import time
            time.sleep(duration / 1000)  # Convert to seconds
            return f"completed_{duration}"
        
        # Run multiple tasks concurrently
        tasks = [
            async_agent.run_in_executor(slow_task, 10),
            async_agent.run_in_executor(slow_task, 20),
            async_agent.run_in_executor(slow_task, 15)
        ]
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 3
        assert "completed_10" in results
        assert "completed_20" in results
        assert "completed_15" in results
    
    async def test_concurrent_exception_handling(self, async_agent):
        """Test exception handling in concurrent operations"""
        import asyncio
        
        def task_that_succeeds(value):
            return f"success_{value}"
        
        def task_that_fails():
            raise RuntimeError("Task failed")
        
        # Mix successful and failing tasks
        tasks = [
            async_agent.run_in_executor(task_that_succeeds, "A"),
            async_agent.run_in_executor(task_that_fails),
            async_agent.run_in_executor(task_that_succeeds, "B")
        ]
        
        # Use return_exceptions=True to get both results and exceptions
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        assert results[0] == "success_A"
        assert isinstance(results[1], RuntimeError)
        assert results[2] == "success_B"


class TestWalletIntegration:
    """Test suite for wallet integration and verification"""
    
    def test_wallet_signature_properties(self, mock_agent):
        """Test wallet signature properties"""
        wallet = mock_agent.wallet
        test_data = b"test_payload_for_signing"
        
        signature = wallet.sign(test_data)
        
        # Verify signature properties
        assert isinstance(signature, bytes)
        assert len(signature) > 0
        
        # Verify signature can be verified
        assert wallet.verify(test_data, signature)
    
    def test_wallet_address_consistency(self, mock_agent):
        """Test that wallet address is consistent"""
        wallet = mock_agent.wallet
        
        addr1 = wallet.address()
        addr2 = wallet.address()
        
        assert addr1 == addr2
        assert isinstance(addr1, str)
        assert len(addr1) > 0
    
    def test_wallet_funding_status(self, mock_agent):
        """Test wallet funding status management"""
        wallet = mock_agent.wallet
        
        # Initially funded
        assert wallet.is_funded() is True
        
        # Set unfunded
        wallet.set_funded(False)
        assert wallet.is_funded() is False
        
        # Set funded again
        wallet.set_funded(True)
        assert wallet.is_funded() is True
        