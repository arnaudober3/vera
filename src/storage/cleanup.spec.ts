// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The sweep is the only code in the app that deletes user data, so it gets the
// closest guard: what it removes, what it must leave alone, and that a second
// run is a no-op.

const deleteDatabase = vi.fn();

const seed = (): void => {
  // Two distinct sessions, to prove the sweep matches by prefix rather than
  // rebuilding keys from the current session id.
  localStorage.setItem("session_id", "session_b");
  localStorage.setItem("vera:lookbook:session_a", JSON.stringify([{ id: "1" }]));
  localStorage.setItem("vera:lookbook:session_b", JSON.stringify([]));
  localStorage.setItem("vera:history:session_a", JSON.stringify([{ id: "2" }]));
  localStorage.setItem("vera:calendarConnected:session_b", "true");
  localStorage.setItem("vera:calendarRefreshToken:session_b", "token");
  localStorage.setItem("vera:notifications:promptDismissed:session_b", "true");
  localStorage.setItem("vera:today:session_b", JSON.stringify({ worn: {} }));
  localStorage.setItem("vera:weather:session_b", JSON.stringify({ temperatureC: 12 }));

  localStorage.setItem(
    "vera:clothingItems:session_b",
    JSON.stringify([
      { id: "top1", name: "Tee", category: "top", isClean: false },
      { id: "bot1", name: "Jeans", category: "bottom", isClean: true },
    ]),
  );
  localStorage.setItem("vera:outfit:session_b", JSON.stringify({ top: {} }));
  localStorage.setItem("vera:occasion:session_b", '"everyday"');
  localStorage.setItem("vera:onboardingComplete:session_b", "true");
};

const load = async () => {
  vi.resetModules();
  return import("./cleanup.ts");
};

describe("local data cleanup", () => {
  beforeEach(() => {
    localStorage.clear();
    deleteDatabase.mockClear();
    vi.stubGlobal("indexedDB", { deleteDatabase });
    seed();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops the keys left by the removed features, across sessions", async () => {
    await load();

    expect(localStorage.getItem("vera:lookbook:session_a")).toBeNull();
    expect(localStorage.getItem("vera:lookbook:session_b")).toBeNull();
    expect(localStorage.getItem("vera:history:session_a")).toBeNull();
    expect(localStorage.getItem("vera:calendarConnected:session_b")).toBeNull();
    expect(localStorage.getItem("vera:calendarRefreshToken:session_b")).toBeNull();
    expect(
      localStorage.getItem("vera:notifications:promptDismissed:session_b"),
    ).toBeNull();
    expect(localStorage.getItem("vera:today:session_b")).toBeNull();
    expect(localStorage.getItem("vera:weather:session_b")).toBeNull();
  });

  it("leaves the closet and the rest of the app's state intact", async () => {
    await load();

    expect(localStorage.getItem("session_id")).toBe("session_b");
    expect(localStorage.getItem("vera:outfit:session_b")).not.toBeNull();
    expect(localStorage.getItem("vera:occasion:session_b")).not.toBeNull();
    expect(localStorage.getItem("vera:onboardingComplete:session_b")).toBe("true");

    const items = JSON.parse(
      localStorage.getItem("vera:clothingItems:session_b")!,
    );
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Tee");
    expect(items[1].name).toBe("Jeans");
  });

  it("strips the obsolete isClean flag from stored items", async () => {
    await load();

    const items = JSON.parse(
      localStorage.getItem("vera:clothingItems:session_b")!,
    ) as Record<string, unknown>[];
    for (const item of items) expect(item).not.toHaveProperty("isClean");
  });

  it("deletes the reminder database and never the image one", async () => {
    await load();

    expect(deleteDatabase).toHaveBeenCalledWith("vera-sw-db");
    expect(deleteDatabase).not.toHaveBeenCalledWith("vera-images");
  });

  it("is a no-op once the version stamp is set", async () => {
    const mod = await load();
    expect(localStorage.getItem("vera:cleanupVersion")).toBe("2");

    // Re-seeding then re-running must leave the legacy keys alone: the stamp
    // short-circuits the sweep, so it can't fight a future feature's keys.
    localStorage.setItem("vera:lookbook:session_b", "[]");
    deleteDatabase.mockClear();
    mod.runLocalDataCleanup();

    expect(localStorage.getItem("vera:lookbook:session_b")).toBe("[]");
    expect(deleteDatabase).not.toHaveBeenCalled();
  });

  it("still sweeps a browser already stamped at an older version", async () => {
    // A user who ran the v1 build carries the stamp but never had the weather
    // key swept — bumping LATEST has to re-run the sweep for them.
    localStorage.setItem("vera:cleanupVersion", "1");

    await load();

    expect(localStorage.getItem("vera:weather:session_b")).toBeNull();
    expect(localStorage.getItem("vera:cleanupVersion")).toBe("2");
    expect(localStorage.getItem("vera:clothingItems:session_b")).not.toBeNull();
  });

  it("survives a localStorage that throws", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });

    await expect(load()).resolves.toBeDefined();

    getItem.mockRestore();
  });
});
