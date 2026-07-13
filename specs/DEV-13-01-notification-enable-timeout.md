# Spec: Stop notification enable hanging on serviceWorker.ready

**Status:** draft
**Linear:** DEV-13
**Owner:** Arnaud
**Last updated:** 2026-07-13

## Context
Enabling daily-reminder notifications in onboarding can leave the "enable" button
stuck in its loading state forever, even after the browser permission prompt is
granted. The onboarding `NotificationScreen` sets `requesting = true`, awaits
`enableDailyReminder()`, and only clears the flag in a `finally`. Inside
`enableDailyReminder()` the service grants permission and then does
`await navigator.serviceWorker.ready`. `serviceWorker.ready` only resolves once a
service worker becomes **active** for the scope; if none ever activates (SW
registration failed, blocked, or not yet installed in that context) the promise
never settles, so `enableDailyReminder()` never returns, the `finally` never
runs, and the button stays in its loading state indefinitely — although the
permission itself succeeded. `bootstrap()` (run at app start) contains the same
unbounded await. See Linear DEV-13.

## Data contracts
No data shapes change. Signatures are preserved:
- `notificationService.enableDailyReminder(): Promise<void>` — still resolves
  `void`, still first calls `requestPermission()` and returns early when the
  result is not `"granted"`.
- `notificationService.bootstrap(): Promise<void>` — unchanged signature.
- `NotificationPermissionStatus` union — unchanged.
- Service-worker message contract — unchanged: when a worker is active, the
  service still posts `{ type: "CHECK_REMINDERS" }` to `registration.active`.

The only internal change is that the `navigator.serviceWorker.ready` step is made
non-blocking: the reminder ping is best-effort and must never gate the promise
returned to the UI. Concretely, the `serviceWorker.ready` wait is bounded by a
short timeout (a `Promise.race` against a timer, e.g. ~3s); on timeout the method
resolves without having pinged the worker rather than hanging.

## User-visible behavior

### Enabling notifications always resolves the button
When the user taps the enable CTA and grants permission, the button leaves its
`requesting` loading state promptly (either after the worker is pinged, or after
the bounded timeout elapses). It never stays stuck loading on a granted
permission.

### Best-effort reminder ping is unchanged when the worker is available
When a service worker is already active, enabling still posts `CHECK_REMINDERS`
to it exactly as before — the timeout only affects the case where readiness never
(or slowly) arrives.

### Denied / unsupported still short-circuit
When permission is not granted, or notifications are unsupported,
`enableDailyReminder()` returns early exactly as before — no timer, no worker
wait.

## Failure modes
- **Service worker never activates** (registration failed / blocked / not yet
  installed): the `serviceWorker.ready` wait times out; `enableDailyReminder()`
  resolves without pinging. UI unblocks. This is the bug being fixed.
- **`navigator.serviceWorker.ready` rejects**: treated the same as the timeout —
  swallowed so it can't reject the enable flow; method resolves.
- **Permission denied**: early return, unchanged.
- **`serviceWorker` not in navigator**: skip the wait entirely, unchanged.
- **`registration.active` null after ready**: no message posted, unchanged.

## Rollout
No flag. Ships with the branch. Manual verification in onboarding: grant
notification permission and confirm the button resolves. No monitoring change;
rollback is reverting the commit.

## Out of scope
- `NotificationScreen` UI / its `requesting`/`finally` logic (kept as-is).
- The permission-request path (`requestPermission`) itself.
- Reminder scheduling logic in `notification-logic.ts`.
- Service-worker registration configuration (vite-plugin-pwa).

## Open questions
None.
