"use client";
import { useState, useRef, Fragment } from "react";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function simulateProof(hash: string) {
  return {
    proof: { a: hash.slice(0, 16), b: hash.slice(16, 32), c: hash.slice(32, 48) },
    publicInputs: { hash },
  };
}
function simulateVerify(proof: any, publicInputs: any) {
  return proof && publicInputs && (proof.a + proof.b + proof.c) === publicInputs.hash.slice(0, 48);
}

export default function ZKProofDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [hash, setHash] = useState<string>("");
  const [proof, setProof] = useState<any>(null);
  const [publicInputs, setPublicInputs] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<null | boolean>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<'choice' | 'zk' | 'manual' | 'success'>('choice');
  const [manual, setManual] = useState({ age: '', gender: '', country: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return content.items.map((item: any) => item.str).join(' ');
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    processFile(selectedFile);
  };

  const processFile = async (selectedFile: File | undefined | null) => {
    setProof(null);
    setPublicInputs(null);
    setVerificationResult(null);
    setError("");
    setPdfText("");
    setHash("");
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsLoading(true);
    try {
      if (selectedFile.type === "application/pdf") {
        const text = await extractPdfText(selectedFile);
        setPdfText(text);
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        setHash(hash);
        const { proof, publicInputs } = simulateProof(hash);
        setProof(proof);
        setPublicInputs(publicInputs);
      } else {
        // For non-PDF files, hash the file as before
        const arrayBuffer = await selectedFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        setHash(hash);
        const { proof, publicInputs } = simulateProof(hash);
        setProof(proof);
        setPublicInputs(publicInputs);
      }
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "Error processing file");
      setIsLoading(false);
    }
  };

  const handleVerify = () => {
    if (!proof || !publicInputs) return;
    const result = simulateVerify(proof, publicInputs);
    setVerificationResult(result);
    if (result) {
      setShowModal(true);
    }
  };

  const handleContinue = () => {
    setShowModal(false);
    setStep('success');
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Manual form handlers
  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setManual({ ...manual, [e.target.name]: e.target.value });
  };
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('success');
  };

  return (
    <Fragment>
      {step === 'choice' && (
        <div className="flex flex-col items-center gap-8">
          <h2 className="text-xl font-bold mb-4 text-blue-900">Choose Verification Method</h2>
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
            <button
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow hover:from-blue-600 hover:to-blue-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
              onClick={() => setStep('zk')}
            >
              ZK Verification
            </button>
            <button
              className="flex-1 px-6 py-4 bg-gradient-to-r from-gray-400 to-gray-600 text-white font-bold rounded-lg shadow hover:from-gray-500 hover:to-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 text-lg"
              onClick={() => setStep('manual')}
            >
              Manual Entry
            </button>
          </div>
        </div>
      )}
      {step === 'zk' && (
        <div className="space-y-8">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-blue-300 rounded-xl p-8 bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition hover:bg-blue-100 hover:border-blue-500"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
            <div className="text-5xl mb-2 text-blue-400">📄</div>
            <div className="font-semibold text-blue-900 mb-1">
              {file ? file.name : "Click or drag & drop a PDF health report here"}
            </div>
            <div className="text-xs text-blue-600 mb-2">PDF only. First page will be parsed.</div>
            {isLoading && <div className="text-blue-600 animate-pulse mt-2">Parsing and generating proof...</div>}
            {error && <div className="text-red-600 mt-2">{error}</div>}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {pdfText && (
              <div className="bg-white rounded-lg shadow p-4 border border-blue-100 transition-all">
                <h2 className="font-semibold mb-2 text-blue-800">Extracted PDF Text (Page 1)</h2>
                <pre className="bg-blue-50 rounded p-2 text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">{pdfText}</pre>
              </div>
            )}
            {hash && (
              <div className="bg-white rounded-lg shadow p-4 border border-blue-100 transition-all">
                <h2 className="font-semibold mb-2 text-blue-800">SHA-256 Hash</h2>
                <pre className="bg-blue-50 rounded p-2 text-xs overflow-x-auto break-all">{hash}</pre>
              </div>
            )}
            {proof && (
              <div className="bg-white rounded-lg shadow p-4 border border-blue-100 transition-all">
                <h2 className="font-semibold mb-2 text-blue-800">ZK Proof</h2>
                <pre className="bg-blue-50 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(proof, null, 2)}</pre>
                <h2 className="font-semibold mb-2 mt-4 text-blue-800">Public Inputs</h2>
                <pre className="bg-blue-50 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(publicInputs, null, 2)}</pre>
                <button
                  onClick={handleVerify}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow hover:from-blue-600 hover:to-blue-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  Verify Proof
                </button>
              </div>
            )}
            {verificationResult !== null && (
              <div className={`px-4 py-3 rounded text-lg font-bold shadow border transition-all ${verificationResult ? "bg-green-100 border-green-300 text-green-800" : "bg-red-100 border-red-300 text-red-800"}`}>
                {verificationResult ? "✅ Proof verified successfully!" : "❌ Proof verification failed!"}
              </div>
            )}
          </div>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center max-w-sm w-full animate-fade-in">
                <svg className="w-20 h-20 text-green-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l3 3 5-5" />
                </svg>
                <h2 className="text-2xl font-bold mt-6 mb-2 text-green-600 text-center">ZK Proof Successful!</h2>
                <p className="text-gray-700 mb-6 text-center">Your zero-knowledge proof has been verified. You may now continue.</p>
                <button
                  onClick={handleContinue}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold rounded-lg shadow hover:from-green-600 hover:to-green-800 transition-all focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {step === 'manual' && (
        <form onSubmit={handleManualSubmit} className="max-w-md mx-auto bg-white rounded-xl shadow p-8 border border-gray-200 flex flex-col gap-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Manual Verification</h2>
          <div>
            <label className="block mb-1 font-semibold text-gray-700">Country (ISO 3-letter code)</label>
            <input
              className="w-full border rounded px-3 py-2"
              name="country"
              value={manual.country}
              onChange={handleManualChange}
              placeholder="e.g. USA, SGP"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold text-gray-700">Age</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              name="age"
              value={manual.age}
              onChange={handleManualChange}
              min={0}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold text-gray-700">Gender</label>
            <select
              className="w-full border rounded px-3 py-2"
              name="gender"
              value={manual.gender}
              onChange={handleManualChange}
              required
            >
              <option value="">Select...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-4 px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white font-bold rounded-lg shadow hover:from-gray-600 hover:to-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Submit
          </button>
        </form>
      )}
      {step === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <svg className="w-20 h-20 text-green-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l3 3 5-5" />
          </svg>
          <h2 className="text-2xl font-bold mt-6 mb-2 text-green-600 text-center">Verification Successful!</h2>
          <p className="text-gray-700 mb-6 text-center">You may now continue to submit your health report.</p>
        </div>
      )}
    </Fragment>
  );
} 