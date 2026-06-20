import { useState, useEffect } from "react";
import {
  mockTodayEvents,
  pickMostRelevant,
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
  todayLocalDay,
} from "../storage/calendar.ts";

// Private singleton state reused through the app (mirrors occasion.ts). Kept in
// sync so connecting during onboarding is reflected the moment Today mounts.
let connected = isCalendarConnected();
let events: StoredCalendarEvent[] = getStoredEvents();
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

// The day's pick derived from the imported snapshot, recomputed per day.
const currentTodayEvent = (): CalendarEvent | null =>
  connected
    ? pickMostRelevant(events.filter((e) => e.date === todayLocalDay()))
    : null;

export function useCalendar() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = (): void => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Mock calendar connection: simulate the round-trip, then persist today's
  // illustrative events so Today derives the pick. Stands in for the real Google
  // Calendar integration (coming later) — no on-device parsing yet.
  const connect = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const mocked = mockTodayEvents();
    events = mocked;
    setStoredEvents(mocked);
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
