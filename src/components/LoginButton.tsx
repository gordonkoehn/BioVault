'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useCallback } from 'react';
import { createVault, findVault } from '@/lib/tuskyClient';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [vaultId, setVaultId] = useState<string | null>(null);

  // Memoized vault setup function to prevent recreations
  const setupVault = useCallback(async (userIdentifier: string) => {
    const lockKey = `vault_processing_${userIdentifier}`;
    const processedKey = `vault_processed_${userIdentifier}`;
    
    // Check if we're already processing this user (persistent across hot reloads)
    if (localStorage.getItem(lockKey) === 'true') {
      console.log('🚫 Vault setup already in progress for user, aborting...');
      return;
    }

    // Check if we already processed this user (persistent across hot reloads)
    if (localStorage.getItem(processedKey) === 'true') {
      console.log('🚫 Vault already processed for this user, aborting...');
      return;
    }

    try {
      // Set processing lock
      localStorage.setItem(lockKey, 'true');
      localStorage.setItem(processedKey, 'true');
      setVaultStatus('creating');
      
      console.log('🔄 Starting vault setup for:', userIdentifier);
      
      // Check localStorage first for existing vault
      const existingVaultId = localStorage.getItem('biovault_vault_id');
      if (existingVaultId) {
        console.log('✅ Found vault in localStorage:', existingVaultId);
        setVaultId(existingVaultId);
        setVaultStatus('created');
        return;
      }
      
      // Try to find existing vault via API
      const vaultName = `bv_${userIdentifier}`;
      console.log('🔍 Searching for existing vault:', vaultName);
      const findResponse = await findVault(vaultName);
      
      if (findResponse.success && findResponse.found && findResponse.vaultId) {
        console.log('✅ Found existing vault:', findResponse.vaultId);
        localStorage.setItem('biovault_vault_id', findResponse.vaultId);
        setVaultId(findResponse.vaultId);
        setVaultStatus('created');
        return;
      }
      
      // Create new vault only if none exists
      console.log('🆕 Creating new vault for:', userIdentifier);
      const createResponse = await createVault(userIdentifier);
      
      if (createResponse.success && createResponse.vaultId) {
        console.log('✅ Vault creation successful:', {
          vaultId: createResponse.vaultId,
          message: createResponse.message
        });
        localStorage.setItem('biovault_vault_id', createResponse.vaultId);
        setVaultId(createResponse.vaultId);
        setVaultStatus('created');
      } else {
        throw new Error(createResponse.error || 'Failed to create vault');
      }
    } catch (error) {
      console.error('❌ Vault setup failed:', error);
      setVaultStatus('error');
      // Clear locks on error to allow retry
      localStorage.removeItem(lockKey);
      localStorage.removeItem(processedKey);
    } finally {
      // Remove processing lock but keep processed flag
      localStorage.removeItem(lockKey);
      console.log('🏁 Vault setup completed');
    }
  }, []);

  // Single effect to handle authentication state
  useEffect(() => {
    if (!authenticated || !user) {
      // Reset state when not authenticated
      if (!authenticated) {
        console.log('🔓 User logged out, resetting vault state');
        setVaultStatus('idle');
        setVaultId(null);
        localStorage.removeItem('biovault_vault_id');
        // Clear all processing flags
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('vault_processing_') || key.startsWith('vault_processed_')) {
            localStorage.removeItem(key);
          }
        });
      }
      return;
    }

    // Only proceed if we haven't processed a vault yet
    if (vaultStatus !== 'idle') {
      console.log('🔄 Vault status not idle:', vaultStatus);
      return;
    }

    // Get user identifier
    const userIdentifier = user.email?.address || user.wallet?.address;
    if (!userIdentifier) {
      console.error('❌ No user identifier found');
      setVaultStatus('error');
      return;
    }

    console.log('🚀 Triggering vault setup for authenticated user:', userIdentifier);
    setupVault(userIdentifier);
  }, [authenticated, user, vaultStatus, setupVault]);

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