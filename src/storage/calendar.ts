import { getSessionId } from "./session.ts";

const calendarConnectedKey = (sessionId: string): string =>
  `vera:calendarConnected:${sessionId}`;

export const isCalendarConnected = (): boolean =>
  localStorage.getItem(calendarConnectedKey(getSessionId())) === "true";

export const markCalendarConnected = (): void => {
  localStorage.setItem(calendarConnectedKey(getSessionId()), "true");
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
