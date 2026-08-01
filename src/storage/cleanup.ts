// One-shot local-data migrations. The app is local-first with no schema and no
// backend, so a removed feature leaves its keys behind in every browser that
// ever ran the old build. This module is the single place where that debris is
// swept, versioned so a future clean-up only has to add a step and bump LATEST.
//
// Imported for its side effect at the very top of main.tsx: the hooks in
// hooks/* initialise their singletons at import time, so the sweep has to run
// before any of them reads localStorage.

const VERSION_KEY = "vera:cleanupVersion";
const LATEST = 2;

// Keys written by the removed lookbook, outfit-history, calendar, notification
// and weather features. Matched by prefix rather than rebuilt from the current
// session id, so entries from earlier sessions are collected too.
export const LEGACY_PREFIXES = [
  "vera:lookbook:",
  "vera:history:",
  "vera:calendar", // calendarConnected, calendarEvents, calendarRefreshToken, …
  "vera:notifications:",
  // The Today deck's working state used to carry a "worn" snapshot pointing at
  // an outfit-history record. It resets daily anyway, so dropping it is free.
  "vera:today:",
  // Cached (or manually entered) weather reading — v2.
  "vera:weather:",
];

// Everything the app still reads. Listed explicitly so the sweep's blast radius
// is reviewable at a glance (and testable).
export const KEEP_PREFIXES = [
  "session_id",
  "vera:clothingItems:",
  "vera:outfit:",
  "vera:occasion:",
  "vera:onboardingComplete:",
];

// IndexedDB database backing the removed service-worker reminders. Distinct
// from "vera-images", which holds the closet photos and must never be touched.
const LEGACY_DB = "vera-sw-db";

const currentVersion = (): number => {
  const raw = localStorage.getItem(VERSION_KEY);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
};

// v1 — drop the keys and the IndexedDB database left by the notifications,
// calendar, lookbook and laundry features, and strip the now-unused `isClean`
// flag from stored closet items.
// v2 — same sweep, now also covering the weather reading. Both steps are folded
// into one pass: the prefix list is the source of truth, and removing a key that
// is already gone costs nothing.
const sweep = (): void => {
  for (const key of Object.keys(localStorage)) {
    if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) {
      localStorage.removeItem(key);
    }
  }

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("vera:clothingItems:")) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      const items = JSON.parse(raw) as Record<string, unknown>[];
      if (!Array.isArray(items)) continue;
      if (!items.some((item) => item && "isClean" in item)) continue;
      const stripped = items.map((item) => {
        const next = { ...item };
        delete next.isClean;
        return next;
      });
      localStorage.setItem(key, JSON.stringify(stripped));
    } catch {
      // A malformed payload is already unreadable by lsGet — leave it alone.
    }
  }

  // Fire-and-forget: deleting is idempotent, a missing database resolves fine,
  // and nothing downstream waits on it.
  indexedDB.deleteDatabase(LEGACY_DB);
};

// Idempotent: a version stamp short-circuits the sweep on every later load.
// Wrapped whole because localStorage can throw (Safari private mode, quota) and
// a failure here must never keep the app from booting.
export const runLocalDataCleanup = (): void => {
  try {
    if (currentVersion() >= LATEST) return;
    sweep();
    localStorage.setItem(VERSION_KEY, String(LATEST));
  } catch {
    /* best effort */
  }
};

runLocalDataCleanup();
