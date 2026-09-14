/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Real-Time System & Data Diagnostics View
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { fetchJson } from '../../lib/api.ts';
import {
  Activity,
  Server,
  Database,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Table2,
  Cpu,
  Filter,
} from 'lucide-react';

interface DiagnosticReport {
  timestamp: string;
  environment: {
    nodeEnv: string;
    databaseEngine?: string;
    databaseName?: string;
    clusterHost?: string;
    projectId?: string;
    firestoreDatabaseId?: string;
    timezone: string;
    moroccoTime: string;
    serverUptimeSeconds: number;
    appVersion: string;
  };
  storageCounts: {
    gamesTotal: number;
    gamesToday: number;
    completedGames: number;
    activeGames: number;
    loansTotal: number;
    openLoans: number;
    sessionsTotal: number;
    customersTotal: number;
    tablesTotal: number;
  };
  mongoCounts?: {
    connected: boolean;
    games: number;
    loans: number;
    sessions: number;
    customers: number;
    tables: number;
    auditLogs: number;
  };
  firestoreCounts: {
    connected: boolean;
    games: number;
    loans: number;
    sessions: number;
    customers: number;
    tables: number;
    auditLogs: number;
  };
  activeSession: {
    sessionId: string;
    status: string;
    openedAt: string;
    date: string;
    totalGames: number;
    totalPaid: number;
    newLoans: number;
    reste: number;
    mini1Revenue: number;
    mini2Revenue: number;
  };
  last10Games: Array<{
    game_id: string;
    session_id: string;
    table_id: string;
    player_name: string;
    status: string;
    payment_status: string;
    suggested_price: number;
    final_price: number;
    start_time: string;
    end_time?: string;
    winner_name?: string;
    loser_name?: string;
  }>;
  queryDebug: {
    allGamesInRepository: number;
    gamesMatchingCurrentSession: number;
    gamesMatchingTodayDate: number;
    activeRunningGames: number;
    closedPaidGames: number;
    closedLoanGames: number;
  };
  systemStatus: {
    firestoreDirectRead: string;
    apiLatencyMs: number;
    memoryHydrated: boolean;
    storageConsistency: 'CONSISTENT' | 'MISMATCH';
  };
}

