import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Landing page for the Google OAuth popup. It runs in the popup window, reads
// the auth code (or error) off the query string, postMessages it to the opener
// (same origin — see services/google-calendar.ts), then closes itself. If it was
// somehow opened in the same tab (no opener), it shows a close hint.
export const GoogleCallbackPage = (): React.JSX.Element => {
  const { t } = useTranslation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    window.opener?.postMessage(
      {
        source: "vera-google-oauth",
        code: params.get("code") ?? undefined,
        state: params.get("state") ?? undefined,
        error: params.get("error") ?? undefined,
      },
      window.location.origin,
    );
    window.close();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 24,
        textAlign: "center",
        color: "var(--vera-fg-muted)",
        fontSize: 15,
      }}
    >
      {t("calendarCallback.close")}
    </div>
  );
};
