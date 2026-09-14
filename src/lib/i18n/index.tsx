/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Internationalization Context & Auto-Detection
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language, TranslationKey } from './translations.ts';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
  availableLanguages: { code: Language; name: string; nativeName: string; flag: string }[];
}

const STORAGE_KEY = 'extrablack_language_preference';

/**
 * Detects the user's browser language automatically.
 * Defaults to Arabic ('ar') for Moroccan Snooker Lounge, while respecting saved user preference and browser language.
 */
export function detectBrowserLanguage(): Language {
  try {
    // 1. Check saved user preference first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'ar') {
      return saved;
    }

    // 2. Check browser navigator languages
    const browserLangs = navigator.languages || [navigator.language || ''];
    for (const l of browserLangs) {
      const lower = l.toLowerCase();
      if (lower.startsWith('ar')) {
        return 'ar';
      }
      if (lower.startsWith('fr')) {
        return 'fr';
      }
    }
  } catch {
    // Fallback if storage or navigator is unavailable
  }
  // Default to Arabic
  return 'ar';
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const AVAILABLE_LANGUAGES: {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇲🇦' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
];

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => detectBrowserLanguage());

  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  // Apply RTL and language attribute to HTML root whenever language changes
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;

    if (isRTL) {
      document.documentElement.classList.add('rtl-layout');
    } else {
      document.documentElement.classList.remove('rtl-layout');
    }
  }, [language, dir, isRTL]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const langDict = translations[language] || translations.en;
      let text: string = (langDict as any)[key] || (translations.en as any)[key] || key;

      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        });
      }

      return text;
    },
    [language]
  );

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isRTL,
        dir,
        availableLanguages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export function useLanguage() {
  return useTranslation();
}
