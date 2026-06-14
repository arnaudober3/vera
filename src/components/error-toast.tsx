import { FaInfoCircle } from "react-icons/fa";
import "./error-toast.css";

export type ErrorToastProps = {
  message: string;
  showIcon?: boolean;
  durationMs?: number;
  /** Change la clé du remount pour relancer la barre de progression. */
  playKey?: number;
  onDismiss: () => void;
};

/**
 * Toast d'erreur réutilisable (form retenue dans le handoff Claude Design).
 * Non bloquant : il monte au-dessus du dock, énonce son message, puis se
 * referme seul quand la barre teal a fini de se vider. Un tap le ferme aussi.
 */
export const ErrorToast = ({
  message,
  showIcon = true,
  durationMs = 3000,
  playKey = 0,
  onDismiss,
}: ErrorToastProps): React.JSX.Element => (
  <div
    className="vera-toast"
    role="status"
    aria-live="polite"
    onClick={onDismiss}
    style={{ ["--vera-toast-duration" as string]: `${durationMs}ms` }}
  >
    {showIcon && (
      <div className="vera-toast__icon">
        <FaInfoCircle size={15} />
      </div>
    )}
    <p className="vera-toast__message">{message}</p>
    <div
      key={playKey}
      className="vera-toast__bar"
      onAnimationEnd={onDismiss}
    />
  </div>
);
