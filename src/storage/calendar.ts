import { getSessionId } from "./session.ts";
import { lsGet, lsSet, lsRemove } from "./local-store.ts";
import type { StoredCalendarEvent } from "../models/calendar.ts";

const calendarConnectedKey = (sessionId: string): string =>
  `vera:calendarConnected:${sessionId}`;

// "Connected" here means a calendar file has been imported at least once.
export const isCalendarConnected = (): boolean =>
  localStorage.getItem(calendarConnectedKey(getSessionId())) === "true";

export const markCalendarConnected = (): void => {
  localStorage.setItem(calendarConnectedKey(getSessionId()), "true");
};

const calendarEventsKey = (sessionId: string): string =>
  `vera:calendarEvents:${sessionId}`;

// Parsed + recurrence-expanded events from the last import (whole-window
// snapshot; "today's event" is derived per day from this list).
export const getStoredEvents = (): StoredCalendarEvent[] =>
  lsGet<StoredCalendarEvent[]>(calendarEventsKey(getSessionId()), []);

export const setStoredEvents = (events: StoredCalendarEvent[]): void => {
  lsSet(calendarEventsKey(getSessionId()), events);
};

// Local-day stamp (YYYY-MM-DD), matching today-session's daily-reset key so the
// calendar pick re-applies on each new calendar day.
export const todayLocalDay = (): string => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const calendarAppliedDayKey = (sessionId: string): string =>
  `vera:calendarAppliedDay:${sessionId}`;

// The local day (YYYY-MM-DD) the calendar pick was last applied to the deck.
// Lets Today bias the outfit once per day without re-overriding a manual chip
// the user taps afterwards (or after a route-level remount of the deck).
export const getCalendarAppliedDay = (): string | null =>
  localStorage.getItem(calendarAppliedDayKey(getSessionId()));

export const setCalendarAppliedDay = (day: string): void => {
  localStorage.setItem(calendarAppliedDayKey(getSessionId()), day);
};

// Cleared on a fresh import so the new pick re-applies to the deck even if the
// calendar was already applied earlier today.
export const clearCalendarAppliedDay = (): void => {
  localStorage.removeItem(calendarAppliedDayKey(getSessionId()));
};

// Full disconnect — drops imported events, the connected flag and the applied
// stamp.
export const clearCalendar = (): void => {
  const sessionId = getSessionId();
  lsRemove(calendarEventsKey(sessionId));
  localStorage.removeItem(calendarConnectedKey(sessionId));
  localStorage.removeItem(calendarAppliedDayKey(sessionId));
};
