import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    const { userIdentifier } = await request.json();
    
    if (!userIdentifier) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 });
    }

    if (!APIKEY) {
      return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
    }

    const client = new Tusky({ apiKey: APIKEY });
    // Use identifier as the unique vault name
    const vaultName = `bv_${userIdentifier}`;
    
    const response = await client.vault.create(vaultName, { encrypted: false });
    
    return NextResponse.json({ 
      success: true, 
      vaultId: response.id,
      vaultName: vaultName
    });
    
  } catch (error) {
    console.error('Failed to create vault:', error);
    return NextResponse.json({ 
      error: 'Failed to create vault',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
