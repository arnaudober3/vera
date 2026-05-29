import type { Season } from "../models/season.ts";

// Northern-hemisphere meteorological seasons by month index (0 = Jan ... 11 = Dec).
const NORTHERN_BY_MONTH: Season[] = [
  "winter", // Jan
  "winter", // Feb
  "spring", // Mar
  "spring", // Apr
  "spring", // May
  "summer", // Jun
  "summer", // Jul
  "summer", // Aug
  "fall", // Sep
  "fall", // Oct
  "fall", // Nov
  "winter", // Dec
];

const SOUTHERN_OPPOSITE: Record<Season, Season> = {
  winter: "summer",
  summer: "winter",
  spring: "fall",
  fall: "spring",
};

// Detect hemisphere via the DST trick. getTimezoneOffset() returns minutes behind
// UTC (positive = west). In the Northern hemisphere clocks spring forward in summer,
// so July's offset is smaller than January's; the reverse holds in the South.
// Limitation: regions without DST have equal offsets and are indistinguishable —
// we fall back to Northern in that case.
export const detectHemisphere = (now: Date = new Date()): "north" | "south" => {
  const year = now.getFullYear();
  const janOffset = new Date(year, 0, 1).getTimezoneOffset();
  const julOffset = new Date(year, 6, 1).getTimezoneOffset();

  if (julOffset < janOffset) return "north";
  if (julOffset > janOffset) return "south";
  return "north";
};

export const getCurrentSeason = (now: Date = new Date()): Season => {
  const base = NORTHERN_BY_MONTH[now.getMonth()];
  return detectHemisphere(now) === "south" ? SOUTHERN_OPPOSITE[base] : base;
};
