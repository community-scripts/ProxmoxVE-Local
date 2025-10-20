'use client';

import { useCallback } from 'react';
import { type LanguageContextValue, useLanguageContext } from './LanguageProvider';
import type { TranslateOptions } from './translator';

export interface UseTranslationResult {
  locale: LanguageContextValue['locale'];
  availableLocales: LanguageContextValue['availableLocales'];
  setLocale: LanguageContextValue['setLocale'];
  t: (key: string, options?: TranslateOptions) => string;
}

export function useTranslation(namespace?: string): UseTranslationResult {
  const { t: translate, locale, setLocale, availableLocales } = useLanguageContext();

  const scopedTranslate = useCallback(
    (key: string, options?: TranslateOptions) => {
      const namespacedKey = namespace ? `${namespace}.${key}` : key;
      return translate(namespacedKey, options);
    },
    [namespace, translate],
  );

  return {
    locale,
    availableLocales,
    setLocale,
    t: scopedTranslate,
  };
}
