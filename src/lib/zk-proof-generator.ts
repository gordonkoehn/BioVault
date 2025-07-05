import { execSync } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';
import * as circomlib from 'circomlibjs';

export interface ZKProofInput {
  preimage: string;
  expectedHash: string;
}

export interface ZKProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
}

export interface ZKPublicInputs {
  [key: string]: string;
}

export class ZKProofGenerator {
  private circuitPath: string;
  private wasmPath: string;
  private zkeyPath: string;
  private verificationKeyPath: string;

  constructor(circuitPath: string = '../biovault-circuits') {
    this.circuitPath = circuitPath;
    this.wasmPath = `${circuitPath}/biometric_hash_js/biometric_hash.wasm`;
    this.zkeyPath = `${circuitPath}/biometric_hash_0001.zkey`;
    this.verificationKeyPath = `${circuitPath}/verification_key.json`;
  }

  /**
   * Generate a biometric hash from raw biometric data
   */
  generateBiometricHash(biometricData: Buffer): string {
    return crypto.createHash('sha256').update(biometricData).digest('hex');
  }

  /**
   * Convert hex string to field element for circuit input
   */
  hexToFieldElement(hexString: string): string {
    const fieldSize = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const hashBigInt = BigInt('0x' + hexString);
    const fieldElement = hashBigInt % fieldSize;
    return fieldElement.toString();
  }

  /**
   * Generate input for the ZK circuit
   */
  async generateInput(biometricData: Buffer): Promise<ZKProofInput> {
    const biometricHash = this.generateBiometricHash(biometricData);
    const preimageBigInt = BigInt(this.hexToFieldElement(biometricHash));
    const preimage = preimageBigInt.toString();

    // Compute Poseidon(preimage) using circomlibjs
    const poseidon = await (circomlib as any).buildPoseidon();
    const expectedHash = poseidon.F.toString(poseidon([preimageBigInt]));

    return {
      preimage,
      expectedHash
    };
  }

  /**
   * Generate a ZK proof from biometric data
   */
  async generateProof(biometricData: Buffer): Promise<{
    proof: ZKProof;
    publicInputs: ZKPublicInputs;
    input: ZKProofInput;
  }> {
    try {
      // Generate input
      const input = await this.generateInput(biometricData);
      const inputPath = `${this.circuitPath}/temp_input.json`;
      const witnessPath = `${this.circuitPath}/temp_witness.wtns`;
      const proofPath = `${this.circuitPath}/temp_proof.json`;
      const publicPath = `${this.circuitPath}/temp_public.json`;

      // Save input to file
      fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));

      // Generate witness
      execSync(
        `node ${this.circuitPath}/biometric_hash_js/generate_witness.js ${this.wasmPath} ${inputPath} ${witnessPath}`,
        { stdio: 'pipe' }
      );

      // Generate proof
      execSync(
        `snarkjs groth16 prove ${this.zkeyPath} ${witnessPath} ${proofPath} ${publicPath}`,
        { stdio: 'pipe' }
      );

      // Read generated files
      const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
      const publicInputs = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

      // Clean up temporary files
      [inputPath, witnessPath, proofPath, publicPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      return { proof, publicInputs, input };

    } catch (error) {
      throw new Error(`Failed to generate ZK proof: ${error}`);
    }
  }

  /**
   * Verify a ZK proof
   */
  async verifyProof(proof: ZKProof, publicInputs: ZKPublicInputs): Promise<boolean> {
    try {
      const proofPath = `${this.circuitPath}/temp_verify_proof.json`;
      const publicPath = `${this.circuitPath}/temp_verify_public.json`;

      // Save proof and public inputs to files
      fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
      fs.writeFileSync(publicPath, JSON.stringify(publicInputs, null, 2));

      // Verify proof
      execSync(
        `snarkjs groth16 verify ${this.verificationKeyPath} ${publicPath} ${proofPath}`,
        { stdio: 'pipe' }
      );

      // Clean up temporary files
      [proofPath, publicPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      return true;

    } catch (error) {
      console.error('Proof verification failed:', error);
      return false;
    }
  }

  /**
   * Generate proof from file (useful for your app)
   */
  async generateProofFromFile(filePath: string): Promise<{
    proof: ZKProof;
    publicInputs: ZKPublicInputs;
    input: ZKProofInput;
  }> {
    const fileBuffer = fs.readFileSync(filePath);
    return this.generateProof(fileBuffer);
  }
}

// Export a singleton instance
export const zkProofGenerator = new ZKProofGenerator(); 