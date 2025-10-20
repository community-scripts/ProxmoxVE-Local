'use client';

import { Loader2 } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface LoadingModalProps {
  isOpen: boolean;
  action: string;
}

export function LoadingModal({ isOpen, action }: LoadingModalProps) {
  const { t } = useTranslation('loadingModal');
  useRegisterModal(isOpen, { id: 'loading-modal', allowEscape: false, onClose: () => null });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse"></div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              {t('processing')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {action}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {t('pleaseWait')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

