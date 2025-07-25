'use client';

import { useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useVerificationStore } from '../store/verificationStore';
import { useRouter } from 'next/navigation';

interface ZKProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
}

interface ZKPublicInputs {
  [key: string]: string;
}

interface VerificationState {
  verifiedWallets: Set<string>;
  markVerified: (wallet: string) => void;
  isVerified: (wallet: string) => boolean;
}

async function generateRealProof(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/zk-proof', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

async function verifyRealProof(proof: any, publicInputs: any) {
  const response = await fetch('/api/zk-proof', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof, publicInputs }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const result = await response.json();
  return result.isValid;
}

export default function ZKProofDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [proof, setProof] = useState<ZKProof | null>(null);
  const [publicInputs, setPublicInputs] = useState<ZKPublicInputs | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = usePrivy();
  const markVerified = useVerificationStore((state: VerificationState) => state.markVerified);
  const isVerified = useVerificationStore((state: VerificationState) => state.isVerified);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setProof(null);
      setPublicInputs(null);
      setParsedJson(null);
      setVerificationResult(null);
    }
  };

  const generateProof = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateRealProof(file);
      
      if (result.success) {
        setProof(result.proof);
        setPublicInputs(result.publicInputs);
        setParsedJson(result.parsed);
        setError(null);
      } else {
        setError(result.error || 'Failed to generate proof');
      }
    } catch (err) {
      setError('Error generating proof: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const verifyProof = async () => {
    if (!proof || !publicInputs) {
      setError('No proof to verify');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyRealProof(proof, publicInputs);
      
      setVerificationResult(result);
      setError(null);
      if (result && user?.wallet?.address) {
        markVerified(user.wallet.address);
        router.push('/submit-invoice');
      }
    } catch (err) {
      setError('Error verifying proof: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">ZK Proof Generation Demo</h2>
        
        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Biometric File (PDF recommended)
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.wav,.mp3"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Generate Proof Button */}
          <button
            onClick={generateProof}
            disabled={!file || isGenerating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating Proof...' : 'Generate ZK Proof'}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Parsed JSON Display */}
          {parsedJson && (
            <div className="bg-white rounded-lg shadow p-4 border border-blue-100 transition-all">
              <h2 className="font-semibold mb-2 text-blue-800">Parsed PDF Data (JSON)</h2>
              <pre className="bg-blue-50 rounded p-2 text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">{JSON.stringify(parsedJson, null, 2)}</pre>
            </div>
          )}

          {/* Proof Display */}
          {proof && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                ✅ ZK Proof generated successfully!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Proof Details</h3>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <p><strong>Size:</strong> {JSON.stringify(proof).length} characters</p>
                    <p><strong>Type:</strong> Groth16</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Public Inputs</h3>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    {Object.entries(publicInputs || {}).map(([key, value]) => (
                      <p key={key}>
                        <strong>{key}:</strong> {value}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Verify Proof Button */}
              <button
                onClick={verifyProof}
                disabled={isVerifying}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying...' : 'Verify Proof'}
              </button>

              {/* Verification Result */}
              {verificationResult !== null && (
                <div className={`px-4 py-3 rounded ${
                  verificationResult 
                    ? 'bg-green-50 border border-green-200 text-green-700' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {verificationResult ? '✅ Proof verified successfully!' : '❌ Proof verification failed!'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">How it works:</h3>
        <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
          <li>Upload a PDF health report or any biometric file</li>
          <li>For PDFs, the system extracts structured health data as JSON</li>
          <li>The data is hashed and converted to circuit input format</li>
          <li>A ZK proof is generated using your compiled Circom circuit</li>
          <li>The proof can be verified without revealing the original data</li>
          <li>This demonstrates privacy-preserving biometric verification</li>
        </ol>
      </div>
    </div>
  );
} 