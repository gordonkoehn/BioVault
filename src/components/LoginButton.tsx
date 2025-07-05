'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createVault } from '@/lib/tuskyClient';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [vaultId, setVaultId] = useState<string | null>(null);

  // Create vault when user authenticates
  useEffect(() => {
    const createUserVault = async () => {
      if (authenticated && user && vaultStatus === 'idle') {
        try {
          setVaultStatus('creating');
          
          const userAddress = user.wallet?.address || user.email?.address || 'unknown';
          const response = await createVault(userAddress);
          
          if (response.success && response.vaultId) {
            // Store vault ID for later use
            localStorage.setItem('biovault_vault_id', response.vaultId);
            setVaultId(response.vaultId);
            setVaultStatus('created');
            
            console.log('Vault created successfully:', response);
          } else {
            throw new Error(response.error || 'Failed to create vault');
          }
        } catch (error) {
          console.error('Failed to create vault:', error);
          setVaultStatus('error');
        }
      }
    };

    // Check if vault already exists in localStorage
    if (authenticated && user) {
      const existingVaultId = localStorage.getItem('biovault_vault_id');
      if (existingVaultId) {
        setVaultId(existingVaultId);
        setVaultStatus('created');
      } else {
        createUserVault();
      }
    }
  }, [authenticated, user, vaultStatus]);

  // Reset vault status when user logs out
  useEffect(() => {
    if (!authenticated) {
      setVaultStatus('idle');
      setVaultId(null);
      localStorage.removeItem('biovault_vault_id');
    }
  }, [authenticated]);

  if (!ready) {
    return (
      <button className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition">
        Loading...
      </button>
    );
  }

  if (authenticated && user) {
    return (
      <div className="w-full flex flex-col gap-2">
        <div className="text-sm text-gray-600 mb-2">
          Connected: {user.wallet?.address ? 
            `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : 
            user.email?.address || 'Unknown'
          }
        </div>
        
        {/* Vault Status Feedback */}
        <div className="text-sm mb-2">
          {vaultStatus === 'creating' && (
            <div className="text-blue-600 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Creating your secure vault...
            </div>
          )}
          {vaultStatus === 'created' && vaultId && (
            <div className="text-green-600">
              ✅ Vault ready: {vaultId.slice(0, 8)}...
            </div>
          )}
          {vaultStatus === 'error' && (
            <div className="text-red-600">
              ❌ Failed to create vault
            </div>
          )}
        </div>
        
        <button 
          onClick={logout}
          className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition"
        >
          Disconnect Wallet
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={login}
      className="px-6 py-2 rounded-lg bg-black text-white text-lg font-semibold shadow hover:bg-gray-900 transition"
    >
      Log in with Wallet
    </button>
  );
} 