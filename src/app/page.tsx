"use client";
import { useState } from "react";


export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [proofGenerated, setProofGenerated] = useState(false);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-md flex flex-col gap-10">
        <div className="rounded-2xl shadow-lg border bg-white px-8 py-10 flex flex-col items-center">
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-gray-900">BioVault</h1>
          <p className="text-gray-600 mb-6 text-center text-lg">Upload biometric data and generate ZK proofs for private identity and insurance claims</p>
          <button className="w-full py-3 rounded-lg border border-gray-300 text-lg font-semibold bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition mb-2">Log in with Wallet</button>
        </div>
       
        {/* Upload Section */}
        <div className="rounded-2xl shadow border bg-white px-6 py-7 flex flex-col gap-5">
          <div className="font-semibold text-lg mb-1 text-gray-900">Upload Biometric Data</div>
          <label className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 bg-white cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-black transition">
            <span className="text-2xl">📄</span>
            <input
              type="file"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <span className="flex-1 text-gray-700 text-base">
              {file ? file.name : <span className="text-gray-400">Choose File</span>}
            </span>
          </label>
          <button
            className="w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition"
            onClick={() => setProofGenerated(true)}
            disabled={!file}
          >
            Generate ZK Proof
          </button>
        </div>

        {/* Verify Section */}
        <div className="rounded-2xl shadow border bg-white px-6 py-7 flex flex-col gap-5">
          <div className="font-semibold text-lg mb-1 text-gray-900">Verify Access</div>
          {proofGenerated ? (
            <>
              <div className="text-green-600 font-medium mb-2">Proof verified successfully!</div>
              <button
                className="w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition mb-2"
                onClick={() => {}}
              >
                Ask AI Agent
              </button>
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
                <span className="text-xl">❓</span>
                <span>Is user eligible for insurance?</span>
              </div>
            </>
          ) : (
            <div className="text-gray-400">Generate a ZK proof to verify access</div>
          )}
        </div>
      </div>
    </div>
  );
}
