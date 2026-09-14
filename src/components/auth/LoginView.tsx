/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Staff & Admin PIN Keypad Login View
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Delete,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext.tsx';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { LanguageSelector } from '../common/LanguageSelector.tsx';

export const LoginView: React.FC = () => {
  const { loginWithPin, error: authError } = useAuth();
  const { t } = useTranslation();

  // PIN Form State
  const [pin, setPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (!pinValue || pinValue.length < 4) {
        setLocalError(t('pinMinDigits'));
        return;
      }

      try {
        setIsSubmitting(true);
        setLocalError(null);
        await loginWithPin(pinValue);
      } catch (err: any) {
        setLocalError(err.message || t('invalidPin'));
        setPin('');
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginWithPin, t]
  );

  // PIN Keypad Handlers
  const handleDigit = useCallback(
    (digit: string) => {
      if (isSubmitting) return;
      if (pin.length < 6) {
        const nextPin = pin + digit;
        setPin(nextPin);
        setLocalError(null);

        // Auto-submit when maximum PIN length (6 digits) is reached
        if (nextPin.length === 6) {
          submitPin(nextPin);
        }
      }
    },
    [pin, isSubmitting, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (isSubmitting) return;
    setPin(prev => prev.slice(0, -1));
    setLocalError(null);
  }, [isSubmitting]);

  const handleClear = useCallback(() => {
    if (isSubmitting) return;
    setPin('');
    setLocalError(null);
  }, [isSubmitting]);

  // Physical keyboard listener for desktop and counter terminals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          submitPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, handleDigit, handleBackspace, handleClear, submitPin]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-indigo-500/20 selection:text-indigo-900">
      <div className="w-full max-w-md space-y-5">
        {/* Top Language Selector */}
        <div className="flex items-center justify-center">
          <LanguageSelector variant="inline-buttons" />
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-lg shadow-indigo-600/20">
            8
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-slate-900 uppercase">
            {t('appName')}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {t('tagline')}
          </p>
        </div>

        {/* Main Auth Card (Pure PIN Keypad) */}
        <div className="p-6 sm:p-7 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 mb-1">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              {t('staffAdminLogin')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('enterPinDesc')}
            </p>
          </div>

          {/* Error Display */}
          {(localError || authError) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span className="font-medium">{localError || authError}</span>
            </div>
          )}

          {/* PIN Indicators Display (Supports 4 to 6 digits) */}
          <div className="flex justify-center items-center gap-3 py-1">
            {[0, 1, 2, 3, 4, 5].map(i => {
              const isFilled = pin.length > i;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    isFilled
                      ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-xs shadow-indigo-500/30'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                />
              );
            })}
          </div>

          {/* Numeric Keypad for Tablet & Counter Touchscreens */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                id={`pin-btn-${num}`}
                disabled={isSubmitting}
                onClick={() => handleDigit(num)}
                className="h-13 sm:h-14 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 active:text-indigo-700 border border-slate-200 text-slate-800 font-mono font-bold text-2xl active:scale-95 transition-all shadow-2xs flex items-center justify-center disabled:opacity-50 select-none cursor-pointer"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              id="pin-btn-clear"
              disabled={isSubmitting || pin.length === 0}
              onClick={handleClear}
              className="h-13 sm:h-14 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              id="pin-btn-0"
              disabled={isSubmitting}
              onClick={() => handleDigit('0')}
              className="h-13 sm:h-14 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 active:text-indigo-700 border border-slate-200 text-slate-800 font-mono font-bold text-2xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 select-none cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              id="pin-btn-backspace"
              disabled={isSubmitting || pin.length === 0}
              onClick={handleBackspace}
              aria-label="Delete digit"
              className="h-13 sm:h-14 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            id="pin-submit-btn"
            disabled={isSubmitting || pin.length < 4}
            onClick={() => submitPin(pin)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>{t('loggingIn')}</span>
            ) : (
              <>
                <span>{t('signIn')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 font-mono">
          Casablanca Timezone (GMT+1) • EXTRABLACK
        </div>
      </div>
    </div>
  );
};

