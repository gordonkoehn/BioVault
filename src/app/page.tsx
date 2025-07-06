"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-between">
      {/* Hero Section with Video */}
      <section className="relative w-full flex flex-col items-center justify-center min-h-screen py-32 px-4 overflow-hidden">
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
          <h1 className="text-6xl md:text-7xl font-extrabold text-center text-white mb-8 tracking-tight drop-shadow-lg">BioVault</h1>
          <p className="text-2xl md:text-3xl text-center text-gray-200 max-w-3xl mb-12 drop-shadow">
            Privacy-preserving biometric identity and insurance claims powered by zero-knowledge proofs and AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
            <Link
              href="/verify"
              className="inline-block px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow-lg hover:from-blue-600 hover:to-blue-800 transition text-xl"
            >
              Verify with Passport
            </Link>
            {/* <Link
              href="/manual-form"
              className="inline-block px-10 py-4 bg-white text-blue-700 font-bold rounded-lg shadow-lg hover:bg-gray-50 transition text-xl border-2 border-white"
            >
              Manual Form
            </Link> */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 px-4 py-16">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-blue-100 animate-fade-in">
          <span className="text-4xl mb-3">🔒</span>
          <h3 className="font-bold text-lg mb-2 text-blue-900">Private Biometric Storage</h3>
          <p className="text-gray-600 text-center">Your biometric data is encrypted and stored securely using decentralized technology.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-blue-100 animate-fade-in">
          <span className="text-4xl mb-3">🧩</span>
          <h3 className="font-bold text-lg mb-2 text-blue-900">Zero-Knowledge Proofs</h3>
          <p className="text-gray-600 text-center">Prove your identity or eligibility without revealing your sensitive data to anyone.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-blue-100 animate-fade-in">
          <span className="text-4xl mb-3">🤖</span>
          <h3 className="font-bold text-lg mb-2 text-blue-900">AI-Powered Verification</h3>
          <p className="text-gray-600 text-center">AI agents automate and verify insurance claims, reducing fraud and speeding up approvals.</p>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="w-full max-w-3xl mx-auto py-16 px-4">
        <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">How BioVault Works</h2>
        <ol className="space-y-4 text-gray-700 list-decimal list-inside">
          <li>Connect your wallet or verify manually.</li>
          <li>Upload your health report (PDF) or biometric data.</li>
          <li>Generate a zero-knowledge proof to verify your identity or insurance claim.</li>
          <li>AI agent reviews and verifies your claim instantly.</li>
        </ol>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-gray-400 py-8 text-sm mt-12">
        &copy; {new Date().getFullYear()} BioVault. All rights reserved.
      </footer>
    </main>
  );
}
