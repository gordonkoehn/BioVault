import ZKProofDemo from '@/components/ZKProofDemo';

export default function ZKProofDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
        <h1 className="text-3xl font-extrabold text-center mb-6 text-blue-900 tracking-tight">Upload Health Reports</h1>
        <p className="text-center text-gray-600 mb-8">
          Upload a PDF health report, parse it to JSON, and generate a real zero-knowledge proof using your custom biometric hash circuit. The system extracts health data and creates cryptographic proofs using the biovault-circuits.
        </p>
        <ZKProofDemo />
      </div>
    </div>
  );
} 