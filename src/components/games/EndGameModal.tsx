/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - End Game Modal
 * Multilingualized for Arabic, French, and English
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Trophy,
  Crown,
  Clock,
  Shield,
  Lock,
  Tag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { DeleteMistakeModal } from '../common/DeleteMistakeModal.tsx';
import { Game, SnookerTable } from '../../types.ts';
import { formatTime, formatDurationHuman } from '../../lib/dateUtils.ts';
import { calculateGamePricing, computeFinalDifferences } from '../../lib/pricing.ts';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { useAuth } from '../../lib/authContext.tsx';
import { api } from '../../lib/api.ts';

interface EndGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  table: SnookerTable | null;
  onGameEnded: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  isOpen,
  onClose,
  game,
  table,
  onGameEnded,
}) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const [endTimeIso, setEndTimeIso] = useState<string>('');
  const [pricingInfo, setPricingInfo] = useState<any>(null);
  const [finalPrice, setFinalPrice] = useState<number>((game?.games_count || 1) * 20);
  const [isFreeGame, setIsFreeGame] = useState<boolean>(false);
  const [priceReason, setPriceReason] = useState<string>('MANUAL CORRECTION');
  const [priceNote, setPriceNote] = useState<string>('');
  const [selectedOfferType, setSelectedOfferType] = useState<string>('NONE');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  // Match winner / loser tracking
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [gamesCount, setGamesCount] = useState<number>(game?.games_count || 1);

  // Admin manual discount (DH)
  const [adminDiscountDh, setAdminDiscountDh] = useState<number>(0);
  const [showAdminDiscountPanel, setShowAdminDiscountPanel] = useState<boolean>(false);

  // Parse 2 players if available
  const getPlayers = (): { p1: string; p2: string } | null => {
    if (!game) return null;
    if (game.player1_name && game.player2_name) {
      return { p1: game.player1_name, p2: game.player2_name };
    }
    if (game.player_name.includes(' vs ')) {
      const parts = game.player_name.split(' vs ');
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        return { p1: parts[0].trim(), p2: parts[1].trim() };
      }
    }
    if (game.player_name.includes(' VS ')) {
      const parts = game.player_name.split(' VS ');
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        return { p1: parts[0].trim(), p2: parts[1].trim() };
      }
    }
    return null;
  };

  const players = getPlayers();
  const wasOpenRef = React.useRef(false);

  // Initialize calculations & players when modal opens
  useEffect(() => {
    if (isOpen && game && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const now = new Date().toISOString();
      setEndTimeIso(now);
      setIsFreeGame(false);
      setPriceReason('MANUAL CORRECTION');
      setPriceNote('');
      setErrorMessage(null);
      setAdminDiscountDh(0);
      setShowAdminDiscountPanel(false);

      const initialCount = game.games_count || 1;
      setGamesCount(initialCount);

      // Default winner to null or previous winner
      if (game.winner_name) {
        setSelectedWinner(game.winner_name);
      } else {
        setSelectedWinner(null);
      }

      // Fetch server-side pricing preview for accuracy
      api.previewPricing({
        startTime: game.start_time,
        endTime: now,
        customerId: game.customer_id,
      })
        .then(info => {
          setPricingInfo(info);
          if (info.isEligibleFor5thGameFree) {
            setIsFreeGame(true);
            setFinalPrice(0);
            setSelectedOfferType('FIFTH_GAME_FREE');
          } else if (info.isEligibleFor3GameOffer || initialCount === 3) {
            setFinalPrice(40);
            setSelectedOfferType('THREE_GAME');
            setPriceReason('OFFRE 3 PARTIES = 40 DH');
          } else {
            // Standard rule: 20 DH per partie
            setFinalPrice(initialCount * 20);
            setSelectedOfferType('NONE');
          }
        })
        .catch(() => {
          // Fallback: 20 DH per partie
          const localPricing = calculateGamePricing(
            game.start_time,
            now,
            game.game_number_today ? game.game_number_today - 1 : 0
          );
          setPricingInfo(localPricing);
          setFinalPrice(initialCount * 20);
        });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, game]);

  if (!game) return null;

  // Extended quick prices up to 120 DH (each partie = 20 DH)
  const quickPrices = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const suggestedPrice = pricingInfo?.suggestedPrice || gamesCount * 20;
  const rawCalculatedPrice = pricingInfo?.rawCalculatedPrice || 0;
  const durationMinutes = pricingInfo?.durationMinutes || 0;

  const { isManual } = computeFinalDifferences(
    suggestedPrice,
    finalPrice,
    isFreeGame
  );

  // Helper when user selects gamesCount (1 to 9)
  const handleSelectGamesCount = (num: number) => {
    setGamesCount(num);
    if (selectedOfferType === 'THREE_GAME') {
      if (num === 3) {
        setFinalPrice(Math.max(0, 40 - adminDiscountDh));
        return;
      } else {
        setSelectedOfferType('NONE');
      }
    }
    if (!isFreeGame) {
      const base = num * 20;
      setFinalPrice(Math.max(0, base - adminDiscountDh));
    }
  };

  // Helper to toggle 3 games for 40 DH offer
  const handleToggle3GameOffer = () => {
    if (selectedOfferType === 'THREE_GAME' && finalPrice === Math.max(0, 40 - adminDiscountDh)) {
      // Toggle off
      setSelectedOfferType('NONE');
      const base = gamesCount * 20;
      setFinalPrice(Math.max(0, base - adminDiscountDh));
      setPriceReason('MANUAL CORRECTION');
    } else {
      // Apply offer: 3 games = 40 DH
      setSelectedOfferType('THREE_GAME');
      setGamesCount(prev => Math.max(3, prev));
      setFinalPrice(Math.max(0, 40 - adminDiscountDh));
      setIsFreeGame(false);
      setPriceReason('OFFRE 3 PARTIES = 40 DH');
    }
  };

  // Helper for admin to apply manual discount in DH
  const handleApplyAdminDiscount = (discountDh: number) => {
    const validDiscount = Math.max(0, discountDh);
    setAdminDiscountDh(validDiscount);
    const base = selectedOfferType === 'THREE_GAME' ? 40 : gamesCount * 20;
    const newPrice = Math.max(0, base - validDiscount);
    setFinalPrice(newPrice);
    if (validDiscount > 0) {
      setPriceReason(`REMISE ADMIN: -${validDiscount} DH`);
    } else if (selectedOfferType === 'THREE_GAME') {
      setPriceReason('OFFRE 3 PARTIES = 40 DH');
    } else {
      setPriceReason('MANUAL CORRECTION');
    }
  };

  // Derive winner and loser
  let winner = selectedWinner;
  let loser = '';
  if (players && winner) {
    loser = winner === players.p1 ? players.p2 : players.p1;
  }

  const handleEndGame = async (paymentType: 'PAID' | 'PAY_LATER' | 'LOAN') => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const effectivePayer = loser || (players && winner ? (winner === players.p1 ? players.p2 : players.p1) : game.player_name);

      await api.endGame({
        gameId: game.game_id,
        finalPrice: isFreeGame ? 0 : Number(finalPrice),
        paymentType,
        winnerName: winner || undefined,
        loserName: loser || undefined,
        payerName: effectivePayer,
        isFreeGame,
        priceReason: (isManual || adminDiscountDh > 0 || selectedOfferType !== 'NONE') ? priceReason : undefined,
        priceNote: priceNote.trim() || undefined,
        offerType: isFreeGame ? 'FIFTH_GAME_FREE' : selectedOfferType,
        offerSelectedPrice: (isManual || selectedOfferType !== 'NONE' || adminDiscountDh > 0) ? Number(finalPrice) : undefined,
        gamesCount,
      });

      onGameEnded();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to end game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tableName = table?.name || (game.table_id === 'MINI1' ? t('tableMini1') : game.table_id === 'MINI2' ? t('tableMini2') : game.table_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('endGameTitle', { table: tableName })}
      subtitle={t('endGameSubtitle', { name: game.player_name })}
      maxWidth="xl"
      resizable={true}
    >
      <div className="space-y-4 min-w-0">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Game Timing Summary Banner */}
        <div className="p-3.5 bg-neutral-950/70 rounded-xl border border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('matchPlayers')}</div>
            <div className="text-sm font-bold text-white truncate mt-0.5">{game.player_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('startedAt')}</div>
            <div className="text-sm font-mono font-semibold text-neutral-300 mt-0.5">
              {formatTime(game.start_time)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('duration')}</div>
            <div className="text-sm font-mono font-semibold text-neutral-300 mt-0.5">
              {formatTime(endTimeIso)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('duration')}</div>
            <div className="text-sm font-mono font-extrabold text-amber-400 mt-0.5">
              {formatDurationHuman(durationMinutes)}
            </div>
          </div>
        </div>

        {/* 2. NUMBER OF GAMES PLAYED (1 to 9) - 20 DH per partie */}
        <div
          id="end-modal-games-modifier"
          className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎱</span>
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-neutral-200">
                {t('gamesPlayedCount') || 'Parties jouées (1 à 9)'}
              </span>
              <span className="text-[10px] text-amber-400 font-semibold">
                (20 {t('dh')} / partie)
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
              {gamesCount} {gamesCount > 1 ? (t('gamesUnit') || 'parties') : (t('gameUnit') || 'partie')} = {gamesCount * 20} {t('dh')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="end-modal-minus-game"
              onClick={() => handleSelectGamesCount(Math.max(1, gamesCount - 1))}
              disabled={gamesCount <= 1}
              className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-white font-bold flex items-center justify-center border border-neutral-750 active:scale-95 transition-all text-sm cursor-pointer"
            >
              -
            </button>

            <div className="grid grid-cols-9 gap-1 flex-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  id={`end-modal-game-count-${num}`}
                  onClick={() => handleSelectGamesCount(num)}
                  className={`h-8 rounded-lg font-black text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    gamesCount === num
                      ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30 scale-105 ring-2 ring-amber-400'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white border border-neutral-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              id="end-modal-plus-game"
              onClick={() => handleSelectGamesCount(Math.min(9, gamesCount + 1))}
              disabled={gamesCount >= 9}
              className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-white font-bold flex items-center justify-center border border-neutral-750 active:scale-95 transition-all text-sm cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* 3. MATCH WINNER SELECTION ("The winner must not pay, the loser must pay") */}
        {players && (
          <div className="p-4 bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-2xl border-2 border-amber-500/30 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{t('whoWonMatch')}</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">
                {t('tapWinnerBelow')}
              </span>
            </div>

            {/* 2 Big Player Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Option: Player 1 */}
              <button
                type="button"
                id="select-winner-p1-btn"
                onClick={() => setSelectedWinner(players.p1)}
                className={`py-3.5 px-4 rounded-xl border text-center transition-all ${
                  selectedWinner === players.p1
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10 ring-2 ring-amber-400/30 scale-[1.02]'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-base font-extrabold">
                  <Crown className={`w-4 h-4 ${selectedWinner === players.p1 ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}`} />
                  <span>{players.p1}</span>
                </div>
                <div className={`text-[11px] font-bold mt-1 uppercase ${
                  selectedWinner === players.p1 ? 'text-emerald-400' : 'text-neutral-400'
                }`}>
                  {selectedWinner === players.p1 ? t('winnerPill') : t('tapIfWinner')}
                </div>
              </button>

              {/* Option: Player 2 */}
              <button
                type="button"
                id="select-winner-p2-btn"
                onClick={() => setSelectedWinner(players.p2)}
                className={`py-3.5 px-4 rounded-xl border text-center transition-all ${
                  selectedWinner === players.p2
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10 ring-2 ring-amber-400/30 scale-[1.02]'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-base font-extrabold">
                  <Crown className={`w-4 h-4 ${selectedWinner === players.p2 ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}`} />
                  <span>{players.p2}</span>
                </div>
                <div className={`text-[11px] font-bold mt-1 uppercase ${
                  selectedWinner === players.p2 ? 'text-emerald-400' : 'text-neutral-400'
                }`}>
                  {selectedWinner === players.p2 ? t('winnerPill') : t('tapIfWinner')}
                </div>
              </button>
            </div>

            {/* Dynamic Status Display */}
            {selectedWinner ? (
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-base">🏆</span>
                  <div>
                    <div className="font-bold text-emerald-400 uppercase text-[10px]">{t('winner')} (0 {t('dh')})</div>
                    <div className="text-white font-extrabold">{winner} — {t('winnerMustNotPay')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base">🎱</span>
                  <div>
                    <div className="font-bold text-amber-400 uppercase text-[10px]">{t('loser')}</div>
                    <div className="text-white font-extrabold">{loser} — {finalPrice} {t('dh')}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-neutral-950/60 rounded-xl text-center text-xs text-neutral-400">
                ⚠️ {t('tapWinnerBelow')} — {t('winnerMustNotPay')}, {t('loserMustPay')}.
              </div>
            )}
          </div>
        )}

        {/* 4. SPECIAL OFFER BUTTON: 3 GAMES FOR 40 DH (Save 20 DH) */}
        <div className="space-y-1.5">
          <button
            type="button"
            id="offer-3-games-40dh-btn"
            onClick={handleToggle3GameOffer}
            className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
              selectedOfferType === 'THREE_GAME'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/15 ring-2 ring-amber-400/40'
                : 'bg-neutral-950/90 border-amber-500/30 text-neutral-200 hover:bg-neutral-900 hover:border-amber-400/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 text-left">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 transition-colors ${
                selectedOfferType === 'THREE_GAME' ? 'bg-amber-500 text-neutral-950' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                🎱 3
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-white">
                    {t('offerThreeGames') || 'Offre Spéciale : 3 Parties = 40 DH'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    -20 DH
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Au lieu de 60 DH (3 × 20 DH) • Économisez 20 DH
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 pl-2">
              <span className={`text-sm sm:text-base font-black font-mono px-3 py-1.5 rounded-lg inline-block transition-colors ${
                selectedOfferType === 'THREE_GAME'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'bg-neutral-900 text-amber-400 border border-neutral-750'
              }`}>
                40 {t('dh')}
              </span>
            </div>
          </button>
        </div>

        {/* 5. ADMIN MANUAL DISCOUNT (DH) - STRICTLY FOR ADMIN ONLY */}
        {isAdmin ? (
          <div id="admin-discount-section" className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="btn-toggle-admin-discount"
                onClick={() => setShowAdminDiscountPanel(!showAdminDiscountPanel)}
                className="flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Remise en DH (Admin Config)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold uppercase">
                  Admin Only
                </span>
              </button>
              {adminDiscountDh > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  -{adminDiscountDh} {t('dh')} appliquée
                </span>
              )}
            </div>

            {showAdminDiscountPanel && (
              <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-neutral-400 font-medium">Remise rapide :</span>
                  {[5, 10, 15, 20, 30].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      id={`btn-discount-${amt}dh`}
                      onClick={() => handleApplyAdminDiscount(amt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        adminDiscountDh === amt
                          ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow-sm'
                          : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border-neutral-750'
                      }`}
                    >
                      -{amt} {t('dh')}
                    </button>
                  ))}
                  {adminDiscountDh > 0 && (
                    <button
                      type="button"
                      id="btn-clear-discount"
                      onClick={() => handleApplyAdminDiscount(0)}
                      className="px-2 py-1 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition-all cursor-pointer"
                    >
                      Annuler remise
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Montant personnalisé en DH :</span>
                  <div className="relative flex-1 max-w-[140px]">
                    <input
                      type="number"
                      id="input-custom-discount-dh"
                      min="0"
                      max="180"
                      value={adminDiscountDh || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        handleApplyAdminDiscount(val);
                      }}
                      placeholder="0"
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-neutral-900 border border-neutral-750 text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-neutral-500 font-bold">
                      {t('dh')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Locked indicator for Worker */
          <div id="worker-discount-locked-msg" className="p-2.5 bg-neutral-950/40 rounded-xl border border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[11px]">Remise manuelle (DH) : Réservé à l'administrateur</span>
            </div>
            <span className="text-[10px] text-neutral-500 uppercase font-semibold">Employé</span>
          </div>
        )}

        {/* 6. Quick Price Selection (Extended up to 120 DH) */}
        {!isFreeGame && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] uppercase font-bold text-neutral-400 tracking-wider">
                {t('quickPrice')} (20 {t('dh')} / partie • jusqu'à 120 {t('dh')})
              </label>
              <span className="text-[10px] text-neutral-500">
                Sélection rapide
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
              {quickPrices.map(price => {
                const isPartieMultiple = price % 20 === 0;
                const partieCount = Math.round(price / 20);
                return (
                  <button
                    key={price}
                    type="button"
                    id={`quick-price-${price}-btn`}
                    onClick={() => {
                      setFinalPrice(price);
                      setSelectedOfferType('NONE');
                      setAdminDiscountDh(0);
                      if (isPartieMultiple && partieCount >= 1 && partieCount <= 9) {
                        setGamesCount(partieCount);
                      }
                    }}
                    className={`py-2 px-1 rounded-xl font-mono font-bold text-xs sm:text-sm border transition-all text-center min-w-0 cursor-pointer ${
                      finalPrice === price && !isFreeGame
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm ring-1 ring-amber-400/40 scale-[1.02]'
                        : isPartieMultiple
                        ? 'bg-neutral-850 border-neutral-750 text-neutral-200 hover:border-amber-500/40 hover:text-white'
                        : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div>{price} <span className="text-[10px] text-neutral-400">{t('dh')}</span></div>
                    {isPartieMultiple && (
                      <div className="text-[9px] text-neutral-500 font-sans font-medium">
                        {partieCount} {partieCount > 1 ? 'parties' : 'partie'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Final Charge Summary Box */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between shadow-xl gap-2 min-w-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>{t('totalChargeForLoser')}</span>
              {selectedOfferType === 'THREE_GAME' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Offre 3 parties (40 DH)
                </span>
              )}
              {adminDiscountDh > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Remise -{adminDiscountDh} DH
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-300 mt-0.5 font-medium truncate">
              {loser ? t('billedTo', { name: loser }) : game.player_name} • {gamesCount} {gamesCount > 1 ? 'parties' : 'partie'} ({durationMinutes} {t('minutes')})
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white shrink-0">
            {finalPrice} <span className="text-base sm:text-lg font-bold text-amber-400">{t('dh')}</span>
          </div>
        </div>

        {/* 8. Payment Action Buttons: PAYÉ, PAY LATER, CRÉDIT */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>{t('settlementPayment')}</span>
            <span className="text-[10px] text-neutral-500 font-normal">3 options disponibles</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {/* 1. PAID Button (Payé Cash) */}
            <button
              type="button"
              id="end-game-paid-btn"
              disabled={isSubmitting}
              onClick={() => handleEndGame('PAID')}
              className="w-full min-w-0 p-2.5 sm:p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-950/40 flex flex-col items-center text-center justify-center gap-1 active:scale-[0.98] transition-all border border-emerald-400/30 group cursor-pointer"
            >
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm w-full">
                <CheckCircle className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform shrink-0" />
                <span className="break-words text-center leading-snug">
                  {isSubmitting
                    ? t('processing')
                    : loser
                    ? t('paidBy', { name: loser.toUpperCase() })
                    : t('paidCash')}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-emerald-100/85 font-normal leading-tight text-center">
                Espèces immédiat
              </span>
            </button>

            {/* 2. PAY LATER Button (En salle, paiera à la sortie) */}
            <button
              type="button"
              id="end-game-pay-later-btn"
              disabled={isSubmitting}
              onClick={() => handleEndGame('PAY_LATER')}
              className="w-full min-w-0 p-2.5 sm:p-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-sky-950/40 flex flex-col items-center text-center justify-center gap-1 active:scale-[0.98] transition-all border border-sky-400/30 group cursor-pointer"
            >
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm w-full">
                <Clock className="w-4 h-4 text-sky-100 group-hover:scale-110 transition-transform shrink-0" />
                <span className="break-words text-center leading-snug">
                  {isSubmitting
                    ? t('processing')
                    : loser
                    ? t('payLaterTo', { name: loser.toUpperCase() })
                    : t('payLater')}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-sky-100/85 font-normal leading-tight text-center">
                En salle • Sortie
              </span>
            </button>

            {/* 3. LOAN Button (Crédit / Salaf) */}
            <button
              type="button"
              id="end-game-loan-btn"
              disabled={isSubmitting || isFreeGame}
              onClick={() => handleEndGame('LOAN')}
              className="w-full min-w-0 p-2.5 sm:p-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-orange-950/40 flex flex-col items-center text-center justify-center gap-1 active:scale-[0.98] transition-all border border-orange-400/30 group cursor-pointer"
            >
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm w-full">
                <CreditCard className="w-4 h-4 text-orange-100 group-hover:scale-110 transition-transform shrink-0" />
                <span className="break-words text-center leading-snug">
                  {isSubmitting
                    ? t('processing')
                    : loser
                    ? t('loanTo', { name: loser.toUpperCase() })
                    : t('recordLoan')}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-orange-100/85 font-normal leading-tight text-center">
                Dette crédit (Salaf)
              </span>
            </button>
          </div>

          {/* Direct Cancel / Mistake Delete option */}
          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-center">
            <button
              type="button"
              id="end-game-mistake-cancel-btn"
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-xs text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('startedByMistake') || 'Partie lancée par erreur ? Supprimer sans facturer'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mistake Removal Modal */}
      {isDeleteModalOpen && game && (
        <DeleteMistakeModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          recordIdentifier={`${table?.name || 'Table'} — ${game.player_name}`}
          recordType="GAME"
          onConfirm={async (reason, password) => {
            await api.deleteGame(game.game_id, reason, password);
            setIsDeleteModalOpen(false);
            onClose();
            onGameEnded();
          }}
        />
      )}
    </Modal>
  );
};
