"use client";

import { useState } from "react";
import { ContextualHelpIcon } from "./ContextualHelpIcon";

interface CategorySidebarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  categoryDevCounts?: Record<string, number>;
  totalScripts: number;
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  showDevScripts?: boolean;
}

// Icon mapping for categories
const categoryIconColorMap: Record<string, string> = {
  server: "text-blue-500",
  monitor: "text-sky-400",
  box: "text-orange-400",
  shield: "text-green-500",
  "shield-check": "text-green-500",
  key: "text-yellow-500",
  archive: "text-amber-400",
  database: "text-indigo-500",
  "chart-bar": "text-emerald-500",
  template: "text-violet-500",
  "folder-open": "text-cyan-500",
  "document-text": "text-slate-400",
  film: "text-rose-500",
  download: "text-cyan-500",
  "video-camera": "text-pink-500",
  home: "text-lime-500",
  wifi: "text-fuchsia-500",
  "chat-alt": "text-sky-500",
  clock: "text-orange-500",
  code: "text-green-400",
  "external-link": "text-blue-400",
  sparkles: "text-purple-500",
  "currency-dollar": "text-emerald-400",
  puzzle: "text-pink-400",
  office: "text-stone-500",
};

const iconPaths: Record<string, string> = {
  server:
    "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
  monitor:
    "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  shield:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "shield-check":
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  key: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1 0 21 9z",
  archive:
    "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  database:
    "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  "chart-bar":
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  template:
    "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  "folder-open":
    "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  "document-text":
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  film: "M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5V4m-3 0H9m3 0v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4m6 0h2a2 2 0 012 2v12a2 2 0 01-2 2h-2V4z",
  download:
    "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "video-camera":
    "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  wifi: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
  "chat-alt":
    "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  code: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  "external-link":
    "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  sparkles:
    "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  "currency-dollar":
    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
  puzzle:
    "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  office:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
};

const FALLBACK_PATH =
  "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z";

const CategoryIcon = ({
  iconName,
  className = "w-5 h-5",
}: {
  iconName: string;
  className?: string;
}) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={iconPaths[iconName] ?? FALLBACK_PATH}
      />
    </svg>
  );
};

