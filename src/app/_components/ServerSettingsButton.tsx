"use client";

import { useState } from "react";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/button";
import { Server } from "lucide-react";

export function ServerSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title="Manage PVE Servers"
        aria-label="Manage PVE Servers"
      >
        <Server className="h-4 w-4" />
      </Button>

      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
