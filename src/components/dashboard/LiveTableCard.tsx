/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Live Table Card Component
 */

import React, { useEffect, useState } from 'react';
import { Play, CheckCircle2, Clock, User, Sparkles, ChevronRight, Trash2, ShieldAlert, Pencil, Check } from 'lucide-react';
import { Game, SnookerTable, WaitingEntry } from '../../types.ts';
import { formatTime, formatTimerSeconds } from '../../lib/dateUtils.ts';
import { calculateBasePrices } from '../../lib/pricing.ts';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { useAuth } from '../../lib/authContext.tsx';
import { DeleteMistakeModal } from '../common/DeleteMistakeModal.tsx';
import { api } from '../../lib/api.ts';

interface LiveTableCardProps {
  table: SnookerTable;
  activeGame?: Game;
  waitingQueue: WaitingEntry[];
  onStartGame: (table: SnookerTable, waitingCustomer?: WaitingEntry) => void;
  onEndGame: (game: Game, table: SnookerTable) => void;
  onGameCancelled?: () => void;
}

export const LiveTableCard: React.FC<LiveTableCardProps> = ({
  table,
  activeGame,
  waitingQueue,
  onStartGame,
  onEndGame,
  onGameCancelled,
}) => {
  const { t, isRTL } = useTranslation();
  const { isAdmin } = useAuth();
  const isPlaying = !!activeGame && activeGame.status === 'RUNNING';
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [currentGamesCount, setCurrentGamesCount] = useState<number>(activeGame?.games_count || 1);
  const [isUpdatingCount, setIsUpdatingCount] = useState<boolean>(false);

  // Edit player names states
  const [isEditingNames, setIsEditingNames] = useState<boolean>(false);
  const [editPlayer1, setEditPlayer1] = useState<string>('');
  const [editPlayer2, setEditPlayer2] = useState<string>('');
  const [editSinglePlayer, setEditSinglePlayer] = useState<string>('');
  const [isVsMode, setIsVsMode] = useState<boolean>(false);
  const [isSavingNames, setIsSavingNames] = useState<boolean>(false);
  const [editNamesError, setEditNamesError] = useState<string | null>(null);

  // Keep games count in sync with activeGame
  useEffect(() => {
    if (activeGame?.games_count) {
      setCurrentGamesCount(activeGame.games_count);
    }
  }, [activeGame?.games_count]);

  const handleOpenEditNames = () => {
    if (!activeGame) return;
    const isVs = activeGame.player_name.includes(' vs ');
    setIsVsMode(isVs);
    if (isVs) {
      const parts = activeGame.player_name.split(' vs ');
      setEditPlayer1(activeGame.player1_name || parts[0]?.trim() || '');
      setEditPlayer2(activeGame.player2_name || parts[1]?.trim() || '');
      setEditSinglePlayer('');
    } else {
      setEditSinglePlayer(activeGame.player_name || '');
      setEditPlayer1('');
      setEditPlayer2('');
    }
    setEditNamesError(null);
    setIsEditingNames(true);
  };

  const handleSaveEditNames = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeGame || isSavingNames) return;

    let payload: { playerName?: string; player1Name?: string; player2Name?: string };

    if (isVsMode) {
      const p1 = editPlayer1.trim();
      const p2 = editPlayer2.trim();
      if (!p1 || !p2) {
        setEditNamesError('Veuillez renseigner les deux joueurs (Joueur 1 et Joueur 2)');
        return;
      }
      payload = {
        playerName: `${p1} vs ${p2}`,
        player1Name: p1,
        player2Name: p2,
      };
    } else {
      const s = editSinglePlayer.trim();
      if (!s) {
        setEditNamesError('Veuillez renseigner le nom du joueur');
        return;
      }
      payload = {
        playerName: s,
        player1Name: undefined,
        player2Name: undefined,
      };
    }

    setIsSavingNames(true);
    setEditNamesError(null);
    try {
      await api.updateGamePlayers(activeGame.game_id, payload);
      activeGame.player_name = payload.playerName!;
      activeGame.player1_name = payload.player1Name;
      activeGame.player2_name = payload.player2Name;
      setIsEditingNames(false);
      onGameCancelled?.();
    } catch (err: any) {
      console.error('Failed to update game players:', err);
      setEditNamesError(err.message || 'Erreur lors de la mise à jour des noms');
    } finally {
      setIsSavingNames(false);
    }
  };

  const handleUpdateGamesCount = async (newCount: number) => {
    if (!activeGame || isUpdatingCount) return;
    const clamped = Math.max(1, Math.min(9, newCount));
    setCurrentGamesCount(clamped);
    setIsUpdatingCount(true);
    try {
      await api.updateGameGamesCount(activeGame.game_id, clamped);
      onGameCancelled?.();
    } catch (err) {
      console.error('Failed to update games count:', err);
    } finally {
      setIsUpdatingCount(false);
    }
  };

  // Live timer calculated strictly from server start_time
  useEffect(() => {
    if (!isPlaying || !activeGame?.start_time) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startMs = new Date(activeGame.start_time).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, activeGame?.start_time]);

  // Live estimated price calculation (1 DH/min, min 20 DH)
  const elapsedMinutes = elapsedSeconds > 0 ? Math.ceil(elapsedSeconds / 60) : 0;
  const { rawCalculated, suggested: estimatedPrice } = calculateBasePrices(elapsedMinutes, {
    hourly_rate: table.hourly_rate || 60,
    minimum_price: table.minimum_price || 20,
  });

  const nextWaiting = waitingQueue[0];

  return (
    <div
      id={`table-card-${table.table_id.toLowerCase()}`}
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
        isPlaying
          ? 'bg-gradient-to-b from-neutral-900 to-neutral-950 border-amber-500/40 shadow-xl shadow-amber-950/20'
          : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      {/* Top Banner & Status Indicator */}
      <div className="p-5 pb-4 border-b border-neutral-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                isPlaying ? 'bg-amber-400 animate-pulse shadow-xs shadow-amber-400' : 'bg-emerald-500'
              }`}
            />
            <h2 className="text-xl font-bold tracking-tight text-white uppercase">{table.name}</h2>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isPlaying ? t('occupied') : t('free')}
          </span>
        </div>

        {/* Rate info subtitle */}
        <div className="text-[11px] text-neutral-400 font-mono mt-1">
          {t('standardRate')}: {table.hourly_rate} {t('dh')}/hr • {t('minimumPrice')}: {table.minimum_price} {t('dh')}
        </div>
      </div>

      {/* Middle Content */}
      <div className="p-5 flex-1 flex flex-col justify-center">
        {isPlaying && activeGame ? (
          <div className="space-y-4">
            {/* Player Name */}
            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/60 transition-all">
              {isEditingNames ? (
                <form onSubmit={handleSaveEditNames} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Pencil className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('editPlayerNames') || 'Modifier les noms (erreur)'}</span>
                    </div>
                    {/* Mode Toggle: 2 Players (VS) or 1 Player */}
                    <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[10px]">
                      <button
                        type="button"
                        id={`btn-toggle-vs-${table.table_id.toLowerCase()}`}
                        onClick={() => setIsVsMode(true)}
                        className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                          isVsMode ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        2 Joueurs (VS)
                      </button>
                      <button
                        type="button"
                        id={`btn-toggle-single-${table.table_id.toLowerCase()}`}
                        onClick={() => setIsVsMode(false)}
                        className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                          !isVsMode ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        1 Joueur
                      </button>
                    </div>
                  </div>

                  {isVsMode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        id={`input-edit-player1-${table.table_id.toLowerCase()}`}
                        value={editPlayer1}
                        onChange={(e) => setEditPlayer1(e.target.value)}
                        placeholder="Joueur 1 (ex: Karim)"
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 border border-neutral-750 text-blue-200 placeholder-neutral-500 focus:outline-none focus:border-blue-400"
                      />
                      <span className="text-[10px] font-black px-1.5 py-0.5 text-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        VS
                      </span>
                      <input
                        type="text"
                        id={`input-edit-player2-${table.table_id.toLowerCase()}`}
                        value={editPlayer2}
                        onChange={(e) => setEditPlayer2(e.target.value)}
                        placeholder="Joueur 2 (ex: Mehdi)"
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 border border-neutral-750 text-emerald-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        autoFocus
                        id={`input-edit-single-${table.table_id.toLowerCase()}`}
                        value={editSinglePlayer}
                        onChange={(e) => setEditSinglePlayer(e.target.value)}
                        placeholder="Nom du joueur"
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 border border-neutral-750 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {editNamesError && (
                    <div className="text-[11px] text-rose-400 font-medium">
                      {editNamesError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      id={`btn-cancel-edit-names-${table.table_id.toLowerCase()}`}
                      onClick={() => setIsEditingNames(false)}
                      disabled={isSavingNames}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 cursor-pointer transition-colors"
                    >
                      {t('cancel') || 'Annuler'}
                    </button>
                    <button
                      type="submit"
                      id={`btn-save-edit-names-${table.table_id.toLowerCase()}`}
                      disabled={isSavingNames}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingNames ? (t('saving') || 'Enregistrement...') : (t('save') || 'Enregistrer')}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
                          {t('matchPlayers')}
                        </span>
                        <button
                          type="button"
                          id={`btn-edit-players-${table.table_id.toLowerCase()}`}
                          onClick={handleOpenEditNames}
                          title="Modifier les noms si saisis par erreur"
                          className="text-[10px] px-1.5 py-0.5 rounded text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>{t('edit') || 'Modifier'}</span>
                        </button>
                      </div>
                      <div className="text-base font-bold text-white flex items-center gap-1.5 flex-wrap mt-0.5">
                        {activeGame.player_name.includes(' vs ') ? (
                          <>
                            <span className="text-blue-300">{activeGame.player_name.split(' vs ')[0]}</span>
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">VS</span>
                            <span className="text-emerald-300">{activeGame.player_name.split(' vs ')[1]}</span>
                          </>
                        ) : (
                          activeGame.player_name
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right rtl:text-left shrink-0 pl-2">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">{t('startedAt')}</div>
                    <div className="text-sm font-mono font-semibold text-neutral-300">
                      {formatTime(activeGame.start_time)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Ticking Timer & Live Price */}
            <div className="grid grid-cols-2 gap-3">
              {/* Duration Box */}
              <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800 text-center">
                <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{t('duration')}</span>
                </div>
                <div className="text-2xl font-extrabold font-mono text-white mt-1 tracking-wider">
                  {formatTimerSeconds(elapsedSeconds)}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{elapsedMinutes} {t('minutes')}</div>
              </div>

              {/* Live Price Box */}
              <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-amber-500/30 text-center">
                <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                  {t('estimatedPrice')}
                </div>
                <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
                  {estimatedPrice} <span className="text-sm font-bold text-amber-300">{t('dh')}</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Raw: {rawCalculated} {t('dh')}
                </div>
              </div>
            </div>

            {/* 3. Dedicated Games / Frames Section (1 to 9) - Lite & Refined */}
            <div
              id={`table-games-modifier-${table.table_id.toLowerCase()}`}
              className="bg-neutral-900/40 hover:bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/80 space-y-2 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🎱</span>
                  <span className="text-[11px] font-medium text-neutral-300 uppercase tracking-wide">
                    {t('gamesPlayedCount') || 'Parties (1 à 9)'}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 font-semibold border border-amber-400/20">
                  {currentGamesCount} {currentGamesCount > 1 ? (t('gamesUnit') || 'parties') : (t('gameUnit') || 'partie')}
                </span>
              </div>

              {/* Lite Segmented Control + Steppers */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id={`btn-minus-game-${table.table_id.toLowerCase()}`}
                  onClick={() => handleUpdateGamesCount(currentGamesCount - 1)}
                  disabled={currentGamesCount <= 1 || isUpdatingCount}
                  className="w-7 h-7 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 disabled:opacity-20 text-neutral-300 hover:text-white font-bold flex items-center justify-center border border-neutral-750 active:scale-95 transition-all text-xs cursor-pointer"
                  title="Diminuer"
                >
                  -
                </button>

                <div className="flex items-center gap-0.5 bg-neutral-950/90 p-0.5 rounded-lg border border-neutral-800/90 flex-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      id={`btn-game-count-${table.table_id.toLowerCase()}-${num}`}
                      onClick={() => handleUpdateGamesCount(num)}
                      disabled={isUpdatingCount}
                      className={`flex-1 h-7 rounded font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer ${
                        currentGamesCount === num
                          ? 'bg-amber-500 text-neutral-950 font-extrabold shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850/60'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  id={`btn-plus-game-${table.table_id.toLowerCase()}`}
                  onClick={() => handleUpdateGamesCount(currentGamesCount + 1)}
                  disabled={currentGamesCount >= 9 || isUpdatingCount}
                  className="w-7 h-7 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 disabled:opacity-20 text-neutral-300 hover:text-white font-bold flex items-center justify-center border border-neutral-750 active:scale-95 transition-all text-xs cursor-pointer"
                  title="Augmenter"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Table is FREE */
          <div className="py-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-200">{t('tableReady')}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {waitingQueue.length > 0 ? (
                  <span className="text-amber-400 font-medium">
                    {waitingQueue.length} {t('inQueue')}
                  </span>
                ) : (
                  t('noActiveGame')
                )}
              </div>
            </div>

            {/* Next Customer Pill if someone is waiting */}
            {nextWaiting && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left rtl:text-right text-xs text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>
                  {t('nextInQueue')}: <strong>{nextWaiting.player_name}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button Footer */}
      <div className="p-5 pt-0">
        {isPlaying && activeGame ? (
          <div className="space-y-2">
            <button
              id={`end-game-btn-${table.table_id.toLowerCase()}`}
              onClick={() => onEndGame(activeGame, table)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-base shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{t('endGame')}</span>
              <ChevronRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>

            {/* Mistake cancellation (Accessible with Master PIN 753159 or Admin) */}
            <button
              type="button"
              id={`mistake-cancel-btn-${table.table_id.toLowerCase()}`}
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-transparent hover:border-rose-500/20"
              title={t('startedByMistake')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('startedByMistake')}</span>
            </button>
          </div>
        ) : (
          <button
            id={`start-game-btn-${table.table_id.toLowerCase()}`}
            onClick={() => onStartGame(table, nextWaiting)}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>
              {nextWaiting ? `${t('startGame')} (${nextWaiting.player_name})` : t('startGame')}
            </span>
          </button>
        )}
      </div>

      {/* Mistake Removal Modal */}
      {isPlaying && activeGame && (
        <DeleteMistakeModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          recordIdentifier={`${table.name} — ${activeGame.player_name}`}
          recordType="GAME"
          onConfirm={async (reason, password) => {
            await api.deleteGame(activeGame.game_id, reason, password);
            setIsDeleteModalOpen(false);
            onGameCancelled?.();
          }}
        />
      )}
    </div>
  );
};

