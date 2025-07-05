"use client";
import LoginButton from "@/components/LoginButton";
import ZKProofDemo from "@/components/ZKProofDemo";

export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-between">
      {/* Hero Section */}
      <section className="relative w-full flex flex-col items-center justify-center min-h-[80vh] py-24 px-4 overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src="/vault-hero.mp4"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />
        {/* Content */}
        <div className="relative z-20 flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-center text-white mb-6 tracking-tight drop-shadow-lg">BioVault</h1>
          <p className="text-xl md:text-2xl text-center text-gray-200 max-w-2xl mb-8 drop-shadow">
            Privacy-preserving biometric identity and insurance claims powered by zero-knowledge proofs and AI.
          </p>
          <div className="flex flex-col items-center gap-4">
            <LoginButton />
            <span className="text-gray-200 text-sm">Connect your wallet to get started</span>
            {/* Development Test Link */}
            <a
              href="/test-api"
              className="text-blue-300 hover:text-blue-200 underline text-sm mt-4 px-4 py-2 bg-blue-600/20 rounded-lg backdrop-blur"
            >
              🧪 Test Flask API
            </a>
          </div>
        </div>
      </section>

      {/* ZK Proof Demo Section */}
      <section className="w-full py-16 bg-gray-50">
        <ZKProofDemo />
      </section>

      {/* Features Section */}
      <section className="w-full max-w-4xl mx-auto py-16 px-4 grid md:grid-cols-3 gap-8">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-4xl mb-3">🔒</span>
          <h3 className="font-bold text-lg mb-2">Private Biometric Storage</h3>
          <p className="text-gray-600 text-center">Your biometric data is encrypted and stored securely using decentralized technology.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-4xl mb-3">🧩</span>
          <h3 className="font-bold text-lg mb-2">Zero-Knowledge Proofs</h3>
          <p className="text-gray-600 text-center">Prove your identity or eligibility without revealing your sensitive data to anyone.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-4xl mb-3">🤖</span>
          <h3 className="font-bold text-lg mb-2">AI-Powered Verification</h3>
          <p className="text-gray-600 text-center">AI agents automate and verify insurance claims, reducing fraud and speeding up approvals.</p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full max-w-3xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How BioVault Works</h2>
        <ol className="space-y-4 text-gray-700 list-decimal list-inside">
          <li>Connect your wallet to create a private, decentralized identity.</li>
          <li>Upload your biometric data (encrypted and never shared).</li>
          <li>Generate a zero-knowledge proof to verify your identity or insurance claim.</li>
          <li>AI agent reviews and verifies your claim instantly.</li>
        </ol>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-gray-400 text-sm border-t bg-white">
        &copy; {new Date().getFullYear()} BioVault. All rights reserved.
      </footer>
    </main>
  );
}
