"use client";

import { useState } from "react";
import { GeneralSettingsModal } from "./GeneralSettingsModal";
import { Button } from "./ui/button";
import { Settings } from "lucide-react";

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <GeneralSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
