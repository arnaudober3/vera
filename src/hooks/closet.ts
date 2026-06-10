import { useState, useEffect } from "react";
import { useLookbook } from "./lookbook.ts";
import { useOutfitHistory } from "./outfit-history.ts";
import {
  isWashable,
  type ClothingItem,
  type CreateClothingItem,
} from "../models/clothing-item";
import { closetKey, lsGet, lsSet } from "../storage/local-store.ts";
import { getSessionId } from "../storage/session.ts";

const ITEMS_UPLOAD_LIMIT = 10;

// Private singleton state reused through the app
let state: ClothingItem[] = [];
let isInitialized = false;
const listeners = new Set<(items: ClothingItem[]) => void>();

const initialize = () => {
  if (isInitialized) {
    return;
  }

  const sessionId = getSessionId();
  state = lsGet<ClothingItem[]>(closetKey(sessionId), []);

  isInitialized = true;

  // Cleanup: ensure non-washable items are marked as clean
  const nonWashableDirtyItems = state.filter(
    (item) => !isWashable(item.category) && !item.isClean,
  );
  if (nonWashableDirtyItems.length > 0) {
    state = state.map((item) =>
      !isWashable(item.category) && !item.isClean
        ? { ...item, isClean: true }
        : item,
    );
    lsSet(closetKey(sessionId), state);
  }
};
initialize();

export function useCloset() {
  // We "subscribe" to the singleton state
  const [items, setItems] = useState(state);

  const { removeLookbookEntriesWithItem } = useLookbook();
  const { removeHistoryEntriesWithItem } = useOutfitHistory();

  useEffect(() => {
    const listener = (newItems: ClothingItem[]) => setItems(newItems);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addClothingItem = async (
    item: CreateClothingItem,
  ): Promise<ClothingItem> => {
    const sessionId = getSessionId();
    const itemId = `${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newItem: ClothingItem = {
      id: itemId,
      name: item.name,
      category: item.category,
      subCategory: item.subCategory,
      color: item.color,
      isClean: true,
      imageId: itemId,
    };

    emitChange([newItem, ...state]);

    return newItem;
  };
  const removeClothingItem = async (id: string): Promise<string> => {
    await removeLookbookEntriesWithItem(id);
    await removeHistoryEntriesWithItem(id);
    emitChange(state.filter((i) => i.id !== id));
    return id;
  };
  const renameClothingItem = async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return; // name is required — ignore empty input
    emitChange(state.map((i) => (i.id === id ? { ...i, name: trimmed } : i)));
  };
  const markLaundryDone = async (): Promise<void> => {
    emitChange(state.map((i) => ({ ...i, isClean: true })));
  };
  const markWorn = async (item: ClothingItem): Promise<ClothingItem> => {
    if (!isWashable(item.category)) {
      return item;
    }

    emitChange(
      state.map((i) => (item.id === i.id ? { ...i, isClean: false } : i)),
    );

    return { ...item, isClean: false };
  };
  // Inverse of markWorn: returns a single item to the clean pool. Used to undo a
  // "wear" that was committed by mistake. No-op for non-washable items (which are
  // always clean), mirroring markWorn's guard.
  const markClean = async (item: ClothingItem): Promise<ClothingItem> => {
    if (!isWashable(item.category)) {
      return item;
    }

    emitChange(
      state.map((i) => (item.id === i.id ? { ...i, isClean: true } : i)),
    );

    return { ...item, isClean: true };
  };
  const isItemClean = (id: string): boolean => {
    const item = state.find((i) => i.id === id);
    if (!item) return false;
    return !isWashable(item.category) || item.isClean;
  };
  const areAllItemsClean = (): boolean => {
    return state.every((i) => !isWashable(i.category) || i.isClean);
  };
  const isUploadLimitReached = (): boolean => {
    return state.length >= ITEMS_UPLOAD_LIMIT;
  };

  function emitChange(newItems: ClothingItem[]): void {
    state = newItems;
    lsSet(closetKey(getSessionId()), newItems);
    listeners.forEach((listener) => listener(newItems));
  }

  return {
    items,
    addClothingItem,
    removeClothingItem,
    renameClothingItem,
    markLaundryDone,
    markWorn,
    markClean,
    isItemClean,
    areAllItemsClean,
    isUploadLimitReached,
  };
}
