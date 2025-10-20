import { defaultLocale, type Locale, isLocale } from './config';
import { messages } from './messages';
import type { NestedMessages } from './messages/types';

export type TranslateValues = Record<string, string | number>;

export interface TranslateOptions {
  fallback?: string;
  values?: TranslateValues;
}

function getNestedMessage(tree: NestedMessages | string | undefined, segments: string[]): string | undefined {
  if (segments.length === 0) {
    return typeof tree === 'string' ? tree : undefined;
  }

  if (!tree || typeof tree === 'string') {
    return undefined;
  }

  const [current, ...rest] = segments;
  if (!current) {
    return undefined;
  }

  const next: NestedMessages | string | undefined = tree[current];
  return getNestedMessage(next, rest);
}

function formatMessage(template: string, values?: TranslateValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(.*?)\}/g, (match, token: string) => {
    const value = values[token];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}

function resolveMessage(locale: Locale, key: string): string | undefined {
  const dictionary = messages[locale];
  if (!dictionary) {
    return undefined;
  }

  const segments = key.split('.').filter(Boolean);
  return getNestedMessage(dictionary, segments);
}

export function createTranslator(locale: Locale) {
  const normalizedLocale: Locale = isLocale(locale) ? locale : defaultLocale;

  return (key: string, options?: TranslateOptions): string => {
    const fallbackLocales: Locale[] = [normalizedLocale];
    if (normalizedLocale !== defaultLocale) {
      fallbackLocales.push(defaultLocale);
    }

    for (const currentLocale of fallbackLocales) {
      const message = resolveMessage(currentLocale, key);
      if (typeof message === 'string') {
        return formatMessage(message, options?.values);
      }
    }

    if (options?.fallback) {
      return formatMessage(options.fallback, options.values);
    }

    return key;
  };
}
