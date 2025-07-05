from flask import Flask, request, jsonify
import time
import json

app = Flask(__name__)

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
            "/api/info - API information"
        ]
    })