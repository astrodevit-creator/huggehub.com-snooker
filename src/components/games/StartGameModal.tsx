/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Start Game Modal
 * Multilingualized for Arabic, French, and English
 */

import React, { useEffect, useState, useRef } from 'react';
import { Play, Swords, AlertCircle, Check } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { Customer, SnookerTable, WaitingEntry } from '../../types.ts';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { api } from '../../lib/api.ts';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: SnookerTable | null;
  tables: SnookerTable[];
  waitingCustomer?: WaitingEntry | null;
  onGameStarted: () => void;
}

export const StartGameModal: React.FC<StartGameModalProps> = ({
  isOpen,
  onClose,
  table,
  tables,
  waitingCustomer,
  onGameStarted,
}) => {
  const { t } = useTranslation();
  const [selectedTableId, setSelectedTableId] = useState<string>('MINI1');
  const [player1Name, setPlayer1Name] = useState<string>('');
  const [player2Name, setPlayer2Name] = useState<string>('');
  const [gamesCount, setGamesCount] = useState<number>(1);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const player1InputRef = useRef<HTMLInputElement>(null);
  const player2InputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Initialize ONCE when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedTableId(table?.table_id || tables[0]?.table_id || 'MINI1');
      setPlayer1Name(waitingCustomer?.player_name || '');
      setPlayer2Name('');
      setGamesCount(1);
      setErrorMessage(null);
      setIsSubmitting(false);

      // Smooth autofocus after modal mounts
      const timer = setTimeout(() => {
        if (waitingCustomer?.player_name) {
          player2InputRef.current?.focus();
        } else {
          player1InputRef.current?.focus();
        }
      }, 60);

      // Fetch customer quick list once
      api.getCustomers().then(list => {
        if (Array.isArray(list)) {
          setRecentCustomers(list.slice(0, 8));
        }
      }).catch(() => {});

      wasOpenRef.current = true;
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, table?.table_id, waitingCustomer?.player_name, tables]);

  const p1Trimmed = player1Name.trim();
  const p2Trimmed = player2Name.trim();

  // Smart resolution of player names
  const effectiveP1 = p1Trimmed || (p2Trimmed ? p2Trimmed : '');
  const effectiveP2 = p1Trimmed ? p2Trimmed : '';
  const isMatch = !!effectiveP1 && !!effectiveP2;
  const hasAtLeastOnePlayer = !!p1Trimmed || !!p2Trimmed;

  const handleStartGame = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!hasAtLeastOnePlayer) {
      setErrorMessage(t('pleaseEnterPlayerNames'));
      player1InputRef.current?.focus();
      return;
    }

    if (!selectedTableId) {
      setErrorMessage(t('pleaseSelectTable'));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isMatch) {
        // 2-player match: Winner plays free, loser pays
        await api.startGame({
          tableId: selectedTableId,
          player1Name: effectiveP1,
          player2Name: effectiveP2,
          playerName: `${effectiveP1} vs ${effectiveP2}`,
          waitingId: waitingCustomer?.waiting_id,
          gamesCount,
        });
      } else {
        // 1-player single session
        await api.startGame({
          tableId: selectedTableId,
          playerName: effectiveP1,
          waitingId: waitingCustomer?.waiting_id,
          gamesCount,
        });
      }

      onGameStarted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChipClick = (name: string) => {
    if (!player1Name.trim()) {
      setPlayer1Name(name);
      player2InputRef.current?.focus();
    } else if (!player2Name.trim() && player1Name.trim().toLowerCase() !== name.toLowerCase()) {
      setPlayer2Name(name);
    } else {
      setPlayer1Name(name);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('startSnookerGame')}
      subtitle={t('startGameSubtitle')}
      maxWidth="lg"
    >
      <form onSubmit={handleStartGame} className="space-y-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* 1. Table Selector */}
        <div>
          <label className="block text-[11px] uppercase font-bold text-neutral-400 tracking-wider mb-2">
            {t('selectStartTable')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {tables.map(tItem => {
              const isSelected = selectedTableId === tItem.table_id;
              return (
                <button
                  key={tItem.table_id}
                  type="button"
                  id={`start-select-table-${tItem.table_id.toLowerCase()}`}
                  onClick={() => setSelectedTableId(tItem.table_id)}
                  className={`py-3 px-4 rounded-xl border text-left rtl:text-right transition-all relative ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                      : 'bg-neutral-800/80 border-neutral-700/80 text-neutral-300 hover:border-neutral-600 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wide">{tItem.name}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    {tItem.hourly_rate} {t('dh')}/{t('hours')} • {t('minPrice')} {tItem.minimum_price} {t('dh')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Easy Two Players Input Fields */}
        <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              <span>{t('playersSetup')}</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">
              {isMatch ? t('matchTwoPlayers') : hasAtLeastOnePlayer ? t('singlePlayer') : t('enterOneOrTwo')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            {/* Player 1 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-extrabold flex items-center justify-center">
                  1
                </span>
                <span>{t('player1Name')}</span>
              </label>
              <input
                ref={player1InputRef}
                type="text"
                id="player1-name-input"
                autoComplete="off"
                placeholder={t('player1Placeholder')}
                value={player1Name}
                onChange={e => {
                  setPlayer1Name(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (player2InputRef.current) {
                      player2InputRef.current.focus();
                    } else {
                      handleStartGame();
                    }
                  }
                }}
                className={`w-full bg-neutral-900 border rounded-xl px-3.5 py-2.5 text-white font-semibold text-sm placeholder-neutral-500 transition-all outline-none ${
                  !player1Name.trim() && player2Name.trim()
                    ? 'border-amber-500/50 focus:border-amber-400'
                    : 'border-neutral-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                }`}
              />
            </div>

            {/* Player 2 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-extrabold flex items-center justify-center">
                  2
                </span>
                <span>{t('soloOptional')}</span>
              </label>
              <input
                ref={player2InputRef}
                type="text"
                id="player2-name-input"
                autoComplete="off"
                placeholder={t('player2Placeholder')}
                value={player2Name}
                onChange={e => {
                  setPlayer2Name(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleStartGame();
                  }
                }}
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-white font-semibold text-sm placeholder-neutral-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Quick Click Suggestions from Recent Customers */}
          {recentCustomers.length > 0 && (
            <div className="pt-2 border-t border-neutral-800/80">
              <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1.5 flex items-center justify-between">
                <span>{t('quickTapFill')}</span>
                <span className="text-[10px] font-normal text-neutral-500">{t('clickToFill')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentCustomers.map(c => (
                  <button
                    key={c.customer_id}
                    type="button"
                    onClick={() => handleChipClick(c.name)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-200 hover:text-white transition-colors active:scale-95"
                  >
                    + {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Number of Games to Play (1 to 9) */}
        <div
          id="start-modal-games-section"
          className="p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                🎱
              </span>
              <span className="text-xs uppercase font-extrabold text-neutral-200 tracking-wider">
                {t('gamesPlayedCount') || 'Nombre de parties (1 à 9)'}
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold">
              {gamesCount} {gamesCount > 1 ? (t('gamesUnit') || 'parties') : (t('gameUnit') || 'partie')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="start-modal-games-minus"
              onClick={() => setGamesCount(prev => Math.max(1, prev - 1))}
              disabled={gamesCount <= 1}
              className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-white font-bold flex items-center justify-center border border-neutral-700 active:scale-95 transition-all text-sm cursor-pointer"
            >
              -
            </button>

            <div className="grid grid-cols-9 gap-1 flex-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  id={`start-modal-game-count-${num}`}
                  onClick={() => setGamesCount(num)}
                  className={`h-8 rounded-lg font-black text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    gamesCount === num
                      ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30 scale-105 ring-2 ring-amber-400'
                      : 'bg-neutral-950 text-neutral-300 hover:bg-neutral-800 hover:text-white border border-neutral-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              id="start-modal-games-plus"
              onClick={() => setGamesCount(prev => Math.min(9, prev + 1))}
              disabled={gamesCount >= 9}
              className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-white font-bold flex items-center justify-center border border-neutral-700 active:scale-95 transition-all text-sm cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* 4. Match Rule Banner */}
        <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold text-base">
            🏆
          </div>
          <div className="text-xs">
            <span className="font-bold text-amber-300">{t('matchRuleTitle')}</span>{' '}
            <span className="text-neutral-300">
              {t('matchRuleDesc')}
            </span>
          </div>
        </div>

        {/* 4. Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="start-game-confirm-btn"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
              hasAtLeastOnePlayer
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700'
            }`}
          >
            <Play className={`w-4 h-4 ${hasAtLeastOnePlayer ? 'fill-white text-white' : 'text-neutral-400'}`} />
            <span>
              {isSubmitting
                ? t('startingGame')
                : isMatch
                ? t('startMatchBtn', { p1: effectiveP1.toUpperCase(), p2: effectiveP2.toUpperCase() })
                : hasAtLeastOnePlayer
                ? t('startSingleBtn', { p1: effectiveP1.toUpperCase() })
                : t('startTypeNames')}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
