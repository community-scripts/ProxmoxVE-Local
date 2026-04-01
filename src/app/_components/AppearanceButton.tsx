"use client";

import { useState } from "react";
import { AppearanceModal } from "./AppearanceModal";
import { Button } from "./ui/button";
import { Paintbrush } from "lucide-react";

export function AppearanceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title="Appearance"
        aria-label="Appearance"
      >
        <Paintbrush className="h-4 w-4" />
      </Button>

      <AppearanceModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
