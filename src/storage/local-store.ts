export const lsGet = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const lsSet = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const lsRemove = (key: string): void => {
  localStorage.removeItem(key);
};

export const closetKey = (sessionId: string) =>
  `vera:clothingItems:${sessionId}`;
export const outfitKey = (sessionId: string) => `vera:outfit:${sessionId}`;
export const favouritesKey = (sessionId: string) =>
  `vera:favourites:${sessionId}`;
export const historyKey = (sessionId: string) => `vera:history:${sessionId}`;
