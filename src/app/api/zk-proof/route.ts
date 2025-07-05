export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { zkProofGenerator } from '@/lib/zk-proof-generator';
import { parseHealthReportPdf } from '@/lib/pdfParser';
import * as circomlib from 'circomlibjs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse PDF to JSON
    const reportJson = await parseHealthReportPdf(buffer);
    console.log('Parsed PDF JSON:', reportJson);

    // Canonicalize and hash the JSON using Poseidon
    const canonical = JSON.stringify(reportJson, Object.keys(reportJson).sort());
    const poseidon = await (circomlib as any).buildPoseidon();
    const hashBigInt = poseidon.F.toString(poseidon([BigInt('0x' + Buffer.from(canonical).toString('hex'))]));

    // Pass the hash as the input to your ZK proof generator
    const { proof, publicInputs, input } = await zkProofGenerator.generateProof(Buffer.from(hashBigInt));
    
    return NextResponse.json({
      success: true,
      proof,
      publicInputs,
      input,
      parsed: reportJson,
      message: 'ZK proof generated successfully'
    });

  } catch (error) {
    console.error('Error generating ZK proof:', error);
    return NextResponse.json(
      { error: 'Failed to generate ZK proof', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { proof, publicInputs } = await request.json();
    
    if (!proof || !publicInputs) {
      return NextResponse.json(
        { error: 'Proof and public inputs are required' },
        { status: 400 }
      );
    }

    // Verify the proof
    const isValid = await zkProofGenerator.verifyProof(proof, publicInputs);
    
    return NextResponse.json({
      success: true,
      isValid,
      message: isValid ? 'Proof verified successfully' : 'Proof verification failed'
    });

  } catch (error) {
    console.error('Error verifying ZK proof:', error);
    return NextResponse.json(
      { error: 'Failed to verify ZK proof', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 