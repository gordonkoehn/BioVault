#!/usr/bin/env python3
"""
Command-line script for multi-agent claim evaluation
Called from Next.js API route
Fixes: thread-safety, timeouts, logging, base URL handling
"""
import os
import sys
import json
import asyncio
import tempfile
import aiohttp
import logging
from typing import Dict, Any, List, Optional
import threading
from dotenv import load_dotenv

# Load environment variables from .env.local file
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..')
env_file = os.path.join(project_root, '.env.local')
load_dotenv(env_file)

# Debug: Check if environment variables are loaded (commented out for production)
# print(f"DEBUG: ANTHROPIC_API_KEY exists: {bool(os.getenv('ANTHROPIC_API_KEY'))}")
# print(f"DEBUG: OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")
# print(f"DEBUG: ASI_API_KEY exists: {bool(os.getenv('ASI_API_KEY'))}")

# Add project root to Python path for proper package imports
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..')
sys.path.insert(0, project_root)

# Now we can import as a proper package
from src.agents.nlp_policy_agent import NLPPolicyAgent, ClaudeLLMAdapter, GPT4LLMAdapter, ASI1LLMAdapter
from src.agents.schemas import AgentVerdict

# Configure logging for serverless environment
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Thread-safe cached agents with lock
_cached_agents: Optional[List[NLPPolicyAgent]] = None
_agents_lock = threading.Lock()
_api_keys_validated = False

# Configuration constants
AGENT_TIMEOUT_SECONDS = 45  # Per-agent timeout
TOTAL_TIMEOUT_SECONDS = 55  # Total function timeout (under Vercel's 60s limit)
CONSENSUS_THRESHOLD = 0.67  # 2/3 majority for consensus

async def validate_api_keys() -> Dict[str, str]:
    """
    Validate and return API keys once during startup
    Thread-safe implementation
    """
    global _api_keys_validated
    
    if _api_keys_validated:
        return {
            "anthropic": os.getenv("ANTHROPIC_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"), 
            "asi": os.getenv("ASI_API_KEY")
        }
    
    # Validate all required API keys
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    asi_api_key = os.getenv("ASI_API_KEY")
    
    missing_keys = []
    if not anthropic_api_key:
        missing_keys.append("ANTHROPIC_API_KEY")
    if not openai_api_key:
        missing_keys.append("OPENAI_API_KEY")
    if not asi_api_key:
        missing_keys.append("ASI_API_KEY")
    
    if missing_keys:
        raise Exception(f"Missing required API keys: {missing_keys}")
    
    _api_keys_validated = True
    logger.info("API keys validated successfully")
    return {
        "anthropic": anthropic_api_key,
        "openai": openai_api_key,
        "asi": asi_api_key
    }

async def get_cached_agents() -> List[NLPPolicyAgent]:
    """
    Get or create cached agent instances with thread-safety
    Fixes: Thread-safety of cached agents using threading.Lock
    """
    global _cached_agents
    
    # Thread-safe check and initialization
    with _agents_lock:
        if _cached_agents is not None:
            logger.info("Using cached agents")
            return _cached_agents
    
    logger.info("Initializing agents for the first time")
    
    # Validate API keys once
    api_keys = await validate_api_keys()
    
    agents = []
    
    try:
        # Agent 1: Claude-based NLP Policy Agent
        claude_adapter = ClaudeLLMAdapter(
            api_key=api_keys["anthropic"],
            model_name="claude-3-haiku-20240307",
            max_retries=2  # Reduced for faster timeout
        )
        
        claude_agent = NLPPolicyAgent(
            agent_id="claude_nlp_agent_001",
            seed_phrase="test_claude_seed_phrase_12345",
            endpoint="http://localhost",
            port=8001,
            llm_adapter=claude_adapter
        )
        agents.append(claude_agent)
        logger.info("Claude agent initialized")
        
        # Agent 2: GPT-4-based NLP Policy Agent
        gpt4_adapter = GPT4LLMAdapter(
            api_key=api_keys["openai"],
            model_name="gpt-4-1106-preview",
            max_retries=2
        )
        
        gpt4_agent = NLPPolicyAgent(
            agent_id="gpt4_nlp_agent_001",
            seed_phrase="test_gpt4_seed_phrase_67890", 
            endpoint="http://localhost",
            port=8002,
            llm_adapter=gpt4_adapter
        )
        agents.append(gpt4_agent)
        logger.info("GPT-4 agent initialized")
        
        # Agent 3: ASI1-based NLP Policy Agent
        asi1_adapter = ASI1LLMAdapter(
            api_key=api_keys["asi"],
            model_name="asi1-mini",
            max_retries=2
        )
        
        asi1_agent = NLPPolicyAgent(
            agent_id="asi1_nlp_agent_001",
            seed_phrase="test_asi1_seed_phrase_abcde",
            endpoint="http://localhost", 
            port=8003,
            llm_adapter=asi1_adapter
        )
        agents.append(asi1_agent)
        logger.info("ASI1 agent initialized")
        
        # Thread-safe cache assignment
        with _agents_lock:
            _cached_agents = agents
            
        logger.info(f"Successfully initialized {len(agents)} agents")
        return agents
        
    except Exception as e:
        logger.error(f"Failed to initialize agents: {e}")
        raise

