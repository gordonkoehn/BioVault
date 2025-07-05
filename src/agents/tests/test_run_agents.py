"""
Test runner for Bio Vault agents with real PDFs
This script demonstrates the multi-agent claim evaluation system
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env.local
env_path = Path(__file__).parent.parent.parent.parent / '.env.local'
load_dotenv(env_path)

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from agents.distributed_orchestrator import DistributedConsensusOrchestrator
from agents.nlp_policy_agent import NLPPolicyAgent, ClaudeLLMAdapter, GPT4LLMAdapter, ASI1LLMAdapter
from agents.schemas import ClaimEvaluationRequest

openai_api_key = os.getenv("OPENAI_API_KEY")
anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
asi_api_key = os.getenv("ASI_API_KEY")

async def test_claim_evaluation():
    """Test the full claim evaluation flow with real PDFs"""
    print(" Starting Bio Vault Agent Test Run\n")
    
    # Check API keys
    if not openai_api_key or not anthropic_api_key or not asi_api_key:
        print(" Error: API keys required for real testing")
        print("   Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, and ASI_API_KEY environment variables")
        return
    
    print(" OpenAI API key found")
    print(" Anthropic API key found")
    print(" ASI API key found")
    
    # Setup paths
    test_dir = Path(__file__).parent / "test_pdfs"
    policy_path = str(test_dir.absolute() / "test_policy.pdf")
    invoice_path = str(test_dir.absolute() / "test_invoice.pdf")
    
    # For testing without encryption, we'll use a dummy key
    dummy_decryption_key = "test_key_for_unencrypted_pdfs_32c"
    
    print(f" Policy PDF: {policy_path}")
    print(f" Invoice PDF: {invoice_path}")
    print(f" Decryption Key: {dummy_decryption_key} (dummy for unencrypted test)\n")
    
    # Initialize agents
    print(" Initializing Agents...")
    
    # Create three evaluation agents (Claude, GPT-4, and ASI1 for testing)
    agents = []
    
    # Agent 1: Claude-based NLP Policy Agent
    claude_adapter = ClaudeLLMAdapter(
        api_key=anthropic_api_key,
        model_name="claude-3-haiku-20240307",  # Try Haiku first (most widely available)
        max_retries=3
    )
    
    claude_agent = NLPPolicyAgent(
        agent_id="claude_nlp_agent_001",
        seed_phrase="test_claude_seed_phrase_12345",
        endpoint="http://localhost",
        port=8001,
        llm_adapter=claude_adapter
    )
    agents.append(claude_agent)
    print(" Initialized Claude NLP Policy Agent")
    
    # Agent 2: GPT-4-based NLP Policy Agent  
    gpt4_adapter = GPT4LLMAdapter(
        api_key=openai_api_key,
        model_name="gpt-4-1106-preview",
        max_retries=3
    )
    
    gpt4_agent = NLPPolicyAgent(
        agent_id="gpt4_nlp_agent_001", 
        seed_phrase="test_gpt4_seed_phrase_67890",
        endpoint="http://localhost",
        port=8002,
        llm_adapter=gpt4_adapter
    )
    agents.append(gpt4_agent)
    print(" Initialized GPT-4 NLP Policy Agent")
    
    # Agent 3: ASI1-based NLP Policy Agent
    asi1_adapter = ASI1LLMAdapter(
        api_key=asi_api_key,
        model_name="asi1-mini",
        max_retries=3
    )
    
    asi1_agent = NLPPolicyAgent(
        agent_id="asi1_nlp_agent_001",
        seed_phrase="test_asi1_seed_phrase_abcde",
        endpoint="http://localhost",
        port=8003,
        llm_adapter=asi1_adapter
    )
    agents.append(asi1_agent)
    print(" Initialized ASI1 NLP Policy Agent")
    
    # Initialize orchestrator
    orchestrator = DistributedConsensusOrchestrator(
        orchestrator_id="test_orchestrator_001",
        seed="test_orchestrator_seed_phrase",
        endpoint="http://localhost", 
        port=8000
    )
    print(" Initialized Distributed Orchestrator\n")
    
    # Create claim evaluation request
    print("📋 Creating Claim Evaluation Request...")
    claim_request = ClaimEvaluationRequest(
        claim_id="TEST_CLAIM_001",
        policy_pdf_path=policy_path,
        invoice_pdf_path=invoice_path,
        decryption_key=dummy_decryption_key,
        requester_id="test_user_001",
        consensus_threshold=1.0  # Require unanimous consensus
    )
    
    print(" Sending claim for evaluation...\n")
    
    # Process the claim
    try:
        # For testing, we'll directly call the evaluation method
        # In production, this would happen through agent messages
        
        # First, let's test individual agent evaluations
        print(" Testing Individual Agent Evaluations:\n")
        
        for agent in agents:
            print(f"Agent: {agent.agent_id}")
            try:
                verdict = await agent.evaluate_claim(
                    policy_path=policy_path,
                    invoice_path=invoice_path,
                    decryption_key=dummy_decryption_key,
                    claim_id=claim_request.claim_id
                )
                
                print(f"  Verdict: {verdict.verdict.value}")
                print(f"  Coverage Amount: ${verdict.coverage_amount}")
                print(f"  Primary Reason: {verdict.primary_reason}")
                print(f"  Processing Time: {verdict.processing_time_ms}ms")
                print(f"  Signature: {verdict.signature.value[:20]}... (truncated)")
                print()
                
            except Exception as e:
                print(f"  Error: {str(e)}\n")
        
        # Now test consensus
        print(" Testing Consensus Evaluation:\n")
        
        # Collect all verdicts
        verdicts = []
        for agent in agents:
            try:
                verdict = await agent.evaluate_claim(
                    policy_path=policy_path,
                    invoice_path=invoice_path,
                    decryption_key=dummy_decryption_key,
                    claim_id=claim_request.claim_id
                )
                # Sign the verdict
                verdict.signature = agent.sign_verdict_asi_native(verdict, claim_request.claim_id)
                verdicts.append(verdict)
            except Exception as e:
                print(f"Error from {agent.agent_id}: {e}")
        
        if verdicts:
            # For testing, we'll create a simple consensus result based on the verdicts
            # In production, this would happen through agent messaging
            
            # Check if all verdicts agree
            verdict_types = [v.verdict for v in verdicts]
            unique_verdicts = set(verdict_types)
            
            if len(unique_verdicts) == 1:
                # Unanimous consensus
                final_verdict = verdict_types[0]
                agreement_ratio = 1.0
                consensus_reached = True
            else:
                # No consensus
                final_verdict = None
                agreement_ratio = max(verdict_types.count(vt) for vt in unique_verdicts) / len(verdict_types)
                consensus_reached = False
            
            print(" Consensus Results:")
            print(f"  Agreement Ratio: {agreement_ratio:.2%}")
            print(f"  Has Consensus: {consensus_reached}")
            print(f"  Final Verdict: {final_verdict.value if final_verdict else 'No consensus'}")
            
            # Calculate average coverage
            coverage_amounts = [v.coverage_amount for v in verdicts if v.coverage_amount is not None]
            if coverage_amounts:
                avg_coverage = sum(coverage_amounts) / len(coverage_amounts)
                print(f"  Average Coverage: ${avg_coverage:.2f}")
            
            # Show verdict distribution
            verdict_dist = {}
            for vt in verdict_types:
                verdict_dist[vt.value] = verdict_dist.get(vt.value, 0) + 1
            print(f"  Verdict Distribution: {verdict_dist}")
            
            # Average processing time
            avg_time = sum(v.processing_time_ms for v in verdicts) / len(verdicts)
            print(f"  Average Processing Time: {avg_time:.0f}ms")
        
    except Exception as e:
        print(f" Error during evaluation: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n Test completed!")

def main():
    """Run the test"""
    # Check if PDFs exist
    test_dir = Path(__file__).parent / "test_pdfs"
    if not (test_dir / "test_policy.pdf").exists():
        print(" Test PDFs not found. Please run create_test_pdfs.py first.")
        return
    
    # Run the async test
    asyncio.run(test_claim_evaluation())

if __name__ == "__main__":
    main()