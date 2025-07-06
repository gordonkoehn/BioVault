"use client";
import { useState, useEffect } from "react";
import { ZKProofSimulator, BiometricProof } from "@/lib/zk-proofs";
import { listFiles } from "@/lib/tusky";
import { getUserVaultId } from "@/lib/vault";
import { FileItem } from "@/lib/tuskyClient";

// Define proper types for the claims
interface ClaimRequirements {
  minAge: number;
  insuranceType: string;
  [key: string]: unknown; // Index signature to match Record<string, unknown>
}

interface Claim {
  id: string;
  biometricType: string;
  submittedAt: number;
  proof: BiometricProof;
  requirements: ClaimRequirements;
  tuskyFileId?: string; // Add this to link to vault files
}

interface SubmittedFile extends FileItem {
  claimData?: Claim; // Optional claim data from localStorage
}

// Helper to get claims from localStorage
function getLocalClaims(): Claim[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("claims");
  return stored ? JSON.parse(stored) : [];
}

// Helper to merge vault files with local claim data
function mergeClaimsWithFiles(localClaims: Claim[], vaultFiles: FileItem[]): SubmittedFile[] {
  const mergedFiles: SubmittedFile[] = vaultFiles.map(file => {
    // Try to find matching claim data by file ID
    const matchingClaim = localClaims.find(claim => claim.tuskyFileId === file.id);
    return {
      ...file,
      claimData: matchingClaim
    };
  });
  
  return mergedFiles;
}

export default function InsuranceDashboard() {
  const [submittedFiles, setSubmittedFiles] = useState<SubmittedFile[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedFile, setSelectedFile] = useState<SubmittedFile | null>(null);
  const [eligibility, setEligibility] = useState<null | boolean>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load claims and files from both localStorage and vault
  const loadClaimsAndFiles = async () => {
    try {
      setLoadingFiles(true);
      
      // Get local claims data
      const localClaims = getLocalClaims();
      
      // Get vault files if user has a vault
      const vaultId = getUserVaultId();
      if (vaultId) {
        const vaultFiles = await listFiles();
        const mergedData = mergeClaimsWithFiles(localClaims, vaultFiles || []);
        setSubmittedFiles(mergedData);
      } else {
        // If no vault, just show local claims without file data
        setSubmittedFiles([]);
      }
    } catch (error) {
      console.error('Error loading claims and files:', error);
      // Fallback to empty files list
      setSubmittedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Load claims from localStorage on mount
  useEffect(() => {
    loadClaimsAndFiles();
  }, []);

  // Refresh claims from localStorage and vault
  const refreshClaims = () => {
    loadClaimsAndFiles();
    setSelectedClaim(null);
    setSelectedFile(null);
    setEligibility(null);
  };

  const checkEligibility = async (claim: Claim) => {
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

  const downloadFile = async (file: SubmittedFile) => {
    try {
      setDownloading(true);
      
      // Create a download link for the file using the download parameter
      const response = await fetch(`/api/vault/file?fileId=${file.id}&download=true`);
      if (response.ok) {
        const blob = await response.blob();
        
        // Check if we actually got file content
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        console.log(`Downloaded file: ${file.name}, size: ${blob.size} bytes`);
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download file:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        alert(`Failed to download file: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Error downloading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
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
            disabled={loadingFiles}
          >
            {loadingFiles ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submitted Files from Vault */}
          <div className="rounded-2xl shadow border bg-white p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Incoming Claims</h2>
            {loadingFiles ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                <p className="mt-2 text-gray-600">Loading files from vault...</p>
              </div>
            ) : submittedFiles.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {submittedFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`p-4 rounded-lg cursor-pointer transition-all duration-300 border ${
                      selectedFile?.id === file.id 
                        ? "border-black bg-gray-100" 
                        : "border-gray-200 hover:border-black hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setSelectedFile(file);
                      if (file.claimData) {
                        setSelectedClaim(file.claimData);
                        setEligibility(null);
                      } else {
                        setSelectedClaim(null);
                        setEligibility(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">📄</div>
                        <div>
                          <div className="font-bold text-xl text-blue-700">{file.name}</div>
                          <div className="text-sm text-gray-700">Size: {(file.size / 1024).toFixed(2)} KB</div>
                          <div className="text-xs text-gray-500">File ID: {file.id.substring(0, 12)}...</div>
                          {file.claimData && (
                            <div className="text-xs text-green-600 mt-1">
                              ✓ Claim Data: {file.claimData.biometricType.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${file.claimData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>No files found in vault</p>
                <p className="text-sm">Submit biometric claims to see them here</p>
              </div>
            )}
          </div>

          {/* File Details and Claim Analysis */}
          <div className="rounded-2xl shadow border bg-white p-6 min-h-[300px] flex flex-col justify-center">
            {selectedFile ? (
              <div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">File Details</h3>
                <div className="space-y-3 mb-6">
                  <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <span className="text-blue-700 font-semibold text-lg">📄 Name:</span> 
                    <span className="text-blue-600 ml-2 font-bold text-lg">{selectedFile.name}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-gray-700 font-semibold">File ID:</span> {selectedFile.id}
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-gray-700 font-semibold">Size:</span> {(selectedFile.size / 1024).toFixed(2)} KB
                  </div>
                  {selectedFile.claimData && (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <span className="text-green-700 font-semibold">Biometric Type:</span> 
                      <span className="text-green-600 ml-2">{selectedFile.claimData.biometricType.toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <button
                  className={`w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition mb-4 ${downloading ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => downloadFile(selectedFile)}
                  disabled={downloading}
                >
                  {downloading ? "📥 Downloading..." : "📥 Download File"}
                </button>
                
                {selectedClaim && (
                  <>
                    <hr className="my-6 border-gray-200" />
                    <h3 className="text-xl font-bold mb-4 text-gray-900">Claim Analysis</h3>
                    <div className="space-y-3 mb-6">
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <span className="text-gray-700 font-semibold">Claim ID:</span> {selectedClaim.id}
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
                    {/* <button
                      className={`w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition mb-2 ${loading ? "opacity-50" : ""}`}
                      onClick={() => checkEligibility(selectedClaim)}
                      disabled={loading}
                    > */}
                      {/* {loading ? "Analyzing..." : "Verify Eligibility"}
                    </button> */}
                    {eligibility !== null && (
                      <div className={`mt-4 p-4 rounded-lg border text-center font-bold text-lg ${
                        eligibility 
                          ? "border-green-400 bg-green-50 text-green-700" 
                          : "border-red-400 bg-red-50 text-red-700"
                      }`}>
                        {eligibility ? "✓ Eligible" : "✗ Not Eligible"}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 h-full flex items-center justify-center min-h-[200px]">
                <div>
                  <div className="text-6xl mb-4">🔍</div>
                  <div className="text-lg">Select a file to view details</div>
                  <div className="text-sm mt-2">Choose from incoming claims on the left</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 