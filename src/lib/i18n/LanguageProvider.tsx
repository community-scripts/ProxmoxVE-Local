"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { defaultLocale, isLocale, locales, type Locale } from "./config";
import { createTranslator, type TranslateOptions } from "./translator";

export interface LanguageContextValue {
  locale: Locale;
  availableLocales: readonly Locale[];
  setLocale: (nextLocale: Locale) => void;
  t: (key: string, options?: TranslateOptions) => string;
}

const STORAGE_KEY = "pve-locale";
const COOKIE_KEY = "pve-locale";

export const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

interface LanguageProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

function getInitialLocale(initialLocale?: Locale): Locale {
  if (initialLocale && isLocale(initialLocale)) {
    return initialLocale;
  }

  if (typeof window === "undefined") {
    return defaultLocale;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) {
      return stored;
    }

    const browserLocale = window.navigator.language?.slice(0, 2).toLowerCase();
    if (isLocale(browserLocale)) {
      return browserLocale;
    }
  } catch (error) {
    console.error("Failed to resolve initial locale", error);
  }

  return defaultLocale;
}

export function LanguageProvider({
  children,
  initialLocale,
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    getInitialLocale(initialLocale),
  );
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.cookie = `${COOKIE_KEY}=${locale}; path=/; max-age=31536000`;
    } catch (error) {
      console.error("Failed to persist locale", error);
    }
  }, [locale]);

  useEffect(() => {
    if (hasHydrated.current) {
      return;
    }

    hasHydrated.current = true;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLocale(stored) && stored !== locale) {
        setLocaleState(stored);
        return;
      }

      const browserLocale = window.navigator.language
        ?.slice(0, 2)
        .toLowerCase();
      if (isLocale(browserLocale) && browserLocale !== locale) {
        setLocaleState(browserLocale);
      }
    } catch (error) {
      console.error("Failed to hydrate locale from client settings", error);
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!isLocale(nextLocale)) {
      return;
    }
    setLocaleState(nextLocale);
  }, []);

  const translator = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      availableLocales: locales,
      setLocale,
      t: (key: string, options?: TranslateOptions) => translator(key, options),
    }),
    [locale, setLocale, translator],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error(
      "useLanguageContext must be used within a LanguageProvider",
    );
  }
  return context;
}
