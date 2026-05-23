const DAY_MS = 24 * 60 * 60 * 1000;

export const formatRelativeDate = (date: Date, now: Date = new Date()): string => {
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / DAY_MS);

  if (diffDays < 0) return "in the future";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "a month ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  if (diffDays < 730) return "a year ago";
  return `${Math.floor(diffDays / 365)} years ago`;
};
