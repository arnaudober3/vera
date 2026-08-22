import { useState, useEffect } from "react";
import type { Outfit } from "../models/outfit.ts";
import { ALL_OCCASIONS, type Occasion } from "../models/occasion.ts";
import { NAMED_COLORS } from "../utils/color.ts";
import { getSessionId } from "../storage/session.ts";
import { todayKey, lsGet, lsSet } from "../storage/local-store.ts";

// Shared deck UI types — defined here so both the hook and TodayDeck use one
// definition rather than redeclaring them. The filter is just the active
// occasion; "everyday" is the relaxed, fits-everything default.
export type Filter = Occasion;

// Canonical key for an outfit's top/bottom duo — identifies a deck card, used
// as its React key so the swipe animation restarts on a new card.
export const cardKeyOf = (o: Outfit): string => `${o.top.id}|${o.bottom.id}`;

// Up to two colours narrow the deck alongside the occasion.
const MAX_COLORS = 2;

// The ephemeral working state of the Today deck. Persisted so it survives the
// route-level unmount/remount of TodayDeck, and reset on a new calendar day.
type TodaySession = {
  filter: Filter;
  colors: string[];
  index: number;
  day: string; // YYYY-MM-DD (local day)
};

// Local-day stamp; matched against on load to reset the deck each new day.
const todayString = (): string => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

// The deck is ranked deterministically (colour match), so starting every day
// at index 0 would surface the exact same look each morning. Seeding the index
// from the local day rotates the entry point instead — no extra storage, and
// the ordering itself stays stable while the user swipes through it.
const daySeed = (day: string = todayString()): number => {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

const defaults = (): TodaySession => ({
  filter: "everyday",
  colors: [],
  index: daySeed(),
  day: todayString(),
});

// Guards a persisted filter against the pre-rename occasion set (old "all"/
// "casual"/… values), which are no longer valid Filters.
const isFilter = (value: unknown): value is Filter =>
  ALL_OCCASIONS.includes(value as Occasion);

const isColorName = (value: unknown): value is string =>
  typeof value === "string" && NAMED_COLORS.some((c) => c.name === value);

const sanitizeColors = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isColorName).slice(0, MAX_COLORS) : [];

// Private singleton state reused through the app
let state: TodaySession = defaults();
let isInitialized = false;
const listeners = new Set<(s: TodaySession) => void>();

const initialize = (): void => {
  if (isInitialized) {
    return;
  }

  const sessionId = getSessionId();
  const stored = lsGet<TodaySession>(todayKey(sessionId), defaults());
  // A stale-day load — or a filter from the pre-rename occasion set — is
  // treated as a fresh deck (daily reset / migration). Same-day payloads are
  // rebuilt field by field rather than adopted wholesale, so a legacy snapshot
  // can't smuggle dropped state (like the old per-card edits) back in.
  state =
    stored.day === todayString() && isFilter(stored.filter)
      ? {
          filter: stored.filter,
          colors: sanitizeColors(stored.colors),
          index: stored.index ?? daySeed(),
          day: stored.day,
        }
      : defaults();

  isInitialized = true;
};
initialize();

export function useTodaySession() {
  const [session, setSession] = useState(state);

  useEffect(() => {
    const listener = (s: TodaySession) => setSession(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setFilter = (filter: Filter): void => {
    // Changing the filter narrows the deck; reset position so the new filter's
    // deck rotates the same way as a fresh day.
    emitChange({ ...state, filter, index: daySeed() });
  };

  // Toggling a colour on/off narrows the deck the same way changing the filter
  // does. Picking a third colour drops the oldest pick — a rolling window of
  // two, so the control never needs an explicit "clear".
  const toggleColor = (name: string): void => {
    const has = state.colors.includes(name);
    const colors = has
      ? state.colors.filter((c) => c !== name)
      : state.colors.length >= MAX_COLORS
        ? [state.colors[1], name]
        : [...state.colors, name];
    emitChange({ ...state, colors, index: daySeed() });
  };

  const setIndex = (value: number | ((prev: number) => number)): void => {
    const index = typeof value === "function" ? value(state.index) : value;
    emitChange({ ...state, index });
  };

  function emitChange(next: TodaySession): void {
    // Always stamp the current day so a write made on a new day re-anchors it.
    state = { ...next, day: todayString() };
    lsSet(todayKey(getSessionId()), state);
    listeners.forEach((listener) => listener(state));
  }

  return {
    filter: session.filter,
    colors: session.colors,
    index: session.index,
    setFilter,
    toggleColor,
    setIndex,
  };
}
