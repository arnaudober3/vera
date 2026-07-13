import { describe, it, expect } from "vitest";
import {
  isNotificationSectionDone,
  notificationCtaAction,
} from "./notification-onboarding.ts";

describe("isNotificationSectionDone", () => {
  it("is done only when permission is granted", () => {
    expect(isNotificationSectionDone("granted")).toBe(true);
  });

  it("is not done when permission is denied", () => {
    // Denying the prompt returns the user to the hub, but the notifications
    // section must stay actionable and must not read "Terminé".
    expect(isNotificationSectionDone("denied")).toBe(false);
  });

  it("is not done when permission is still default", () => {
    expect(isNotificationSectionDone("default")).toBe(false);
  });

  it("is not done when notifications are unsupported", () => {
    expect(isNotificationSectionDone("unsupported")).toBe(false);
  });
});

describe("notificationCtaAction", () => {
  it("requests the prompt when permission has never been asked", () => {
    expect(notificationCtaAction("default")).toBe("request");
  });

  it("still goes through the request path when already granted", () => {
    // Granted re-runs the enable flow (pings the worker) — harmless.
    expect(notificationCtaAction("granted")).toBe("request");
  });

  it("shows blocked guidance instead of re-requesting once denied", () => {
    // Regression: after denying and returning to the hub, tapping enable again
    // used to call requestPermission — which the browser no-ops for a denied
    // permission — and immediately bounce back to the hub with no popup and no
    // explanation. It must now surface the "blocked" guidance instead.
    expect(notificationCtaAction("denied")).toBe("blocked");
  });

  it("reports unsupported when notifications aren't available", () => {
    expect(notificationCtaAction("unsupported")).toBe("unsupported");
  });
});
