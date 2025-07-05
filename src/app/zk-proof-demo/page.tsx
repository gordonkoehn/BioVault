"use client";
import { useState } from "react";

export default function ZKProofDemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");
  const [proof, setProof] = useState<any>(null);
  const [publicInputs, setPublicInputs] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<null | boolean>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Example: hash the file as SHA-256 (replace with Poseidon if needed)
  async function hashFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
      setProof(null);
      setPublicInputs(null);
      setVerificationResult(null);
      setIsLoading(true);
      try {
        // Hash the file client-side
        const hash = await hashFile(selectedFile);
        setHash(hash);
        // Send hash to backend for proof generation
        const response = await fetch("/api/zk-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash }),
        });
        const result = await response.json();
        if (result.success) {
          setProof(result.proof);
          setPublicInputs(result.publicInputs);
        } else {
          setError(result.error || "Failed to generate proof");
        }
      } catch (err: any) {
        setError(err.message || "Error generating proof");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVerify = async () => {
    if (!proof || !publicInputs) return;
    setIsVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/zk-proof", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, publicInputs }),
      });
      const result = await response.json();
      if (result.success) {
        setVerificationResult(result.isValid);
      } else {
        setError(result.error || "Failed to verify proof");
      }
    } catch (err: any) {
      setError(err.message || "Error verifying proof");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ZK Proof Generation Demo</h1>
      <input type="file" onChange={handleFileChange} className="mb-4" />
      {isLoading && <div className="mb-4 text-blue-600">Generating proof...</div>}
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {proof && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Proof</h2>
          <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(proof, null, 2)}</pre>
          <h2 className="font-semibold mb-2 mt-4">Public Inputs</h2>
          <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(publicInputs, null, 2)}</pre>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {isVerifying ? "Verifying..." : "Verify Proof"}
          </button>
        </div>
      )}
      {verificationResult !== null && (
        <div className={`mt-4 px-4 py-2 rounded text-lg font-bold ${verificationResult ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {verificationResult ? "✅ Proof verified successfully!" : "❌ Proof verification failed!"}
        </div>
      )}
    </div>
  );
} 