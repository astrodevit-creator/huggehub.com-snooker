/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Language Selector Switcher
 */

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { Language } from '../../lib/i18n/translations.ts';

interface LanguageSelectorProps {
  variant?: 'pill' | 'dropdown' | 'inline-buttons';
  className?: string;
  showLabel?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  className = '',
  showLabel = false,
}) => {
  const { language, setLanguage, availableLanguages, isRTL } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangObj = availableLanguages.find(l => l.code === language) || availableLanguages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'inline-buttons') {
    return (
      <div className={`flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 ${className}`}>
        {availableLanguages.map(item => {
          const isSelected = item.code === language;
          return (
            <button
              key={item.code}
              type="button"
              id={`lang-btn-${item.code}`}
              onClick={() => setLanguage(item.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="text-sm leading-none">{item.flag}</span>
              <span>{item.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="language-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-auto sm:h-auto p-0 sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors shadow-2xs active:scale-95"
        aria-label="Change language"
        title={`Language: ${currentLangObj.nativeName}`}
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4 text-indigo-600 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="text-sm leading-none shrink-0">{currentLangObj.flag}</span>
        <span className="hidden sm:inline font-bold">{currentLangObj.nativeName}</span>
        {showLabel && <span className="hidden md:inline text-slate-500 font-normal">({currentLangObj.code.toUpperCase()})</span>}
        <ChevronDown className={`hidden sm:inline w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 w-44 sm:w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100 end-0"
        >
          <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-600 border-b border-slate-100 text-start">
            Select Language / اختر اللغة
          </div>
          {availableLanguages.map(item => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                type="button"
                id={`lang-option-${item.code}`}
                onClick={() => {
                  setLanguage(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-indigo-50/80 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.flag}</span>
                  <div className="text-start">
                    <div className="font-semibold">{item.nativeName}</div>
                    <div className="text-[10px] text-slate-600">{item.name}</div>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
