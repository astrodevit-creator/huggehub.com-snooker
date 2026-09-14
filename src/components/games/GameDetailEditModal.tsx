/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Game Detail & Admin Edit Modal
 */

import React, { useState } from 'react';
import {
  Edit3,
  Trash2,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Layers,
  History,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { Game, PaymentStatus, SnookerTable } from '../../types.ts';
import { formatDateTime, formatDurationHuman } from '../../lib/dateUtils.ts';
import { useAuth } from '../../lib/authContext.tsx';
import { api } from '../../lib/api.ts';

interface GameDetailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  tables: SnookerTable[];
  onGameUpdated: () => void;
}

export const GameDetailEditModal: React.FC<GameDetailEditModalProps> = ({
  isOpen,
  onClose,
  game,
  tables,
  onGameUpdated,
}) => {
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Edit fields
  const [playerName, setPlayerName] = useState<string>('');
  const [tableId, setTableId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAID');
  const [notes, setNotes] = useState<string>('');
  const [reason, setReason] = useState<string>('Accidental entry / Started by mistake');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when opening
  React.useEffect(() => {
    if (game) {
      setPlayerName(game.player_name);
      setTableId(game.table_id);
      setStartTime(game.start_time ? game.start_time.slice(0, 16) : '');
      setEndTime(game.end_time ? game.end_time.slice(0, 16) : '');
      setFinalPrice(game.final_price);
      setPaymentStatus(game.payment_status);
      setNotes(game.notes || '');
      setReason('Accidental entry / Started by mistake');
      setPassword('');
      setIsEditing(false);
      setIsDeleting(false);
      setErrorMessage(null);
    }
  }, [game]);

  if (!game) return null;

  const handleSettleCredit = async () => {
    if (!game) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await api.payGameCredit(game.game_id);
      onGameUpdated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to settle credit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('A reason for this correction is required for audit logs.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await api.editGame(
        game.game_id,
        {
          player_name: playerName.trim(),
          table_id: tableId,
          start_time: startTime ? new Date(startTime).toISOString() : game.start_time,
          end_time: endTime ? new Date(endTime).toISOString() : game.end_time,
          final_price: Number(finalPrice),
          payment_status: paymentStatus,
          notes: notes.trim() || undefined,
        },
        reason.trim()
      );

      onGameUpdated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update game record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    const cleanPassword = password.trim();
    if (!isAdmin && cleanPassword !== '753159') {
      setErrorMessage('Incorrect password! Enter master password 753159 to remove this record.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Please provide a reason for cancelling this game record.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await api.deleteGame(game.game_id, reason.trim(), cleanPassword || '753159');

      onGameUpdated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel game record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickDeleteReasons = [
    'Accidental entry / Started by mistake',
    'Customer left / Cancelled',
    'Wrong table selected',
    'Incorrect duration / price entered',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Correct Game Record' : isDeleting ? 'Cancel Game Record' : 'Game Audit Details'}
      subtitle={game.game_id}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isDeleting ? (
          /* Soft Delete / Mistake Removal View */
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
              <div className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Cancel / Delete Game Record (Mistake)</span>
              </div>
              <p>
                If this game was recorded by mistake, enter the master password (<strong>753159</strong>) to cancel the record and automatically recalculate shift revenue and statistics.
              </p>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  Master Password <span className="text-rose-500">*</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPassword('753159')}
                  className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold underline cursor-pointer"
                >
                  Auto-fill (753159)
                </button>
              </label>
              <input
                type="password"
                id="delete-game-password-input"
                required
                placeholder="Enter 753159"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Quick Reason selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for cancellation <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {quickDeleteReasons.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`py-1.5 px-2 rounded-lg text-xs text-left transition-colors border ${
                      reason === r
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                id="delete-game-reason-input"
                required
                placeholder="Reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                id="confirm-delete-game-btn"
                disabled={isSubmitting || !reason.trim() || (!isAdmin && !password.trim())}
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Cancelling...' : 'Confirm Record Deletion'}</span>
              </button>
            </div>
          </div>
        ) : isEditing ? (
          /* Edit Form */
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Player Name</label>
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Table</label>
                <select
                  value={tableId}
                  onChange={e => setTableId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {tables.map(t => (
                    <option key={t.table_id} value={t.table_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Final Price (DH)</label>
                <input
                  type="number"
                  min="0"
                  value={finalPrice}
                  onChange={e => setFinalPrice(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="PAID">PAID (Payé)</option>
                  <option value="PAY_LATER">PAY_LATER (En salle • Paie à la sortie)</option>
                  <option value="LOAN">LOAN (Crédit / Salaf)</option>
                  <option value="LOAN_PAID">LOAN_PAID (Crédit Payé)</option>
                  <option value="FREE">FREE (Gratuit)</option>
                  <option value="PENDING">PENDING (En attente)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Correction <span className="text-indigo-600">*</span>
              </label>
              <input
                type="text"
                required
                id="edit-game-reason-input"
                placeholder="e.g. Worker mistakenly entered 30 min instead of 45 min"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-edit-game-btn"
                disabled={isSubmitting || !reason.trim()}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'Saving...' : 'Save Corrections'}
              </button>
            </div>
          </form>
        ) : (
          /* Read-Only Details View */
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Player:</span>{' '}
                  <span className="font-bold text-slate-900">{game.player_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Table:</span>{' '}
                  <span className="font-bold text-slate-900 uppercase">{game.table_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{' '}
                  <span className="font-bold text-indigo-600 font-mono">
                    {formatDurationHuman(game.duration_minutes)} ({game.duration_minutes} min)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="font-bold text-slate-800">{game.status}</span>
                </div>
                <div>
                  <span className="text-slate-500">Calculated:</span>{' '}
                  <span className="font-mono text-slate-700">{game.raw_calculated_price} DH</span>
                </div>
                <div>
                  <span className="text-slate-500">Suggested:</span>{' '}
                  <span className="font-mono text-indigo-600 font-bold">{game.suggested_price} DH</span>
                </div>
                <div>
                  <span className="text-slate-500">Final Charged:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{game.final_price} DH</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment:</span>{' '}
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md ${
                      game.payment_status === 'PAID' || game.payment_status === 'LOAN_PAID'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : game.payment_status === 'PAY_LATER'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : game.payment_status === 'LOAN'
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {game.payment_status === 'LOAN_PAID'
                      ? 'PAID (SETTLED LOAN)'
                      : game.payment_status === 'PAY_LATER'
                      ? 'PAY LATER (EN SALLE)'
                      : game.payment_status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Start Time:</span>{' '}
                  <span className="font-mono text-slate-700">{formatDateTime(game.start_time)}</span>
                </div>
                <div>
                  <span className="text-slate-500">End Time:</span>{' '}
                  <span className="font-mono text-slate-700">
                    {game.end_time ? formatDateTime(game.end_time) : '--'}
                  </span>
                </div>
              </div>

              {game.price_reason && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Manual Price Reason:</span>{' '}
                  <span className="text-indigo-700 font-medium">{game.price_reason}</span>
                  {game.price_note && <span className="text-slate-500 ml-1">({game.price_note})</span>}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!game.deleted && (
              <div className="space-y-2 pt-2">
                {game.payment_status === 'LOAN' && (
                  <button
                    type="button"
                    id="modal-settle-credit-btn"
                    onClick={handleSettleCredit}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{isSubmitting ? 'Settling Credit...' : `Mark Credit as Paid (${game.final_price} DH)`}</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {isAdmin ? (
                    <button
                      type="button"
                      id="open-edit-game-btn"
                      onClick={() => setIsEditing(true)}
                      className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Correct Record</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      id="open-delete-game-btn"
                      onClick={() => setIsDeleting(true)}
                      className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Remove mistake record"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Delete / Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
