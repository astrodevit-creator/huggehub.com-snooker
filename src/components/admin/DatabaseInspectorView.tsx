/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Live Database & Firestore Explorer View
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { fetchJson, api } from '../../lib/api.ts';
import {
  Database,
  ExternalLink,
  Search,
  Download,
  Code2,
  RefreshCw,
  Server,
  Layers,
  CheckCircle2,
  Table2,
  Users,
  CreditCard,
  Calendar,
  Clock,
  Shield,
  Settings,
  Eye,
  X,
  Copy,
  Check,
  FileSpreadsheet,
} from 'lucide-react';

interface DatabaseMeta {
  projectId: string;
  databaseId: string;
  clusterHost?: string;
  consoleUrl: string;
  status: string;
  provider: string;
  timezone: string;
  syncedTime: string;
}

interface CollectionSummary {
  count: number;
  sample: any[];
}

interface DatabaseOverviewResponse {
  meta: DatabaseMeta;
  collections: Record<string, CollectionSummary>;
}

export const DatabaseInspectorView: React.FC = () => {
  const { t, isRTL } = useTranslation();
  const [overview, setOverview] = useState<DatabaseOverviewResponse | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>('games');
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingCollection, setIsLoadingCollection] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inspectModalDoc, setInspectModalDoc] = useState<any | null>(null);
  const [copiedDoc, setCopiedDoc] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState<boolean>(false);
  const [sheetInputId, setSheetInputId] = useState<string>('');
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const [sheetsStatus, setSheetsStatus] = useState<any>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Load Google Sheets Status
  const loadSheetsStatus = async () => {
    try {
      const res = await api.getGoogleSheetsStatus();
      setSheetsStatus(res);
      if (res.spreadsheetId && !sheetInputId) {
        setSheetInputId(res.spreadsheetId);
      }
    } catch (e) {
      console.error('Failed to load Google Sheets status:', e);
    }
  };

  // Connect & Initialize Spreadsheet by ID or URL
  const handleConnectSpreadsheet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sheetInputId.trim()) return;
    try {
      setIsConnectingSheet(true);
      setSyncMessage('Connecting and initializing Google Spreadsheet...');
      const res = await fetchJson<{ success: boolean; health: any; syncResult?: any }>(
        '/api/admin/sheets/init',
        {
          method: 'POST',
          body: JSON.stringify({ spreadsheetId: sheetInputId.trim() }),
        }
      );
      if (res.success) {
        setSyncMessage('Google Spreadsheet connected & mirrored successfully!');
        await loadSheetsStatus();
      } else {
        setSyncMessage(res.health?.errorMessage || 'Failed to initialize spreadsheet. Check service account access.');
      }
    } catch (err: any) {
      setSyncMessage(err?.message || 'Failed to connect spreadsheet');
    } finally {
      setIsConnectingSheet(false);
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  const handleCopyServiceAccountEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // Sync All Data to Google Sheets
  const handleSyncGoogleSheets = async () => {
    try {
      setIsSyncingSheets(true);
      setSyncMessage(t('syncingGoogleSheets'));
      const res = await api.syncAllGoogleSheets();
      if (res.success) {
        setSyncMessage('Google Sheets Realtime Backup updated successfully!');
        await loadSheetsStatus();
      } else {
        setSyncMessage(res.error || 'Failed to sync with Google Sheets');
      }
    } catch (e: any) {
      setSyncMessage(e?.message || 'Sync error with Google Sheets');
    } finally {
      setIsSyncingSheets(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  // Force sync all data to Cloud Firestore
  const handleForceSync = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage(t('syncingFirestore'));
      const res = await fetchJson<{ success: boolean; syncedCounts: Record<string, number> }>(
        '/api/admin/database/sync',
        { method: 'POST' }
      );
      if (res.success) {
        setSyncMessage(t('syncSuccessMsg'));
        await loadOverview();
      } else {
        setSyncMessage('Failed to sync to Firestore');
      }
    } catch (e: any) {
      setSyncMessage(e?.message || 'Sync error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Load Overview Data
  const loadOverview = async () => {
    try {
      setIsLoading(true);
      const res = await fetchJson<DatabaseOverviewResponse>('/api/admin/database/overview');
      setOverview(res);
      if (res.collections[selectedCollection]) {
        setCollectionData(res.collections[selectedCollection].sample || []);
      }
    } catch (e) {
      console.error('Failed to load database overview:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load specific collection data
  const loadCollectionData = async (colName: string) => {
    try {
      setIsLoadingCollection(true);
      setSelectedCollection(colName);
      const res = await fetchJson<{ collection: string; totalCount: number; data: any[] }>(
        `/api/admin/database/collection/${colName}`
      );
      setCollectionData(res.data || []);
    } catch (e) {
      console.error(`Failed to load collection ${colName}:`, e);
    } finally {
      setIsLoadingCollection(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadSheetsStatus();
  }, []);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return collectionData;
    const term = searchTerm.toLowerCase().trim();
    return collectionData.filter(doc => {
      const str = JSON.stringify(doc).toLowerCase();
      return str.includes(term);
    });
  }, [collectionData, searchTerm]);

  // Export JSON file
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(collectionData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `extrablack_${selectedCollection}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = (doc: any) => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const collectionIcons: Record<string, React.ReactNode> = {
    games: <Table2 className="w-4 h-4 text-emerald-600" />,
    customers: <Users className="w-4 h-4 text-blue-600" />,
    loans: <CreditCard className="w-4 h-4 text-amber-600" />,
    sessions: <Calendar className="w-4 h-4 text-indigo-600" />,
    tables: <Server className="w-4 h-4 text-purple-600" />,
    waiting_list: <Clock className="w-4 h-4 text-cyan-600" />,
    users: <Shield className="w-4 h-4 text-rose-600" />,
    audit_logs: <Layers className="w-4 h-4 text-slate-600" />,
    settings: <Settings className="w-4 h-4 text-slate-600" />,
  };

  const collectionLabels: Record<string, string> = {
    games: isRTL ? 'المباريات (Games)' : 'Games',
    customers: isRTL ? 'الزبائن (Customers)' : 'Customers',
    loans: isRTL ? 'الكريدي (Loans)' : 'Loans',
    sessions: isRTL ? 'الورديات (Sessions)' : 'Sessions',
    tables: isRTL ? 'الطاولات (Tables)' : 'Tables',
    waiting_list: isRTL ? 'الانتظار (Waiting List)' : 'Waiting List',
    users: isRTL ? 'المستخدمين (Users)' : 'Users',
    audit_logs: isRTL ? 'سجلات الأمان (Audit)' : 'Audit Logs',
    settings: isRTL ? 'الإعدادات (Settings)' : 'Settings',
  };

  const consoleUrl =
    overview?.meta.consoleUrl ||
    'https://cloud.mongodb.com/';

  return (
    <div className="space-y-6">
      {/* Database Metadata Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-inner">
              <Database className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{t('databaseTitle')}</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {overview?.meta.provider || t('cloudConnected')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('databaseSubtitle')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs font-mono">
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-400">Cluster Host:</span>{' '}
                  <span className="text-slate-800 font-bold">{overview?.meta.clusterHost || 'cluster0.9jwyvih.mongodb.net'}</span>
                </div>
                <div className="text-slate-600 truncate">
                  <span className="font-semibold text-slate-400">Database Name:</span>{' '}
                  <span className="text-slate-800 font-bold" title={overview?.meta.databaseId || 'extrablack_snooker'}>
                    {overview?.meta.databaseId || 'extrablack_snooker'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              id="force-sync-firestore-btn"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? t('syncingFirestore') : t('forceSyncFirestore')}</span>
            </button>

            <button
              type="button"
              id="refresh-database-btn"
              onClick={loadOverview}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('refreshData')}</span>
            </button>

            <a
              href={consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="open-firebase-console-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t('openFirebaseConsole')}</span>
            </a>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800 flex items-center justify-between">
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-indigo-600 hover:text-indigo-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Google Sheets Real-time Backup Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{t('googleSheetsBackupTitle')}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  sheetsStatus?.connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sheetsStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {sheetsStatus?.connected ? t('googleSheetsConnected') : t('googleSheetsNotConfigured')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {sheetsStatus?.spreadsheetId
                  ? `Active Spreadsheet ID: ${sheetsStatus.spreadsheetId}`
                  : 'Automatic real-time mirroring of all games, loans, customers, sessions, and tables.'}
              </p>
              {sheetsStatus?.lastSyncAt && (
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {t('googleSheetsLastSync')}: {new Date(sheetsStatus.lastSyncAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sheetsStatus?.spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetsStatus.spreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                id="open-google-sheet-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('openGoogleSheet')}</span>
              </a>
            )}

            <button
              type="button"
              id="sync-all-google-sheets-btn"
              onClick={handleSyncGoogleSheets}
              disabled={isSyncingSheets || !sheetsStatus?.connected}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheets ? t('syncingGoogleSheets') : t('syncAllToSheetsBtn')}</span>
            </button>
          </div>
        </div>

        {/* Spreadsheet URL / ID Input & Service Account Sharing Instructions */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <form onSubmit={handleConnectSpreadsheet} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              id="google-sheet-url-input"
              value={sheetInputId}
              onChange={(e) => setSheetInputId(e.target.value)}
              placeholder="Paste Google Spreadsheet URL or ID (e.g. https://docs.google.com/spreadsheets/d/...)"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder-slate-400"
            />
            <button
              type="submit"
              id="connect-sheet-btn"
              disabled={isConnectingSheet || !sheetInputId.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnectingSheet ? 'animate-spin' : ''}`} />
              <span>{isConnectingSheet ? 'Connecting...' : 'Connect & Mirror Sheet'}</span>
            </button>
          </form>

          {/* Service Account Share Info */}
          {sheetsStatus?.serviceAccountEmail ? (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="text-emerald-900">
                <span className="font-bold">Step:</span> Share your Google Spreadsheet with this Service Account as <strong className="font-semibold">Editor</strong>:
                <code className="block sm:inline sm:ml-2 font-mono text-[11px] bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded font-semibold select-all mt-1 sm:mt-0">
                  {sheetsStatus.serviceAccountEmail}
                </code>
              </div>
              <button
                type="button"
                id="copy-service-account-email-btn"
                onClick={() => handleCopyServiceAccountEmail(sheetsStatus.serviceAccountEmail)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-800 transition shrink-0 self-start sm:self-center"
              >
                {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                <span>{copiedEmail ? 'Copied Email' : 'Copy Email'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <span className="font-bold">Note:</span>
              <span>
                To enable automated background backup, configure <code className="font-mono bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px]">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code className="font-mono bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px]">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> in environment settings.
              </span>
            </div>
          )}

          {sheetsStatus?.errorMessage && !sheetsStatus?.connected && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-mono">
              <span className="font-bold font-sans">Status Error: </span>{sheetsStatus.errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* Collection Grid Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {Object.entries(overview?.collections || {
          games: { count: 0, sample: [] },
          customers: { count: 0, sample: [] },
          loans: { count: 0, sample: [] },
          sessions: { count: 0, sample: [] },
          tables: { count: 0, sample: [] },
          waiting_list: { count: 0, sample: [] },
          users: { count: 0, sample: [] },
          audit_logs: { count: 0, sample: [] },
          settings: { count: 1, sample: [] },
        }).map(([colKey, colInfoVal]) => {
          const colInfo = colInfoVal as CollectionSummary;
          const isSelected = selectedCollection === colKey;
          return (
            <button
              key={colKey}
              type="button"
              id={`col-select-${colKey}`}
              onClick={() => loadCollectionData(colKey)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
              }`}
            >
              <div className={`p-2 rounded-lg mb-1.5 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50'}`}>
                {collectionIcons[colKey] || <Database className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-bold truncate max-w-full ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                {collectionLabels[colKey] || colKey}
              </span>
              <span
                className={`text-[10px] font-mono mt-0.5 px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {colInfo?.count ?? 0} docs
              </span>
            </button>
          );
        })}
      </div>

      {/* Collection Browser Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-indigo-600" />
              <span>{collectionLabels[selectedCollection] || selectedCollection}</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-100">
              {filteredDocuments.length} / {collectionData.length} records
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="search-database-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('searchDatabase')}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 font-sans"
              />
            </div>

            {/* Export JSON */}
            <button
              type="button"
              id="export-collection-json-btn"
              onClick={handleExportJson}
              disabled={collectionData.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition"
              title={t('exportJson')}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('exportJson')}</span>
            </button>
          </div>
        </div>

        {/* Data List / Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {isLoadingCollection ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono">{t('loading')}</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-mono">
              No records found for "{searchTerm}" in collection "{selectedCollection}".
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDocuments.map((doc, idx) => {
                const docId =
                  doc.game_id ||
                  doc.customer_id ||
                  doc.loan_id ||
                  doc.session_id ||
                  doc.table_id ||
                  doc.user_id ||
                  doc.waiting_id ||
                  doc.audit_id ||
                  `DOC-${idx}`;

                return (
                  <div
                    key={docId + idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                          {docId}
                        </span>
                        {doc.status && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.status === 'PAID' || doc.status === 'CLOSED' || doc.status === 'OPEN'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.status === 'RUNNING' || doc.status === 'WAITING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {doc.status}
                          </span>
                        )}
                        {doc.player_name && (
                          <span className="font-semibold text-slate-800">
                            {doc.player_name}
                          </span>
                        )}
                        {doc.name && (
                          <span className="font-semibold text-slate-800">
                            {doc.name}
                          </span>
                        )}
                        {doc.final_price !== undefined && (
                          <span className="font-bold text-indigo-700">
                            {doc.final_price} DH
                          </span>
                        )}
                        {doc.amount !== undefined && (
                          <span className="font-bold text-amber-700">
                            {doc.amount} DH
                          </span>
                        )}
                      </div>

                      <p className="text-slate-500 font-mono text-[11px] truncate max-w-2xl">
                        {JSON.stringify(doc)}
                      </p>
                    </div>

                    <button
                      type="button"
                      id={`inspect-doc-${docId}`}
                      onClick={() => setInspectModalDoc(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 shadow-sm transition shrink-0 self-end sm:self-center"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('viewDocumentJson')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* JSON Record Inspector Modal */}
      {inspectModalDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  {t('rawJson')} — {inspectModalDoc.game_id || inspectModalDoc.customer_id || inspectModalDoc.loan_id || inspectModalDoc.user_id || inspectModalDoc.session_id || 'DOCUMENT'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="copy-doc-json-btn"
                  onClick={() => handleCopyJson(inspectModalDoc)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                >
                  {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDoc ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  id="close-inspect-modal-btn"
                  onClick={() => setInspectModalDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-emerald-400 leading-relaxed">
              <pre className="whitespace-pre-wrap selection:bg-emerald-900 selection:text-white">
                {JSON.stringify(inspectModalDoc, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs text-slate-500">
              <span>Collection: <strong className="text-slate-700">{selectedCollection}</strong></span>
              <button
                type="button"
                onClick={() => setInspectModalDoc(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 rounded-lg transition"
              >
                {t('closeModal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
