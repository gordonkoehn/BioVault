"use client";
import { useState, useEffect } from "react";
import { BiometricEncryption } from "@/lib/encryption";
import { ZKProofSimulator } from "@/lib/zk-proofs";
import { uploadFileObject, listFiles } from "@/lib/tusky";
import { getUserVaultId } from "@/lib/vault";
import { FileItem } from "@/lib/tuskyClient";

const biometricTypes = [
  { value: "iris", label: "IRIS SCAN" },
  { value: "heartbeat", label: "HEARTBEAT MONITOR" },
  { value: "fingerprint", label: "FINGERPRINT SCAN" },
  { value: "face", label: "FACIAL RECOGNITION" },
  { value: "voice", label: "VOICE PATTERN" },
];

export default function SubmitClaimPage() {
  const [biometricType, setBiometricType] = useState(biometricTypes[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [minAge, setMinAge] = useState(18);
  const [insuranceType, setInsuranceType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submittedFiles, setSubmittedFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Load submitted files when component mounts
  useEffect(() => {
    const loadSubmittedFiles = async () => {
      try {
        setLoadingFiles(true);
        const vaultId = getUserVaultId();
        if (vaultId) {
          const files = await listFiles();
          setSubmittedFiles(files || []);
        }
      } catch (error) {
        console.error('Error loading submitted files:', error);
      } finally {
        setLoadingFiles(false);
      }
    };

    loadSubmittedFiles();
  }, [success]); // Reload when a new file is successfully submitted

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
    try {
      if (!file) throw new Error("Please upload a biometric file.");
      
      // Upload file to Tusky vault first
      const fileId = await uploadFileObject(file);
      console.log(`File uploaded to Tusky with ID: ${fileId}`);
      
      // Simulate file hash
      const fileHash = await BiometricEncryption.generateFileHash(file);
      // Encrypt file (simulate)
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const fileData = ev.target?.result as string;
        const encrypted = BiometricEncryption.encrypt(fileData);
        // Simulate ZK proof
        const proof = await ZKProofSimulator.generateProof({
          biometricType: biometricType as "iris" | "heartbeat" | "fingerprint" | "face" | "voice",
          dataHash: fileHash,
          requirements: { minAge, insuranceType },
        });
        // Save claim to localStorage
        const claim = {
          id: `claim_${Date.now()}`,
          biometricType,
          submittedAt: Date.now(),
          proof,
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
      <div className="w-full max-w-4xl">
        {/* Submitted Claims Section */}
        <div className="rounded-2xl shadow-lg border bg-white px-8 py-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Submitted Claims</h2>
          {loadingFiles ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
              <p className="mt-2 text-gray-600">Loading submitted files...</p>
            </div>
          ) : submittedFiles.length > 0 ? (
            <div className="space-y-3">
              {submittedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <div className="font-semibold text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-600">Size: {(file.size / 1024).toFixed(2)} KB</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    File ID: {file.id.substring(0, 8)}...
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>No claims submitted yet</p>
              <p className="text-sm">Submit your first biometric claim below</p>
            </div>
          )}
        </div>

        {/* Submit New Claim Section */}
        <div className="rounded-2xl shadow-lg border bg-white px-8 py-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-gray-900">Submit New Biometric Claim</h1>
            <div className="w-20 h-1 bg-gray-200 mx-auto mb-2"></div>
            <p className="text-gray-600 text-base">Upload your biometric data and submit a claim for insurance eligibility.</p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-green-600 font-bold mb-4 text-lg">Claim successfully transmitted</div>
              <div className="text-gray-500 mb-6">Your biometric data has been encrypted and a ZK proof has been generated.</div>
              <a 
                href="/insurance" 
                className="inline-block w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition"
              >
                View in Dashboard
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