export function CategorySidebar({
  categories,
  categoryCounts,
  categoryDevCounts,
  totalScripts,
  selectedCategory,
  onCategorySelect,
  showDevScripts = false,
}: CategorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Category to icon mapping (based on metadata.json)
  const categoryIconMapping: Record<string, string> = {
    "Proxmox & Virtualization": "server",
    "Operating Systems": "monitor",
    "Containers & Docker": "box",
    "Network & Firewall": "shield",
    "Adblock & DNS": "shield-check",
    "Authentication & Security": "key",
    "Backup & Recovery": "archive",
    Databases: "database",
    "Monitoring & Analytics": "chart-bar",
    "Dashboards & Frontends": "template",
    "Files & Downloads": "folder-open",
    "Documents & Notes": "document-text",
    "Media & Streaming": "film",
    "*Arr Suite": "download",
    "NVR & Cameras": "video-camera",
    "IoT & Smart Home": "home",
    "ZigBee, Z-Wave & Matter": "wifi",
    "MQTT & Messaging": "chat-alt",
    "Automation & Scheduling": "clock",
    "AI / Coding & Dev-Tools": "code",
    "Webservers & Proxies": "external-link",
    "Bots & ChatOps": "sparkles",
    "Finance & Budgeting": "currency-dollar",
    "Gaming & Leisure": "puzzle",
    "Business & ERP": "office",
    Miscellaneous: "box",
  };

  // Filter categories to only show those with scripts, then sort by count (descending) and alphabetically
  const sortedCategories = categories
    .map((category) => [category, categoryCounts[category] ?? 0] as const)
    .filter(([, count]) => count > 0) // Only show categories with at least one script
    .sort(([a, countA], [b, countB]) => {
      if (countB !== countA) return countB - countA;
      return a.localeCompare(b);
    });

  return (
    <div
      className={`bg-card border-border rounded-lg border shadow-md transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-full lg:w-80"
      }`}
    >
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b p-4">
        {!isCollapsed && (
          <div className="flex w-full items-center justify-between">
            <div>
              <h3 className="text-foreground text-lg font-semibold">
                Categories
              </h3>
              <p className="text-muted-foreground text-sm">
                {totalScripts} Total scripts
              </p>
            </div>
            <ContextualHelpIcon
              section="available-scripts"
              tooltip="Help with categories"
            />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:bg-muted rounded-lg p-2 transition-colors"
          title={isCollapsed ? "Expand categories" : "Collapse categories"}
        >
          <svg
            className={`text-muted-foreground h-5 w-5 transition-transform ${
              isCollapsed ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Expanded state - show full categories */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="space-y-2">
            {/* "All Categories" option */}
            <button
              onClick={() => onCategorySelect(null)}
              className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                selectedCategory === null
                  ? "bg-primary/10 text-primary border-primary/20 border"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <div className="flex items-center space-x-3">
                <CategoryIcon
                  iconName="template"
                  className={`h-5 w-5 ${selectedCategory === null ? "text-primary" : (categoryIconColorMap["template"] ?? "text-muted-foreground")}`}
                />
                <span className="font-medium">All Categories</span>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-sm ${
                  selectedCategory === null
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {totalScripts}
              </span>
            </button>

            {/* Individual Categories */}
            {sortedCategories.map(([category, count]) => {
              const isSelected = selectedCategory === category;

              return (
                <button
                  key={category}
                  onClick={() => onCategorySelect(category)}
                  className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CategoryIcon
                      iconName={categoryIconMapping[category] ?? "box"}
                      className={`h-5 w-5 ${isSelected ? "text-primary" : (categoryIconColorMap[categoryIconMapping[category] ?? "box"] ?? "text-muted-foreground")}`}
                    />
                    <span className="font-medium capitalize">
                      {category.replace(/[_-]/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {showDevScripts &&
                      (categoryDevCounts?.[category] ?? 0) > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500/10 px-1.5 text-[10px] leading-none font-semibold text-violet-600 dark:text-violet-400">
                          {categoryDevCounts?.[category]}{" "}
                          <span className="ml-0.5 text-[8px] font-normal opacity-70">
                            dev
                          </span>
                        </span>
                      )}
                    <span
                      className={`rounded-full px-2 py-1 text-sm ${
                        isSelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed state - show only icons with counters and tooltips */}
      {isCollapsed && (
        <div className="flex flex-row space-x-2 overflow-x-auto p-2 lg:flex-col lg:space-y-2 lg:space-x-0 lg:overflow-x-visible">
          {/* "All Categories" option */}
          <div className="group relative">
            <button
              onClick={() => onCategorySelect(null)}
              className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-lg transition-colors ${
                selectedCategory === null
                  ? "bg-primary/10 text-primary border-primary/20 border"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <CategoryIcon
                iconName="template"
                className={`h-5 w-5 ${selectedCategory === null ? "text-primary" : (categoryIconColorMap["template"] ?? "text-muted-foreground group-hover:text-foreground")}`}
              />
              <span
                className={`mt-1 rounded px-1 text-xs ${
                  selectedCategory === null
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {totalScripts}
              </span>
            </button>

            {/* Tooltip */}
            <div className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 transform rounded px-2 py-1 text-sm whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 lg:block">
              All Categories ({totalScripts})
            </div>
          </div>

          {/* Individual Categories */}
          {sortedCategories.map(([category, count]) => {
            const isSelected = selectedCategory === category;

            return (
              <div key={category} className="group relative">
                <button
                  onClick={() => onCategorySelect(category)}
                  className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <CategoryIcon
                    iconName={categoryIconMapping[category] ?? "box"}
                    className={`h-5 w-5 ${isSelected ? "text-primary" : (categoryIconColorMap[categoryIconMapping[category] ?? "box"] ?? "text-muted-foreground group-hover:text-foreground")}`}
                  />
                  <span
                    className={`mt-1 rounded px-1 text-xs ${
                      isSelected
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>

                {/* Tooltip */}
                <div className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 transform rounded px-2 py-1 text-sm whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                  {category} ({count})
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
