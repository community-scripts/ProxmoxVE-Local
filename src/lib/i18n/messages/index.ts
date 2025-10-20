import type { Locale } from '../config';
import type { NestedMessages } from './types';
import { enMessages } from './en';
import { deMessages } from './de';

export const messages: Record<Locale, NestedMessages> = {
  en: enMessages,
  de: deMessages,
};
