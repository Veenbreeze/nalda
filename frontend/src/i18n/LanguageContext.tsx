import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setFormatLanguage, titleCase } from '../lib/utils';
import { enumLabels } from './enumLabels';
import {
  LANGUAGE_STORAGE_KEY,
  translations,
  type Language,
  type TranslationKey,
} from './translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tr: (english: string, swahili: string) => string;
  enumLabel: (value?: string | null) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'sw' || stored === 'en' ? stored : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  setFormatLanguage(language);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);
  const toggleLanguage = useCallback(
    () => setLanguageState((prev) => (prev === 'en' ? 'sw' : 'en')),
    [],
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dictionary = translations[language] as Record<string, string>;
      const fallback = translations.en as Record<string, string>;
      let value = dictionary[key] ?? fallback[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(replacement));
        }
      }
      return value;
    },
    [language],
  );

  const tr = useCallback(
    (english: string, swahili: string) => (language === 'sw' ? swahili : english),
    [language],
  );

  const enumLabel = useCallback(
    (value?: string | null) => {
      if (!value) return '—';
      const key = value.toUpperCase();
      const entry = enumLabels[key];
      if (language === 'sw') return entry ? entry.sw : titleCase(value);
      return entry?.en ?? titleCase(value);
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t, tr, enumLabel }),
    [language, setLanguage, toggleLanguage, t, tr, enumLabel],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
