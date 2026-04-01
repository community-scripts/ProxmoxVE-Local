"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import { useTheme } from "./ThemeProvider";
import {
  Sun,
  Moon,
  Type,
  Maximize2,
  Minimize2,
  X,
  Paintbrush,
} from "lucide-react";

type TextSize = "small" | "medium" | "large";
type LayoutWidth = "default" | "full";

function loadAppearance(): { textSize: TextSize; layoutWidth: LayoutWidth } {
  if (typeof window === "undefined")
    return { textSize: "medium", layoutWidth: "default" };
  try {
    const ts = localStorage.getItem("pve-text-size");
    const lw = localStorage.getItem("pve-layout-width");
    return {
      textSize:
        ts === "small" || ts === "medium" || ts === "large" ? ts : "medium",
      layoutWidth: lw === "full" ? "full" : "default",
    };
  } catch {
    return { textSize: "medium", layoutWidth: "default" };
  }
}

function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  root.classList.remove(
    "text-size-small",
    "text-size-medium",
    "text-size-large",
  );
  root.classList.add(`text-size-${size}`);
  localStorage.setItem("pve-text-size", size);
}

function applyLayoutWidth(width: LayoutWidth) {
  const root = document.documentElement;
  root.style.setProperty(
    "--layout-max-w",
    width === "full" ? "1800px" : "1440px",
  );
  localStorage.setItem("pve-layout-width", width);
}

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppearanceModal({ isOpen, onClose }: AppearanceModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "appearance-modal",
    allowEscape: true,
    onClose,
  });
  const { theme, setTheme } = useTheme();
  const [textSize, setTextSize] = useState<TextSize>("medium");
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidth>("default");

  useEffect(() => {
    if (isOpen) {
      const a = loadAppearance();
      setTextSize(a.textSize);
      setLayoutWidth(a.layoutWidth);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4"
        style={{ zIndex }}
        onClick={handleBackdropClick}
      >
        <div className="bg-card w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl">
          {/* Header */}
          <div className="border-border/60 flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                <Paintbrush className="text-primary h-4 w-4" />
              </div>
              <h2 className="text-foreground text-lg font-bold tracking-tight">
                Appearance
              </h2>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              aria-label="Close appearance settings"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-5 p-5">
            {/* Theme */}
            <div>
              <h3 className="text-foreground mb-2.5 text-sm font-semibold">
                Theme
              </h3>
              <div className="flex gap-2">
                {[
                  { value: "light" as const, label: "Light", Icon: Sun },
                  { value: "dark" as const, label: "Dark", Icon: Moon },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      theme === value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Size */}
            <div>
              <h3 className="text-foreground mb-2.5 flex items-center gap-2 text-sm font-semibold">
                <Type className="h-3.5 w-3.5" />
                Text Size
              </h3>
              <div className="flex gap-2">
                {[
                  { value: "small" as const, label: "Small" },
                  { value: "medium" as const, label: "Medium" },
                  { value: "large" as const, label: "Large" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTextSize(value);
                      applyTextSize(value);
                    }}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      textSize === value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Width */}
            <div>
              <h3 className="text-foreground mb-2.5 text-sm font-semibold">
                Layout Width
              </h3>
              <div className="flex gap-2">
                {[
                  {
                    value: "default" as const,
                    label: "Default",
                    sub: "1440px",
                    Icon: Minimize2,
                  },
                  {
                    value: "full" as const,
                    label: "Wide",
                    sub: "1800px",
                    Icon: Maximize2,
                  },
                ].map(({ value, label, sub, Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setLayoutWidth(value);
                      applyLayoutWidth(value);
                    }}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      layoutWidth === value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                    <span className="text-[0.625rem] opacity-60">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
