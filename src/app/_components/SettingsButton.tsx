"use client";

import { useState } from "react";
import { GeneralSettingsModal } from "./GeneralSettingsModal";
import { Button } from "./ui/button";
import { Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function SettingsButton() {
  const { t } = useTranslation("settingsButton");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-muted-foreground text-sm font-medium">
          {t("description")}
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="default"
          className="inline-flex items-center"
          title={t("buttonTitle")}
        >
          <Settings className="mr-2 h-5 w-5" />
          {t("buttonLabel")}
        </Button>
      </div>

      <GeneralSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
