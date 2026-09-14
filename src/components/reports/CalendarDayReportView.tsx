/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Calendar Day Session Report
 */

import React, { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Printer,
  Clock,
  DollarSign,
  CreditCard,
  Percent,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  User,
  Sparkles,
} from 'lucide-react';
import { CalendarDayReport } from '../../types.ts';
import { api } from '../../lib/api.ts';
import { formatDurationHuman, getCasablancaDate } from '../../lib/dateUtils.ts';
import { useTranslation } from '../../lib/i18n/useTranslation.ts';

export const CalendarDayReportView: React.FC = () => {
  const { t, isRtl } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(getCasablancaDate());
  const [report, setReport] = useState<CalendarDayReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDayReport = async (dateStr: string) => {
    try {
      setIsLoading(true);
      const data = await api.getCalendarDayReport(dateStr);
      setReport(data);
    } catch (err) {
      console.error('Failed to load calendar day report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDayReport(selectedDate);
  }, [selectedDate]);

  const changeDateByDays = (delta: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + delta);
    const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(newStr);
  };

  const handlePrint = () => {
    window.print();
  };

  const todayStr = getCasablancaDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const maxHourlyGames = report?.hourlyActivity ? Math.max(...report.hourlyActivity.map(h => h.gamesCount), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Date Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="date"
              id="calendar-date-picker"
              value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-mono text-sm font-bold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              id="cal-today-btn"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === todayStr ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t('todayBtn')}
            </button>
            <button
              type="button"
              id="cal-yesterday-btn"
              onClick={() => setSelectedDate(yesterdayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === yesterdayStr ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t('yesterdayBtn')}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              id="cal-prev-day-btn"
              onClick={() => changeDateByDays(-1)}
              title={t('prevDay')}
              className="p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition-colors"
            >
              {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              type="button"
              id="cal-next-day-btn"
              onClick={() => changeDateByDays(1)}
              title={t('nextDay')}
              className="p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition-colors"
            >
              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          id="print-day-report-btn"
          onClick={handlePrint}
          className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>{t('printDayReport')}</span>
        </button>
      </div>

      {/* Printable Title Block */}
      <div className="hidden print:block border-b border-neutral-800 pb-4 mb-4">
        <div className="text-xl font-bold text-black uppercase">EXTRABLACK SNOOKER CLUB</div>
        <div className="text-sm font-semibold text-neutral-700">{t('calendarDayReportTitle')} - {selectedDate}</div>
      </div>

      {/* Main KPI Overview */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Paid Revenue */}
          <div className="p-4 bg-neutral-900/90 rounded-2xl border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>{t('paidRevenue')}</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1.5">
              {report.financials.paidRevenue} <span className="text-sm">DH</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {report.gamesCount} {t('gamesToday')} ({formatDurationHuman(report.totalPlayingMinutes)})
            </div>
          </div>

          {/* New Loans */}
          <div className="p-4 bg-neutral-900/90 rounded-2xl border border-amber-500/30">
            <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
              <span>{t('newLoans')}</span>
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-400 mt-1.5">
              {report.financials.newLoans} <span className="text-sm">DH</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {report.loans.length} {t('loansOnDay')}
            </div>
          </div>

          {/* Le Reste */}
          <div className="p-4 bg-neutral-900/90 rounded-2xl border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>{t('leReste')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1.5">
              {report.financials.paidRevenue} <span className="text-sm text-emerald-400">DH</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {t('paidRevenue')}
            </div>
          </div>

          {/* Discounts & Free Promo */}
          <div className="p-4 bg-neutral-900/90 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
              <span>{t('discountsGiven')}</span>
              <Percent className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-400 mt-1.5">
              {report.financials.discountsGiven} <span className="text-sm">DH</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {report.financials.freeGamesCount} free promotional games ({report.financials.freePromotionalValue} DH)
            </div>
          </div>
        </div>
      )}

      {/* Hourly Activity Timeline */}
      {report && (
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('hourlyActivityTitle')}
              </h4>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {selectedDate}
            </span>
          </div>

          {/* 24-Hour Interactive Timeline Bars */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-2">
            {report.hourlyActivity.map(h => {
              const heightPercent = h.gamesCount > 0 ? Math.max((h.gamesCount / maxHourlyGames) * 100, 15) : 4;
              return (
                <div
                  key={h.hour}
                  className="flex flex-col items-center bg-neutral-950 p-2 rounded-xl border border-neutral-800/80 hover:border-amber-500/50 transition-colors group relative"
                >
                  <div className="h-16 w-full flex items-end justify-center">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[16px] rounded-t-md transition-all ${
                        h.gamesCount > 0
                          ? 'bg-amber-500 group-hover:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                          : 'bg-neutral-800/40'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-mono font-bold text-neutral-400 mt-1.5">
                    {h.hourLabel.split(':')[0]}h
                  </div>
                  <div className="text-[10px] font-mono font-extrabold text-amber-400 mt-0.5">
                    {h.gamesCount > 0 ? `${h.gamesCount}g` : '-'}
                  </div>
                  {h.paidRevenue > 0 && (
                    <div className="text-[9px] font-mono text-emerald-400 font-semibold">
                      {h.paidRevenue}DH
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table Comparison for the Selected Day */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mini 1 */}
          <div className="p-4 bg-neutral-900/80 rounded-2xl border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white uppercase tracking-wider">TABLE MINI 1</span>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                {report.tableBreakdown.mini1.games} {t('gamesToday')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('playingTimeToday')}</div>
                <div className="text-sm font-bold text-neutral-200 font-mono mt-0.5">
                  {formatDurationHuman(report.tableBreakdown.mini1.minutes)}
                </div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('paidRevenue')}</div>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {report.tableBreakdown.mini1.revenue} DH
                </div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('discountsGiven')}</div>
                <div className="text-sm font-bold text-neutral-400 font-mono mt-0.5">
                  {report.tableBreakdown.mini1.discounts} DH
                </div>
              </div>
            </div>
          </div>

          {/* Mini 2 */}
          <div className="p-4 bg-neutral-900/80 rounded-2xl border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white uppercase tracking-wider">TABLE MINI 2</span>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                {report.tableBreakdown.mini2.games} {t('gamesToday')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('playingTimeToday')}</div>
                <div className="text-sm font-bold text-neutral-200 font-mono mt-0.5">
                  {formatDurationHuman(report.tableBreakdown.mini2.minutes)}
                </div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('paidRevenue')}</div>
                <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                  {report.tableBreakdown.mini2.revenue} DH
                </div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-neutral-500">{t('discountsGiven')}</div>
                <div className="text-sm font-bold text-neutral-400 font-mono mt-0.5">
                  {report.tableBreakdown.mini2.discounts} DH
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Games on Selected Date */}
      {report && (
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('dailyGamesList')} ({report.games.length})
              </h4>
            </div>
          </div>

          {report.games.length === 0 ? (
            <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800/60 text-neutral-500 text-xs">
              {t('noSessionForDay')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-mono text-[10px]">
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Players</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Payment</th>
                    <th className="py-2.5 px-3">Offer / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {report.games.map(g => (
                    <tr key={g.game_id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-amber-400">{g.table_id}</td>
                      <td className="py-2.5 px-3 text-white font-sans font-semibold">{g.player_name}</td>
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                        {g.start_time.split('T')[1]?.slice(0, 5)} - {g.end_time ? g.end_time.split('T')[1]?.slice(0, 5) : 'Active'}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-300">
                        {formatDurationHuman(g.duration_minutes)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        {g.final_price} DH
                        {g.discount_amount > 0 && (
                          <span className="text-[10px] text-rose-400 block">-{g.discount_amount}DH</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : g.payment_status === 'PAY_LATER'
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}
                        >
                          {g.payment_status === 'LOAN_PAID'
                            ? 'PAID (LOAN)'
                            : g.payment_status === 'PAY_LATER'
                            ? 'PAY LATER'
                            : g.payment_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">
                        {g.offer_type || g.price_reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Loans on Selected Date */}
      {report && report.loans.length > 0 && (
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-amber-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('loansOnDay')} ({report.loans.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {report.loans.map(l => (
              <div key={l.loan_id} className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-xs">{l.player_name}</div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    {l.created_at.split('T')[1]?.slice(0, 5)} • Table {l.table_id || 'Direct'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-amber-400">{l.amount} DH</div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      l.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
