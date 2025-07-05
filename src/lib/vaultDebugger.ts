// Debug utility to help monitor vault operations

export const VaultDebugger = {
  log: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[VAULT DEBUG ${timestamp}] ${message}`, data || '');
  },
  
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[VAULT ERROR ${timestamp}] ${message}`, error || '');
  },
  
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[VAULT WARN ${timestamp}] ${message}`, data || '');
  },
  
  trackOperation: (operation: string, userIdentifier: string, vaultName: string) => {
    VaultDebugger.log(`Starting ${operation}`, {
      userIdentifier,
      vaultName,
      localStorage: typeof window !== 'undefined' ? localStorage.getItem('biovault_vault_id') : null
    });
  }
};

export default VaultDebugger;
