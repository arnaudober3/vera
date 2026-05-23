import { useState, useEffect } from "react";
import type { FavouriteOutfit } from "../models/favourite-outfit.ts";
import { getSessionId } from "../storage/session.ts";
import { favouritesKey, lsGet, lsSet } from "../storage/local-store.ts";

type StoredFavourite = Omit<FavouriteOutfit, "savedAt" | "lastWornAt"> & {
  savedAt: string;
  lastWornAt?: string;
};

// Private singleton state reused through the app
let state: FavouriteOutfit[] = [];
let isInitialized = false;
const listeners = new Set<(entries: FavouriteOutfit[]) => void>();

const initialize = (): void => {
  if (isInitialized) {
    return;
  }

  const sessionId = getSessionId();
  const raw = lsGet<StoredFavourite[]>(favouritesKey(sessionId), []);
  state = raw.map((entry) => ({
    ...entry,
    savedAt: new Date(entry.savedAt),
    lastWornAt: entry.lastWornAt ? new Date(entry.lastWornAt) : undefined,
  }));

  isInitialized = true;
};
initialize();

export function useFavouriteOutfits() {
  const [favourites, setFavourites] = useState(state);

  useEffect(() => {
    const listener = (entries: FavouriteOutfit[]) => setFavourites(entries);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const isFavourite = (
    topId: string,
    bottomId: string,
    outerwearId?: string,
    shoesId?: string,
    accessoriesIds?: string[],
  ): boolean => {
    return state.some(
      (f) =>
        f.topId === topId &&
        f.bottomId === bottomId &&
        f.outerwearId === outerwearId &&
        f.shoesId === shoesId &&
        JSON.stringify([...(f.accessoriesIds || [])].sort()) ===
          JSON.stringify([...(accessoriesIds || [])].sort()),
    );
  };

  const addFavourite = async (
    topId: string,
    bottomId: string,
    outerwearId?: string,
    shoesId?: string,
    accessoriesIds?: string[],
    name?: string,
  ): Promise<void> => {
    const sortedAccessories = accessoriesIds ? [...accessoriesIds].sort() : undefined;

    if (isFavourite(topId, bottomId, outerwearId, shoesId, sortedAccessories)) {
      return;
    }

    const sessionId = getSessionId();
    const entryId = `${sessionId}_${Date.now()}`;

    const newEntry: FavouriteOutfit = {
      id: entryId,
      name,
      topId,
      bottomId,
      outerwearId,
      shoesId,
      accessoriesIds: sortedAccessories,
      savedAt: new Date(),
      sessionId,
      wornCount: 0,
    };

    emitChange([newEntry, ...state]);
  };

  const removeFavourite = async (id: string): Promise<void> => {
    emitChange(state.filter((f) => f.id !== id));
  };

  const removeFavouriteByOutfit = async (
    topId: string,
    bottomId: string,
    outerwearId?: string,
    shoesId?: string,
    accessoriesIds?: string[],
  ): Promise<void> => {
    const match = state.find(
      (f) =>
        f.topId === topId &&
        f.bottomId === bottomId &&
        f.outerwearId === outerwearId &&
        f.shoesId === shoesId &&
        JSON.stringify([...(f.accessoriesIds || [])].sort()) ===
          JSON.stringify([...(accessoriesIds || [])].sort()),
    );
    if (match) {
      await removeFavourite(match.id);
    }
  };

  const removeFavouritesWithItem = async (itemId: string): Promise<void> => {
    const newState = state.filter(
      (f) =>
        f.topId !== itemId &&
        f.bottomId !== itemId &&
        f.outerwearId !== itemId &&
        f.shoesId !== itemId &&
        !f.accessoriesIds?.includes(itemId),
    );
    if (newState.length !== state.length) {
      emitChange(newState);
    }
  };

  const renameFavourite = async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    const next = state.map((f) =>
      f.id === id ? { ...f, name: trimmed || undefined } : f,
    );
    emitChange(next);
  };

  const recordWear = async (id: string): Promise<void> => {
    const next = state.map((f) =>
      f.id === id
        ? { ...f, wornCount: (f.wornCount ?? 0) + 1, lastWornAt: new Date() }
        : f,
    );
    emitChange(next);
  };

  function emitChange(newEntries: FavouriteOutfit[]): void {
    state = newEntries;
    lsSet(favouritesKey(getSessionId()), newEntries);
    listeners.forEach((listener) => listener(newEntries));
  }

  return {
    favourites,
    addFavourite,
    removeFavourite,
    removeFavouriteByOutfit,
    removeFavouritesWithItem,
    renameFavourite,
    recordWear,
    isFavourite,
  };
}
