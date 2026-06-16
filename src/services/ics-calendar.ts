import IcalExpander from "ical-expander";
import {
  eventToOccasion,
  type StoredCalendarEvent,
} from "../models/calendar.ts";

// How far ahead we expand recurrences at import time, so a single import keeps
// driving "today's event" for a while before the user needs to re-import.
const WINDOW_DAYS = 31;

// The minimal slice of an ical.js Time we read. Avoids depending on ICAL's types
// directly (they resolve loosely through the bundler).
type IcalTime = {
  isDate: boolean;
  year: number;
  month: number; // 1-12
  day: number;
  toJSDate: () => Date;
};

const pad = (n: number): string => `${n}`.padStart(2, "0");

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatTime = (d: Date): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

const normalize = (
  startDate: IcalTime,
  summary: string | undefined,
): StoredCalendarEvent | null => {
  const title = (summary ?? "").trim();
  if (!title) return null;

  // All-day events carry no time; read the calendar date components directly so
  // a timezone offset can't shift the event onto a neighbouring day.
  if (startDate.isDate) {
    const date = `${startDate.year}-${pad(startDate.month)}-${pad(startDate.day)}`;
    const startMs = new Date(
      startDate.year,
      startDate.month - 1,
      startDate.day,
    ).getTime();
    return { date, time: "", title, occasion: eventToOccasion(title), startMs };
  }

  const d = startDate.toJSDate();
  return {
    date: localDay(d),
    time: formatTime(d),
    title,
    occasion: eventToOccasion(title),
    startMs: d.getTime(),
  };
};

// Parse an imported .ics file entirely in the browser: expand recurrences over
// [start of today, +31 days] and normalise to dated events. Throws on a file
// that isn't valid iCalendar.
export const parseIcs = async (
  file: File,
): Promise<StoredCalendarEvent[]> => {
  const ics = await file.text();
  if (!ics.includes("BEGIN:VCALENDAR")) {
    throw new Error("invalid-ics");
  }

  // From local midnight so events earlier today (already ended) are still read.
  const after = new Date();
  after.setHours(0, 0, 0, 0);
  const before = new Date(after.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const expander = new IcalExpander({ ics, maxIterations: 1000 });
  const { events, occurrences } = expander.between(after, before);

  const out: StoredCalendarEvent[] = [];
  for (const e of events) {
    const n = normalize(e.startDate as unknown as IcalTime, e.summary);
    if (n) out.push(n);
  }
  for (const o of occurrences) {
    const n = normalize(o.startDate as unknown as IcalTime, o.item.summary);
    if (n) out.push(n);
  }

  out.sort((a, b) => a.startMs - b.startMs);
  return out;
};
