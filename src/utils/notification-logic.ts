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

export function getNotificationContent(lang: string) {
  const normalizedLang = lang.startsWith("fr") ? "fr" : "en";
  return NOTIFICATION_CONTENT[normalizedLang] || NOTIFICATION_CONTENT.en;
}

export function shouldNotify(
  now: Date,
  lastNotifiedDay: string | null,
): boolean {
  // Use local date string (YYYY-MM-DD) for deduping
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  // 1. Dedup: Don't notify if already notified today
  if (lastNotifiedDay === today) {
    return false;
  }

  // 2. Window: Only notified after 6 AM
  return now.getHours() >= 6;
}
