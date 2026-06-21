import { useState, useEffect } from "react";
import {
  pickMostRelevant,
  rawEventsToStored,
  type CalendarEvent,
  type StoredCalendarEvent,
} from "../models/calendar.ts";
import {
  isCalendarConnected,
  markCalendarConnected,
  getStoredEvents,
  setStoredEvents,
  clearCalendar,
  clearCalendarAppliedDay,
  getCalendarRefreshToken,
  setCalendarRefreshToken,
  getCalendarFetchedDay,
  setCalendarFetchedDay,
  getCalendarFetchedAt,
  setCalendarFetchedAt,
  todayLocalDay,
} from "../storage/calendar.ts";
import { googleCalendar } from "../services/google-calendar.ts";

// Don't re-hit Google more than once per this window when the app regains
// focus — enough to dedupe rapid tab-flicking while still feeling fresh on
// a genuine return.
const REFRESH_THROTTLE_MS = 60_000;

// Private singleton state reused through the app (mirrors occasion.ts). Kept in
// sync so connecting during onboarding is reflected the moment Today mounts.
let connected = isCalendarConnected();
let events: StoredCalendarEvent[] = getStoredEvents();
let refreshing = false;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

// The day's pick derived from the imported snapshot, recomputed per day.
const currentTodayEvent = (): CalendarEvent | null =>
  connected
    ? pickMostRelevant(events.filter((e) => e.date === todayLocalDay()))
    : null;

// Silently trade the stored refresh token for a fresh event window so Today's
// pick stays current without re-prompting. Triggered on mount and whenever the
// app regains focus (see the visibilitychange listener below), throttled to
// REFRESH_THROTTLE_MS. Guarded so concurrently-mounted consumers don't each fire
// a request. Failures leave the existing window in place and are retried later.
//
// The deck only re-biases once per calendar day: a within-day refresh updates
// the stored events (so the cue is current) but leaves the applied-day stamp, so
// it won't override an occasion chip you tapped earlier today. A new day clears
// the stamp so the fresh pick re-applies to the deck.
const maybeRefresh = async (): Promise<void> => {
  if (!connected || refreshing) return;
  const token = getCalendarRefreshToken();
  if (!token) return;
  const now = Date.now();
  if (now - getCalendarFetchedAt() < REFRESH_THROTTLE_MS) return;
  refreshing = true;
  const dayChanged = getCalendarFetchedDay() !== todayLocalDay();
  try {
    const raw = await googleCalendar.refreshEvents(token);
    events = rawEventsToStored(raw);
    setStoredEvents(events);
    setCalendarFetchedAt(now);
    if (dayChanged) {
      setCalendarFetchedDay(todayLocalDay());
      clearCalendarAppliedDay();
    }
    notify();
  } catch {
    // Keep the cached window; try again on the next focus/mount.
  } finally {
    refreshing = false;
  }
};

// Refresh when the user returns to the app (tab focus / reopen). Registered once
// at module load since the hook state is a singleton; the throttle inside
// maybeRefresh keeps repeated focus events cheap.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void maybeRefresh();
  });
}

export function useCalendar() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = (): void => force((n) => n + 1);
    listeners.add(l);
    void maybeRefresh();
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Real Google Calendar connection: run the popup OAuth handshake, persist the
  // refresh token + the fetched window, then derive Today's pick. Errors
  // (popup blocked/closed, denied, exchange failure) propagate to the caller.
  const connect = async (): Promise<void> => {
    const { refreshToken, events: raw } = await googleCalendar.connectViaPopup();
    events = rawEventsToStored(raw);
    setStoredEvents(events);
    setCalendarRefreshToken(refreshToken);
    setCalendarFetchedDay(todayLocalDay());
    setCalendarFetchedAt(Date.now());
    markCalendarConnected();
    connected = true;
    // Re-apply the fresh pick to the deck even if already applied today.
    clearCalendarAppliedDay();
    notify();
  };

  const clear = (): void => {
    clearCalendar();
    events = [];
    connected = false;
    notify();
  };

  return {
    connected,
    todayEvent: currentTodayEvent(),
    connect,
    clear,
  };
}
