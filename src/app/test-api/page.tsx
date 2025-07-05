"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function TestAPIPage() {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const testPythonAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/python');
      const data = await res.text();
      setResponse(data);
    } catch (error) {
      setResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testHealthAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testInfoAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testCustomAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Hello from Next.js!' })
      });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Flask API Test Page
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Test your Python Flask serverless functions
        </p>

        <div className="space-y-6">
          {/* Navigation */}
          <div className="flex justify-center">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Home
            </Link>
          </div>

          {/* Test Buttons */}
          <div className="grid gap-3">
            <button
              onClick={testPythonAPI}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Test GET /api/python'}
            </button>

            <button
              onClick={testCustomAPI}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Test POST /api/test'}
            </button>

            <button
              onClick={testHealthAPI}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Test GET /api/health'}
            </button>

            <button
              onClick={testInfoAPI}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Test GET /api/info'}
            </button>
          </div>

          {/* Response Display */}
          {response && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                API Response:
              </h3>
              <div className="bg-gray-100 rounded-lg p-4 border">
                <pre className="whitespace-pre-wrap text-sm text-gray-800">
                  {response}
                </pre>
              </div>
            </div>
          )}

          {/* API Documentation */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              How it works:
            </h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Next.js rewrites <code>/api/*</code> requests to your Flask server</li>
              <li>• In development: proxies to <code>http://127.0.0.1:5328</code></li>
              <li>• In production: uses Vercel serverless functions</li>
              <li>• Your Flask app is in <code>/api/index.py</code></li>
            </ul>
          </div>

          {/* Development Commands */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Development Commands:
            </h3>
            <div className="text-yellow-800 text-sm space-y-2">
              <div>
                <strong>Start both servers:</strong>
                <code className="block bg-yellow-100 p-2 rounded mt-1 font-mono text-xs">
                  npm run dev
                </code>
              </div>
              <div>
                <strong>Start Flask only:</strong>
                <code className="block bg-yellow-100 p-2 rounded mt-1 font-mono text-xs">
                  npm run flask-dev
                </code>
              </div>
              <div>
                <strong>Start Next.js only:</strong>
                <code className="block bg-yellow-100 p-2 rounded mt-1 font-mono text-xs">
                  npm run next-dev
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
