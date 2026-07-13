# Spec: Update-available reload prompt

**Status:** draft
**Linear:** DEV-7 (subtask 01)
**Owner:** Arnaud
**Last updated:** 2026-07-13

## Context
Vera is an installed PWA. Today the service worker uses `registerType: 'autoUpdate'`
with `skipWaiting()` + `clientsClaim()`, so a new Cloudflare deploy activates
silently and the user only sees it on some later reload, with no signal that an
update happened. The ticket (DEV-7) frames a fear that updating requires
uninstall/reinstall and loses data — it does not: localStorage + IndexedDB
survive in-place SW updates. This subtask makes the in-place update **visible and
user-controlled**: when a new version is waiting, show a prompt and reload on the
user's click. Local data is never touched.

## Data contracts
No persisted data. Only in-memory SW registration state, surfaced by
`useRegisterSW()` from `virtual:pwa-register/react`:
- `needRefresh: [boolean, setter]` — true when a new SW is installed and waiting.
- `updateServiceWorker(reloadPage?: boolean): Promise<void>` — posts `SKIP_WAITING`
  to the waiting SW and (with `true`) reloads the page once it takes control.

Service-worker message contract (app → SW): `{ type: 'SKIP_WAITING' }` triggers
`self.skipWaiting()` in `src/sw.ts`. This coexists with the existing
`{ type: 'CHECK_REMINDERS' }` branch.

## User-visible behavior

### New version available
When a newer deploy has been fetched and its SW is waiting, a non-blocking toast
appears above the dock: text `t('update.title')` with a `t('update.reload')`
action button. Strings live in `src/i18n/locales/{en,fr}.json` under a new
`update` section and are read via `useTranslation`. It does not auto-dismiss
(unlike the error toast).

### Applying the update
Tapping "Recharger" calls `updateServiceWorker(true)`: the waiting SW activates
and the page reloads into the new version. All closet/outfit/image data persists.

### No update
When no update is waiting, nothing renders. Normal app use is unaffected.

## Failure modes
- **No `serviceWorker` support / SW registration fails:** `needRefresh` stays
  false, nothing renders, app works normally.
- **User ignores the prompt:** it stays until reload; the old version keeps
  running (data intact). The update applies whenever they choose, or on next
  full relaunch.
- **Double registration risk:** switching to the virtual register must not
  register the SW twice; the notification service (which awaits
  `navigator.serviceWorker.ready`) must still resolve. Verified by the app
  registering exactly one SW.

## Rollout
Big bang with the next Cloudflare deploy. Note: because the *current* installed
SW still has `skipWaiting()`, the very first deploy carrying this change activates
silently (old SW's behavior); the prompt flow governs every deploy after that.
Rollback = revert the commit and redeploy. Nothing to monitor server-side.

## Out of scope
- Data export / import backup (separate DEV-7 follow-up).
- Local-store schema versioning / migration (separate DEV-7 follow-up).
- Periodic background update polling / "check for updates" button.
- Localization beyond the app's existing i18n conventions for these two strings.

## Open questions
None.
