import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ErrorToast } from "./error-toast.tsx";
import {
  ToastContext,
  type ShowToastOptions,
} from "./toast-context.ts";

type ToastState = {
  message: string;
  showIcon: boolean;
  durationMs: number;
  /** Incrémenté à chaque appel pour relancer l'animation/le timer. */
  playKey: number;
};

/**
 * Fournit le toast d'erreur réutilisable. Un seul toast à la fois : un nouvel
 * appel remplace le précédent et relance la temporisation (latest-wins, comme
 * dans le design). L'auto-fermeture est portée par la barre de progression.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, options?: ShowToastOptions) => {
      setToast((current) => ({
        message,
        showIcon: options?.showIcon ?? true,
        durationMs: options?.durationMs ?? 3000,
        playKey: (current?.playKey ?? 0) + 1,
      }));
    },
    [],
  );

  const dismiss = useCallback(() => setToast(null), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <ErrorToast
          message={toast.message}
          showIcon={toast.showIcon}
          durationMs={toast.durationMs}
          playKey={toast.playKey}
          onDismiss={dismiss}
        />
      )}
    </ToastContext.Provider>
  );
};
