/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Cloud Sync Status Indicator Component
 * Explicitly displays whether the connection to Google Sheets is active
 * and when the last successful backup occurred.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FileSpreadsheet, RefreshCw, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { useAuth } from '../../lib/authContext.tsx';
import { api } from '../../lib/api.ts';

export interface GoogleSheetsSyncStatus {
  connected: boolean;
  spreadsheetId: string | null;
  serviceAccountConfigured: boolean;
  sheetsFound: string[];
  lastSyncAt: string | null;
  errorMessage: string | null;
  pendingRetries?: number;
  consecutiveFailures?: number;
  stack?: {
    sheets: any;
    mongodb: any;
    firestore: any;
    overallHealthy: boolean;
  };
}

interface CloudSyncStatusProps {
  className?: string;
  onSyncComplete?: () => void;
}

export const CloudSyncStatus: React.FC<CloudSyncStatusProps> = ({
  className = '',
  onSyncComplete,
}) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<GoogleSheetsSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<'success' | 'error' | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      const data = await api.getGoogleSheetsStatus();
      setStatus(data);
    } catch {
      // In case user is not admin or request fails, handle gracefully without crashing
      setStatus(prev => prev || {
        connected: false,
        spreadsheetId: null,
        serviceAccountConfigured: false,
        sheetsFound: [],
        lastSyncAt: null,
        errorMessage: 'Unable to query Google Sheets status',
      });
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll sync status periodically (every 15 seconds)
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 15000);

    return () => {
      clearInterval(interval);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [fetchStatus]);

  const handleManualSync = async () => {
    if (isSyncing || !isAdmin) return;
    try {
      setIsSyncing(true);
      setSyncFeedback(null);
      const res = await api.syncAllGoogleSheets();
      if (res.success) {
        setSyncFeedback('success');
        await fetchStatus(true);
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncFeedback('error');
      }
    } catch {
      setSyncFeedback('error');
    } finally {
      setIsSyncing(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);
    }
  };

  const isConnected = !!status?.connected;
  const lastSyncTimeStr = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div
      id="cloud-sync-status-indicator"
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all text-xs ${
        isConnected
          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          : 'bg-neutral-950/70 border-neutral-800 text-neutral-400'
      } ${className}`}
    >
      {/* Icon & Connection State Badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <FileSpreadsheet
          className={`w-3.5 h-3.5 ${
            isConnected ? 'text-emerald-400' : 'text-neutral-500'
          }`}
        />
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected
              ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-500/20'
              : 'bg-neutral-600'
          }`}
        />
      </div>

      {/* Connection Text & Last Successful Backup Timestamp */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 leading-tight">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="text-white/90">
            {t('googleSheetsBackupTitle').split('(')[0].trim() || 'Google Sheets'}:
          </span>
          <span
            className={`font-mono text-[11px] font-bold ${
              isConnected ? 'text-emerald-400' : 'text-neutral-400'
            }`}
          >
            {isConnected ? t('cloudSyncActive') : t('cloudSyncInactive')}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
          <span className="text-neutral-500 hidden sm:inline">•</span>
          <span>{t('lastSuccessfulBackup')}:</span>
          <span className={lastSyncTimeStr ? 'text-neutral-200 font-semibold' : 'text-neutral-500'}>
            {lastSyncTimeStr || t('noBackupYet')}
          </span>
        </div>
      </div>

      {/* Controls: External Link & Admin Manual Trigger */}
      <div className="flex items-center gap-1.5 ml-auto pl-1">
        {status?.spreadsheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            title={t('openGoogleSheet')}
            className="p-1 text-neutral-400 hover:text-emerald-400 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isLoading}
            title={t('syncAllToSheetsBtn')}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
          >
            {syncFeedback === 'success' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : syncFeedback === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`}
              />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
