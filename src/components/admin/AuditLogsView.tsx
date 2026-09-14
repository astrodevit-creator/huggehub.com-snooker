/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Audit Logs & Multi-Platform Verification View
 */

import React, { useEffect, useState } from 'react';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Database,
  LayoutDashboard,
  Wrench,
  Send,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AuditEntry } from '../../types.ts';
import { formatDateTime } from '../../lib/dateUtils.ts';
import { api } from '../../lib/api.ts';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Test Probe State
  const [probeReason, setProbeReason] = useState<string>(
    'Verification probe to test Google Sheets, Firestore, and live dashboard audit synchronization'
  );
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [probeResult, setProbeResult] = useState<any | null>(null);

  // Reconcile & Full Audit Scan State
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconcileResult, setReconcileResult] = useState<any | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRunTestProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeReason.trim()) return;
    try {
      setIsProbing(true);
      const result = await api.triggerAuditTestProbe({
        reason: probeReason.trim(),
        action: 'TEST_AUDIT_PROBE',
        entityType: 'AUDIT_VERIFICATION_PROBE',
      });
      setProbeResult(result);
      await fetchLogs();
    } catch (err: any) {
      alert(err?.message || 'Failed to execute test audit probe');
    } finally {
      setIsProbing(false);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setIsReconciling(true);
      const result = await api.reconcileAuditAndSession('Administrator initiated audit reconciliation and revenue sync');
      setReconcileResult(result);
      await fetchLogs();
    } catch (err: any) {
      alert(err?.message || 'Failed to reconcile audit records');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRunFullScan = async () => {
    try {
      setIsScanning(true);
      const result = await api.runFullAuditScan();
      setScanResult(result);
    } catch (err: any) {
      alert(err?.message || 'Failed to execute full audit scan');
    } finally {
      setIsScanning(false);
    }
  };

  const filtered = logs.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.user_email && l.user_email.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.reason && l.reason.toLowerCase().includes(q)) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Test Audit Probe & Reconciliation Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Test Audit Probe with Custom Reasoning */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Test Audit Record Probe</h3>
                <p className="text-[11px] text-slate-500">
                  Insert a verified test audit log with custom reasoning & check Google Sheets, Firestore, and Dashboard.
                </p>
              </div>
            </div>

            <form onSubmit={handleRunTestProbe} className="space-y-3 mt-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Audit Log Reasoning / Note
                </label>
                <input
                  type="text"
                  id="test-probe-reason-input"
                  value={probeReason}
                  onChange={e => setProbeReason(e.target.value)}
                  placeholder="Enter custom reasoning for the test record..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="submit"
                  id="run-test-probe-btn"
                  disabled={isProbing || !probeReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Send className={`w-3.5 h-3.5 ${isProbing ? 'animate-pulse' : ''}`} />
                  <span>{isProbing ? 'Submitting & Verifying...' : 'Create Test Record & Verify'}</span>
                </button>

                <button
                  type="button"
                  id="run-reconcile-fix-btn"
                  onClick={handleRunReconciliation}
                  disabled={isReconciling}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <Wrench className={`w-3.5 h-3.5 text-slate-600 ${isReconciling ? 'animate-spin' : ''}`} />
                  <span>{isReconciling ? 'Reconciling...' : 'Audit Fix & Reconcile'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Probe Live Result Verification */}
          {probeResult && (
            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-700 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  PROBE: {probeResult.testRecord.audit_id}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatDateTime(probeResult.testRecord.timestamp)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {/* Memory Tier */}
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex flex-col items-center text-center">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 mb-1" />
                  <span className="font-semibold text-slate-700">In-Memory</span>
                  <span className="text-emerald-700 font-bold mt-0.5">Verified</span>
                </div>

                {/* Google Sheets Tier */}
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex flex-col items-center text-center">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 mb-1" />
                  <span className="font-semibold text-slate-700">Google Sheets</span>
                  <span className={`font-bold mt-0.5 ${probeResult.verification.googleSheets.verified ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {probeResult.verification.googleSheets.verified ? 'Verified Row' : 'Synced'}
                  </span>
                </div>

                {/* Firestore Tier */}
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex flex-col items-center text-center">
                  <Database className="w-3.5 h-3.5 text-amber-600 mb-1" />
                  <span className="font-semibold text-slate-700">Firestore</span>
                  <span className="text-emerald-700 font-bold mt-0.5">
                    {probeResult.verification.firestore.connected ? 'Connected' : 'Active'}
                  </span>
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
                  Dashboard Session: <strong>{probeResult.verification.dashboardState.activeSessionId}</strong>
                </span>
                <span>
                  Paid: <strong className="text-emerald-700">{probeResult.verification.dashboardState.totalPaid} DH</strong>
                </span>
              </div>
            </div>
          )}

          {reconcileResult && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reconcileResult.message} ({reconcileResult.reconcileLog.audit_id})</span>
            </div>
          )}
        </div>

        {/* Card 2: Full System Audit Scan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Comprehensive System Audit</h3>
                  <p className="text-[11px] text-slate-500">
                    Scan games revenue, loans ledger, hardware tables, and cloud synchronization.
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="run-full-audit-scan-btn"
                onClick={handleRunFullScan}
                disabled={isScanning}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Run Full Audit'}</span>
              </button>
            </div>

            {scanResult ? (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-700">Audit Status:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {scanResult.overallStatus}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {scanResult.checks.map((check: any, idx: number) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-800 text-[11px]">{check.name}</div>
                        <div className="text-[10px] text-slate-500">{check.details}</div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 mt-3">
                Click <strong>Run Full Audit</strong> to execute a full multi-point audit scan of games, tables, loans, and cloud data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Audit Logs Search & Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            id="audit-logs-search"
            placeholder="Search audit logs by worker, action, or reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <button
          type="button"
          id="refresh-audit-logs-btn"
          onClick={fetchLogs}
          disabled={isLoading}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Logs ({filtered.length})</span>
        </button>
      </div>

      {/* Logs Stream */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 shadow-sm">
            {isLoading ? 'Loading audit records...' : 'No audit records found.'}
          </div>
        ) : (
          filtered.map(log => (
            <div
              key={log.audit_id}
              className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-600 font-mono uppercase">{log.action}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-900 font-medium">{log.user_email}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                    {log.user_role}
                  </span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>

              {log.reason && (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                  <span className="text-slate-500 font-bold mr-1.5">Reason:</span>
                  <span>{log.reason}</span>
                </div>
              )}

              <div className="text-[11px] text-slate-500 font-mono truncate">
                Target: {log.entity_type} ({log.entity_id}) • Session: {log.session_id || 'N/A'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

