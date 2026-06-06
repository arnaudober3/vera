import { useState, useEffect } from "react";
import type { OutfitHistoryEntry } from "../models/outfit-history.ts";
import { getSessionId } from "../storage/session.ts";
import { historyKey, lsGet, lsSet } from "../storage/local-store.ts";

const HISTORY_LIMIT = 10;
const RECENCY_RECOVERY_DAYS = 14;

type StoredEntry = Omit<OutfitHistoryEntry, "wornAt"> & { wornAt: string };

// Private singleton state reused through the app
let state: OutfitHistoryEntry[] = [];
let isInitialized = false;
const listeners = new Set<(entries: OutfitHistoryEntry[]) => void>();

const initialize = (): void => {
  if (isInitialized) {
    return;
  }

  const sessionId = getSessionId();
  const raw = lsGet<StoredEntry[]>(historyKey(sessionId), []);
  state = raw.map((entry) => ({
    ...entry,
    wornAt: new Date(entry.wornAt),
  }));

  isInitialized = true;
};
initialize();

export function useOutfitHistory() {
  const [history, setHistory] = useState(state);

  useEffect(() => {
    const listener = (entries: OutfitHistoryEntry[]) => setHistory(entries);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const recordOutfit = async (
    topId: string,
    bottomId: string,
    outerwearId?: string,
    shoesId?: string,
    accessoriesIds?: string[],
  ): Promise<string> => {
    const sessionId = getSessionId();
    const entryId = `${sessionId}_${Date.now()}`;

    const newEntry: OutfitHistoryEntry = {
      id: entryId,
      topId,
      bottomId,
      ...(outerwearId && { outerwearId }),
      ...(shoesId && { shoesId }),
      ...(accessoriesIds && { accessoriesIds }),
      wornAt: new Date(),
      sessionId,
    };

    const updated = [newEntry, ...state].slice(0, HISTORY_LIMIT);
    emitChange(updated);
    return entryId;
  };

  // Remove a single history entry by id — used to undo a wear that was committed
  // by mistake (the deck's tap-to-wear, then tap-to-undo).
  const removeOutfitRecord = async (id: string): Promise<void> => {
    const newState = state.filter((h) => h.id !== id);
    if (newState.length !== state.length) {
      emitChange(newState);
    }
  };

  const getRecencyPenalty = (itemIds: string[]): number => {
    const matchingEntries = state.filter((h) => {
      const entryIds = [
        h.topId,
        h.bottomId,
        h.outerwearId,
        h.shoesId,
        ...(h.accessoriesIds || []),
      ].filter(Boolean) as string[];

      // An entry matches if it contains ANY of the items in the current outfit
      return itemIds.some((id) => entryIds.includes(id));
    });

    if (matchingEntries.length === 0) {
      return 1.0;
    }

    // Find the most recent match among all matching entries
    const mostRecentMatch = matchingEntries[0]; // State is sorted by wornAt desc

    const daysSince =
      (Date.now() - mostRecentMatch.wornAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.min(1, daysSince / RECENCY_RECOVERY_DAYS);
  };

  const clearHistory = async (): Promise<void> => {
    emitChange([]);
  };

  const removeHistoryEntriesWithItem = async (itemId: string): Promise<void> => {
    const newState = state.filter(
      (h) =>
        h.topId !== itemId &&
        h.bottomId !== itemId &&
        h.outerwearId !== itemId &&
        h.shoesId !== itemId &&
        !h.accessoriesIds?.includes(itemId),
    );
    if (newState.length !== state.length) {
      emitChange(newState);
    }
  };

  function emitChange(newEntries: OutfitHistoryEntry[]): void {
    state = newEntries;
    lsSet(historyKey(getSessionId()), newEntries);
    listeners.forEach((listener) => listener(newEntries));
  }

  return {
    history,
    recordOutfit,
    removeOutfitRecord,
    getRecencyPenalty,
    clearHistory,
    removeHistoryEntriesWithItem,
  };
}
