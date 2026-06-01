import { useState, useEffect } from "react";
import { type Occasion } from "../models/occasion.ts";
import { getSessionId } from "../storage/session.ts";
import { lsGet, lsSet } from "../storage/local-store.ts";

const occasionKey = (sessionId: string): string => `vera:occasion:${sessionId}`;

const DEFAULT_OCCASION: Occasion = "casual";

// Private singleton state reused through the app (mirrors closet.ts / outfit.ts).
let state: Occasion = DEFAULT_OCCASION;
let isInitialized = false;
const listeners = new Set<(o: Occasion) => void>();

const initialize = (): void => {
  if (isInitialized) {
    return;
  }
  state = lsGet<Occasion>(occasionKey(getSessionId()), DEFAULT_OCCASION);
  isInitialized = true;
};
initialize();

// Plain getter so the outfit hook can read the selection without a React dep.
export const getSelectedOccasion = (): Occasion => state;

export function useOccasion() {
  const [occasion, setOccasionState] = useState(state);

  useEffect(() => {
    const listener = (o: Occasion) => setOccasionState(o);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setOccasion = (next: Occasion): void => {
    state = next;
    lsSet(occasionKey(getSessionId()), next);
    listeners.forEach((listener) => listener(next));
  };

  return { occasion, setOccasion };
}
