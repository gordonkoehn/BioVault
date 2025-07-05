// Utility functions for vault management

/**
 * Generate a unique vault name for a user based on their identifier
 */
export const generateVaultName = (userIdentifier: string): string => {
  return `bv_${userIdentifier}`;
};

/**
 * Get the current user's vault ID from localStorage
 */
export const getUserVaultId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('biovault_vault_id');
  }
  return null;
};

/**
 * Set the current user's vault ID in localStorage
 */
export const setUserVaultId = (vaultId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('biovault_vault_id', vaultId);
  }
};

/**
 * Check if user has a vault created
 */
export const hasVault = (): boolean => {
  return getUserVaultId() !== null;
};

/**
 * Clear vault data (used on logout)
 */
export const clearVaultData = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('biovault_vault_id');
  }
};
