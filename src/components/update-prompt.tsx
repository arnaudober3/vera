import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./update-prompt.css";

/**
 * Surfaces a new-version prompt when a fresh service worker is installed and
 * waiting. Non-blocking toast above the dock; unlike the error toast it does
 * not auto-dismiss — it stays until the user reloads or relaunches the app.
 * Tapping "reload" activates the waiting SW and reloads into the new version.
 * Local data (localStorage / IndexedDB) is untouched by the in-place update.
 */
export const UpdatePrompt = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="vera-update-toast" role="status" aria-live="polite">
      <p className="vera-update-toast__message">{t("update.title")}</p>
      <button
        type="button"
        className="vera-update-toast__action"
        onClick={() => updateServiceWorker(true)}
      >
        {t("update.reload")}
      </button>
    </div>
  );
};
