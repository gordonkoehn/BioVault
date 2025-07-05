import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    const { userIdentifier } = await request.json();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`🔵 [${requestId}] Vault creation request for:`, userIdentifier);
    
    if (!userIdentifier) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 });
    }

    if (!APIKEY) {
      return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
    }

    const client = new Tusky({ apiKey: APIKEY });
    // Use identifier as the unique vault name
    const vaultName = `bv_${userIdentifier}`;
    
    console.log(`🔍 [${requestId}] Checking for existing vault:`, vaultName);
    
    // First check if vault already exists to prevent duplicates
    try {
      const existingVaults = await client.vault.listAll();
      console.log(`📋 [${requestId}] Found ${existingVaults.length} total vaults`);
      
      const existingVault = existingVaults.find(vault => vault.name === vaultName);
      
      if (existingVault) {
        console.log(`✅ [${requestId}] Vault already exists, returning:`, existingVault.id);
        return NextResponse.json({ 
          success: true, 
          vaultId: existingVault.id,
          vaultName: vaultName,
          message: 'Vault already exists'
        });
      }
    } catch (listError) {
      console.warn(`⚠️ [${requestId}] Failed to check existing vaults:`, listError);
    }
    
    console.log(`🆕 [${requestId}] Creating new vault:`, vaultName);
    const response = await client.vault.create(vaultName, { encrypted: false });
    console.log(`✅ [${requestId}] Vault created successfully:`, response.id);
    
    return NextResponse.json({ 
      success: true, 
      vaultId: response.id,
      vaultName: vaultName,
      message: 'New vault created'
    });
    
  } catch (error) {
    console.error('❌ Failed to create vault:', error);
    return NextResponse.json({ 
      error: 'Failed to create vault',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