export const DiagnosticsView: React.FC = () => {
  const { t } = useTranslation();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const startTime = performance.now();
      const res = await fetchJson<DiagnosticReport>('/api/admin/diagnostics');
      const endTime = performance.now();
      if (res.systemStatus) {
        res.systemStatus.apiLatencyMs = Math.round(endTime - startTime);
      }
      setReport(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load diagnostics report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">System & Database Diagnostics</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Live Runtime Proof
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit verifying MongoDB Atlas records, in-memory repository, and dashboard state synchronization.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="refresh-diagnostics-btn"
          onClick={loadDiagnostics}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Scanning Runtime...' : 'Re-run Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error loading diagnostics: {error}</span>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* SECTION 1: ENVIRONMENT & CONFIGURATION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>Section 1 — Environment & Cloud Infrastructure</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px] uppercase">Primary Database Engine</div>
                <div className="font-bold font-mono text-slate-800 mt-1">{report.environment.databaseEngine || 'MongoDB Atlas'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px] uppercase">Database Name</div>
                <div className="font-bold font-mono text-slate-800 mt-1 truncate" title={report.environment.databaseName || report.environment.firestoreDatabaseId}>
                  {report.environment.databaseName || report.environment.firestoreDatabaseId || 'extrablack_snooker'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px] uppercase">Timezone & Time</div>
                <div className="font-bold text-slate-800 mt-1">
                  {report.environment.timezone}
                </div>
                <div className="text-[11px] font-mono text-indigo-700 mt-0.5">{report.environment.moroccoTime}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px] uppercase">Database Latency & Status</div>
                <div className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {report.systemStatus.mongoDirectRead || report.systemStatus.firestoreDirectRead} ({report.systemStatus.apiLatencyMs} ms)
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CLOUD FIRESTORE VS IN-MEMORY STORAGE COUNTS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Section 2 — Database vs Memory Record Consistency</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                report.systemStatus.storageConsistency === 'CONSISTENT'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {report.systemStatus.storageConsistency === 'CONSISTENT' ? '100% In-Sync' : 'Mismatch Detected'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                <div className="text-slate-500 font-medium">Total Games</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{report.storageCounts.gamesTotal}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Database: {report.mongoCounts?.games ?? report.firestoreCounts.games}</div>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-center">
                <div className="text-indigo-800 font-medium">Games Today</div>
                <div className="text-xl font-bold font-mono text-indigo-700 mt-1">{report.storageCounts.gamesToday}</div>
                <div className="text-[10px] text-indigo-500 mt-0.5">Active: {report.storageCounts.activeGames}</div>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
                <div className="text-emerald-800 font-medium">Completed Games</div>
                <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{report.storageCounts.completedGames}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Closed today</div>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-center">
                <div className="text-amber-800 font-medium">Total Loans</div>
                <div className="text-xl font-bold font-mono text-amber-700 mt-1">{report.storageCounts.loansTotal}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">Open: {report.storageCounts.openLoans}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                <div className="text-slate-500 font-medium">Sessions</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{report.storageCounts.sessionsTotal}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Database: {report.mongoCounts?.sessions ?? report.firestoreCounts.sessions}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                <div className="text-slate-500 font-medium">Audit Logs</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{report.firestoreCounts.auditLogs}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Security trace</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ACTIVE OPERATIONAL SESSION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Section 3 — Active Operational Session</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100">
                <div className="text-purple-700 font-semibold font-sans">Session ID</div>
                <div className="text-sm font-bold text-purple-900 mt-1">{report.activeSession.sessionId}</div>
                <div className="text-[11px] text-purple-600 mt-0.5">Status: {report.activeSession.status}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-500 font-sans">Session Financials</div>
                <div className="font-bold text-slate-800 mt-1">Paid: {report.activeSession.totalPaid} DH</div>
                <div className="text-[11px] text-slate-500">Loans: {report.activeSession.newLoans} DH | Reste: {report.activeSession.reste} DH</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-500 font-sans">Table Breakdown</div>
                <div className="font-bold text-slate-800 mt-1">Mini 1: {report.activeSession.mini1Revenue} DH</div>
                <div className="text-[11px] text-slate-500">Mini 2: {report.activeSession.mini2Revenue} DH</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-500 font-sans">Session Opened At</div>
                <div className="font-bold text-slate-800 mt-1 truncate" title={report.activeSession.openedAt}>
                  {report.activeSession.openedAt}
                </div>
                <div className="text-[11px] text-slate-500">Date: {report.activeSession.date}</div>
              </div>
            </div>
          </div>

          {/* SECTION 4: LAST 10 GAMES TRACE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Table2 className="w-4 h-4 text-emerald-600" />
              <span>Section 4 — Last 10 Games In Persistence</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-2.5">Game ID</th>
                    <th className="p-2.5">Session</th>
                    <th className="p-2.5">Table</th>
                    <th className="p-2.5">Players</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Payment</th>
                    <th className="p-2.5">Price</th>
                    <th className="p-2.5">Start Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {report.last10Games.map(g => (
                    <tr key={g.game_id} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-slate-800">{g.game_id}</td>
                      <td className="p-2.5 text-slate-500 text-[11px]">{g.session_id}</td>
                      <td className="p-2.5 font-sans font-semibold text-slate-700">{g.table_id}</td>
                      <td className="p-2.5 font-sans text-slate-800">{g.player_name}</td>
                      <td className="p-2.5 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.status === 'CLOSED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : g.payment_status === 'LOAN'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {g.payment_status === 'LOAN_PAID' ? 'PAID (LOAN)' : g.payment_status}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-slate-900">{g.final_price} DH</td>
                      <td className="p-2.5 text-slate-500 text-[11px] truncate max-w-[150px]">{g.start_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 5: QUERY FILTERING & PIPELINE TRACE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Section 5 — Query Pipeline & Filter Diagnostics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">TOTAL IN MEMORY</div>
                <div className="text-base font-bold font-mono text-slate-800 mt-1">{report.queryDebug.allGamesInRepository}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">CURRENT SESSION</div>
                <div className="text-base font-bold font-mono text-indigo-700 mt-1">{report.queryDebug.gamesMatchingCurrentSession}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">MATCHING TODAY</div>
                <div className="text-base font-bold font-mono text-slate-800 mt-1">{report.queryDebug.gamesMatchingTodayDate}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">ACTIVE RUNNING</div>
                <div className="text-base font-bold font-mono text-amber-700 mt-1">{report.queryDebug.activeRunningGames}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">CLOSED / PAID</div>
                <div className="text-base font-bold font-mono text-emerald-700 mt-1">{report.queryDebug.closedPaidGames}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-slate-400 font-mono text-[10px]">CLOSED / LOAN</div>
                <div className="text-base font-bold font-mono text-amber-700 mt-1">{report.queryDebug.closedLoanGames}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
