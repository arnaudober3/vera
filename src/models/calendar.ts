import type { Occasion } from "./occasion.ts";

// A single day's event as Vera reads it. Vera only ever needs the title, the
// time, and the occasion the title maps to — never event bodies or attendees.
export type CalendarEvent = {
  title: string;
  time: string;
  occasion: Occasion;
};

// A parsed + recurrence-expanded event kept locally after an .ics import. Dated
// (local YYYY-MM-DD) so "today's event" is recomputed each day from one import;
// `startMs` orders events within a day; `time` is "" for all-day events.
export type StoredCalendarEvent = {
  date: string;
  time: string;
  title: string;
  occasion: Occasion;
  startMs: number;
};

// A row in the onboarding agenda preview. `occasion` is null for events that
// don't drive a look (e.g. lunch); `standout` marks the day's most relevant one.
export type AgendaItem = {
  time: string;
  title: string;
  occasion: Occasion | null;
  standout: boolean;
};

// The illustrative day shown in the onboarding preview, so the user sees how
// events map to occasions before connecting. The standout (dinner) is the pick.
export const MOCK_AGENDA: AgendaItem[] = [
  { time: "9:00", title: "Team standup", occasion: "work", standout: false },
  { time: "1:00", title: "Lunch", occasion: null, standout: false },
  {
    time: "7:30",
    title: "Dinner with friends",
    occasion: "dinner",
    standout: true,
  },
];

// Wall-clock for each MOCK_AGENDA row (parallel by index), used to stamp today's
// mocked events with ascending times so the dinner ends up the latest dressable
// one — i.e. the pick. Display time is the 12h label shown on Today's cue.
const MOCK_TIMES: { hour: number; minute: number; time: string }[] = [
  { hour: 9, minute: 0, time: "9:00 AM" },
  { hour: 13, minute: 0, time: "1:00 PM" },
  { hour: 19, minute: 30, time: "7:30 PM" },
];

// Mocked "connected calendar": MOCK_AGENDA projected onto today, in the same
// StoredCalendarEvent shape a real import produces — so Today derives the dinner
// pick and biases the deck exactly as it would from real events. Temporary
// stand-in until Google Calendar is wired up.
export const mockTodayEvents = (): StoredCalendarEvent[] => {
  const now = new Date();
  return MOCK_AGENDA.map((row, i) => {
    const { hour, minute, time } = MOCK_TIMES[i] ?? MOCK_TIMES[0];
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
    );
    const m = `${start.getMonth() + 1}`.padStart(2, "0");
    const day = `${start.getDate()}`.padStart(2, "0");
    return {
      date: `${start.getFullYear()}-${m}-${day}`,
      time,
      title: row.title,
      occasion: row.occasion ?? "everyday",
      startMs: start.getTime(),
    };
  });
};

// Keyword heuristics (FR + EN) mapping an event title to an occasion. Order
// matters: the first rule that matches wins. Anything unmatched is "everyday"
// (a neutral, non-dressable day).
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OCCASION_RULES: { occasion: Occasion; words: string[] }[] = [
  {
    occasion: "gym",
    words: [
      "gym", "workout", "work-out", "fitness", "sport", "yoga", "pilates",
      "run", "running", "jog", "jogging", "muscu", "training", "entrainement",
      "entraînement", "crossfit", "swim", "natation", "padel", "tennis",
    ],
  },
  {
    occasion: "dinner",
    words: ["dinner", "dîner", "diner", "souper", "restaurant", "resto"],
  },
  {
    occasion: "date-night",
    words: [
      "date night", "date-night", "drinks", "apéro", "apero", "cocktail",
      "cocktails", "soirée", "soiree", "party", "anniversaire", "birthday",
      "concert", "theatre", "théâtre", "opera", "opéra", "cinema", "cinéma",
    ],
  },
  {
    occasion: "work",
    words: [
      "work", "travail", "boulot", "bureau", "office", "meeting", "réunion",
      "reunion", "standup", "stand-up", "call", "appel", "sync", "review",
      "1:1", "interview", "entretien", "client", "presentation", "présentation",
      "demo", "démo", "webinar", "conference", "conférence", "kickoff",
      "kick-off", "onboarding", "workshop", "atelier",
    ],
  },
];

const OCCASION_MATCHERS: { occasion: Occasion; re: RegExp }[] = OCCASION_RULES.map(
  ({ occasion, words }) => ({
    occasion,
    re: new RegExp(`\\b(${words.map(escapeRe).join("|")})\\b`, "i"),
  }),
);

export const eventToOccasion = (title: string): Occasion => {
  for (const { occasion, re } of OCCASION_MATCHERS) {
    if (re.test(title)) return occasion;
  }
  return "everyday";
};

// The day's pick Vera surfaces on Today. Prefers a "dressable" occasion
// (anything but everyday) so the outfit is biased meaningfully; among the
// candidates it takes the latest event of the day, which naturally surfaces the
// evening dinner/date. If the day has only everyday events (e.g. "beach day"),
// it still returns the latest one so the event is shown — the deck just stays on
// the neutral everyday look. Returns null only when there's no event at all.
export const pickMostRelevant = (
  events: StoredCalendarEvent[],
): CalendarEvent | null => {
  if (events.length === 0) return null;
  const dressable = events.filter((e) => e.occasion !== "everyday");
  const pool = dressable.length > 0 ? dressable : events;
  const top = pool.reduce((a, b) => (b.startMs >= a.startMs ? b : a));
  return { title: top.title, time: top.time, occasion: top.occasion };
};
