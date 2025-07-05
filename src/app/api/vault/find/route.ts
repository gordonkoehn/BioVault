import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    const { vaultName } = await request.json();
    
    if (!vaultName) {
      return NextResponse.json({ error: 'Vault name is required' }, { status: 400 });
    }

    if (!APIKEY) {
      return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
    }

    const client = new Tusky({ apiKey: APIKEY });
    
    // Get all vaults for the current user
    const vaults = await client.vault.listAll();
    
    // Find vault by name
    const existingVault = vaults.find(vault => vault.name === vaultName);
    
    if (existingVault) {
      return NextResponse.json({ 
        success: true, 
        found: true,
        vaultId: existingVault.id,
        vaultName: existingVault.name
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        found: false
      });
    }
    
  } catch (error) {
    console.error('Failed to find vault:', error);
    return NextResponse.json({ 
      error: 'Failed to find vault',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
