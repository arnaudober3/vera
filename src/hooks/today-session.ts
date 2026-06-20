import { useState, useEffect } from "react";
import type { Outfit } from "../models/outfit.ts";
import { ALL_OCCASIONS, type Occasion } from "../models/occasion.ts";
import { getSessionId } from "../storage/session.ts";
import { todayKey, lsGet, lsSet } from "../storage/local-store.ts";

// Shared deck UI types — defined here so both the hook and TodayDeck use one
// definition rather than redeclaring them. The filter is just the active
// occasion; "everyday" is the relaxed, fits-everything default.
export type Filter = Occasion;
export type WornState = { cardKey: string; recordId: string; snapshot: Outfit };

// Canonical key for an outfit's top/bottom duo — identifies a deck card and the
// worn snapshot across the deck and the favorites page.
export const cardKeyOf = (o: Outfit): string => `${o.top.id}|${o.bottom.id}`;

// Per-card secondary edits (added accessory/outerwear/shoes), keyed by cardKey.
type Edits = Record<string, Partial<Outfit>>;

// The ephemeral working state of the Today deck. Persisted so it survives the
// route-level unmount/remount of TodayDeck, and reset on a new calendar day.
type TodaySession = {
  filter: Filter;
  index: number;
  edits: Edits;
  worn: WornState | null;
  // An outfit kept as the deck's front card without being worn — e.g. after
  // undoing a wear, so the chosen outfit stays put instead of regenerating.
  // The user swipes to move on to the regular deck.
  selected: Outfit | null;
  day: string; // YYYY-MM-DD (local day)
};

// Local-day stamp; matched against on load to reset the deck each new day.
const todayString = (): string => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const defaults = (): TodaySession => ({
  filter: "everyday",
  index: 0,
  edits: {},
  worn: null,
  selected: null,
  day: todayString(),
});

// Guards a persisted filter against the pre-rename occasion set (old "all"/
// "casual"/… values), which are no longer valid Filters.
const isFilter = (value: unknown): value is Filter =>
  ALL_OCCASIONS.includes(value as Occasion);

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
  // treated as a fresh deck (daily reset / migration).
  state =
    stored.day === todayString() && isFilter(stored.filter)
      ? stored
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
    // Changing the filter narrows the deck; reset position, per-card edits and
    // any kept outfit atomically (they don't carry across filters).
    emitChange({ ...state, filter, index: 0, edits: {}, selected: null });
  };

  const setIndex = (value: number | ((prev: number) => number)): void => {
    const index = typeof value === "function" ? value(state.index) : value;
    emitChange({ ...state, index });
  };

  const setEdits = (value: Edits | ((prev: Edits) => Edits)): void => {
    const edits = typeof value === "function" ? value(state.edits) : value;
    emitChange({ ...state, edits });
  };

  const setWorn = (worn: WornState | null): void => {
    emitChange({ ...state, worn });
  };

  const setSelected = (selected: Outfit | null): void => {
    emitChange({ ...state, selected });
  };

  function emitChange(next: TodaySession): void {
    // Always stamp the current day so a write made on a new day re-anchors it.
    state = { ...next, day: todayString() };
    lsSet(todayKey(getSessionId()), state);
    listeners.forEach((listener) => listener(state));
  }

  return {
    filter: session.filter,
    index: session.index,
    edits: session.edits,
    worn: session.worn,
    selected: session.selected,
    setFilter,
    setIndex,
    setEdits,
    setWorn,
    setSelected,
  };
}
