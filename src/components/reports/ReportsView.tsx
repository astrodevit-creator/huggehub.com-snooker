/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Reports & Analytics Dashboard
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  Clock,
  DollarSign,
  Gift,
  CreditCard,
  UserCheck,
  TrendingUp,
  Users,
  CalendarDays,
} from 'lucide-react';
import { formatDurationHuman } from '../../lib/dateUtils.ts';
import { api } from '../../lib/api.ts';
import { CalendarDayReportView } from './CalendarDayReportView.tsx';
import { UserSessionsReportView } from './UserSessionsReportView.tsx';
import { useTranslation } from '../../lib/i18n/useTranslation.ts';

type ReportTab = 'overview' | 'calendar' | 'userSessions';

export const ReportsView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [range, setRange] = useState<'today' | 'yesterday' | 'all'>('today');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const data = await api.getReports({ range });
      setReportData(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchReports();
    }
  }, [range, activeTab]);

  const summary = reportData?.summary;
  const tablePerf = reportData?.tablePerformance;
  const workerPerf = reportData?.workerPerformance || [];

  return (
    <div className="space-y-6">
      {/* Top Report Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-sm">
        <button
          type="button"
          id="tab-report-overview"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{t('navReports')} & KPIs</span>
        </button>

        <button
          type="button"
          id="tab-report-calendar"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'calendar'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{t('navCalendarReport')}</span>
        </button>

        <button
          type="button"
          id="tab-report-user-sessions"
          onClick={() => setActiveTab('userSessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'userSessions'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('navUserSessions')}</span>
        </button>
      </div>

      {/* Tab 1: Financial & Table Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Controls Bar: Range Selector & CSV Export */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800">
              {(['today', 'yesterday', 'all'] as const).map(r => (
                <button
                  key={r}
                  id={`report-range-${r}`}
                  onClick={() => setRange(r)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                    range === r
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'All Time' : r}
                </button>
              ))}
            </div>

            <a
              href="/api/reports/export-csv"
              download
              id="export-csv-btn"
              className="py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl border border-neutral-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export CSV Report</span>
            </a>
          </div>

          {/* Top Financial Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 bg-neutral-900/80 rounded-2xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Total Games</div>
              <div className="text-2xl font-extrabold font-mono text-white mt-1">
                {summary?.totalGames || 0}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                {formatDurationHuman(summary?.totalPlayingMinutes || 0)} played
              </div>
            </div>

            <div className="p-4 bg-neutral-900/80 rounded-2xl border border-emerald-500/30">
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Total Cash Paid</div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
                {summary?.paidRevenue || 0} <span className="text-sm">DH</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">Direct collected revenue</div>
            </div>

            <div className="p-4 bg-neutral-900/80 rounded-2xl border border-amber-500/30">
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">New Loans Created</div>
              <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
                {summary?.newLoans || 0} <span className="text-sm">DH</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">Customer credit recorded</div>
            </div>

            <div className="p-4 bg-neutral-900/80 rounded-2xl border border-emerald-500/30">
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">{t('leReste')}</div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
                {summary?.paidRevenue || 0} <span className="text-sm text-emerald-400">DH</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">{t('paidRevenue')}</div>
            </div>
          </div>

          {/* Secondary Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Gross Calculated Value</div>
              <div className="text-base font-bold text-neutral-300 font-mono mt-0.5">
                {summary?.calculatedValue || 0} DH
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Discounts Conceded</div>
              <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                {summary?.discountsGiven || 0} DH
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Free Promo Value</div>
              <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
                {summary?.freePromotionalValue || 0} DH ({summary?.freeGamesCount || 0} games)
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Global Open Loans</div>
              <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                {summary?.openLoansBalance || 0} DH
              </div>
            </div>
          </div>

          {/* Table Performance Cards */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Table Performance</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mini 1 */}
              <div className="p-5 bg-neutral-900/80 rounded-2xl border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white uppercase tracking-wider">MINI 1</span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    {tablePerf?.mini1?.games || 0} games
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Playing Time</div>
                    <div className="text-sm font-bold text-neutral-200 font-mono mt-0.5">
                      {formatDurationHuman(tablePerf?.mini1?.minutes || 0)}
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Revenue</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      {tablePerf?.mini1?.revenue || 0} DH
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Discounts</div>
                    <div className="text-sm font-bold text-neutral-400 font-mono mt-0.5">
                      {tablePerf?.mini1?.discounts || 0} DH
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini 2 */}
              <div className="p-5 bg-neutral-900/80 rounded-2xl border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white uppercase tracking-wider">MINI 2</span>
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    {tablePerf?.mini2?.games || 0} games
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Playing Time</div>
                    <div className="text-sm font-bold text-neutral-200 font-mono mt-0.5">
                      {formatDurationHuman(tablePerf?.mini2?.minutes || 0)}
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Revenue</div>
                    <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                      {tablePerf?.mini2?.revenue || 0} DH
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-950 rounded-xl">
                    <div className="text-[9px] uppercase font-bold text-neutral-500">Discounts</div>
                    <div className="text-sm font-bold text-neutral-400 font-mono mt-0.5">
                      {tablePerf?.mini2?.discounts || 0} DH
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Worker Operational Breakdown */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Employee Operational Activity
            </h4>
            <div className="space-y-2.5">
              {workerPerf.length === 0 ? (
                <div className="p-6 text-center bg-neutral-900/40 rounded-xl text-xs text-neutral-500 border border-neutral-800">
                  No worker activity recorded for this period.
                </div>
              ) : (
                workerPerf.map((w: any) => (
                  <div
                    key={w.workerId}
                    className="p-4 bg-neutral-900/80 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">{w.name}</div>
                      <div className="text-xs text-neutral-500 font-mono mt-0.5">
                        {w.gamesEnded} games handled • {w.manualPricesCount} manual adjustments
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-neutral-500">Collected:</span>{' '}
                        <span className="text-emerald-400 font-bold">{w.paidCollected} DH</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Loans:</span>{' '}
                        <span className="text-amber-400 font-bold">{w.loansCreated} DH</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Discounts:</span>{' '}
                        <span className="text-neutral-300 font-bold">{w.discountsGiven} DH</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Calendar Day Session Report */}
      {activeTab === 'calendar' && <CalendarDayReportView />}

      {/* Tab 3: Connected User Sessions Report */}
      {activeTab === 'userSessions' && <UserSessionsReportView />}
    </div>
  );
};
