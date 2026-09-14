/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - PWA In-App Install Button & Guidance Modal
 */

import React, { useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../lib/usePWAInstall.ts';
import { useTranslation } from '../../lib/i18n/index.tsx';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'banner' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useTranslation();
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  // If already running in standalone mode on the phone
  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{t('appInstalled')}</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // General instructions modal if browser doesn't trigger prompt
      setShowIOSModal(true);
    }
  };

  if (variant === 'banner') {
    return (
      <>
        <div className={`p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white border border-indigo-700/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>{t('installAppPhone')}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono">
                  PWA
                </span>
              </div>
              <div className="text-xs text-indigo-200/90 mt-0.5">
                {t('installPwaDesc')}
              </div>
            </div>
          </div>

          <button
            type="button"
            id="pwa-install-banner-btn"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>{isInstalling ? t('loading') : t('installApp')}</span>
          </button>
        </div>

        {/* iOS / General Install Guidance Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-base text-slate-900">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <span>{t('installIosGuideTitle')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Share className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t('installIosStep1')}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <PlusSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t('installIosStep2')}</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Header / Pill style button
  return (
    <>
      <button
        type="button"
        id="pwa-install-header-btn"
        onClick={handleInstallClick}
        disabled={isInstalling}
        title={t('installAppPhone')}
        aria-label={t('installAppPhone')}
        className={`w-10 h-10 min-w-[40px] min-h-[40px] sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition shadow-2xs hover:shadow active:scale-95 ${className}`}
      >
        <Smartphone className="w-4 h-4 text-indigo-600 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden sm:inline">{t('installApp')}</span>
      </button>

      {/* iOS / General Install Guidance Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base text-slate-900">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <span>{t('installIosGuideTitle')}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('installIosStep1')}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <PlusSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('installIosStep2')}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
