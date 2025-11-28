"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScriptCard } from "~/types/script";
import { TypeBadge, UpdateableBadge } from "./Badge";

interface ScriptCardListProps {
  script: ScriptCard;
  onClick: (script: ScriptCard) => void;
  isSelected?: boolean;
  onToggleSelect?: (slug: string) => void;
}

export function ScriptCardList({
  script,
  onClick,
  isSelected = false,
  onToggleSelect,
}: ScriptCardListProps) {
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  const getCategoryNames = () => {
    if (!script.categoryNames || script.categoryNames.length === 0)
      return "Uncategorized";
    return script.categoryNames.join(", ");
  };

  const getRepoName = (url?: string): string => {
    if (!url) return "";
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(url);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return url;
  };

  return (
    <div
      className="bg-card border-border hover:border-primary relative cursor-pointer rounded-lg border shadow-sm transition-shadow duration-200 hover:shadow-md"
      onClick={() => onClick(script)}
    >
      {/* Checkbox */}
      {onToggleSelect && (
        <div className="absolute top-4 left-4 z-10">
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

      <div className={`p-6 ${onToggleSelect ? "pl-12" : ""}`}>
        <div className="flex items-start space-x-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-lg font-semibold">
                  {script.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Header Row */}
            <div className="mb-3 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground mb-2 truncate text-xl font-semibold">
                  {script.name || "Unnamed Script"}
                </h3>
                <div className="flex flex-wrap items-center gap-2 space-x-3">
                  <TypeBadge type={script.type ?? "unknown"} />
                  {script.updateable && <UpdateableBadge />}
                  {script.repository_url && (
                    <span
                      className="bg-muted text-muted-foreground border-border rounded border px-2 py-0.5 text-xs"
                      title={script.repository_url}
                    >
                      {getRepoName(script.repository_url)}
                    </span>
                  )}
                  <div className="flex items-center space-x-1">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        script.isDownloaded ? "bg-success" : "bg-error"
                      }`}
                    ></div>
                    <span
                      className={`text-sm font-medium ${
                        script.isDownloaded ? "text-success" : "text-error"
                      }`}
                    >
                      {script.isDownloaded ? "Downloaded" : "Not Downloaded"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side - Website link */}
              {script.website && (
                <a
                  href={script.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:text-info/80 ml-4 flex items-center space-x-1 text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Website</span>
                  <svg
                    className="h-4 w-4"
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
              )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
              {script.description || "No description available"}
            </p>

            {/* Metadata Row */}
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
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
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <span>Categories: {getCategoryNames()}</span>
                </div>
                <div className="flex items-center space-x-1">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Created: {formatDate(script.date_created)}</span>
                </div>
                {(script.os ?? script.version) && (
                  <div className="flex items-center space-x-1">
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
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                    <span>
                      {script.os && script.version
                        ? `${script.os.charAt(0).toUpperCase() + script.os.slice(1)} ${script.version}`
                        : script.os
                          ? script.os.charAt(0).toUpperCase() +
                            script.os.slice(1)
                          : script.version
                            ? `Version ${script.version}`
                            : ""}
                    </span>
                  </div>
                )}
                {script.interface_port && (
                  <div className="flex items-center space-x-1">
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
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Port: {script.interface_port}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-1">
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>ID: {script.slug || "unknown"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
