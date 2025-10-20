"use client";

import { useCallback } from "react";
import { Languages } from "lucide-react";

import { useTranslation } from "~/lib/i18n/useTranslation";
import { type Locale, locales } from "~/lib/i18n/config";
import { Button } from "./ui/button";

interface LanguageToggleProps {
  className?: string;
  showLabel?: boolean;
}

function getNextLocale(current: Locale): Locale {
  const orderedLocales = [...locales];
  const currentIndex = orderedLocales.indexOf(current);
  const nextIndex =
    currentIndex === -1 ? 0 : (currentIndex + 1) % orderedLocales.length;
  const fallback = orderedLocales[0] ?? current;
  return orderedLocales[nextIndex] ?? fallback;
}

export function LanguageToggle({
  className = "",
  showLabel = false,
}: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation("common.language");

  const nextLocale = getNextLocale(locale);

  const handleToggle = useCallback(() => {
    setLocale(nextLocale);
  }, [nextLocale, setLocale]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={`text-muted-foreground hover:text-foreground transition-colors ${className}`}
      aria-label={t("switch")}
    >
      <Languages className="h-4 w-4" />
      {showLabel && (
        <span className="ml-2 text-sm">{locale.toUpperCase()}</span>
      )}
    </Button>
  );
}
