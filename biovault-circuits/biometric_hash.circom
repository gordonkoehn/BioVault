pragma circom 2.0.0;

include "poseidon.circom";

template BiometricHash() {
    signal input preimage;      // The hash of the biometric file (as a number)
    signal input expectedHash;  // The public hash to prove knowledge of

    signal output hash;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== preimage;
    hash <== hasher.out;

    // Enforce that the hash matches the expected public hash
    expectedHash === hash;
}

component main = BiometricHash();