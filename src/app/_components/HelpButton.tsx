'use client';

import { useState } from 'react';
import { HelpModal } from './HelpModal';
import { Button } from './ui/button';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface HelpButtonProps {
  initialSection?: string;
}

export function HelpButton({ initialSection }: HelpButtonProps) {
  const { t } = useTranslation('helpButton');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="text-sm text-muted-foreground font-medium">
          {t('needHelp')}
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="default"
          className="inline-flex items-center"
          title={t('openHelp')}
        >
          <HelpCircle className="w-5 h-5 mr-2" />
          {t('help')}
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
