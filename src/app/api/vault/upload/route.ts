import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BiometricEncryption } from '@/lib/encryption';

const APIKEY = process.env.TUSKY_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle File upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const vaultId = formData.get('vaultId') as string;
      
      if (!vaultId || !file) {
        return NextResponse.json({ error: 'Vault ID and file are required' }, { status: 400 });
      }

      if (!APIKEY) {
        return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
      }

      // Save file temporarily
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Encrypt the file content
      const fileContent = buffer.toString('base64');
      const encryptedData = BiometricEncryption.encrypt(fileContent);
      
      // Store encrypted data as JSON
      const encryptedFileContent = JSON.stringify(encryptedData);
      
      // Create encrypted filename (add _encrypted suffix for storage, but keep original for user)
      const encryptedFileName = `${file.name}_encrypted`;
      const tempFilePath = join(tmpdir(), `upload_${Date.now()}_${encryptedFileName}`);
      
      await writeFile(tempFilePath, encryptedFileContent, 'utf8');
      
      try {
        const client = new Tusky({ apiKey: APIKEY });
        const fileId = await client.file.upload(vaultId, tempFilePath);
        
        // Clean up temporary file
        await unlink(tempFilePath);
        
        return NextResponse.json({ 
          success: true, 
          fileId: fileId
        });
      } catch (uploadError) {
        // Clean up temporary file on error
        await unlink(tempFilePath);
        throw uploadError;
      }
      
    } else {
      // Handle file path upload (existing functionality)
      const { vaultId, filePath } = await request.json();
      
      if (!vaultId || !filePath) {
        return NextResponse.json({ error: 'Vault ID and file path are required' }, { status: 400 });
      }

      if (!APIKEY) {
        return NextResponse.json({ error: 'Tusky API key not configured' }, { status: 500 });
      }

      // Read and encrypt the file
      const fileBuffer = await readFile(filePath);
      const fileContent = fileBuffer.toString('base64');
      const encryptedData = BiometricEncryption.encrypt(fileContent);
      
      // Create temporary encrypted file
      const encryptedFileContent = JSON.stringify(encryptedData);
      const originalFileName = filePath.split('/').pop() || 'unknown';
      const encryptedFileName = `${originalFileName}_encrypted`;
      const tempFilePath = join(tmpdir(), `upload_${Date.now()}_${encryptedFileName}`);
      
      await writeFile(tempFilePath, encryptedFileContent, 'utf8');
      
      try {
        const client = new Tusky({ apiKey: APIKEY });
        const fileId = await client.file.upload(vaultId, tempFilePath);
        
        // Clean up temporary file
        await unlink(tempFilePath);
        
        return NextResponse.json({ 
          success: true, 
          fileId: fileId
        });
      } catch (uploadError) {
        // Clean up temporary file on error
        await unlink(tempFilePath);
        throw uploadError;
      }
    }
    
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
