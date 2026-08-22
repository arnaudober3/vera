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

type MessageEvent = {
  data?: { type?: string };
  waitUntil?: (promise: Promise<unknown>) => void;
};
type Listener = (event: MessageEvent) => void;

// The real message event exposes waitUntil (from ExtendableEvent); provide a
// no-op stub on dispatched events so listeners can call it freely.
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
    listeners.message(message({ type: "SOMETHING_ELSE" }));
    listeners.message(message());
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  // Guards the notification removal: the SW must not re-acquire a reminder
  // surface (a notification click target, or work scheduled on activation).
  it("registers no listener beyond the message contract", () => {
    expect(Object.keys(listeners)).toEqual(["message"]);
  });
});
