import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['claim_id', 'policy_walrus_id', 'invoice_walrus_id', 'vault_id'];
    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Add base_url if not provided
    if (!body.base_url) {
      const url = new URL(request.url);
      body.base_url = `${url.protocol}//${url.host}`;
    }

    console.log('Calling Python agent evaluation with:', body);

    // Call the Python script
    const pythonScriptPath = path.join(process.cwd(), 'api', 'evaluate_claim.py');
    const result = await callPythonScript(pythonScriptPath, body);
    
    console.log('Python agent result:', result);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

async function callPythonScript(scriptPath: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    // Send data to Python script via stdin
    python.stdin.write(JSON.stringify(data));
    python.stdin.end();
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${parseError}\nOutput: ${stdout}`));
      }
    });
    
    python.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
    
    // Set timeout
    setTimeout(() => {
      python.kill();
      reject(new Error('Python script timeout after 60 seconds'));
    }, 60000);
  });
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Agent evaluation API is running',
    status: 'ready'
  });
}