/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Primary Dashboard View
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Lock,
  RefreshCw,
  History,
  Trash2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { LiveTableCard } from './LiveTableCard.tsx';
import { StartGameModal } from '../games/StartGameModal.tsx';
import { EndGameModal } from '../games/EndGameModal.tsx';
import { GameDetailEditModal } from '../games/GameDetailEditModal.tsx';
import { DeleteMistakeModal } from '../common/DeleteMistakeModal.tsx';
import { CloseSessionModal } from '../sessions/CloseSessionModal.tsx';
import { WaitingListManager } from '../waiting/WaitingListManager.tsx';
import { CloudSyncStatus } from './CloudSyncStatus.tsx';
import {
  DashboardLiveData,
  DailySession,
  Game,
  SnookerTable,
  WaitingEntry,
} from '../../types.ts';
import { formatDurationHuman, formatTime } from '../../lib/dateUtils.ts';
import { useAuth } from '../../lib/authContext.tsx';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { api } from '../../lib/api.ts';
import { useFirestoreRealtimeStream } from '../../lib/useFirestoreStream.ts';

export const DashboardView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [liveData, setLiveData] = useState<DashboardLiveData | null>(null);
  const [allTables, setAllTables] = useState<SnookerTable[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals state
  const [startGameTable, setStartGameTable] = useState<SnookerTable | null>(null);
  const [waitingPlayerToStart, setWaitingPlayerToStart] = useState<WaitingEntry | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);

  const [endGameObj, setEndGameObj] = useState<{ game: Game; table: SnookerTable } | null>(null);
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);

  const [selectedGameForDetails, setSelectedGameForDetails] = useState<Game | null>(null);
  const [gameToDeleteForMistake, setGameToDeleteForMistake] = useState<Game | null>(null);
  const [gameToPayCredit, setGameToPayCredit] = useState<Game | null>(null);
  const [isPayingCredit, setIsPayingCredit] = useState<boolean>(false);
  const [isCloseSessionModalOpen, setIsCloseSessionModalOpen] = useState<boolean>(false);

  const fetchDashboard = useCallback(async (showIndicator = false) => {
    try {
      if (showIndicator) setIsRefreshing(true);
      const [dash, tablesList] = await Promise.all([
        api.getLiveDashboard(),
        api.getTables().catch(() => []),
      ]);
      setLiveData(dash);
      if (tablesList.length > 0) {
        setAllTables(tablesList);
      }
    } catch {
      // ignore
    } finally {
      if (showIndicator) setIsRefreshing(false);
    }
  }, []);

  const handleConfirmPayCredit = async () => {
    if (!gameToPayCredit) return;
    try {
      setIsPayingCredit(true);
      await api.payGameCredit(gameToPayCredit.game_id);
      setGameToPayCredit(null);
      await fetchDashboard(true);
    } catch (err) {
      console.error('Failed to pay credit:', err);
    } finally {
      setIsPayingCredit(false);
    }
  };

  const isAnyModalOpen = isStartModalOpen || isEndModalOpen || isCloseSessionModalOpen || !!selectedGameForDetails || !!gameToPayCredit || !!gameToDeleteForMistake;

  // Real-time Firestore stream listener: instant update when database writes occur
  useFirestoreRealtimeStream(() => {
    if (!isAnyModalOpen) {
      fetchDashboard(false);
    }
  });

  useEffect(() => {
    fetchDashboard();
    // Resilient background sync interval
    const interval = setInterval(() => {
      if (!isAnyModalOpen) {
        fetchDashboard(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard, isAnyModalOpen]);

  const handleStartGame = (table: SnookerTable, waitingCustomer?: WaitingEntry) => {
    setStartGameTable(table);
    setWaitingPlayerToStart(waitingCustomer || null);
    setIsStartModalOpen(true);
  };

  const handleEndGame = (game: Game, table: SnookerTable) => {
    setEndGameObj({ game, table });
    setIsEndModalOpen(true);
  };

  const currentSession: DailySession | undefined = liveData?.session;
  const metrics = liveData?.todayTotals;

  const recentGames = (liveData?.recentGames || []).filter(
    g => (!currentSession?.session_id || g.session_id === currentSession.session_id) && g.status === 'CLOSED' && !g.deleted
  );

  const paidGames = recentGames.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID');
  const loanGames = recentGames.filter(g => g.payment_status === 'LOAN');
  const payLaterGames = recentGames.filter(g => g.payment_status === 'PAY_LATER');

  const totalPaidCash = metrics?.totalPaid ?? paidGames.reduce((acc, g) => acc + (g.final_price || 0), 0);
  const totalLoanAmount = metrics?.totalLoan ?? loanGames.reduce((acc, g) => acc + (g.final_price || 0), 0);
  const totalPayLaterAmount = metrics?.totalPayLater ?? payLaterGames.reduce((acc, g) => acc + (g.final_price || 0), 0);
  const creditPaidAmount = metrics?.creditPaidToday ?? metrics?.oldLoansCollectedToday ?? 0;
  const directCashAmount = Math.max(0, totalPaidCash - creditPaidAmount);
  const totalGamesValue = currentSession?.final_value || (totalPaidCash + totalLoanAmount + totalPayLaterAmount);

  const tableList: SnookerTable[] = allTables.length > 0 ? allTables : (liveData?.tables?.map(t => t.table) || [
    { table_id: 'MINI1', name: 'Mini 1', active: true, hourly_rate: 60, minimum_price: 20, created_at: '', updated_at: '' },
    { table_id: 'MINI2', name: 'Mini 2', active: true, hourly_rate: 60, minimum_price: 20, created_at: '', updated_at: '' },
  ]);

  const mini1TableData = liveData?.tables.find(t => t.table.table_id === 'MINI1');
  const mini2TableData = liveData?.tables.find(t => t.table.table_id === 'MINI2');

  const mini1 = mini1TableData?.table || tableList.find(t => t.table_id === 'MINI1') || tableList[0];
  const mini2 = mini2TableData?.table || tableList.find(t => t.table_id === 'MINI2') || tableList[1] || tableList[0];

  const mini1Game = mini1TableData?.activeGame;
  const mini2Game = mini2TableData?.activeGame;

  const mini1Queue = mini1TableData?.waitingQueue || [];
  const mini2Queue = mini2TableData?.waitingQueue || [];

  return (
    <div className="space-y-6">
      {/* Top Session KPIs & Accounting Bar */}
      <div className="bg-neutral-900/90 rounded-2xl border border-neutral-800/90 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3.5 mb-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${
                  currentSession?.status === 'OPEN' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                }`}
              />
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('sessionStatus')}
                </h2>
                <div className="text-xs text-neutral-400 font-mono">
                  {currentSession ? `${t('session')}: ${currentSession.session_id}` : t('noActiveSession')}
                </div>
              </div>
            </div>

            {/* Cloud Sync Status Indicator */}
            <CloudSyncStatus onSyncComplete={() => fetchDashboard(false)} />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
            <button
              type="button"
              id="refresh-dash-btn"
              onClick={() => fetchDashboard(true)}
              className="p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 transition-colors cursor-pointer"
              title={t('refreshData')}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {isAdmin && currentSession?.status === 'OPEN' && (
              <button
                type="button"
                id="open-close-session-modal-btn"
                onClick={() => setIsCloseSessionModalOpen(true)}
                className="py-2 px-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t('closeDailySession')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Role-adaptive metrics bar: Admin sees financial totals, Worker sees clean operational metrics without sold */}
        {isAdmin ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Recette Today (Paid + Loan) */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-indigo-500/30">
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                {t('totalRevenue')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                {(metrics?.totalPaid || 0) + (metrics?.totalLoan || 0)} <span className="text-sm text-indigo-400">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono truncate">
                {t('paid')} ({(metrics?.totalPaid || 0)}) + {t('loan')} ({(metrics?.totalLoan || 0)})
              </div>
            </div>

            {/* LE RESTE (Espèce Payé) */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-emerald-500/30">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                {t('leReste')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
                {metrics?.totalPaid || 0} <span className="text-sm">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5 truncate">
                {t('paidRevenue')}
              </div>
            </div>

            {/* New Loans */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-amber-500/30">
              <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                {t('newLoans')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400 mt-0.5">
                {metrics?.totalLoan || 0} <span className="text-sm">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                {t('unpaidLoans')}
              </div>
            </div>

            {/* Old Loans Collected */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                {t('loansCollected')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400 mt-0.5">
                {metrics?.oldLoansCollectedToday || 0} <span className="text-sm">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                {t('loansHistory')}
              </div>
            </div>

            {/* Games Today */}
            <div className="col-span-2 sm:col-span-1 p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                {t('gamesToday')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                {metrics?.totalGamesToday || 0}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                {formatDurationHuman(metrics?.totalPlayingMinutesToday || 0)}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Worker Metric 1: Games Today */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                {t('gamesToday')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                {metrics?.totalGamesToday || recentGames.length || 0}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                {formatDurationHuman(metrics?.totalPlayingMinutesToday || 0)}
              </div>
            </div>

            {/* Worker Metric 2: Total Paid */}
            <div
              id="worker-metric-credit-paid"
              className="p-3 bg-neutral-950/80 rounded-xl border border-emerald-500/30 shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center justify-between">
                <span>{t('paidRevenue')}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
                {totalPaidCash} <span className="text-sm">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate font-sans">
                {paidGames.length > 0 ? (
                  <span>
                    <span className="text-emerald-400 font-semibold">{paidGames.length} {t('paid')}</span>
                    {creditPaidAmount > 0 && (
                      <span className="text-neutral-400 text-[10px] ml-1">({creditPaidAmount} {t('dh')} {t('creditPaid')})</span>
                    )}
                  </span>
                ) : (
                  <span>0 {t('paid')}</span>
                )}
              </div>
            </div>

            {/* Worker Metric 3: Total Loan (Unpaid Credit) */}
            <div
              id="worker-metric-total-loan"
              className="p-3 bg-neutral-950/80 rounded-xl border border-orange-500/40 shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-orange-400 flex items-center justify-between">
                <span>{t('loan')}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-mono">
                  {loanGames.length}
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-orange-400 mt-0.5">
                {totalLoanAmount} <span className="text-sm">{t('dh')}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate font-sans">
                {loanGames.length > 0 ? (
                  <span className="text-orange-400 font-semibold">{loanGames.length} {t('loan')} {t('unpaidLoans')}</span>
                ) : (
                  <span>0 {t('unpaidLoans')}</span>
                )}
              </div>
            </div>

            {/* Worker Metric 4: Mini 1 Status */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                {t('tableMini1')}
              </div>
              <div className={`text-sm sm:text-base font-extrabold uppercase mt-1.5 flex items-center gap-1.5 ${
                mini1Game ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mini1Game ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {mini1Game ? t('occupied') : t('free')}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate font-sans">
                {mini1Game ? mini1Game.player_name : t('tableReady')}
              </div>
            </div>

            {/* Worker Metric 5: Mini 2 Status */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                {t('tableMini2')}
              </div>
              <div className={`text-sm sm:text-base font-extrabold uppercase mt-1.5 flex items-center gap-1.5 ${
                mini2Game ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mini2Game ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {mini2Game ? t('occupied') : t('free')}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate font-sans">
                {mini2Game ? mini2Game.player_name : t('tableReady')}
              </div>
            </div>

            {/* Worker Metric 6: Waiting Queue */}
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                {t('waitingQueue')}
              </div>
              <div className="text-2xl font-extrabold font-mono text-indigo-400 mt-0.5">
                {(mini1Queue.length + mini2Queue.length)}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {t('queuedPlayers')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Dual Table Stage: MINI 1 & MINI 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <LiveTableCard
          table={mini1}
          activeGame={mini1Game}
          waitingQueue={mini1Queue}
          onStartGame={handleStartGame}
          onEndGame={handleEndGame}
          onGameCancelled={() => fetchDashboard(true)}
        />

        <LiveTableCard
          table={mini2}
          activeGame={mini2Game}
          waitingQueue={mini2Queue}
          onStartGame={handleStartGame}
          onEndGame={handleEndGame}
          onGameCancelled={() => fetchDashboard(true)}
        />
      </div>

      {/* Live Waiting List Manager */}
      <WaitingListManager
        tables={tableList}
        onStartGameWithCustomer={handleStartGame}
        onWaitingUpdated={() => fetchDashboard(false)}
      />

      {/* Today's Completed Games Stream */}
      <div className="p-3.5 sm:p-5 bg-neutral-900/80 rounded-2xl border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
              {t('completedGames')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              id="completed-games-paid-badge"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{totalPaidCash} {t('dh')}</span>
              <span className="text-[10px] font-sans text-emerald-400/80 font-semibold uppercase">({paidGames.length} {t('paid')})</span>
            </span>
            <span
              id="completed-games-pay-later-badge"
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 font-mono font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>{totalPayLaterAmount} {t('dh')}</span>
              <span className="text-[10px] font-sans text-sky-300/90 font-semibold uppercase">({payLaterGames.length} {t('payLaterBadge')})</span>
            </span>
            <span
              id="completed-games-loan-badge"
              className="px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <span>{totalLoanAmount} {t('dh')}</span>
              <span className="text-[10px] font-sans text-orange-400/80 font-semibold uppercase">({loanGames.length} {t('loan')})</span>
            </span>
            <span className="text-[11px] sm:text-xs text-neutral-400 font-mono">
              {recentGames.length} {t('gamesToday')}
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {recentGames.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              {t('noCompletedGames')}
            </div>
          ) : (
            recentGames.map(game => {
              const formattedTable = game.table_id === 'MINI1' ? 'MINI 1' : game.table_id === 'MINI2' ? 'MINI 2' : game.table_id;
              const hasLoser = !!game.loser_name;
              const primaryName = game.loser_name || game.payer_name || game.player_name;

              return (
                <div
                  key={game.game_id}
                  id={`recent-game-row-${game.game_id.toLowerCase()}`}
                  onClick={() => setSelectedGameForDetails(game)}
                  className="p-2.5 sm:p-3 bg-neutral-950 hover:bg-neutral-900/90 rounded-xl border border-neutral-800 hover:border-neutral-700 cursor-pointer flex items-center justify-between gap-2 sm:gap-3 transition-all active:scale-[0.99] group"
                >
                  {/* Left: mini 1 + loser name */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {/* mini 1 / mini 2 badge */}
                    <span className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] sm:text-xs font-mono font-black text-amber-400 uppercase tracking-tight flex-shrink-0">
                      {formattedTable}
                    </span>

                    {/* Loser Name + match info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">
                          {primaryName}
                        </span>
                        {hasLoser && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 flex-shrink-0 uppercase">
                            {t('loser')}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] sm:text-[11px] text-neutral-400 font-mono flex items-center gap-1.5 truncate mt-0.5">
                        <span>{formatDurationHuman(game.duration_minutes)}</span>
                        <span>•</span>
                        <span>{game.end_time ? formatTime(game.end_time) : '--'}</span>
                        {game.winner_name && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium truncate">
                              🏆 {game.winner_name} {t('won')} (0 {t('dh')})
                            </span>
                          </>
                        )}
                        {game.price_reason && (
                          <>
                            <span className="hidden xs:inline">•</span>
                            <span className="hidden xs:inline text-amber-300/90 truncate">{game.price_reason}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: loan or paid + price + quick mistake delete */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {/* LOAN, PAY_LATER, OR PAID */}
                    <span
                      className={`text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                        game.payment_status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : game.payment_status === 'LOAN_PAID'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                          : game.payment_status === 'PAY_LATER'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                          : game.payment_status === 'LOAN'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {game.payment_status === 'LOAN_PAID' && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                      )}
                      {game.payment_status === 'PAY_LATER' && (
                        <Clock className="w-3 h-3 text-sky-400 inline" />
                      )}
                      {game.payment_status === 'PAID'
                        ? t('paid')
                        : game.payment_status === 'LOAN_PAID'
                        ? t('creditPaid')
                        : game.payment_status === 'PAY_LATER'
                        ? t('payLaterBadge')
                        : game.payment_status === 'LOAN'
                        ? t('loan')
                        : game.payment_status}
                    </span>

                    {/* Quick "Encaisser à la sortie" action button for PAY_LATER games (in-hall player exiting) */}
                    {game.payment_status === 'PAY_LATER' && !game.deleted && (
                      <button
                        type="button"
                        id={`mark-exit-paid-${game.game_id.toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameToPayCredit(game);
                        }}
                        className="px-2.5 py-1 bg-sky-600/25 hover:bg-sky-600/40 active:scale-95 text-sky-200 hover:text-white border border-sky-500/45 hover:border-sky-400 rounded-lg text-[10px] sm:text-xs font-bold tracking-tight flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title={t('collectExitPayment')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-300" />
                        <span>{t('collectExitPayment')}</span>
                      </button>
                    )}

                    {/* Quick "Credit Paid" action button for LOAN games - accessible to worker & admin */}
                    {game.payment_status === 'LOAN' && !game.deleted && (
                      <button
                        type="button"
                        id={`mark-credit-paid-${game.game_id.toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameToPayCredit(game);
                        }}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/35 active:scale-95 text-emerald-300 hover:text-emerald-100 border border-emerald-500/40 hover:border-emerald-400 rounded-lg text-[10px] sm:text-xs font-bold tracking-tight flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title={t('markCreditPaid')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('creditPaid')}</span>
                      </button>
                    )}

                    {/* PRICE */}
                    <div className="text-right rtl:text-left min-w-[44px] sm:min-w-[55px]">
                      <div className="text-sm sm:text-base font-black font-mono text-white">
                        {game.final_price} <span className="text-[10px] sm:text-xs font-bold text-amber-400">{t('dh')}</span>
                      </div>
                    </div>

                    {/* Quick Mistake Delete Button (Admin only - hidden from employees) */}
                    {isAdmin && (
                      <button
                        type="button"
                        id={`delete-mistake-game-${game.game_id.toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameToDeleteForMistake(game);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title={t('startedByMistake')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Start Game Modal */}
      <StartGameModal
        isOpen={isStartModalOpen}
        onClose={() => {
          setIsStartModalOpen(false);
          setWaitingPlayerToStart(null);
        }}
        table={startGameTable}
        tables={tableList}
        waitingCustomer={waitingPlayerToStart}
        onGameStarted={() => fetchDashboard(false)}
      />

      {/* End Game Modal */}
      <EndGameModal
        isOpen={isEndModalOpen}
        onClose={() => {
          setIsEndModalOpen(false);
          setEndGameObj(null);
        }}
        game={endGameObj?.game || null}
        table={endGameObj?.table || null}
        onGameEnded={() => fetchDashboard(false)}
      />

      {/* Game Detail & Admin Edit Modal */}
      <GameDetailEditModal
        isOpen={!!selectedGameForDetails}
        onClose={() => setSelectedGameForDetails(null)}
        game={selectedGameForDetails}
        tables={tableList}
        onGameUpdated={() => fetchDashboard(false)}
      />

      {/* Standalone Mistake Removal Modal */}
      {gameToDeleteForMistake && (
        <DeleteMistakeModal
          isOpen={!!gameToDeleteForMistake}
          onClose={() => setGameToDeleteForMistake(null)}
          recordIdentifier={`Game #${gameToDeleteForMistake.game_id.slice(-6)} (${gameToDeleteForMistake.player_name || gameToDeleteForMistake.loser_name || 'Match'})`}
          recordType="GAME"
          onConfirm={async (reason, password) => {
            await api.deleteGame(gameToDeleteForMistake.game_id, reason, password);
            setGameToDeleteForMistake(null);
            fetchDashboard(false);
          }}
        />
      )}

      {/* Close Daily Session Modal */}
      <CloseSessionModal
        isOpen={isCloseSessionModalOpen}
        onClose={() => setIsCloseSessionModalOpen(false)}
        session={currentSession || null}
        onSessionClosed={() => fetchDashboard(false)}
      />

      {/* Credit / Exit Payment Confirmation Modal */}
      <Modal
        isOpen={!!gameToPayCredit}
        onClose={() => setGameToPayCredit(null)}
        title={gameToPayCredit?.payment_status === 'PAY_LATER' ? t('confirmExitPayment') : t('confirmCreditPaid')}
        subtitle={gameToPayCredit ? `${gameToPayCredit.game_id} • ${gameToPayCredit.table_id}` : undefined}
      >
        {gameToPayCredit && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border text-center ${
              gameToPayCredit.payment_status === 'PAY_LATER'
                ? 'bg-sky-950/40 border-sky-800/60'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                {t('customerName')}
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {gameToPayCredit.payer_name || gameToPayCredit.player_name}
              </div>
              <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
                {gameToPayCredit.final_price} <span className="text-sm font-bold">DH</span>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {gameToPayCredit.payment_status === 'PAY_LATER'
                  ? t('payLaterDesc')
                  : t('confirmCreditPaidDesc')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGameToPayCredit(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                id="confirm-pay-credit-btn"
                onClick={handleConfirmPayCredit}
                disabled={isPayingCredit}
                className={`py-2.5 px-4 active:scale-98 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                  gameToPayCredit.payment_status === 'PAY_LATER'
                    ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>
                  {isPayingCredit
                    ? '...'
                    : gameToPayCredit.payment_status === 'PAY_LATER'
                    ? t('collectExitPayment')
                    : t('markCreditPaid')}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
