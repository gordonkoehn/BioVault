import { IConfigStorage, VerificationConfig } from '@selfxyz/core';

export class SimpleConfigStorage  {
  async getConfig(configId: string): Promise<VerificationConfig> {
    return {
      minimumAge: 18,
      excludedCountries: ['IRN', 'PRK'],
      ofac: true
    };
  }
// TODO: Implement this - what business logic? 
  async getActionId(userIdentifier: string, userDefinedData: any): Promise<string> {
    return 'default_config';
  }
} 