async def download_from_tusky(file_id: str, base_url: str, temp_dir: str, filename: str) -> str:
    """
    Download file from Tusky API with timeout and proper error handling
    Fixes: Request timeout issues
    """
    download_url = f"{base_url}/api/vault/file?fileId={file_id}&download=true"
    logger.info(f"Downloading {filename} from {download_url}")
    
    timeout = aiohttp.ClientTimeout(total=30)  # 30 second download timeout
    
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(download_url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Failed to download file {file_id}: {response.status} - {error_text}")
                
                # Save to temporary file
                file_path = os.path.join(temp_dir, filename)
                with open(file_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)
                
                file_size = os.path.getsize(file_path)
                logger.info(f"Downloaded {filename}: {file_size} bytes")
                
                # DEBUG: Check if it's actually a PDF
                with open(file_path, 'rb') as f:
                    first_bytes = f.read(10)
                    logger.info(f"DEBUG: {filename} first 10 bytes: {first_bytes}")
                    logger.info(f"DEBUG: {filename} starts with PDF header: {first_bytes.startswith(b'%PDF')}")
                
                # DEBUG: Try to read PDF content
                try:
                    import PyPDF2
                    with open(file_path, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        num_pages = len(reader.pages)
                        if num_pages > 0:
                            text_sample = reader.pages[0].extract_text()[:100]
                            logger.info(f"DEBUG: {filename} has {num_pages} pages, sample text: {text_sample}")
                        else:
                            logger.warning(f"DEBUG: {filename} has 0 pages")
                except Exception as e:
                    logger.error(f"DEBUG: Failed to read {filename} as PDF: {e}")
                
                return file_path
                
    except asyncio.TimeoutError:
        raise Exception(f"Timeout downloading file {file_id}")
    except Exception as e:
        logger.error(f"Download error for {file_id}: {e}")
        raise

async def evaluate_single_agent(agent: NLPPolicyAgent, policy_path: str, 
                               invoice_path: str, claim_id: str) -> tuple[Optional[AgentVerdict], Optional[str]]:
    """
    Evaluate a single agent with timeout protection
    Fixes: No request timeout - individual agent timeouts
    """
    try:
        logger.info(f"Starting evaluation with {agent.agent_id}")
        
        # Wrap with timeout to prevent hanging
        verdict = await asyncio.wait_for(
            agent.evaluate_claim(
                policy_path=policy_path,
                invoice_path=invoice_path,
                decryption_key="test_key_for_unencrypted_pdfs_32c",
                claim_id=claim_id
            ),
            timeout=AGENT_TIMEOUT_SECONDS
        )
        
        # Sign the verdict
        verdict.signature = agent.sign_verdict_asi_native(verdict, claim_id)
        
        logger.info(f"Successfully evaluated with {agent.agent_id}: {verdict.verdict.value}")
        return verdict, None
        
    except asyncio.TimeoutError:
        error_msg = f"Timeout after {AGENT_TIMEOUT_SECONDS}s"
        logger.warning(f"{agent.agent_id}: {error_msg}")
        return None, error_msg
    except Exception as e:
        error_msg = str(e)
        logger.error(f"{agent.agent_id}: {error_msg}")
        return None, error_msg

async def evaluate_with_all_agents(agents: List[NLPPolicyAgent], 
                                 policy_path: str, invoice_path: str, 
                                 claim_id: str) -> tuple[List[AgentVerdict], List[Dict[str, str]]]:
    """
    Run evaluation on all agents with comprehensive timeout and error handling
    Fixes: Proper timeout handling and parallel execution
    """
    logger.info(f"Starting evaluation with {len(agents)} agents")
    
    # Run all agents in parallel with individual timeouts
    tasks = [
        evaluate_single_agent(agent, policy_path, invoice_path, claim_id)
        for agent in agents
    ]
    
    try:
        # Overall timeout for all agents
        results = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=AGENT_TIMEOUT_SECONDS + 5  # Small buffer
        )
    except asyncio.TimeoutError:
        logger.error("Overall timeout reached for all agents")
        return [], [{"agent_id": "all", "error": "Overall timeout"}]
    
    verdicts = []
    failed_agents = []
    
    for i, result in enumerate(results):
        agent = agents[i]
        
        if isinstance(result, Exception):
            failed_agents.append({
                "agent_id": agent.agent_id,
                "error": str(result),
                "llm_backend": agent.llm_adapter.model_name
            })
        elif isinstance(result, tuple):
            verdict, error = result
            if verdict:
                verdicts.append(verdict)
            else:
                failed_agents.append({
                    "agent_id": agent.agent_id,
                    "error": error or "Unknown error",
                    "llm_backend": agent.llm_adapter.model_name
                })
    
    logger.info(f"Evaluation complete: {len(verdicts)} successful, {len(failed_agents)} failed")
    return verdicts, failed_agents

def calculate_consensus(verdicts: List[AgentVerdict], failed_agents: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Calculate consensus with support for partial results and configurable threshold
    """
    total_agents = len(verdicts) + len(failed_agents)
    
    if not verdicts:
        return {
            "success": False,
            "error": "No valid verdicts from any agents",
            "failed_agents": failed_agents,
            "consensus": None
        }
    
    # Extract verdict types
    verdict_types = [v.verdict for v in verdicts]
    unique_verdicts = set(verdict_types)
    
    if len(unique_verdicts) == 1:
        # Unanimous consensus among responding agents
        final_verdict = verdict_types[0]
        agreement_ratio = 1.0
        consensus_reached = True
    else:
        # Calculate majority
        most_common_verdict = max(set(verdict_types), key=verdict_types.count)
        most_common_count = verdict_types.count(most_common_verdict)
        agreement_ratio = most_common_count / len(verdict_types)
        consensus_reached = agreement_ratio >= CONSENSUS_THRESHOLD
        final_verdict = most_common_verdict if consensus_reached else None
    
    # Calculate average coverage
    coverage_amounts = [v.coverage_amount for v in verdicts if v.coverage_amount is not None]
    avg_coverage = sum(coverage_amounts) / len(coverage_amounts) if coverage_amounts else None
    
    # Verdict distribution
    verdict_dist = {}
    for vt in verdict_types:
        verdict_dist[vt.value] = verdict_dist.get(vt.value, 0) + 1
    
    # Average processing time
    avg_time = sum(v.processing_time_ms for v in verdicts) / len(verdicts)
    
    return {
        "success": True,
        "consensus": {
            "agreement_ratio": agreement_ratio,
            "has_consensus": consensus_reached,
            "final_verdict": final_verdict.value if final_verdict else None,
            "average_coverage": avg_coverage,
            "verdict_distribution": verdict_dist,
            "average_processing_time_ms": avg_time,
            "responding_agents": len(verdicts),
            "failed_agents_count": len(failed_agents),
            "total_agents": total_agents,
            "consensus_threshold": CONSENSUS_THRESHOLD
        },
        "individual_verdicts": [verdict_to_dict(v) for v in verdicts],
        "failed_agents": failed_agents
    }

def verdict_to_dict(verdict: AgentVerdict) -> Dict[str, Any]:
    """Convert AgentVerdict to JSON-serializable dictionary"""
    return {
        "agent_id": verdict.agent_id,
        "agent_type": verdict.agent_type,
        "verdict": verdict.verdict.value,
        "coverage_amount": verdict.coverage_amount,
        "primary_reason": verdict.primary_reason,
        "processing_time_ms": verdict.processing_time_ms,
        "timestamp": verdict.timestamp.isoformat(),
        "llm_backend": verdict.execution_context.model_version if verdict.execution_context else "unknown"
    }

def get_base_url_from_request(request) -> str:
    """
    Extract base URL from request with fallback handling
    Fixes: Base URL guessing with proper fallbacks
    """
    try:
        if hasattr(request, 'headers'):
            host = request.headers.get('host')
            if host:
                # Detect protocol based on host patterns
                if any(domain in host for domain in ['vercel.app', 'netlify.app', 'herokuapp.com']):
                    protocol = 'https'
                elif 'localhost' in host or '127.0.0.1' in host:
                    protocol = 'http'
                else:
                    protocol = 'https'  # Default to secure
                
                base_url = f"{protocol}://{host}"
                logger.info(f"Detected base URL: {base_url}")
                return base_url
    except Exception as e:
        logger.warning(f"Failed to extract base URL from request: {e}")
    
    # Fallback to environment or default
    fallback = os.getenv("VERCEL_URL", "http://localhost:3000")
    if not fallback.startswith("http"):
        fallback = f"https://{fallback}"
    
    logger.info(f"Using fallback base URL: {fallback}")
    return fallback

async def evaluate_claim_multi_agent(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main multi-agent evaluation logic with comprehensive error handling and timeouts
    """
    claim_id = data['claim_id']
    policy_walrus_id = data['policy_walrus_id']
    invoice_walrus_id = data['invoice_walrus_id']
    base_url = data.get('base_url')
    
    if not base_url:
        raise ValueError("base_url is required in request data")
    
    logger.info(f"Starting evaluation for claim {claim_id}")
    
    # Use temporary directory for file downloads
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Download files with timeout protection
            download_tasks = [
                download_from_tusky(policy_walrus_id, base_url, temp_dir, "policy.pdf"),
                download_from_tusky(invoice_walrus_id, base_url, temp_dir, "invoice.pdf")
            ]
            
            policy_path, invoice_path = await asyncio.wait_for(
                asyncio.gather(*download_tasks),
                timeout=30
            )
            
            # Get cached agents
            agents = await get_cached_agents()
            
            # DEBUG: Final check before passing to agents
            logger.info(f"DEBUG: About to pass to agents:")
            logger.info(f"DEBUG: Policy path: {policy_path}, exists: {os.path.exists(policy_path)}")
            logger.info(f"DEBUG: Invoice path: {invoice_path}, exists: {os.path.exists(invoice_path)}")
            if os.path.exists(policy_path):
                logger.info(f"DEBUG: Policy file size: {os.path.getsize(policy_path)} bytes")
            if os.path.exists(invoice_path):
                logger.info(f"DEBUG: Invoice file size: {os.path.getsize(invoice_path)} bytes")
            
            # Run evaluation on all agents with comprehensive error handling
            agent_verdicts, failed_agents = await evaluate_with_all_agents(
                agents, policy_path, invoice_path, claim_id
            )
            
            # Calculate consensus with partial results support
            consensus_result = calculate_consensus(agent_verdicts, failed_agents)
            
            logger.info(f"Evaluation complete for claim {claim_id}")
            return consensus_result
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout during file download for claim {claim_id}")
            return {
                "success": False,
                "error": "Timeout during file download",
                "claim_id": claim_id
            }
        except Exception as e:
            logger.error(f"Error evaluating claim {claim_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "claim_id": claim_id
            }

# Vercel serverless function handler (compatible with Next.js App Router)
def handler(request):
    """
    Main entry point for Vercel serverless function
    Compatible with both legacy and App Router
    """
    try:
        logger.info("Received evaluation request")
        
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                'body': ''
            }
        
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"error": "Method not allowed"})
            }
        
        # Parse request body (handle different request formats)
        body = None
        if hasattr(request, 'body'):
            body = request.body
        elif hasattr(request, 'data'):
            body = request.data
        elif hasattr(request, 'get_body'):
            body = request.get_body()
        else:
            # Fallback for direct testing
            body = getattr(request, '_body', None)
        
        if isinstance(body, bytes):
            body = body.decode('utf-8')
        
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"error": "Invalid JSON in request body"})
            }
        
        # Validate required fields
        required_fields = ['claim_id', 'policy_walrus_id', 'invoice_walrus_id', 'vault_id']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"error": f"Missing required fields: {missing_fields}"})
            }
        
        # Add base_url if not provided
        if 'base_url' not in data:
            data['base_url'] = get_base_url_from_request(request)
        
        # Run async evaluation with overall timeout protection
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Overall function timeout to stay under Vercel's 60s limit
        result = loop.run_until_complete(
            asyncio.wait_for(
                evaluate_claim_multi_agent(data),
                timeout=TOTAL_TIMEOUT_SECONDS
            )
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, indent=2)
        }
        
    except asyncio.TimeoutError:
        logger.error("Function timeout reached")
        return {
            'statusCode': 408,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                "success": False,
                "error": f"Function timeout after {TOTAL_TIMEOUT_SECONDS}s"
            })
        }
    except Exception as e:
        logger.error(f"Handler error: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            })
        }

# Command-line interface for Next.js integration
async def main():
    """
    Main function for command-line execution
    Reads JSON from stdin and outputs result to stdout
    """
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        # Call the evaluation function
        result = await evaluate_claim_multi_agent(data)
        
        # Output result as JSON to stdout
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())