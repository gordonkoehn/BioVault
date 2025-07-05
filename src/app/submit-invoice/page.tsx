"use client";
import { useState } from "react";
import { uploadFileObject } from "@/lib/tusky";

export default function SubmitInvoicePage() {
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  const handlePolicyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPolicyFile(e.target.files[0]);
    }
  };

  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    setEvaluationResult(null);
    
    try {
      if (!policyFile) throw new Error("Please upload a policy file.");
      if (!invoiceFile) throw new Error("Please upload an invoice file.");
      
      // Upload files to Tusky vault
      const [policyFileId, invoiceFileId] = await Promise.all([
        uploadFileObject(policyFile),
        uploadFileObject(invoiceFile)
      ]);
      
      console.log(`Files uploaded to Tusky:`, {
        policy: policyFileId,
        invoice: invoiceFileId
      });
      
      // Call Flask API for agent evaluation
      const claimId = `test_claim_${Date.now()}`;
      const flaskApiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://127.0.0.1:5328/api/evaluate_claim'
        : '/api/evaluate_claim';
      
      const evaluationResponse = await fetch(flaskApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim_id: claimId,
          policy_walrus_id: policyFileId,
          invoice_walrus_id: invoiceFileId,
          vault_id: "test_vault_id",
          base_url: window.location.origin
        })
      });

      if (!evaluationResponse.ok) {
        const errorText = await evaluationResponse.text();
        throw new Error(`Agent evaluation failed: ${evaluationResponse.status} - ${errorText}`);
      }

      const evaluation = await evaluationResponse.json();
      setEvaluationResult(evaluation);
      setSuccess(true);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl shadow-lg border bg-white px-8 py-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-gray-900">Submit Invoice</h1>
            <div className="w-20 h-1 bg-gray-200 mx-auto mb-2"></div>
            <p className="text-gray-600 text-base">Upload your policy and invoice files to submit your insurance claim.</p>
          </div>

          {success && evaluationResult ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {evaluationResult.success ? "✅" : "❌"}
                </div>
                <div className="text-green-600 font-bold mb-4 text-lg">
                  {evaluationResult.success ? "Claim Processed!" : "Claim Failed"}
                </div>
              </div>

              {evaluationResult.success && evaluationResult.consensus && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold text-lg mb-4">Claim Review Results</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <strong>Final Verdict:</strong> 
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        evaluationResult.consensus.final_verdict === 'COVERED' ? 'bg-green-100 text-green-800' :
                        evaluationResult.consensus.final_verdict === 'NOT_COVERED' ? 'bg-red-100 text-red-800' :
                        evaluationResult.consensus.final_verdict === 'PARTIAL_COVERAGE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {evaluationResult.consensus.final_verdict || 'NO_CONSENSUS'}
                      </span>
                    </div>
                    <div>
                      <strong>Agreement:</strong> {(evaluationResult.consensus.agreement_ratio * 100).toFixed(1)}%
                    </div>
                    <div>
                      <strong>Responding Agents:</strong> {evaluationResult.consensus.responding_agents}
                    </div>
                    <div>
                      <strong>Has Consensus:</strong> {evaluationResult.consensus.has_consensus ? 'Yes' : 'No'}
                    </div>
                  </div>

                  {evaluationResult.consensus.average_coverage && (
                    <div className="mb-4">
                      <strong>Average Coverage:</strong> ${evaluationResult.consensus.average_coverage.toFixed(2)}
                    </div>
                  )}

                  {evaluationResult.individual_verdicts && (
                    <div>
                      <h4 className="font-semibold mb-2">Individual Review Results:</h4>
                      <div className="space-y-2">
                        {evaluationResult.individual_verdicts.map((verdict: any, idx: number) => (
                          <div key={idx} className="bg-white p-3 rounded border">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">{verdict.llm_backend}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                verdict.verdict === 'COVERED' ? 'bg-green-100 text-green-800' :
                                verdict.verdict === 'NOT_COVERED' ? 'bg-red-100 text-red-800' :
                                verdict.verdict === 'PARTIAL_COVERAGE' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {verdict.verdict}
                              </span>
                            </div>
                            {verdict.primary_reason && (
                              <div className="text-sm text-gray-600">{verdict.primary_reason}</div>
                            )}
                            {verdict.coverage_amount && (
                              <div className="text-sm text-gray-500">Coverage: ${verdict.coverage_amount}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evaluationResult.failed_agents && evaluationResult.failed_agents.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2 text-red-600">Processing Issues:</h4>
                      <div className="space-y-1">
                        {evaluationResult.failed_agents.map((failed: any, idx: number) => (
                          <div key={idx} className="bg-red-50 p-2 rounded text-sm text-red-700">
                            {failed.llm_backend}: {failed.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setSuccess(false);
                  setEvaluationResult(null);
                  setPolicyFile(null);
                  setInvoiceFile(null);
                }}
                className="w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition"
              >
Submit Another Claim
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block mb-2 font-semibold text-gray-900">Policy File (PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-black transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePolicyFileChange}
                    className="hidden"
                    id="policy-upload"
                  />
                  <label htmlFor="policy-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">📄</div>
                    <div className="text-gray-500">
                      {policyFile ? policyFile.name : "Click to upload policy document"}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      PDF format only
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-900">Invoice File (PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-black transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleInvoiceFileChange}
                    className="hidden"
                    id="invoice-upload"
                  />
                  <label htmlFor="invoice-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">🧾</div>
                    <div className="text-gray-500">
                      {invoiceFile ? invoiceFile.name : "Click to upload invoice document"}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      PDF format only
                    </div>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 rounded text-red-700 text-center">
                  ERROR: {error}
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-3 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition ${submitting ? "opacity-50" : ""}`}
                disabled={submitting}
              >
                {submitting ? "Processing Your Claim..." : "Submit Claim"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}