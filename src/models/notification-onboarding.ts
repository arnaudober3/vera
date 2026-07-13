// Pure, dependency-free predicate for the onboarding "level up" hub, kept
// separate from onboarding.tsx so it can be unit-tested without rendering.

import type { NotificationPermissionStatus } from "../services/notifications.ts";

// Whether the notifications card on the level-up hub should show its "done"
// (Terminé) state. Only a granted permission counts as done: denying (or any
// other status) leaves the card actionable, so a user who dismissed the prompt
// is not told the step is complete.
export function isNotificationSectionDone(
  status: NotificationPermissionStatus,
): boolean {
  return status === "granted";
}

// What the notifications CTA should do given the current permission, decided
// before any request is made. Kept pure so it can be unit-tested without
// rendering the screen.
//
// The native permission prompt is a one-shot: once the user has denied it, the
// browser will not show it again — `Notification.requestPermission()` resolves
// immediately with "denied" without any UI. So re-tapping "enable" from the hub
// after a denial must NOT call the request (it would silently no-op and bounce
// straight back to the hub); it must instead tell the user to re-enable
// notifications in their browser settings.
export type NotificationCtaAction = "unsupported" | "blocked" | "request";

export function notificationCtaAction(
  status: NotificationPermissionStatus,
): NotificationCtaAction {
  if (status === "unsupported") return "unsupported";
  // "denied" can no longer be re-prompted; guide the user to browser settings.
  if (status === "denied") return "blocked";
  // "default" (never asked) and "granted" both go through the request path,
  // which prompts / re-confirms and then pings the worker.
  return "request";
}
