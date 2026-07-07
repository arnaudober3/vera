import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAuthUrl,
  googleCalendar,
  GoogleCalendarError,
} from "./google-calendar.ts";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

describe("buildAuthUrl", () => {
  it("builds the consent URL with the correct endpoint and all expected params", () => {
    const url = buildAuthUrl(
      "client-123",
      "https://vera.app/google/callback",
      "the-challenge",
      "the-state",
    );

    expect(url.startsWith(`${AUTH_ENDPOINT}?`)).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe(SCOPE);
    expect(params.get("access_type")).toBe("offline");
    expect(params.get("prompt")).toBe("consent");
    expect(params.get("include_granted_scopes")).toBe("true");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("client_id")).toBe("client-123");
    expect(params.get("redirect_uri")).toBe(
      "https://vera.app/google/callback",
    );
    expect(params.get("state")).toBe("the-state");
    expect(params.get("code_challenge")).toBe("the-challenge");
  });
});

// The service reads `this.clientId` (private). Set it on the singleton for the
// connectViaPopup tests so we get past the not_configured guard.
type MutableService = { clientId: string };
const setClientId = (value: string): void => {
  (googleCalendar as unknown as MutableService).clientId = value;
};

describe("connectViaPopup", () => {
  let savedClientId: string;

  beforeEach(() => {
    savedClientId = (googleCalendar as unknown as MutableService).clientId;
    setClientId("test-client");
  });

  afterEach(() => {
    (googleCalendar as unknown as MutableService).clientId = savedClientId;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stubCrypto = (digest: () => Promise<ArrayBuffer>): void => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => arr,
      subtle: { digest },
    });
  };

  const stubWindow = (win: unknown): void => {
    vi.stubGlobal("window", win);
  };

  it("calls window.open synchronously — before the awaited PKCE digest resolves", async () => {
    // A digest that never resolves during this test: proves window.open ran
    // synchronously, before the first await yielded the event loop.
    let resolveDigest: (v: ArrayBuffer) => void = () => {};
    stubCrypto(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          resolveDigest = resolve;
        }),
    );

    const openSpy = vi.fn().mockReturnValue(null);
    stubWindow({
      open: openSpy,
      location: { origin: "https://vera.app" },
    });

    // Fire without awaiting: the microtask queue has NOT been drained yet.
    const promise = googleCalendar.connectViaPopup();

    // window.open must already have been called, synchronously.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toBe("");

    // window.open returned null here, so the flow rejects popup_blocked; the
    // pending digest is irrelevant. Assert to avoid an unhandled rejection.
    await expect(promise).rejects.toBeInstanceOf(GoogleCalendarError);
    resolveDigest(new ArrayBuffer(0));
  });

  it("throws GoogleCalendarError reason 'popup_blocked' when window.open returns null", async () => {
    stubCrypto(() => Promise.resolve(new ArrayBuffer(0)));
    stubWindow({
      open: vi.fn().mockReturnValue(null),
      location: { origin: "https://vera.app" },
    });

    await expect(googleCalendar.connectViaPopup()).rejects.toMatchObject({
      reason: "popup_blocked",
    });
  });

  it("navigates the returned popup to the buildAuthUrl result via popup.location once the challenge resolves", async () => {
    // Digest bytes -> base64url is deterministic, so we can predict the URL.
    const digestBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    stubCrypto(() => Promise.resolve(digestBytes));

    const popup: {
      location: { href: string };
      closed: boolean;
      close: () => void;
    } = {
      location: { href: "about:blank" },
      closed: false,
      close: vi.fn(),
    };

    const messageHandlers: ((event: MessageEvent) => void)[] = [];
    stubWindow({
      open: vi.fn().mockReturnValue(popup),
      location: { origin: "https://vera.app" },
      addEventListener: (_type: string, fn: (e: MessageEvent) => void) => {
        messageHandlers.push(fn);
      },
      removeEventListener: vi.fn(),
    });

    // Deny immediately after the handshake wires up so the flow settles and we
    // can inspect the URL the popup was navigated to.
    const promise = googleCalendar.connectViaPopup();

    // Let the awaited digest resolve and the handshake register its listener.
    await Promise.resolve();
    await Promise.resolve();

    expect(messageHandlers.length).toBe(1);
    // The popup was navigated to a real auth URL (not the blank open target).
    expect(popup.location.href.startsWith(`${AUTH_ENDPOINT}?`)).toBe(true);

    // Extract the state from the URL the code actually built and echo it back so
    // the handshake accepts our message, then confirm the URL matches buildAuthUrl.
    const built = new URL(popup.location.href);
    const state = built.searchParams.get("state") as string;
    const challenge = built.searchParams.get("code_challenge") as string;
    expect(popup.location.href).toBe(
      buildAuthUrl(
        "test-client",
        "https://vera.app/google/callback",
        challenge,
        state,
      ),
    );

    // Settle the flow (deny path) to avoid a dangling promise.
    messageHandlers[0]({
      origin: "https://vera.app",
      data: { source: "vera-google-oauth", error: "access_denied" },
    } as MessageEvent);
    await expect(promise).rejects.toBeInstanceOf(GoogleCalendarError);
  });
});
