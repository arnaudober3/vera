# Spec: Calendar sign-in popup blocked on the web app

**Status:** draft
**Linear:** VER-12
**Owner:** Arnaud
**Last updated:** 2026-07-07

## Context
On the web app, connecting Google Calendar fails: the OAuth consent window never
opens and the user sees "Your browser blocked the sign-in window." The root cause
is timing, not browser policy. `connectViaPopup()` computes a PKCE challenge with
`await crypto.subtle.digest(...)` **before** it calls `window.open(...)`
(`src/services/google-calendar.ts:79`–`94`). That `await` yields the event loop,
so by the time `window.open` runs it is no longer inside the click's user-
activation window. Popup blockers — strict by default on iOS Safari and in
installed/standalone PWAs — treat the call as programmatic and return `null`,
which the service reports as `popup_blocked`. See Linear VER-12.

The fix opens the popup synchronously in the same tick as the click, then points
it at the auth URL once the PKCE challenge resolves. This is the standard popup-
blocker-safe pattern and preserves the entire existing architecture (same
`/google/callback` postMessage handshake, same Cloudflare token exchange).

## Data contracts
No storage or network contract changes. The OAuth request parameters, the
`CallbackMessage` shape, and the `/api/google/token` request/response are all
unchanged.

New internal, pure helper extracted for testability:

- `buildAuthUrl(clientId: string, redirectUri: string, challenge: string, state: string): string`
  — returns the full `https://accounts.google.com/o/oauth2/v2/auth?...` URL with
  the existing params (`response_type=code`, `scope`, `access_type=offline`,
  `prompt=consent`, `include_granted_scopes=true`, `code_challenge_method=S256`,
  plus `client_id`, `redirect_uri`, `state`, `code_challenge`).

`GoogleCalendarErrorReason` union is unchanged (`popup_blocked` still fires only
when `window.open` genuinely returns `null`, i.e. popups are hard-disabled).

## User-visible behavior

### Connecting the calendar (happy path)
User taps **Connect calendar** (onboarding CalendarScreen or LevelUp card). The
Google consent window opens immediately in the same gesture. After they grant the
read-only calendar scope, the window closes, the button returns from its
"connecting…" state, and onboarding advances (`onConnected`). Today's pick reflects
calendar events. Behaviour on browsers that already allowed the popup is
unchanged.

### Popups hard-disabled
If the browser is configured to block all popups (so a synchronous `window.open`
still returns `null`), the user still sees the existing `popup_blocked` message
and can retry after allowing popups. No silent failure.

### Cancel / deny
Closing the window is a deliberate cancel: no error, the button re-enables for
retry. Denying the scope on the consent screen surfaces the generic connect error.
Both are unchanged.

## Failure modes
- **Popup opened but PKCE/digest throws:** the pre-opened popup is closed so no
  orphan window is left; the error propagates as before.
- **`window.open` returns null (hard-blocked):** throw `popup_blocked` — same as
  today.
- **User closes window mid-flow:** `awaitCode` polls `popup.closed` → `cancelled`,
  unchanged.
- **Token exchange fails server-side:** `exchange_failed`, surfaced as the generic
  error, unchanged.
- **State mismatch / denied:** `denied`, unchanged.

## Rollout
Plain code fix, no flag. Ships with the normal web deploy. Manual verification on
a real browser (ideally iOS Safari / installed PWA, where the bug reproduces) is
required because the fix is a user-gesture timing behavior that the Node test env
cannot exercise. Rollback is a straight revert; the change is confined to one
service file (+ its test).

## Out of scope
- A full redirect-based OAuth flow (`window.location.assign` → return route) as a
  fallback for browsers with popups hard-disabled. It would remove the popup
  dependency entirely but requires persisting in-memory onboarding state across a
  full-page navigation (onboarding `step` and captured images are `useState`, not
  persisted) — a materially larger change. Tracked as an open question below.
- Any change to token storage, refresh, or the calendar→occasion mapping.
- Native/Capacitor packaging.

## Open questions
- Do we also want the redirect fallback for browsers that hard-disable popups, or
  is the synchronous-open fix sufficient for launch? — owner: Arnaud, due:
  before merge. Default assumption: synchronous-open fix is sufficient; redirect
  fallback is a separate issue.
