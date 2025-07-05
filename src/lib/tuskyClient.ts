// Client-side service for Tusky vault operations
// This replaces the direct Tusky SDK usage on the client

export interface CreateVaultResponse {
  success: boolean;
  vaultId?: string;
  vaultName?: string;
  error?: string;
  details?: string;
}

export interface FindVaultResponse {
  success: boolean;
  found: boolean;
  vaultId?: string;
  vaultName?: string;
  error?: string;
  details?: string;
}

export interface UploadFileResponse {
  success: boolean;
  fileId?: string;
  error?: string;
  details?: string;
}

export interface GetFileResponse {
  success: boolean;
  file?: unknown;
  error?: string;
  details?: string;
}

/**
 * Find an existing vault by name
 */
export const findVault = async (vaultName: string): Promise<FindVaultResponse> => {
  try {
    const response = await fetch('/api/vault/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vaultName }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error finding vault:', error);
    return {
      success: false,
      found: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Create a vault for the user using their identifier
 */
export const createVault = async (userIdentifier: string): Promise<CreateVaultResponse> => {
  try {
    const response = await fetch('/api/vault/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIdentifier }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating vault:', error);
    return {
      success: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Upload a file to the vault
 */
export const uploadFile = async (vaultId: string, filePath: string): Promise<UploadFileResponse> => {
  try {
    const response = await fetch('/api/vault/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vaultId, filePath }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get a file from the vault
 */
export const getFile = async (fileId: string): Promise<GetFileResponse> => {
  try {
    const response = await fetch(`/api/vault/file?fileId=${encodeURIComponent(fileId)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting file:', error);
    return {
      success: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
