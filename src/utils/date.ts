import type { TFunction } from "i18next";

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatRelativeDate = (
  date: Date,
  t: TFunction,
  now: Date = new Date(),
): string => {
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / DAY_MS);

  if (diffDays < 0) return t("date.future");
  if (diffDays === 0) return t("date.today");
  if (diffDays === 1) return t("date.yesterday");
  if (diffDays < 7) return t("date.daysAgo", { count: diffDays });
  if (diffDays < 14) return t("date.lastWeek");
  if (diffDays < 30) return t("date.weeksAgo", { count: Math.floor(diffDays / 7) });
  if (diffDays < 60) return t("date.monthAgo");
  if (diffDays < 365) return t("date.monthsAgo", { count: Math.floor(diffDays / 30) });
  if (diffDays < 730) return t("date.yearAgo");
  return t("date.yearsAgo", { count: Math.floor(diffDays / 365) });
};
