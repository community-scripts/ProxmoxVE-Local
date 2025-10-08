'use client';

import { useState } from 'react';
import { GeneralSettingsModal } from './GeneralSettingsModal';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="text-sm text-muted-foreground font-medium">
          Application Settings: 
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="default"
          className="inline-flex items-center"
          title="Open Settings"
        >
          <Settings className="w-5 h-5 mr-2" />
          Settings
        </Button>
      </div>

      <GeneralSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
