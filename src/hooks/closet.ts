import { useState, useEffect } from "react";
import type {
  ClothingItem,
  CreateClothingItem,
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
};
initialize();

export function useCloset() {
  // We "subscribe" to the singleton state
  const [items, setItems] = useState(state);

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
      imageId: itemId,
    };

    await emitChange([newItem, ...state]);

    return newItem;
  };
  const removeClothingItem = async (id: string): Promise<string> => {
    await emitChange(state.filter((i) => i.id !== id));
    return id;
  };
  const renameClothingItem = async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return; // name is required — ignore empty input
    await emitChange(state.map((i) => (i.id === id ? { ...i, name: trimmed } : i)));
  };
  const isUploadLimitReached = (): boolean => {
    return state.length >= ITEMS_UPLOAD_LIMIT;
  };

  async function emitChange(newItems: ClothingItem[]): Promise<void> {
    state = newItems;
    lsSet(closetKey(getSessionId()), newItems);
    listeners.forEach((listener) => listener(newItems));
  }

  return {
    items,
    addClothingItem,
    removeClothingItem,
    renameClothingItem,
    isUploadLimitReached,
  };
}
