const fs = require('fs');
const crypto = require('crypto');

// Simple test to verify the circuit files exist
console.log('🔍 Checking ZK circuit files...\n');

const requiredFiles = [
  'biovault-circuits/biometric_hash_js/biometric_hash.wasm',
  'biovault-circuits/biometric_hash_0001.zkey',
  'biovault-circuits/verification_key.json',
  'biovault-circuits/biometric_hash_js/generate_witness.js'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n📊 Summary:');
if (allFilesExist) {
  console.log('✅ All required files are present!');
  console.log('🚀 You can now use the ZK proof generation in your app.');
  console.log('\nTo test:');
  console.log('1. Run: cd biovault-circuits && node generate_and_verify_proof.js');
  console.log('2. Or use the web interface at http://localhost:3000');
} else {
  console.log('❌ Some files are missing. Please compile your circuit first.');
  console.log('\nTo compile:');
  console.log('1. cd biovault-circuits');
  console.log('2. circom biometric_hash.circom --r1cs --wasm --sym');
  console.log('3. snarkjs groth16 setup biometric_hash.r1cs pot12_final.ptau biometric_hash_0001.zkey');
  console.log('4. snarkjs zkey export verificationkey biometric_hash_0001.zkey verification_key.json');
} 