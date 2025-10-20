"use client";

import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { ExternalLink, FileText } from "lucide-react";
import { useTranslation } from "~/lib/i18n/useTranslation";

interface FooterProps {
  onOpenReleaseNotes: () => void;
}

export function Footer({ onOpenReleaseNotes }: FooterProps) {
  const { data: versionData } = api.version.getCurrentVersion.useQuery();
  const { t } = useTranslation("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-muted/30 sticky bottom-0 mt-auto border-t py-3 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-2 text-sm sm:flex-row">
          <div className="flex items-center gap-2">
            <span>{t("copyright", { values: { year: currentYear } })}</span>
            {versionData?.success && versionData.version && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenReleaseNotes}
                className="hover:text-foreground h-auto p-1 text-xs"
              >
                v{versionData.version}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenReleaseNotes}
              className="hover:text-foreground h-auto p-2 text-xs"
            >
              <FileText className="mr-1 h-3 w-3" />
              {t("releaseNotes")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hover:text-foreground h-auto p-2 text-xs"
            >
              <a
                href="https://github.com/community-scripts/ProxmoxVE-Local"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {t("github")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
