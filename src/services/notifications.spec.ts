import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { notificationService } from "./notifications.ts";

// The bounded wait uses this timeout internally (~3s). Tests advance fake
// timers past it to exercise the timeout branch without real waits.
const READY_TIMEOUT_MS = 3000;

describe("notificationService.enableDailyReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Notifications are supported (window + Notification present).
    vi.stubGlobal("window", { Notification: class {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stubNotification = (permission: string): void => {
    vi.stubGlobal("Notification", {
      permission,
      requestPermission: vi.fn().mockResolvedValue(permission),
    });
  };

  it("resolves within the timeout when serviceWorker.ready never resolves", async () => {
    stubNotification("granted");
    // A `ready` promise that never settles.
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: new Promise<never>(() => {}) },
    });

    let settled = false;
    const promise = notificationService.enableDailyReminder().then(() => {
      settled = true;
    });

    // Drain the requestPermission microtasks before the timer matters.
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    // Advance past the bounded timeout; the method must now resolve.
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS);
    await promise;
    expect(settled).toBe(true);
  });

  it("posts CHECK_REMINDERS to the active worker when ready resolves before the timeout", async () => {
    stubNotification("granted");
    const postMessage = vi.fn();
    const registration = { active: { postMessage } };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve(registration) },
    });

    await notificationService.enableDailyReminder();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: "CHECK_REMINDERS" });
  });

  it("returns early and does not touch serviceWorker when permission is not granted", async () => {
    stubNotification("denied");
    const readyGetter = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        get ready() {
          readyGetter();
          return Promise.resolve({ active: { postMessage: vi.fn() } });
        },
      },
    });

    await notificationService.enableDailyReminder();

    expect(readyGetter).not.toHaveBeenCalled();
  });

  it("resolves when serviceWorker.ready rejects", async () => {
    stubNotification("granted");
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.reject(new Error("no worker")) },
    });

    // Must not reject — the rejection is swallowed.
    await expect(notificationService.enableDailyReminder()).resolves.toBeUndefined();
  });
});

describe("notificationService.bootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { Notification: class {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves within the timeout when serviceWorker.ready never resolves for a granted permission", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: new Promise<never>(() => {}) },
    });

    let settled = false;
    const promise = notificationService.bootstrap().then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS);
    await promise;
    expect(settled).toBe(true);
  });
});
