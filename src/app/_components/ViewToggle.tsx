"use client";

import React from "react";
import { Button } from "./ui/button";
import { Grid3X3, List } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ViewToggleProps {
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  const { t } = useTranslation("viewToggle");

  return (
    <div className="mb-6 flex justify-center">
      <div className="bg-muted flex items-center space-x-1 rounded-lg p-1">
        <Button
          onClick={() => onViewModeChange("card")}
          variant={viewMode === "card" ? "default" : "ghost"}
          size="sm"
          className={`flex items-center space-x-2 ${
            viewMode === "card"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Grid3X3 className="h-4 w-4" />
          <span className="text-sm">{t("cardView")}</span>
        </Button>
        <Button
          onClick={() => onViewModeChange("list")}
          variant={viewMode === "list" ? "default" : "ghost"}
          size="sm"
          className={`flex items-center space-x-2 ${
            viewMode === "list"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="h-4 w-4" />
          <span className="text-sm">{t("listView")}</span>
        </Button>
      </div>
    </div>
  );
}
