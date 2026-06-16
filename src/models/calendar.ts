import type { Occasion } from "./occasion.ts";

// A single day's event as Vera reads it. Vera only ever needs the title, the
// time, and the occasion the title maps to — never event bodies or attendees.
export type CalendarEvent = {
  title: string;
  time: string;
  occasion: Occasion;
};

// A row in the onboarding agenda preview. `occasion` is null for events that
// don't drive a look (e.g. lunch); `standout` marks the day's most relevant one.
export type AgendaItem = {
  time: string;
  title: string;
  occasion: Occasion | null;
  standout: boolean;
};

// Local-first PWAs can't read the device calendar, so the "synced" day is
// mocked. This is the single pick the engine would surface on Today — the day's
// most relevant occasion.
export const MOCK_TODAY_EVENT: CalendarEvent = {
  title: "Dinner with friends",
  time: "7:30 PM",
  occasion: "dinner",
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
