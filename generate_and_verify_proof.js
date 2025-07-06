const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const circomlib = require('circomlibjs');

// Generate the input for the circuit
async function generateInput() {
    // Generate a random preimage (field element as string)
    const fieldSize = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const biometricData = crypto.randomBytes(32);
    const preimageBigInt = BigInt('0x' + biometricData.toString('hex')) % fieldSize;
    const preimage = preimageBigInt.toString();

    // Compute Poseidon(preimage) using circomlibjs
    const poseidon = await circomlib.buildPoseidon();
    const hashBigInt = poseidon.F.toString(poseidon([preimageBigInt]));
    const expectedHash = hashBigInt;

    const input = {
        preimage,
        expectedHash
    };

    console.log('Preimage (field element):', preimage);
    console.log('Expected hash (Poseidon):', expectedHash);

    return input;
}

// Main function to generate and verify proof
async function generateAndVerifyProof() {
    try {
        console.log('🚀 Starting ZK Proof Generation and Verification...\n');
        
        // Step 1: Generate input
        console.log('📝 Step 1: Generating input.json...');
        const input = await generateInput();
        fs.writeFileSync('input.json', JSON.stringify(input, null, 2));
        console.log('✅ Input saved to input.json\n');
        
        // Step 2: Generate witness
        console.log('🔍 Step 2: Generating witness...');
        execSync('node biometric_hash_js/generate_witness.js biometric_hash_js/biometric_hash.wasm input.json witness.wtns', { stdio: 'inherit' });
        console.log('✅ Witness generated\n');
        
        // Step 3: Generate proof
        console.log('🔐 Step 3: Generating ZK proof...');
        execSync('snarkjs groth16 prove biometric_hash_0001.zkey witness.wtns proof.json public.json', { stdio: 'inherit' });
        console.log('✅ Proof generated\n');
        
        // Step 4: Verify proof
        console.log('✅ Step 4: Verifying ZK proof...');
        execSync('snarkjs groth16 verify verification_key.json public.json proof.json', { stdio: 'inherit' });
        console.log('✅ Proof verified successfully!\n');
        
        // Display proof details
        console.log('📊 Proof Details:');
        const proof = JSON.parse(fs.readFileSync('proof.json', 'utf8'));
        const publicInputs = JSON.parse(fs.readFileSync('public.json', 'utf8'));
        
        console.log('Proof size:', JSON.stringify(proof).length, 'characters');
        console.log('Public inputs:', publicInputs);
        
        console.log('\n🎉 ZK Proof generation and verification completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during proof generation/verification:', error.message);
        process.exit(1);
    }
}

// Run the process
generateAndVerifyProof(); 