import { useState, useEffect } from "react";
import type { Outfit } from "../models/outfit.ts";
import { useCloset } from "./closet.ts";
import { getSessionId } from "../storage/session.ts";
import {
  isWashable,
  type ClothingItem,
} from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import { getSeasonScore, type Season } from "../models/season.ts";
import { getOccasionScore, type Occasion } from "../models/occasion.ts";
import { getCurrentSeason } from "../services/season.ts";
import {
  getCachedWeather,
  needsOuterwear,
  temperatureToSeason,
} from "../services/weather.ts";
import { getSelectedOccasion } from "./occasion.ts";
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

  // Pick the best recency-adjusted colour match for a fixed anchor, preferring a
  // partner different from the current one whenever an alternative exists.
  const pickPartner = (
    anchor: ClothingItem,
    candidates: ClothingItem[],
    currentPartnerId: string | undefined,
    effectiveSeason: Season,
    occasion: Occasion,
  ): ClothingItem => {
    const hasAlternative = candidates.some((c) => c.id !== currentPartnerId);
    let best: ClothingItem | null = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      if (hasAlternative && candidate.id === currentPartnerId) continue;
      const baseScore = scoreColors({ a: anchor.color, b: candidate.color }) ?? 0;
      // Only the candidate's season/occasion is scored — never penalise the
      // pinned anchor for being out of season or off the occasion.
      const adjustedScore =
        baseScore *
        getRecencyPenalty([anchor.id, candidate.id]) *
        getSeasonScore(candidate, effectiveSeason) *
        getOccasionScore(candidate, occasion);
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        best = candidate;
      }
    }
    return best ?? candidates[0];
  };

  // Existing strategy: try random pivots to find the best scoring top + bottom
  // duo, skipping the exact current duo so regeneration produces something new.
  const pickBestDuo = (
    availableTops: ClothingItem[],
    availableBottoms: ClothingItem[],
    effectiveSeason: Season,
    occasion: Occasion,
  ): { top: ClothingItem; bottom: ClothingItem } | null => {
    const maxAttempts = availableTops.length + availableBottoms.length;
    let bestDuo: { top: ClothingItem; bottom: ClothingItem } | null = null;
    let highestScore = -1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const pivots = [...availableTops, ...availableBottoms];
      const pivot = pivots[Math.floor(Math.random() * pivots.length)];

      const candidate = {
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
        candidate.top.id === outfit.top.id &&
        candidate.bottom.id === outfit.bottom.id
      ) {
        continue;
      }

      const pairScore = scoreColors({
        a: candidate.top.color,
        b: candidate.bottom.color,
      });
      const seasonScore =
        getSeasonScore(candidate.top, effectiveSeason) *
        getSeasonScore(candidate.bottom, effectiveSeason);
      const occasionScore =
        getOccasionScore(candidate.top, occasion) *
        getOccasionScore(candidate.bottom, occasion);
      const adjustedScore =
        (pairScore ?? 0) *
        getRecencyPenalty([candidate.top.id, candidate.bottom.id]) *
        seasonScore *
        occasionScore;

      if (adjustedScore > highestScore) {
        highestScore = adjustedScore;
        bestDuo = candidate;
      }
    }

    return bestDuo;
  };

  const generateOutfit = async (pinnedId?: string): Promise<Outfit | null> => {
    const availableItems = items.filter((i) => i.isClean || !isWashable(i.category));
    if (!availableItems || availableItems.length === 0) {
      return null;
    }

    const availableTops = availableItems.filter((i) => i.category === "top");
    const availableBottoms = availableItems.filter((i) => i.category === "bottom");

    if (availableTops.length === 0 || availableBottoms.length === 0) {
      return null;
    }

    // Resolve the effective pin: an explicit id wins, otherwise reuse the persisted
    // one. Drop the pin silently if the item is no longer available (deleted/dirty).
    const effectivePinnedId = pinnedId ?? state?.pinnedItemId;
    const pinned = effectivePinnedId
      ? availableItems.find((i) => i.id === effectivePinnedId)
      : undefined;

    // Weather refines the season when available: a temperature-derived season
    // flows through the existing season scoring. Falls back to the calendar.
    const weather = getCachedWeather();
    const effectiveSeason = weather
      ? temperatureToSeason(weather.temperatureC)
      : getCurrentSeason();
    const occasion = getSelectedOccasion();

    let duo: { top: ClothingItem; bottom: ClothingItem } | null;
    if (pinned?.category === "top") {
      duo = {
        top: pinned,
        bottom: pickPartner(
          pinned,
          availableBottoms,
          outfit?.bottom?.id,
          effectiveSeason,
          occasion,
        ),
      };
    } else if (pinned?.category === "bottom") {
      duo = {
        top: pickPartner(
          pinned,
          availableTops,
          outfit?.top?.id,
          effectiveSeason,
          occasion,
        ),
        bottom: pinned,
      };
    } else {
      duo = pickBestDuo(availableTops, availableBottoms, effectiveSeason, occasion);
    }

    // Fall back to the current top/bottom if no new duo could be formed.
    if (!duo && state) {
      duo = { top: state.top, bottom: state.bottom };
    }
    if (!duo) {
      return null;
    }

    const finalOutfit: Outfit = { top: duo.top, bottom: duo.bottom };

    // Re-attach the pinned add-on into its slot so the lock survives regeneration.
    if (pinned && pinned.category !== "top" && pinned.category !== "bottom") {
      if (pinned.category === "outerwear") finalOutfit.outerwear = pinned;
      else if (pinned.category === "shoes") finalOutfit.shoes = pinned;
      else if (pinned.category === "accessories")
        finalOutfit.accessories = [pinned];
    }

    // On a cold or rainy day, suggest a layer: attach the best colour-matching
    // outerwear if the user hasn't already pinned/added one.
    if (weather && needsOuterwear(weather) && !finalOutfit.outerwear) {
      const availableOuterwear = availableItems.filter(
        (i) => i.category === "outerwear",
      );
      if (availableOuterwear.length > 0) {
        finalOutfit.outerwear = findBestMatch({
          candidates: availableOuterwear,
          anchor: finalOutfit.top,
        });
      }
    }

    if (pinned) {
      finalOutfit.pinnedItemId = pinned.id;
    }

    await emitChange(finalOutfit);
    return finalOutfit;
  };

  // Lock an item into today's outfit and rebuild the rest around it.
  const pinItem = async (item: ClothingItem): Promise<Outfit | null> =>
    generateOutfit(item.id);

  // Release the lock without regenerating the current outfit.
  const unpinItem = async (): Promise<void> => {
    if (!state?.pinnedItemId) return;
    const next: Outfit = { ...state };
    delete next.pinnedItemId;
    await emitChange(next);
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
    // Removing the pinned item also releases the lock so it isn't re-attached.
    if (next.pinnedItemId === itemId) delete next.pinnedItemId;
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

    const pinned = outfit.pinnedItemId
      ? availableItems.find((i) => i.id === outfit.pinnedItemId)
      : undefined;

    // With a pinned slot, regeneration only varies the complementary slot.
    if (pinned?.category === "top") {
      return availableBottoms.some((b) => b.id !== outfit.bottom.id);
    }
    if (pinned?.category === "bottom") {
      return availableTops.some((t) => t.id !== outfit.top.id);
    }

    // No pin (or a pinned add-on): possible if another top/bottom duo exists.
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
    pinItem,
    unpinItem,
  };
};
