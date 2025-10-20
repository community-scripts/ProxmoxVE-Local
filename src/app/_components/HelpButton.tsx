"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import { Button } from "./ui/button";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface HelpButtonProps {
  initialSection?: string;
}

export function HelpButton({ initialSection }: HelpButtonProps) {
  const { t } = useTranslation("helpButton");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-muted-foreground text-sm font-medium">
          {t("needHelp")}
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="default"
          className="inline-flex items-center"
          title={t("openHelp")}
        >
          <HelpCircle className="mr-2 h-5 w-5" />
          {t("help")}
        </Button>
      </div>

      <HelpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialSection={initialSection}
      />
    </>
  );
}
