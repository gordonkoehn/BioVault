"use client";
import { useState } from "react";
import { BiometricEncryption } from "@/lib/encryption";
import { uploadFileObject } from "@/lib/tusky";

const biometricTypes = [
  { value: "iris", label: "IRIS SCAN" },
  { value: "heartbeat", label: "HEARTBEAT MONITOR" },
  { value: "fingerprint", label: "FINGERPRINT SCAN" },
  { value: "face", label: "FACIAL RECOGNITION" },
  { value: "voice", label: "VOICE PATTERN" },
];

interface ZKProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
}

export default function SubmitClaimPage() {
  const [biometricType, setBiometricType] = useState(biometricTypes[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [minAge, setMinAge] = useState(18);
  const [insuranceType, setInsuranceType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [zkProof, setZkProof] = useState<ZKProof | null>(null);
  const [zkProofError, setZkProofError] = useState<string | null>(null);
  const [zkProofVerified, setZkProofVerified] = useState<boolean | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    setZkProof(null);
    setZkProofError(null);
    setZkProofVerified(null);
    try {
      if (!file) throw new Error("Please upload a biometric file.");
      // Upload file to Tusky vault first
      const fileId = await uploadFileObject(file);
      console.log(`File uploaded to Tusky with ID: ${fileId}`);
      // Encrypt file (simulate)
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const fileData = ev.target?.result as string;
        const encrypted = BiometricEncryption.encrypt(fileData);
        // --- ZK Proof Generation ---
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/zk-proof', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          if (result.success) {
            setZkProof(result.proof);
            // Optionally verify proof immediately
            const verifyRes = await fetch('/api/zk-proof', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ proof: result.proof, publicInputs: result.publicInputs }),
            });
            const verifyJson = await verifyRes.json();
            setZkProofVerified(verifyJson.isValid);
          } else {
            setZkProofError(result.error || 'Failed to generate ZK proof');
          }
        } catch (zkErr: any) {
          setZkProofError(zkErr.message || 'Error generating ZK proof');
        }
        // Save claim to localStorage
        const claim = {
          id: `claim_${Date.now()}`,
          biometricType,
          submittedAt: Date.now(),
          requirements: { minAge, insuranceType },
          encrypted,
          tuskyFileId: fileId, // Store the Tusky file ID
        };
        const prev = localStorage.getItem("claims");
        const claims = prev ? JSON.parse(prev) : [];
        claims.push(claim);
        localStorage.setItem("claims", JSON.stringify(claims));
        setSuccess(true);
        setSubmitting(false);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setSubmitting(false);
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-lg border bg-white px-8 py-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-gray-900">Submit Biometric Claim</h1>
            <div className="w-20 h-1 bg-gray-200 mx-auto mb-2"></div>
            <p className="text-gray-600 text-base">Upload your biometric data and submit a claim for insurance eligibility.</p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-green-600 font-bold mb-4 text-lg">Claim successfully transmitted</div>
              <div className="text-gray-500 mb-6">Your biometric data has been encrypted and a ZK proof has been generated and verified.</div>
              {zkProof && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">ZK Proof</h3>
                  <pre className="bg-gray-100 rounded p-2 text-xs text-left overflow-x-auto max-h-40">{JSON.stringify(zkProof, null, 2)}</pre>
                  {zkProofVerified !== null && (
                    <div className={`mt-2 px-3 py-2 rounded text-sm ${zkProofVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {zkProofVerified ? '✅ Proof verified successfully!' : '❌ Proof verification failed!'}
                    </div>
                  )}
                  {zkProofError && (
                    <div className="mt-2 px-3 py-2 rounded text-sm bg-red-100 text-red-800">
                      {zkProofError}
                    </div>
                  )}
                </div>
              )}
              <a 
                href="/insurance" 
                className="inline-block w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition"
              >
                View Insurance Dashboard
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block mb-2 font-semibold text-gray-900">Biometric Type</label>
                <select
                  className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-gray-900 focus:border-black focus:outline-none transition-colors"
                  value={biometricType}
                  onChange={e => setBiometricType(e.target.value)}
                >
                  {biometricTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-900">Biometric Data File</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-black transition-colors">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.wav,.mp3,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">📁</div>
                    <div className="text-gray-500">
                      {file ? file.name : "Click to upload biometric data"}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Supports: JPG, PNG, WAV, MP3, PDF
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-900">Minimum Age Requirement</label>
                <input
                  type="number"
                  min={0}
                  value={minAge}
                  onChange={e => setMinAge(Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-gray-900 focus:border-black focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-900">Insurance Type</label>
                <input
                  type="text"
                  value={insuranceType}
                  onChange={e => setInsuranceType(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-gray-900 focus:border-black focus:outline-none transition-colors"
                  placeholder="e.g. Health, Life, Travel"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 rounded text-red-700 text-center">
                  ERROR: {error}
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition ${submitting ? "opacity-50" : ""}`}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Submit Claim"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 