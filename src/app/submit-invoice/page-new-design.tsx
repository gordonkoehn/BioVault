"use client";
import { useState } from "react";
import { uploadFileObject } from "@/lib/tusky";

export default function TestAgentsPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">AI Agent Evaluation Center</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test our multi-agent AI system with real insurance claims. Upload policy and invoice documents to see how Claude, GPT-4, and ASI1 agents collaborate to make coverage decisions.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-2xl font-bold text-white mb-2">Multi-Agent Consensus System</h2>
            <div className="flex items-center space-x-6 text-blue-100">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Claude 3</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <span className="text-sm font-medium">GPT-4</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                <span className="text-sm font-medium">ASI1</span>
              </div>
            </div>
          </div>
          
          <div className="p-8">

          {success && evaluationResult ? (
            <div className="space-y-8">
              {/* Success Header */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-6 shadow-lg">
                  {evaluationResult.success ? (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <h3 className={`text-3xl font-bold mb-3 ${evaluationResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {evaluationResult.success ? "Evaluation Complete!" : "Evaluation Failed"}
                </h3>
                <p className="text-gray-600">
                  {evaluationResult.success ? "Our AI agents have reached a consensus on your claim." : "There was an issue processing your claim."}
                </p>
              </div>

              {evaluationResult.success && evaluationResult.consensus && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-8 border border-gray-200">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Consensus Results
                  </h3>
                  
                  {/* Main Verdict Card */}
                  <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Final Decision</h4>
                      <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                        evaluationResult.consensus.final_verdict === 'COVERED' ? 'bg-green-100 text-green-800' :
                        evaluationResult.consensus.final_verdict === 'NOT_COVERED' ? 'bg-red-100 text-red-800' :
                        evaluationResult.consensus.final_verdict === 'PARTIAL_COVERAGE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {evaluationResult.consensus.final_verdict || 'NO_CONSENSUS'}
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{(evaluationResult.consensus.agreement_ratio * 100).toFixed(0)}%</div>
                        <div className="text-sm text-gray-600">Agreement Ratio</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-indigo-600">{evaluationResult.consensus.responding_agents}</div>
                        <div className="text-sm text-gray-600">Active Agents</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">{evaluationResult.consensus.has_consensus ? 'Yes' : 'No'}</div>
                        <div className="text-sm text-gray-600">Has Consensus</div>
                      </div>
                    </div>
                  </div>

                  {evaluationResult.consensus.average_coverage && (
                    <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Coverage Analysis</h4>
                      <div className="text-3xl font-bold text-green-600">${evaluationResult.consensus.average_coverage.toFixed(2)}</div>
                      <div className="text-sm text-gray-600">Average Coverage Amount</div>
                    </div>
                  )}

                  {evaluationResult.individual_verdicts && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border">
                      <h4 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Individual Agent Decisions
                      </h4>
                      <div className="grid gap-4">
                        {evaluationResult.individual_verdicts.map((verdict: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  verdict.llm_backend.includes('claude') ? 'bg-orange-500' :
                                  verdict.llm_backend.includes('gpt') ? 'bg-green-500' :
                                  'bg-blue-500'
                                }`}></div>
                                <span className="font-semibold text-gray-900">{verdict.llm_backend}</span>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                verdict.verdict === 'COVERED' ? 'bg-green-100 text-green-800' :
                                verdict.verdict === 'NOT_COVERED' ? 'bg-red-100 text-red-800' :
                                verdict.verdict === 'PARTIAL_COVERAGE' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {verdict.verdict}
                              </span>
                            </div>
                            {verdict.primary_reason && (
                              <div className="text-gray-700 mb-3 leading-relaxed">{verdict.primary_reason}</div>
                            )}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              {verdict.coverage_amount && (
                                <span className="font-medium">Coverage: ${verdict.coverage_amount}</span>
                              )}
                              <span>Processed in {verdict.processing_time_ms}ms</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evaluationResult.failed_agents && evaluationResult.failed_agents.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                      <h4 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Agent Failures
                      </h4>
                      <div className="space-y-3">
                        {evaluationResult.failed_agents.map((failed: any, idx: number) => (
                          <div key={idx} className="bg-white rounded-lg p-4 border border-red-200">
                            <div className="font-medium text-red-800">{failed.llm_backend}</div>
                            <div className="text-sm text-red-600 mt-1">{failed.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center pt-6">
                <button
                  onClick={() => {
                    setSuccess(false);
                    setEvaluationResult(null);
                    setPolicyFile(null);
                    setInvoiceFile(null);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Test Another Claim
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Upload Section */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-4 text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Insurance Policy
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                    policyFile 
                      ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                      : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePolicyFileChange}
                      className="hidden"
                      id="policy-upload"
                    />
                    <label htmlFor="policy-upload" className="cursor-pointer block">
                      {policyFile ? (
                        <div>
                          <svg className="w-12 h-12 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-green-700 font-medium">{policyFile.name}</div>
                          <div className="text-sm text-green-600 mt-1">Policy document uploaded</div>
                        </div>
                      ) : (
                        <div>
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div className="text-gray-700 font-medium mb-2">Upload Policy Document</div>
                          <div className="text-sm text-gray-500">Drag & drop or click to browse</div>
                          <div className="text-xs text-gray-400 mt-2">PDF format only</div>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block mb-4 text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                    </svg>
                    Medical Invoice
                  </label>
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                    invoiceFile 
                      ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                      : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleInvoiceFileChange}
                      className="hidden"
                      id="invoice-upload"
                    />
                    <label htmlFor="invoice-upload" className="cursor-pointer block">
                      {invoiceFile ? (
                        <div>
                          <svg className="w-12 h-12 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-green-700 font-medium">{invoiceFile.name}</div>
                          <div className="text-sm text-green-600 mt-1">Invoice document uploaded</div>
                        </div>
                      ) : (
                        <div>
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div className="text-gray-700 font-medium mb-2">Upload Invoice Document</div>
                          <div className="text-sm text-gray-500">Drag & drop or click to browse</div>
                          <div className="text-xs text-gray-400 mt-2">PDF format only</div>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-red-800 font-medium">Error</div>
                  </div>
                  <div className="text-red-700 mt-2">{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <div className="text-center pt-4">
                <button
                  type="submit"
                  disabled={submitting || !policyFile || !invoiceFile}
                  className={`px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ${
                    submitting || !policyFile || !invoiceFile
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105'
                  }`}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing with AI Agents...
                    </div>
                  ) : (
                    'Start Agent Evaluation'
                  )}
                </button>
                {(!policyFile || !invoiceFile) && (
                  <p className="text-gray-500 text-sm mt-3">Please upload both documents to continue</p>
                )}
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}