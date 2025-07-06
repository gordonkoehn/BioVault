const fs = require('fs');
const crypto = require('crypto');
const circomlib = require('circomlibjs');

// Generate a sample biometric hash (in practice, this would come from your biometric data)
function generateBiometricHash() {
    // Simulate biometric data hash (e.g., fingerprint, face, etc.)
    const biometricData = crypto.randomBytes(32);
    return biometricData.toString('hex');
}

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

// Generate and save input
(async () => {
    const input = await generateInput();
    fs.writeFileSync('input.json', JSON.stringify(input, null, 2));
    console.log('Input saved to input.json');
})(); 