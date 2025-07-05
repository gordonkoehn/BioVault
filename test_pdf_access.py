#!/usr/bin/env python3
"""
Test script to verify agents can access and read PDF files
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Add project root to path
sys.path.insert(0, '.')

def test_pdf_file_access():
    """Test basic PDF file access"""
    policy_path = "src/agents/tests/test_pdfs/test_policy.pdf"
    invoice_path = "src/agents/tests/test_pdfs/test_invoice.pdf"
    
    print("Testing PDF File Access")
    print("=" * 50)
    
    # Check if files exist
    print(f"Policy PDF exists: {os.path.exists(policy_path)}")
    print(f"Invoice PDF exists: {os.path.exists(invoice_path)}")
    
    if os.path.exists(policy_path):
        size = os.path.getsize(policy_path)
        print(f"Policy PDF size: {size} bytes")
        
    if os.path.exists(invoice_path):
        size = os.path.getsize(invoice_path)
        print(f"Invoice PDF size: {size} bytes")
    
    print()

def test_pdf_reading():
    """Test PDF reading with PyPDF2 and pdfplumber"""
    policy_path = "src/agents/tests/test_pdfs/test_policy.pdf"
    
    print("📖 Testing PDF Reading Libraries")
    print("=" * 50)
    
    # Test PyPDF2
    try:
        import PyPDF2
        with open(policy_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            num_pages = len(reader.pages)
            print(f"✅ PyPDF2: Successfully read {num_pages} pages")
            
            if num_pages > 0:
                first_page = reader.pages[0]
                text_sample = first_page.extract_text()[:100]
                print(f"   Sample text: {text_sample}...")
                
    except Exception as e:
        print(f"❌ PyPDF2 error: {e}")
    
    # Test pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(policy_path) as pdf:
            num_pages = len(pdf.pages)
            print(f"✅ pdfplumber: Successfully read {num_pages} pages")
            
            if num_pages > 0:
                first_page = pdf.pages[0]
                text_sample = first_page.extract_text()[:100] if first_page.extract_text() else "No text extracted"
                print(f"   Sample text: {text_sample}...")
                
    except Exception as e:
        print(f"❌ pdfplumber error: {e}")
    
    print()

def test_agent_imports():
    """Test if agent modules can be imported"""
    print("🤖 Testing Agent Module Imports")
    print("=" * 50)
    
    try:
        from src.agents.nlp_policy_agent import ClaudeLLMAdapter, GPT4LLMAdapter, ASI1LLMAdapter
        print("✅ Agent adapters imported successfully")
        
        from src.agents.schemas import AgentVerdict, VerdictType
        print("✅ Agent schemas imported successfully")
        
    except Exception as e:
        print(f"❌ Import error: {e}")
    
    print()

def test_api_keys():
    """Test if API keys are available"""
    print("🔑 Testing API Key Availability")
    print("=" * 50)
    
    anthropic_key = os.getenv('ANTHROPIC_API_KEY')
    openai_key = os.getenv('OPENAI_API_KEY')
    asi_key = os.getenv('ASI_API_KEY')
    
    print(f"ANTHROPIC_API_KEY: {'✅ Available' if anthropic_key else '❌ Missing'}")
    print(f"OPENAI_API_KEY: {'✅ Available' if openai_key else '❌ Missing'}")
    print(f"ASI_API_KEY: {'✅ Available' if asi_key else '❌ Missing'}")
    
    if anthropic_key:
        print(f"   Anthropic key length: {len(anthropic_key)} chars")
    if openai_key:
        print(f"   OpenAI key length: {len(openai_key)} chars")
    if asi_key:
        print(f"   ASI key length: {len(asi_key)} chars")
    
    print()

def test_simple_agent_creation():
    """Test creating a simple agent instance"""
    print("⚙️ Testing Agent Creation")
    print("=" * 50)
    
    try:
        from src.agents.nlp_policy_agent import ClaudeLLMAdapter
        
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        if not anthropic_key:
            print("❌ Cannot test agent creation - missing ANTHROPIC_API_KEY")
            return
            
        # Try to create a Claude adapter
        adapter = ClaudeLLMAdapter(
            api_key=anthropic_key,
            model_name="claude-3-haiku-20240307",
            max_retries=1
        )
        print("✅ Claude adapter created successfully")
        print(f"   Model: {adapter.model_name}")
        
    except Exception as e:
        print(f"❌ Agent creation error: {e}")
    
    print()

if __name__ == "__main__":
    print("🧪 PDF and Agent Availability Test")
    print("=" * 70)
    print()
    
    test_pdf_file_access()
    test_pdf_reading()
    test_agent_imports()
    test_api_keys()
    test_simple_agent_creation()
    
    print("🏁 Test Complete!")