'use client';

import { api } from '~/trpc/react';
import { Button } from './ui/button';
import { ExternalLink, FileText } from 'lucide-react';

interface FooterProps {
  onOpenReleaseNotes: () => void;
}

export function Footer({ onOpenReleaseNotes }: FooterProps) {
  const { data: versionData } = api.version.getCurrentVersion.useQuery();

  return (
    <footer className="sticky bottom-0 mt-auto border-t border-border bg-muted/30 py-3 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© 2024 PVE Scripts Local</span>
            {versionData?.success && versionData.version && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenReleaseNotes}
                className="h-auto p-1 text-xs hover:text-foreground"
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
              className="h-auto p-2 text-xs hover:text-foreground"
            >
              <FileText className="h-3 w-3 mr-1" />
              Release Notes
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-auto p-2 text-xs hover:text-foreground"
            >
              <a
                href="https://github.com/community-scripts/ProxmoxVE-Local"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
