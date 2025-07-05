"use client";
import { useState, useEffect } from "react";
import { ZKProofSimulator, BiometricProof } from "@/lib/zk-proofs";

// Helper to get claims from localStorage or fallback to dummy data
function getClaims() {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("claims");
  if (stored) return JSON.parse(stored);
  // fallback dummy data for first load
  return [
    {
      id: "claim_1",
      biometricType: "iris",
      submittedAt: Date.now() - 1000 * 60 * 60,
      proof: {
        proofId: "proof_iris_1",
        biometricType: "iris",
        proofHash: "abc123...",
        publicInputs: { irisPattern: "verified", uniqueness: 0.99 },
        timestamp: Date.now() - 1000 * 60 * 60,
        verified: true,
      },
      requirements: { minAge: 18, insuranceType: "health" },
    },
    {
      id: "claim_2",
      biometricType: "heartbeat",
      submittedAt: Date.now() - 1000 * 60 * 30,
      proof: {
        proofId: "proof_heartbeat_1",
        biometricType: "heartbeat",
        proofHash: "def456...",
        publicInputs: { heartRate: "normal", bpm: "72" },
        timestamp: Date.now() - 1000 * 60 * 30,
        verified: true,
      },
      requirements: { minAge: 21, insuranceType: "life" },
    },
  ];
}

export default function InsuranceDashboard() {
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [eligibility, setEligibility] = useState<null | boolean>(null);
  const [loading, setLoading] = useState(false);

  // Load claims from localStorage on mount
  useEffect(() => {
    setClaims(getClaims());
  }, []);

  // Refresh claims from localStorage
  const refreshClaims = () => {
    setClaims(getClaims());
    setSelectedClaim(null);
    setEligibility(null);
  };

  const checkEligibility = async (claim: any) => {
    setLoading(true);
    setEligibility(null);
    // Simulate eligibility check using ZKProofSimulator
    const eligibleProof = await ZKProofSimulator.generateEligibilityProof(
      claim.proof as BiometricProof,
      claim.requirements
    );
    setEligibility(!!eligibleProof.publicInputs.eligibility);
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-gray-900">Insurance Claims Dashboard</h1>
          <div className="w-24 h-1 bg-gray-200 mx-auto"></div>
        </div>

        <div className="flex items-center gap-4 mb-6 justify-center">
          <button
            className="py-2 px-6 rounded-lg border border-gray-300 text-base font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition"
            onClick={refreshClaims}
          >
            Refresh Database
          </button>
          <span className="text-lg text-gray-700">({claims.length} claims detected)</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Claims List */}
          <div className="rounded-2xl shadow border bg-white p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Incoming Claims</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-300 border ${
                    selectedClaim?.id === claim.id 
                      ? "border-black bg-gray-100" 
                      : "border-gray-200 hover:border-black hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSelectedClaim(claim);
                    setEligibility(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">Claim ID: {claim.id}</div>
                      <div className="text-sm text-gray-700">Biometric: {claim.biometricType.toUpperCase()}</div>
                      <div className="text-xs text-gray-500">Timestamp: {new Date(claim.submittedAt).toLocaleString()}</div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Claim Details */}
          <div className="rounded-2xl shadow border bg-white p-6 min-h-[300px] flex flex-col justify-center">
            {selectedClaim ? (
              <div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">Claim Analysis</h3>
                <div className="space-y-3 mb-6">
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-gray-700 font-semibold">Claim ID:</span> {selectedClaim.id}
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-gray-700 font-semibold">Biometric Type:</span> {selectedClaim.biometricType.toUpperCase()}
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-gray-700 font-semibold">Requirements:</span>
                    <div className="mt-2 space-y-1">
                      {Object.entries(selectedClaim.requirements).map(([k, v]) => (
                        <div key={k} className="text-sm ml-4">
                          • {k.toUpperCase()}: {v as string}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className={`w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition mb-2 ${loading ? "opacity-50" : ""}`}
                  onClick={() => checkEligibility(selectedClaim)}
                  disabled={loading}
                >
                  {loading ? "Analyzing..." : "Verify Eligibility"}
                </button>
                {eligibility !== null && (
                  <div className={`mt-4 p-4 rounded-lg border text-center font-bold text-lg ${
                    eligibility 
                      ? "border-green-400 bg-green-50 text-green-700" 
                      : "border-red-400 bg-red-50 text-red-700"
                  }`}>
                    {eligibility ? "✓ Eligible" : "✗ Not Eligible"}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 h-full flex items-center justify-center min-h-[200px]">
                <div>
                  <div className="text-6xl mb-4">🔍</div>
                  <div className="text-lg">Select a claim to analyze</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 