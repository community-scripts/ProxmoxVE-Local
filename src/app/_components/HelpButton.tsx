"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import { Button } from "./ui/button";
import { HelpCircle } from "lucide-react";

interface HelpButtonProps {
  initialSection?: string;
}

export function HelpButton({ initialSection }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title="Help"
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <HelpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialSection={initialSection}
      />
    </>
  );
}
