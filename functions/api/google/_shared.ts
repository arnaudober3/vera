// Shared helpers for the Google Calendar Pages Functions. These run on the
// Cloudflare Workers runtime (not in the browser), so the OAuth client secret
// never reaches the client. They are deliberately a thin proxy: no occasion
// logic lives here — the frontend maps event titles to occasions
// (see src/models/calendar.ts `eventToOccasion`).

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

// The minimal context a Pages Function handler needs. Typed locally so the
// backend stays dependency-free (no @cloudflare/workers-types required).
export interface RequestContext {
  request: Request;
  env: Env;
}

// The normalized event the frontend turns into a StoredCalendarEvent. `startIso`
// is either a date-time (timed event) or a YYYY-MM-DD date (all-day).
export interface RawEvent {
  title: string;
  startIso: string;
  allDay: boolean;
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// How far ahead to fetch so the frontend can derive "today's event" for several
// days without re-hitting Google on every app open.
const WINDOW_DAYS = 7;

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

// Exchange an authorization code (+ PKCE verifier) for tokens. With
// `access_type=offline` + `prompt=consent` on the auth request, Google returns a
// refresh token the client persists for silent daily refresh.
export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  env: Env;
}): Promise<{ access_token: string; refresh_token?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    code_verifier: opts.codeVerifier,
    redirect_uri: opts.redirectUri,
    client_id: opts.env.GOOGLE_CLIENT_ID,
    client_secret: opts.env.GOOGLE_CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Trade a stored refresh token for a fresh short-lived access token.
export async function refreshAccess(opts: {
  refreshToken: string;
  env: Env;
}): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.env.GOOGLE_CLIENT_ID,
    client_secret: opts.env.GOOGLE_CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Fetch a window of upcoming events (start of today → +WINDOW_DAYS) from the
// user's primary calendar, recurrences expanded, normalized to RawEvent[].
export async function fetchEvents(accessToken: string): Promise<RawEvent[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(`${CALENDAR_ENDPOINT}?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items?: {
      summary?: string;
      start?: { dateTime?: string; date?: string };
    }[];
  };
  return (data.items ?? [])
    .map((item) => {
      const startIso = item.start?.dateTime ?? item.start?.date ?? "";
      return {
        title: item.summary ?? "(no title)",
        startIso,
        allDay: !item.start?.dateTime,
      };
    })
    .filter((e) => e.startIso !== "");
}
