import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

export async function POST(request: NextRequest) {
  try {
    const { vaultId } = await request.json();

    if (!vaultId) {
      return NextResponse.json(
        { success: false, error: 'vaultId is required' },
        { status: 400 }
      );
    }

    // Get Tusky API key from environment
    const apiKey = process.env.TUSKY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Tusky API key not configured' },
        { status: 500 }
      );
    }

    // Initialize Tusky client
    const client = new Tusky({
      apiKey: apiKey,
    });

    // List files in the vault
    const response = await client.file.list({ vaultId });

    return NextResponse.json({
      success: true,
      items: response.items.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size
      }))
    });

  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
