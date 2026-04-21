"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type RegisteredModal = {
  id: string;
  allowEscape: boolean;
  onClose: () => void;
};

interface ModalStackContextValue {
  register: (modal: RegisteredModal) => {
    unregister: () => void;
    zIndex: number;
  };
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

export function ModalStackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const stackRef = useRef<RegisteredModal[]>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      for (let i = stackRef.current.length - 1; i >= 0; i -= 1) {
        const modal = stackRef.current[i];
        if (modal?.allowEscape) {
          modal.onClose();
          break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const register = useCallback((modal: RegisteredModal) => {
    const zIndex = 50 + stackRef.current.length * 10;
    stackRef.current.push(modal);
    return {
      zIndex,
      unregister: () => {
        stackRef.current = stackRef.current.filter((m) => m !== modal);
      },
    };
  }, []);

  const value = useMemo(() => ({ register }), [register]);

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
}

export function useRegisterModal(
  enabled: boolean,
  modal: RegisteredModal,
): number {
  const ctx = useContext(ModalStackContext);
  const [zIndex, setZIndex] = useState(50);
  // Keep a mutable ref so the stack always has the latest callbacks
  // without triggering re-registration on every render.
  const modalRef = useRef<RegisteredModal>(modal);
  modalRef.current = modal;

  useEffect(() => {
    if (!ctx || !enabled) return;
    // Register a stable proxy that always delegates to the latest ref values.
    // This prevents z-index races caused by inline object literals re-triggering
    // registration on parent re-renders.
    const proxy: RegisteredModal = {
      get id() {
        return modalRef.current.id;
      },
      get allowEscape() {
        return modalRef.current.allowEscape;
      },
      get onClose() {
        return modalRef.current.onClose;
      },
    };
    const result = ctx.register(proxy);
    setZIndex(result.zIndex);
    return result.unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, enabled]);

  return zIndex;
}

/**
 * Portal wrapper – renders children into document.body so modals escape
 * any parent stacking-context created by backdrop-filter / transform / etc.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
