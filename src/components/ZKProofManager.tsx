'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { BiometricProof, ZKProofSimulator } from '@/lib/zk-proofs';
import { getUserVaultId } from '@/lib/vault';

export default function ZKProofManager() {
  const { user, authenticated } = usePrivy();
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<BiometricProof | null>(null);

  const generateProof = async () => {
    if (!authenticated || !user?.wallet?.address) {
      alert('Please connect your wallet first');
      return;
    }

    const vaultId = getUserVaultId();
    if (!vaultId) {
      alert('No vault found. Please log in to create a vault first.');
      return;
    }

    setIsGenerating(true);
    try {
      // Generate a sample ZK proof using the simulator
      const proofRequest = {
        biometricType: 'iris' as const,
        dataHash: `hash_${user.wallet.address}_${Date.now()}`,
        requirements: {
          minAge: 18,
          conditions: ['identity_verified'],
          insuranceType: 'health'
        }
      };

      const generatedProof = await ZKProofSimulator.generateProof(proofRequest);
      setProof(generatedProof);
      
      console.log('Proof generated:', generatedProof);
    } catch (error) {
      console.error('Error generating proof:', error);
      alert('Failed to generate proof');
    } finally {
      setIsGenerating(false);
    }
  };

  const verifyProof = async () => {
    if (!proof) return;
    
    try {
      const isValid = await ZKProofSimulator.verifyProof(proof);

      alert(isValid ? 'Proof verified successfully!' : 'Proof verification failed');
    } catch (error) {
      console.error('Error verifying proof:', error);
      alert('Failed to verify proof');
    }
  };

  if (!authenticated) {
    return (
      <div className="text-center text-gray-500">
        Please connect your wallet to generate ZK proofs
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={generateProof}
        disabled={isGenerating}
        className="w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition disabled:opacity-50"
      >
        {isGenerating ? 'Generating Proof...' : 'Generate ZK Proof'}
      </button>
      
      {proof && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Proof ID: {proof.proofId}
          </div>
          <div className="text-sm text-gray-600">
            Type: {proof.biometricType}

          </div>
          <button
            onClick={verifyProof}
            className="w-full py-2 rounded-lg border border-gray-300 text-base font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition"
          >
            Verify Proof
          </button>
        </div>
      )}
    </div>
  );
} 