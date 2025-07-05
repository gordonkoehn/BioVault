import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    if (!APIKEY) {
      return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
    }

    const client = new Tusky({ apiKey: APIKEY });
    
    // Check if we want JSON response (for API calls) or file download
    const download = searchParams.get('download');
    
    if (download === 'true') {
      // Use arrayBuffer method to get the actual file content for download
      const fileBuffer = await client.file.arrayBuffer(fileId);
      
      // Get file metadata to determine the filename
      const fileInfo = await client.file.get(fileId);
      const fileName = (fileInfo as any)?.name || `file-${fileId}`;
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } else {
      // Return JSON for API calls
      const response = await client.file.get(fileId);
      return NextResponse.json({ 
        success: true, 
        file: response
      });
    }
    
  } catch (error) {
    console.error('Failed to get file:', error);
    return NextResponse.json({ 
      error: 'Failed to get file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
