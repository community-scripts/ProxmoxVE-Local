'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

type RegisteredModal = { id: string; allowEscape: boolean; onClose: () => void };

interface ModalStackContextValue {
  register: (modal: RegisteredModal) => () => void;
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<RegisteredModal[]>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      for (let i = stackRef.current.length - 1; i >= 0; i -= 1) {
        const modal = stackRef.current[i];
        if (modal?.allowEscape) {
          modal.onClose();
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const register = useCallback((modal: RegisteredModal) => {
    stackRef.current.push(modal);
    return () => {
      stackRef.current = stackRef.current.filter((m) => m !== modal);
    };
  }, []);

  const value = useMemo(() => ({ register }), [register]);

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
}

export function useRegisterModal(enabled: boolean, modal: RegisteredModal) {
  const ctx = useContext(ModalStackContext);
  useEffect(() => {
    if (!ctx || !enabled) return;
    return ctx.register(modal);
  }, [ctx, enabled, modal]);
}


