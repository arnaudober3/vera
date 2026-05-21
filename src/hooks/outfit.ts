import { useState, useEffect } from "react";
import type { Outfit } from "../models/outfit.ts";
import { useCloset } from "./closet.ts";
import { getSessionId } from "../storage/session.ts";
import {
  isWashable,
  type ClothingItem,
} from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import { differenceCiede2000 } from "culori";
import { lsGet, lsSet, outfitKey } from "../storage/local-store.ts";
import { useOutfitHistory } from "./outfit-history.ts";

// Private singleton state reused through the app
let state: Outfit | null = null;
let isInitialized = false;
const listeners = new Set<(s: Outfit | null) => void>();

const scoreColors = ({ a, b }: { a: Color; b: Color }): number | null => {
  if (!a || !b) {
    return null;
  }

  // Simple scoring: higher score for closer colours
  const distance = differenceCiede2000()(a, b);
  if (!distance) {
    throw new Error(
      "An error occurred while calculating the outfit color score.",
    );
  }

  // Convert distance to score (0-1, where 1 is closest). Delta E of 100 is quite different, 0 is identical
  return 1 - Math.min(distance / 100, 1);
};
const findBestMatch = ({
  candidates,
  anchor,
}: {
  candidates: ClothingItem[];
  anchor: ClothingItem;
}): ClothingItem => {
  let bestItem: Partial<ClothingItem> = {};
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = scoreColors({
      a: anchor.color,
      b: candidate.color,
    });

    if (score && score > bestScore) {
      bestScore = score;
      bestItem = candidate;
    }
  }

  // bestItem is now fully defined so we can cast it safely
  return bestItem as ClothingItem;
};

const initialize = (): void => {
  if (isInitialized) {
    return;
  }

  const sessionId = getSessionId();
  state = lsGet<Outfit | null>(outfitKey(sessionId), null);

  isInitialized = true;
};
initialize();

export const useOutfit = () => {
  // Subscribe to the singleton state
  const [outfit, setOutfit] = useState(state);
  const { items } = useCloset();
  const { getRecencyPenalty } = useOutfitHistory();

  useEffect(() => {
    const listener = (s: Outfit | null) => setOutfit(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const generateOutfit = async (): Promise<Outfit | null> => {
    const availableItems = items.filter((i) => i.isClean || !isWashable(i.category));
    if (!availableItems || availableItems.length === 0) {
      return null;
    }

    const availableTops = availableItems.filter((i) => i.category === "top");
    const availableBottoms = availableItems.filter((i) => i.category === "bottom");

    if (availableTops.length === 0 || availableBottoms.length === 0) {
      return null;
    }

    const maxAttempts = availableItems.length;
    let bestOutfit: Outfit | null = null;
    let highestScore = -1;

    // Try to find the best scoring top + bottom duo, but ensure it's different if possible
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const pivots = [...availableTops, ...availableBottoms];
      const pivot = pivots[Math.floor(Math.random() * pivots.length)];

      const currentOutfit: Outfit = {
        top:
          pivot.category === "top"
            ? pivot
            : findBestMatch({ candidates: availableTops, anchor: pivot }),
        bottom:
          pivot.category === "bottom"
            ? pivot
            : findBestMatch({ candidates: availableBottoms, anchor: pivot }),
      };

      // If we have an existing outfit, skip this candidate if it's the exact same duo
      if (
        outfit &&
        currentOutfit.top.id === outfit.top.id &&
        currentOutfit.bottom.id === outfit.bottom.id
      ) {
        continue;
      }

      const pairScore = scoreColors({
        a: currentOutfit.top.color,
        b: currentOutfit.bottom.color,
      });
      const baseScore = pairScore ?? 0;
      const recencyPenalty = getRecencyPenalty([
        currentOutfit.top.id,
        currentOutfit.bottom.id,
      ]);
      const adjustedScore = baseScore * recencyPenalty;

      if (adjustedScore > highestScore) {
        highestScore = adjustedScore;
        bestOutfit = currentOutfit;
      }
    }

    const finalOutfit = bestOutfit ?? state;
    await emitChange(finalOutfit);
    return finalOutfit;
  };

  const addItemToOutfit = async (item: ClothingItem): Promise<void> => {
    if (!state) return;
    const next: Outfit = { ...state };
    if (item.category === "outerwear") {
      next.outerwear = item;
    } else if (item.category === "shoes") {
      next.shoes = item;
    } else if (item.category === "accessories") {
      const existing = next.accessories ?? [];
      if (existing.some((a) => a.id === item.id)) return;
      next.accessories = [...existing, item];
    } else {
      return;
    }
    await emitChange(next);
  };

  const removeItemFromOutfit = async (itemId: string): Promise<void> => {
    if (!state) return;
    const next: Outfit = { ...state };
    if (next.outerwear?.id === itemId) delete next.outerwear;
    if (next.shoes?.id === itemId) delete next.shoes;
    if (next.accessories) {
      next.accessories = next.accessories.filter((a) => a.id !== itemId);
      if (next.accessories.length === 0) delete next.accessories;
    }
    await emitChange(next);
  };

  const clearOutfit = async (): Promise<void> => await emitChange(null);

  const canGenerateOutfit = (): boolean => {
    const availableItems = items.filter((i) => i.isClean || !isWashable(i.category));
    const availableTops = availableItems.filter((i) => i.category === "top");
    const availableBottoms = availableItems.filter((i) => i.category === "bottom");

    if (availableTops.length === 0 || availableBottoms.length === 0) {
      return false;
    }
    if (!outfit) {
      // If there is no current outfit yet, regenerating/generating is possible.
      return true;
    }

    // Only if there is another available outfit.
    return availableTops.some((topItem) =>
      availableBottoms.some(
        (bottomItem) =>
          topItem.id !== outfit.top.id || bottomItem.id !== outfit.bottom.id,
      ),
    );
  };

  async function emitChange(newOutfit: Outfit | null): Promise<void> {
    state = newOutfit;
    lsSet(outfitKey(getSessionId()), newOutfit);
    listeners.forEach((listener) => listener(newOutfit));
  }

  return {
    outfit,
    generateOutfit,
    clearOutfit,
    canGenerateOutfit,
    addItemToOutfit,
    removeItemFromOutfit,
  };
};
