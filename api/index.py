from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import json
import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env.local file
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..')
env_file = os.path.join(project_root, '.env.local')
load_dotenv(env_file)

# Add project root to Python path for agent imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import the evaluate_claim function from our existing code
from api.evaluate_claim import evaluate_claim_multi_agent

app = Flask(__name__)
CORS(app)

@app.route("/api/python")
def hello_world():
    return "<p>Hello, World from Flask!</p>"

@app.route("/api/test", methods=['POST'])
def test_endpoint():
    try:
        data = request.get_json()
        response = {
            "status": "success",
            "message": "Flask API is working!",
            "received_data": data,
            "timestamp": time.time(),
            "server": "Python Flask on Vercel"
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500

@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "BioVault Flask API",
        "timestamp": time.time()
    })

@app.route("/api/info")
def api_info():
    return jsonify({
        "name": "BioVault API",
        "version": "1.0.0",
        "description": "Flask API for BioVault - Privacy-preserving biometric identity",
        "endpoints": [
            "/api/python - Hello World endpoint",
            "/api/test - Test POST endpoint",
            "/api/health - Health check",
            "/api/info - API information",
            "/api/evaluate_claim - Multi-agent claim evaluation"
        ]
    })

@app.route("/api/evaluate_claim", methods=['POST'])
def evaluate_claim():
    """
    Evaluate an insurance claim using multi-agent consensus
    Expects JSON with: claim_id, policy_walrus_id, invoice_walrus_id, vault_id
    """
    try:
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['claim_id', 'policy_walrus_id', 'invoice_walrus_id', 'vault_id']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                "success": False,
                "error": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Add base_url if not provided
        if 'base_url' not in data:
            # Get the base URL from the request
            base_url = request.url_root.rstrip('/')
            data['base_url'] = base_url
        
        # Log the evaluation request
        print(f"Evaluating claim: {data['claim_id']}")
        print(f"Policy: {data['policy_walrus_id']}")
        print(f"Invoice: {data['invoice_walrus_id']}")
        
        # Run the async evaluation function
        # Flask is sync, so we need to run the async function in an event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Call the existing evaluation function
            result = loop.run_until_complete(evaluate_claim_multi_agent(data))
            
            # Return the result
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        print(f"Error in evaluate_claim endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500