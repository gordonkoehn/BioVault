'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createVault, findVault } from '@/lib/tuskyClient';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [vaultId, setVaultId] = useState<string | null>(null);

  // Create or find vault when user authenticates
  useEffect(() => {
    const getOrCreateUserVault = async () => {
      if (authenticated && user && vaultStatus === 'idle') {
        try {
          setVaultStatus('creating');
          
          // Get user identifier - prioritize email over wallet address
          const userIdentifier = user.email?.address || user.wallet?.address;
          if (!userIdentifier) {
            throw new Error('User identifier is required for vault creation');
          }
          
          // First, try to find existing vault
          const vaultName = `bv_${userIdentifier}`;
          const findResponse = await findVault(vaultName);
          
          if (findResponse.success && findResponse.found && findResponse.vaultId) {
            // Existing vault found
            localStorage.setItem('biovault_vault_id', findResponse.vaultId);
            setVaultId(findResponse.vaultId);
            setVaultStatus('created');
            console.log('Existing vault found:', findResponse.vaultId);
            return;
          }
          
          // No existing vault, create a new one
          const createResponse = await createVault(userIdentifier);
          
          if (createResponse.success && createResponse.vaultId) {
            // Store vault ID for later use
            localStorage.setItem('biovault_vault_id', createResponse.vaultId);
            setVaultId(createResponse.vaultId);
            setVaultStatus('created');
            
            console.log('New vault created successfully:', createResponse);
          } else {
            throw new Error(createResponse.error || 'Failed to create vault');
          }
        } catch (error) {
          console.error('Failed to get or create vault:', error);
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
        getOrCreateUserVault();
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
              Setting up your secure vault...
            </div>
          )}
          {vaultStatus === 'created' && vaultId && (
            <div className="text-green-600">
              ✅ Vault ready: {vaultId.slice(0, 8)}...
            </div>
          )}
          {vaultStatus === 'error' && (
            <div className="text-red-600">
              ❌ Failed to setup vault
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