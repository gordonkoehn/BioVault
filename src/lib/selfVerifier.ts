import { SelfBackendVerifier, AttestationId, DefaultConfigStore, AllIds } from '@selfxyz/core';
import { SimpleConfigStorage } from './selfConfig';


const configStorage = new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: ['IRN', 'PRK'],
    ofac: true
});

// Initialize the verifier
const selfBackendVerifier = new SelfBackendVerifier(
  "my-app-scope",                    // Your app's unique scope
  "https://myapp.com/api/verify",    // The API endpoint of this backend
  false,                             // false = real passports, true = mock for testing
  AllIds,                        // Allowed document types
  configStorage as any,                     // Configuration storage implementation
  'uuid'              // UUID for off-chain, HEX for on-chain addresses
);