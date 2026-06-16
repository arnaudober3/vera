import { useState, useEffect } from "react";
import {
  pickMostRelevant,
  type CalendarEvent,
  type StoredCalendarEvent,
} from "../models/calendar.ts";
import { parseIcs } from "../services/ics-calendar.ts";
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
// sync so an import during onboarding is reflected the moment Today mounts.
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

  // Parse an imported .ics entirely on-device, persist the expanded events, and
  // mark the calendar connected. Throws on an invalid file (handled by caller).
  const importIcs = async (file: File): Promise<{ count: number }> => {
    const parsed = await parseIcs(file);
    events = parsed;
    setStoredEvents(parsed);
    markCalendarConnected();
    connected = true;
    // Re-apply the fresh pick to the deck even if already applied today.
    clearCalendarAppliedDay();
    notify();
    return { count: parsed.length };
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
    importIcs,
    clear,
  };
}
