export const NOTIFICATION_CONTENT: Record<
  string,
  { title: string; body: string }
> = {
  en: {
    title: "Check today's suggestion",
    body: "Looking for some outfit ideas for today?",
  },
  fr: {
    title: "Découvre la suggestion du jour",
    body: "Tu cherches des idées de tenues pour aujourd’hui ?",
  },
};

const LAUNDRY_HINT: Record<string, string> = {
  en: "(time for a laundry?)",
  fr: "(C’est l’heure de la lessive ?)",
};

export function getNotificationContent(lang: string, showLaundryHint = false) {
  const normalizedLang = lang.startsWith("fr") ? "fr" : "en";
  const base =
    NOTIFICATION_CONTENT[normalizedLang] || NOTIFICATION_CONTENT.en;

  if (!showLaundryHint) {
    return base;
  }

  const hint = LAUNDRY_HINT[normalizedLang] || LAUNDRY_HINT.en;
  return {
    ...base,
    body: `${base.body} ${hint}`,
  };
}

export function shouldNotify(
  now: Date,
  lastNotifiedDay: string | null,
): boolean {
  const today = formatDate(now);

  // 1. Dedup: Don't notify if already notified today
  if (lastNotifiedDay === today) {
    return false;
  }

  // 2. Window: Only notified after 6 AM
  return now.getHours() >= 6;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayDiff(today: string, dirtySinceDay: string): number {
  const t = new Date(today);
  const d = new Date(dirtySinceDay);

  // Normalize to UTC midnight to avoid DST issues
  const tUtc = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const dUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = tUtc - dUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
