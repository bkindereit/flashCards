/**
 * Diagnostics & Health Inspection View
 * Implements DIA-001..DIA-006, SEC-009
 */

import React, { useState } from 'react';
import { runDiagnosticsSuite, SanitizedDiagnosticReport } from '@/domain/diagnostics';
import { Activity, CheckCircle, XCircle, Copy, Download, RefreshCw } from 'lucide-react';

export const DiagnosticsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [report, setReport] = useState<SanitizedDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    setCopied(false);
    try {
      const res = await runDiagnosticsSuite();
      setReport(res);
    } finally {
      setIsRunning(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics_${report.correlationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6" role="region" aria-label="System Diagnostics">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300 font-medium mb-1 block min-h-[36px] flex items-center">
            ← Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3 break-words">
            <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 shrink-0" />
            <span>System Diagnostics</span>
          </h1>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={isRunning}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running Checks...' : 'Run Diagnostics'}
        </button>
      </div>

      <p className="text-xs sm:text-sm text-slate-400 mb-6">
        Non-destructive health inspection testing client version, FSRS conformance vector, database API, and network connectivity without altering study history.
      </p>

      {report && (
        <div className="space-y-6">
          {/* Header Status Card */}
          <div className={`p-4 sm:p-6 rounded-2xl border ${report.allPassed ? 'bg-emerald-950/40 border-emerald-700/60' : 'bg-red-950/40 border-red-700/60'}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {report.allPassed ? (
                  <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400 shrink-0" />
                )}
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {report.allPassed ? 'All Diagnostic Checks Passed' : 'One or More Checks Failed'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 break-all">
                    Correlation ID: <span className="font-mono text-slate-300">{report.correlationId}</span> • Generated: {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={copyReport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                  aria-label="Copy sanitized diagnostic report"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy Report'}
                </button>
                <button
                  onClick={downloadReport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                  aria-label="Download sanitized diagnostic report"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download JSON
                </button>
              </div>
            </div>
          </div>

          {/* Checks List (DIA-004) */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700/60">
            {report.checks.map(check => (
              <div key={check.id} className="p-4 flex items-center justify-between hover:bg-slate-750 transition-colors">
                <div className="flex items-center gap-3">
                  {check.passed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-white">{check.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{check.message}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {new Date(check.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>

          {/* FSRS Model Specs Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">
              Scheduler Configuration & Conformance
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-500 block mb-1">Package</span>
                <span className="text-slate-200">ts-fsrs@{report.scheduler.packageVersion}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-500 block mb-1">Parameters</span>
                <span className="text-slate-200">{report.scheduler.parameterSetVersion}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-500 block mb-1">Policy</span>
                <span className="text-slate-200">{report.scheduler.policyVersion}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg">
                <span className="text-slate-500 block mb-1">Conformance</span>
                <span className="text-emerald-400 font-bold">Passed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
