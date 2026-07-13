import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The service worker imports workbox helpers and touches the ServiceWorker
// global at module top level, so we mock those out and provide a fake `self`
// that captures registered listeners. This lets us exercise the message
// contract (SKIP_WAITING → self.skipWaiting()) in a plain vitest environment.
vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
}));
vi.mock("workbox-core", () => ({
  clientsClaim: vi.fn(),
}));
vi.mock("./storage/sw-store", () => ({
  getDirtySinceDay: vi.fn().mockResolvedValue(null),
  getLastNotifiedDay: vi.fn().mockResolvedValue(null),
  setLastNotifiedDay: vi.fn().mockResolvedValue(undefined),
}));

type MessageEvent = {
  data?: { type?: string };
  waitUntil?: (promise: Promise<unknown>) => void;
};
type Listener = (event: MessageEvent) => void;

// The real message event exposes waitUntil (from ExtendableEvent); the
// CHECK_REMINDERS branch calls it, so provide a no-op stub on dispatched events.
const message = (data?: { type?: string }) => ({ data, waitUntil: vi.fn() });

describe("sw message handler", () => {
  const listeners: Record<string, Listener> = {};
  const skipWaiting = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    skipWaiting.mockClear();
    for (const key of Object.keys(listeners)) delete listeners[key];

    vi.stubGlobal("self", {
      __WB_MANIFEST: [],
      skipWaiting,
      registration: { showNotification: vi.fn() },
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      navigator: { language: "en" },
      addEventListener: (type: string, listener: Listener) => {
        listeners[type] = listener;
      },
    });

    await import("./sw.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls skipWaiting when it receives a SKIP_WAITING message", () => {
    listeners.message(message({ type: "SKIP_WAITING" }));
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("does not call skipWaiting for unrelated message types", () => {
    listeners.message(message({ type: "CHECK_REMINDERS" }));
    listeners.message(message({ type: "SOMETHING_ELSE" }));
    listeners.message(message());
    expect(skipWaiting).not.toHaveBeenCalled();
  });
});
