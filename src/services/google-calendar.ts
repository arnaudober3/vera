import type { RawCalendarEvent } from "../models/calendar.ts";

// Google Calendar OAuth client. The consent screen opens in a popup; the popup
// lands on /google/callback (same origin), which postMessages the auth code
// back here. The code is then exchanged for tokens by the Cloudflare Pages
// Function (/api/google/token) so the client secret never touches the browser.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const POPUP_MESSAGE_SOURCE = "vera-google-oauth";

export type GoogleCalendarErrorReason =
  | "not_configured"
  | "popup_blocked"
  | "cancelled"
  | "denied"
  | "exchange_failed";

export class GoogleCalendarError extends Error {
  reason: GoogleCalendarErrorReason;
  constructor(reason: GoogleCalendarErrorReason, message: string) {
    super(message);
    this.name = "GoogleCalendarError";
    this.reason = reason;
  }
}

// Message the callback page posts back to the opener.
type CallbackMessage = {
  source: typeof POPUP_MESSAGE_SOURCE;
  code?: string;
  state?: string;
  error?: string;
};

const base64url = (bytes: ArrayBuffer): string => {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const randomToken = (): string => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64url(arr.buffer);
};

const pkceChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(digest);
};

const redirectUri = (): string => `${window.location.origin}/google/callback`;

class GoogleCalendarService {
  private clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Run the full popup OAuth handshake and return the refresh token plus the
  // first window of events. Rejects with a GoogleCalendarError on every failure
  // path so the UI can react (cancelled vs. blocked vs. real error).
  async connectViaPopup(): Promise<{
    refreshToken: string;
    events: RawCalendarEvent[];
  }> {
    if (!this.clientId) {
      throw new GoogleCalendarError(
        "not_configured",
        "VITE_GOOGLE_CLIENT_ID is not configured.",
      );
    }

    const verifier = randomToken();
    const state = randomToken();
    const challenge = await pkceChallenge(verifier);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    const popup = window.open(
      `${AUTH_ENDPOINT}?${params.toString()}`,
      "vera-google-oauth",
      "width=500,height=650,menubar=no,toolbar=no",
    );
    if (!popup) {
      throw new GoogleCalendarError(
        "popup_blocked",
        "The sign-in popup was blocked.",
      );
    }

    const code = await this.awaitCode(popup, state);
    return this.exchange(code, verifier);
  }

  // Silent daily refresh: trade the stored refresh token for a fresh window.
  async refreshEvents(refreshToken: string): Promise<RawCalendarEvent[]> {
    const res = await fetch("/api/google/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      throw new GoogleCalendarError(
        "exchange_failed",
        `Calendar refresh failed (${res.status}).`,
      );
    }
    const data = (await res.json()) as { events: RawCalendarEvent[] };
    return data.events;
  }

  // Wait for the callback page to postMessage the auth code, validating origin
  // and the CSRF state. Rejects if the user closes the popup (cancel) or denies.
  private awaitCode(popup: Window, state: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        window.removeEventListener("message", onMessage);
        clearInterval(poll);
      };
      const finish = (fn: () => void): void => {
        settled = true;
        cleanup();
        if (!popup.closed) popup.close();
        fn();
      };

      const onMessage = (event: MessageEvent): void => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as CallbackMessage | null;
        if (!data || data.source !== POPUP_MESSAGE_SOURCE) return;
        if (data.error) {
          finish(() =>
            reject(
              new GoogleCalendarError("denied", `Access denied: ${data.error}`),
            ),
          );
          return;
        }
        if (data.state !== state) {
          finish(() =>
            reject(new GoogleCalendarError("denied", "State mismatch.")),
          );
          return;
        }
        if (!data.code) {
          finish(() =>
            reject(new GoogleCalendarError("denied", "No code returned.")),
          );
          return;
        }
        finish(() => resolve(data.code as string));
      };

      window.addEventListener("message", onMessage);
      const poll = setInterval(() => {
        if (popup.closed && !settled) {
          cleanup();
          reject(
            new GoogleCalendarError("cancelled", "Sign-in window was closed."),
          );
        }
      }, 500);
    });
  }

  private async exchange(
    code: string,
    codeVerifier: string,
  ): Promise<{ refreshToken: string; events: RawCalendarEvent[] }> {
    const res = await fetch("/api/google/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri: redirectUri() }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { error?: string };
      throw new GoogleCalendarError(
        "exchange_failed",
        detail.error ?? `Token exchange failed (${res.status}).`,
      );
    }
    const data = (await res.json()) as {
      refreshToken: string;
      events: RawCalendarEvent[];
    };
    return data;
  }
}

export const googleCalendar = new GoogleCalendarService();
