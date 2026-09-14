/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Master Password Record Removal Modal
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Lock,
  Trash2,
  KeyRound,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from './Modal.tsx';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { useAuth } from '../../lib/authContext.tsx';

interface DeleteMistakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  recordIdentifier: string; // e.g. "Table MINI 1 — Ahmed vs Yassine" or "GAME-XXXX"
  recordType?: 'GAME' | 'LOAN' | 'RECORD';
  onConfirm: (reason: string, password?: string) => Promise<void>;
}

export const DeleteMistakeModal: React.FC<DeleteMistakeModalProps> = ({
  isOpen,
  onClose,
  title,
  recordIdentifier,
  recordType = 'GAME',
  onConfirm,
}) => {
  const { t, isRTL } = useTranslation();
  const { isAdmin } = useAuth();
  const [password, setPassword] = useState<string>('');
  const [reason, setReason] = useState<string>(t('reasonMistakeClick'));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPassword('');
      setReason(t('reasonMistakeClick'));
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, t]);

  if (!isOpen) return null;

  const quickReasons = [
    t('reasonMistakeClick'),
    t('reasonCustomerLeft'),
    t('reasonWrongTable'),
    t('reasonWrongData'),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = password.trim();

    if (!isAdmin && !cleanPassword) {
      setErrorMessage(t('enterMistakePassword'));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirm(reason.trim() || t('reasonMistakeClick'), cleanPassword);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la suppression de la partie');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('cancelMistakeRecord')}
      subtitle={recordIdentifier}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning Banner */}
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-200">{t('cancelMistakeRecord')}</div>
            <p className="text-neutral-300 leading-relaxed">
              {t('removeRecordMistakeDesc')}
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Admin Session vs Worker PIN Input */}
        {isAdmin ? (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Session Administrateur active : suppression directe autorisée.</span>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                {t('enterMistakePassword')}
                <span className="text-rose-400">*</span>
              </span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                id="mistake-deletion-password-input"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Saisir le Code PIN Maître"
                autoFocus
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        )}

        {/* Reason Quick Selection */}
        <div>
          <label className="block text-xs font-bold text-neutral-300 mb-1.5">
            {t('reasonForCancellation')}
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {quickReasons.map((r, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReason(r)}
                className={`py-1.5 px-2.5 rounded-lg text-xs text-left rtl:text-right transition-colors border ${
                  reason === r
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            id="mistake-deletion-reason-custom"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('reasonForCancellation')}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
          >
            {t('closeModal')}
          </button>
          <button
            type="submit"
            id="confirm-mistake-deletion-btn"
            disabled={isSubmitting || (!isAdmin && !password.trim())}
            className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isSubmitting ? t('deletingRecord') : t('confirmDeleteRecord')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
