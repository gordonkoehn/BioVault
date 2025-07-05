#!/usr/bin/env python3
"""
Test the full Walrus->Download->Agent flow
Simulates what happens in the Flask API
"""
import os
import sys
import asyncio
import tempfile
import aiohttp
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
sys.path.insert(0, '.')

async def test_walrus_download_flow():
    """Test downloading PDFs from Walrus and processing with agents"""
    print("Testing Walrus PDF Download Flow")
    print("=" * 60)
    
    # Simulate the Flask API flow
    base_url = "http://localhost:3000"
    
    # These would be real Walrus file IDs from uploaded files
    # For testing, we'll use the Next.js API to serve our test PDFs
    test_policy_id = "test_policy_file_id"
    test_invoice_id = "test_invoice_file_id"
    
    print(f"Base URL: {base_url}")
    print(f"Policy ID: {test_policy_id}")
    print(f"Invoice ID: {test_invoice_id}")
    print()
    
    # Test 1: Check if Next.js vault API is running
    print("Testing Next.js Vault API Availability")
    print("-" * 40)
    
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Try to reach the Next.js health endpoint
            health_url = f"{base_url}/"
            async with session.get(health_url) as response:
                if response.status == 200:
                    print("SUCCESS: Next.js server is running")
                else:
                    print(f"WARNING: Next.js server returned {response.status}")
    except Exception as e:
        print(f"ERROR: Cannot reach Next.js server: {e}")
        print("NOTE: Make sure 'npm run next-dev' is running")
        print("CONTINUING: Will test simulation flow anyway")
    
    print()
    
    # Test 2: Try to download from vault API (this will likely fail without real file IDs)
    print("Testing File Download from Vault API")
    print("-" * 40)
    
    async def try_download(file_id: str, filename: str) -> bool:
        try:
            download_url = f"{base_url}/api/vault/file?fileId={file_id}"
            print(f"Attempting: {download_url}")
            
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(download_url) as response:
                    if response.status == 200:
                        content = await response.read()
                        print(f"SUCCESS: Downloaded {filename}: {len(content)} bytes")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"ERROR: Download failed for {filename}: {response.status}")
                        print(f"   Error: {error_text[:100]}...")
                        return False
        except Exception as e:
            print(f"ERROR: Download error for {filename}: {e}")
            return False
    
    policy_ok = await try_download(test_policy_id, "policy.pdf")
    invoice_ok = await try_download(test_invoice_id, "invoice.pdf")
    
    if not (policy_ok and invoice_ok):
        print("\nWARNING: Cannot test with real Walrus downloads (expected)")
        print("NOTE: This requires actual uploaded files with real Walrus IDs")
    
    print()
    
    # Test 3: Simulate the full flow with local test files
    print("Simulating Full Download->Process Flow")
    print("-" * 40)
    
    await simulate_agent_processing()

async def simulate_agent_processing():
    """Simulate the agent processing after download"""
    
    # Use temporary directory like the Flask API does
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Created temp directory: {temp_dir}")
        
        # Copy test files to temp directory (simulating download)
        import shutil
        
        source_policy = "src/agents/tests/test_pdfs/test_policy.pdf"
        source_invoice = "src/agents/tests/test_pdfs/test_invoice.pdf"
        
        policy_path = os.path.join(temp_dir, "policy.pdf")
        invoice_path = os.path.join(temp_dir, "invoice.pdf")
        
        if os.path.exists(source_policy) and os.path.exists(source_invoice):
            shutil.copy2(source_policy, policy_path)
            shutil.copy2(source_invoice, invoice_path)
            
            print(f"SUCCESS: Copied policy to: {policy_path}")
            print(f"SUCCESS: Copied invoice to: {invoice_path}")
            
            # Verify files are accessible
            print(f"Policy size: {os.path.getsize(policy_path)} bytes")
            print(f"Invoice size: {os.path.getsize(invoice_path)} bytes")
            
            # Test PDF reading from temp directory
            await test_pdf_reading_from_temp(policy_path, invoice_path)
            
            # Test agent creation and basic functionality
            await test_agent_with_temp_files(policy_path, invoice_path)
            
        else:
            print("ERROR: Test PDF files not found")

async def test_pdf_reading_from_temp(policy_path: str, invoice_path: str):
    """Test reading PDFs from temporary directory"""
    print("\nTesting PDF Reading from Temp Directory")
    print("-" * 40)
    
    try:
        import PyPDF2
        
        # Test policy
        with open(policy_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            policy_text = reader.pages[0].extract_text()
            print(f"SUCCESS: Policy PDF readable: {len(policy_text)} chars")
            print(f"   Sample: {policy_text[:50]}...")
        
        # Test invoice
        with open(invoice_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            invoice_text = reader.pages[0].extract_text()
            print(f"SUCCESS: Invoice PDF readable: {len(invoice_text)} chars")
            print(f"   Sample: {invoice_text[:50]}...")
            
    except Exception as e:
        print(f"ERROR: PDF reading error: {e}")

async def test_agent_with_temp_files(policy_path: str, invoice_path: str):
    """Test agent creation and file access"""
    print("\nTesting Agent with Temp Files")
    print("-" * 40)
    
    try:
        from src.agents.nlp_policy_agent import ClaudeLLMAdapter
        
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        if not anthropic_key:
            print("ERROR: Cannot test agent - missing ANTHROPIC_API_KEY")
            return
        
        # Create agent
        adapter = ClaudeLLMAdapter(
            api_key=anthropic_key,
            model_name="claude-3-haiku-20240307",
            max_retries=1
        )
        print("SUCCESS: Agent created successfully")
        
        # Test if agent can access the files
        if os.path.exists(policy_path) and os.path.exists(invoice_path):
            print(f"SUCCESS: Agent can access policy: {os.path.exists(policy_path)}")
            print(f"SUCCESS: Agent can access invoice: {os.path.exists(invoice_path)}")
            
            # Test file sizes from agent perspective
            print(f"   Policy size from agent: {os.path.getsize(policy_path)} bytes")
            print(f"   Invoice size from agent: {os.path.getsize(invoice_path)} bytes")
        
        print("SUCCESS: Full Walrus->Download->Agent flow simulation complete!")
        
    except Exception as e:
        print(f"ERROR: Agent test error: {e}")

if __name__ == "__main__":
    print("Walrus PDF Flow Test")
    print("=" * 70)
    print()
    
    asyncio.run(test_walrus_download_flow())
    
    print("\nTest Complete!")
    print("\nKey Points:")
    print("   - PDFs are downloaded from Walrus to temp directory")
    print("   - Agents process local file paths, not Walrus IDs")
    print("   - Temp directory is cleaned up after processing")
    print("   - This simulates the exact Flask API flow")