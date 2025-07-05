// Utility functions for vault management

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
