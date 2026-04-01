"use client";

import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { ExternalLink, FileText, Heart } from "lucide-react";

interface FooterProps {
  onOpenReleaseNotes: () => void;
}

export function Footer({ onOpenReleaseNotes }: FooterProps) {
  const { data: versionData } = api.version.getCurrentVersion.useQuery();

  return (
    <footer className="border-border/60 bg-secondary/30 mt-auto border-t backdrop-blur-sm">
      <div className="mx-auto max-w-[var(--layout-max-w)] px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Left: Copyright + version */}
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              Built with <Heart className="text-primary h-3.5 w-3.5" /> by the
              Community
            </span>
            {versionData?.success && versionData.version && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenReleaseNotes}
                className="text-muted-foreground hover:text-foreground h-auto rounded-full px-2.5 py-1 text-xs font-semibold"
              >
                v{versionData.version}
              </Button>
            )}
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenReleaseNotes}
              className="text-muted-foreground hover:text-foreground h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Release Notes
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs"
            >
              <a
                href="https://github.com/community-scripts/ProxmoxVE-Local"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub (ProxmoxVE-Local)
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs"
            >
              <a
                href="https://github.com/community-scripts/ProxmoxVE"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub (ProxmoxVE)
              </a>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-foreground h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs"
            >
              <a
                href="https://community-scripts.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Main Site
              </a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
