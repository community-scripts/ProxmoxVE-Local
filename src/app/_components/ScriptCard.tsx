"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScriptCard } from "~/types/script";
import { TypeBadge, UpdateableBadge } from "./Badge";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ScriptCardProps {
  script: ScriptCard;
  onClick: (script: ScriptCard) => void;
  isSelected?: boolean;
  onToggleSelect?: (slug: string) => void;
}

export function ScriptCard({
  script,
  onClick,
  isSelected = false,
  onToggleSelect,
}: ScriptCardProps) {
  const { t } = useTranslation("scriptCard");
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect && script.slug) {
      onToggleSelect(script.slug);
    }
  };

  return (
    <div
      className="bg-card border-border hover:border-primary relative flex h-full cursor-pointer flex-col rounded-lg border shadow-md transition-shadow duration-200 hover:shadow-lg"
      onClick={() => onClick(script)}
    >
      {/* Checkbox in top-left corner */}
      {onToggleSelect && (
        <div className="absolute top-2 left-2 z-10">
          <div
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 transition-all duration-200 ${
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-card border-border hover:border-primary/60 hover:bg-accent"
            }`}
            onClick={handleCheckboxClick}
          >
            {isSelected && (
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        {/* Header with logo and name */}
        <div className="mb-4 flex items-start space-x-4">
          <div className="flex-shrink-0">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-lg font-semibold">
                  {script.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground truncate text-lg font-semibold">
              {script.name || t("unnamedScript")}
            </h3>
            <div className="mt-2 space-y-2">
              {/* Type and Updateable status on first row */}
              <div className="flex flex-wrap items-center gap-1 space-x-2">
                <TypeBadge type={script.type ?? "unknown"} />
                {script.updateable && <UpdateableBadge />}
              </div>

              {/* Download Status */}
              <div className="flex items-center space-x-1">
                <div
                  className={`h-2 w-2 rounded-full ${
                    script.isDownloaded ? "bg-success" : "bg-error"
                  }`}
                ></div>
                <span
                  className={`text-xs font-medium ${
                    script.isDownloaded ? "text-success" : "text-error"
                  }`}
                >
                  {script.isDownloaded ? t("downloaded") : t("notDownloaded")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-muted-foreground mb-4 line-clamp-3 flex-1 text-sm">
          {script.description || t("noDescription")}
        </p>

        {/* Footer with website link */}
        {script.website && (
          <div className="mt-auto">
            <a
              href={script.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:text-info/80 flex items-center space-x-1 text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{t("website")}</span>
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
