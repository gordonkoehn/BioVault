"use client";
import { useState, useEffect } from "react";
import { ZKProofSimulator, BiometricProof } from "@/lib/zk-proofs";
import { listFiles } from "@/lib/tusky";
import { getUserVaultId } from "@/lib/vault";
import { FileItem } from "@/lib/tuskyClient";
import dayjs from 'dayjs';
import { Inter, Roboto } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

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
  const [eligibility, setEligibility] = useState<null | boolean>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  // Get unique months and types for filters
  const allClaims = submittedFiles.filter(f => f.claimData);
  const months = Array.from(new Set(allClaims.map(f => dayjs(f.claimData!.submittedAt).format('YYYY-MM'))));
  const types = Array.from(new Set(allClaims.map(f => f.claimData!.biometricType)));

  // Filter claims by month and type
  const filteredFiles = submittedFiles.filter(f => {
    if (!f.claimData) return false;
    const claimMonth = dayjs(f.claimData.submittedAt).format('YYYY-MM');
    const matchesMonth = monthFilter === 'all' || claimMonth === monthFilter;
    const matchesType = typeFilter === 'all' || f.claimData.biometricType === typeFilter;
    return matchesMonth && matchesType;
  });

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-gray-900">Health Reports</h1>
          <div className="w-24 h-1 bg-gray-200 mx-auto"></div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 justify-center items-center">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Month</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 bg-white text-gray-900"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            >
              <option value="all">All</option>
              {months.map(month => (
                <option key={month} value={month}>{dayjs(month + '-01').format('MMMM YYYY')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Type</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 bg-white text-gray-900"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All</option>
              {types.map(type => (
                <option key={type} value={type}>{type.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 justify-center">
          <button
            className="py-2 px-6 rounded-lg border border-gray-300 text-base font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition"
            onClick={refreshClaims}
            disabled={loadingFiles}
          >
            {loadingFiles ? "Loading..." : "Refresh Database"}
          </button>
        </div>

        {/* Incoming Claims List */}
        <div className="rounded-2xl shadow border bg-white p-6 w-full">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Incoming Claims</h2>
          {loadingFiles ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
              <p className="mt-2 text-gray-600">Loading files from vault...</p>
            </div>
          ) : filteredFiles.length > 0 ? (
            <div className="space-y-3 max-h-[700px] overflow-y-auto">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-6 rounded-lg cursor-pointer transition-all duration-300 border w-full ${
                    selectedClaim?.tuskyFileId === file.id 
                      ? "border-black bg-gray-100" 
                      : "border-gray-200 hover:border-black hover:bg-gray-50"
                  }`}
                  style={{ minWidth: '100%', wordBreak: 'break-word' }}
                  onClick={() => {
                    if (file.claimData) {
                      setSelectedClaim(file.claimData);
                      setEligibility(null);
                    }
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap">
                    <div className="flex items-center space-x-3 flex-wrap">
                      <div className="text-2xl">📄</div>
                      <div>
                        <div className="font-bold text-xl text-blue-700 break-words">{file.name}</div>
                        <div className="text-sm text-gray-700">Size: {(file.size / 1024).toFixed(2)} KB</div>
                        <div className="text-xs text-gray-500">File ID: {file.id}</div>
                        {file.claimData && (
                          <>
                            <div className="text-xs text-green-600 mt-1">
                              ✓ Claim Data: {file.claimData.biometricType.toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Date Submitted: {dayjs(file.claimData.submittedAt).format('YYYY-MM-DD HH:mm')}
                            </div>
                          </>
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
      </div>
    </div>
  );
} 