import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    const { vaultId, filePath } = await request.json();
    
    if (!vaultId || !filePath) {
      return NextResponse.json({ error: 'Vault ID and file path are required' }, { status: 400 });
    }

    if (!APIKEY) {
      return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
    }

    const client = new Tusky({ apiKey: APIKEY });
    const fileId = await client.file.upload(vaultId, filePath);
    
    return NextResponse.json({ 
      success: true, 
      fileId: fileId
    });
    
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
