import { getSessionId } from "./session.ts";
import { lsGet, lsSet, lsRemove } from "./local-store.ts";
import type { StoredCalendarEvent } from "../models/calendar.ts";

const calendarConnectedKey = (sessionId: string): string =>
  `vera:calendarConnected:${sessionId}`;

// "Connected" here means the calendar has been connected at least once.
export const isCalendarConnected = (): boolean =>
  localStorage.getItem(calendarConnectedKey(getSessionId())) === "true";

export const markCalendarConnected = (): void => {
  localStorage.setItem(calendarConnectedKey(getSessionId()), "true");
};

const calendarEventsKey = (sessionId: string): string =>
  `vera:calendarEvents:${sessionId}`;

// Events from the last calendar connection (whole-window snapshot; "today's
// event" is derived per day from this list).
export const getStoredEvents = (): StoredCalendarEvent[] =>
  lsGet<StoredCalendarEvent[]>(calendarEventsKey(getSessionId()), []);

export const setStoredEvents = (events: StoredCalendarEvent[]): void => {
  lsSet(calendarEventsKey(getSessionId()), events);
};

const calendarRefreshTokenKey = (sessionId: string): string =>
  `vera:calendarRefreshToken:${sessionId}`;

// The Google OAuth refresh token, persisted so the app can silently re-fetch a
// fresh event window each day without re-prompting. Trade-off accepted with the
// app's local-first model (mirrors the client-side API keys already in use).
export const getCalendarRefreshToken = (): string | null =>
  localStorage.getItem(calendarRefreshTokenKey(getSessionId()));

export const setCalendarRefreshToken = (token: string): void => {
  localStorage.setItem(calendarRefreshTokenKey(getSessionId()), token);
};

const calendarFetchedDayKey = (sessionId: string): string =>
  `vera:calendarFetchedDay:${sessionId}`;

// The local day (YYYY-MM-DD) the event window was last fetched from Google. Used
// to trigger one silent refresh per new calendar day.
export const getCalendarFetchedDay = (): string | null =>
  localStorage.getItem(calendarFetchedDayKey(getSessionId()));

export const setCalendarFetchedDay = (day: string): void => {
  localStorage.setItem(calendarFetchedDayKey(getSessionId()), day);
};

const calendarFetchedAtKey = (sessionId: string): string =>
  `vera:calendarFetchedAt:${sessionId}`;

// Epoch ms of the last successful event fetch. Throttles the refresh-on-return
// so rapidly re-focusing the app doesn't re-hit Google each time. 0 if never.
export const getCalendarFetchedAt = (): number =>
  Number(localStorage.getItem(calendarFetchedAtKey(getSessionId())) ?? 0);

export const setCalendarFetchedAt = (ms: number): void => {
  localStorage.setItem(calendarFetchedAtKey(getSessionId()), String(ms));
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

// Cleared on a fresh connection so the new pick re-applies to the deck even if
// the calendar was already applied earlier today.
export const clearCalendarAppliedDay = (): void => {
  localStorage.removeItem(calendarAppliedDayKey(getSessionId()));
};

// Full disconnect — drops stored events, the connected flag, the applied stamp,
// the refresh token and the fetched-day stamp.
export const clearCalendar = (): void => {
  const sessionId = getSessionId();
  lsRemove(calendarEventsKey(sessionId));
  localStorage.removeItem(calendarConnectedKey(sessionId));
  localStorage.removeItem(calendarAppliedDayKey(sessionId));
  localStorage.removeItem(calendarRefreshTokenKey(sessionId));
  localStorage.removeItem(calendarFetchedDayKey(sessionId));
  localStorage.removeItem(calendarFetchedAtKey(sessionId));
};
