import { useState, useEffect } from "react";
import type { Outfit } from "../models/outfit.ts";
import { useCloset } from "./closet.ts";
import { getSessionId } from "../storage/session.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import { fitsOccasion, type Occasion } from "../models/occasion.ts";
import { getSelectedOccasion } from "./occasion.ts";
import { differenceCiede2000 } from "culori";
import { lsGet, lsSet, outfitKey } from "../storage/local-store.ts";

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

  useEffect(() => {
    const listener = (s: Outfit | null) => setOutfit(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Pick the best colour match for a fixed anchor, preferring a partner
  // different from the current one whenever an alternative exists.
  const pickPartner = (
    anchor: ClothingItem,
    candidates: ClothingItem[],
    currentPartnerId: string | undefined,
  ): ClothingItem => {
    const hasAlternative = candidates.some((c) => c.id !== currentPartnerId);
    let best: ClothingItem | null = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      if (hasAlternative && candidate.id === currentPartnerId) continue;
      // Candidates are already occasion-filtered by the caller, so colour is
      // the only thing left to rank on.
      const score = scoreColors({ a: anchor.color, b: candidate.color }) ?? 0;
      if (score > bestScore) {
        bestScore = score;
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

      // Both pools are already occasion-filtered, so occasion no longer scores.
      const pairScore =
        scoreColors({ a: candidate.top.color, b: candidate.bottom.color }) ?? 0;

      if (pairScore > highestScore) {
        highestScore = pairScore;
        bestDuo = candidate;
      }
    }

    return bestDuo;
  };

  const generateOutfit = async (pinnedId?: string): Promise<Outfit | null> => {
    // Clearing the current outfit when nothing can be generated keeps the UI in
    // sync: e.g. switching to an occasion the closet can't satisfy must drop the
    // stale outfit so the empty state shows, instead of leaving it on screen.
    const clearAndReturn = async (): Promise<null> => {
      await emitChange(null);
      return null;
    };

    if (items.length === 0) {
      return clearAndReturn();
    }

    const availableTops = items.filter((i) => i.category === "top");
    const availableBottoms = items.filter((i) => i.category === "bottom");

    if (availableTops.length === 0 || availableBottoms.length === 0) {
      return clearAndReturn();
    }

    // Resolve the effective pin: an explicit id wins, otherwise reuse the persisted
    // one. Drop the pin silently if the item is no longer in the closet.
    const effectivePinnedId = pinnedId ?? state?.pinnedItemId;
    const pinned = effectivePinnedId
      ? items.find((i) => i.id === effectivePinnedId)
      : undefined;

    const occasion = getSelectedOccasion();

    // Hard occasion filter: only clothes that suit the selected occasion are
    // eligible. A pinned anchor is kept as-is (explicit user choice), but its
    // partner — and any unpinned duo — must fit the occasion.
    const occasionTops = availableTops.filter((t) => fitsOccasion(t, occasion));
    const occasionBottoms = availableBottoms.filter((b) =>
      fitsOccasion(b, occasion),
    );

    let duo: { top: ClothingItem; bottom: ClothingItem } | null;
    if (pinned?.category === "top") {
      // No occasion-appropriate bottom to pair with the pinned top.
      if (occasionBottoms.length === 0) return clearAndReturn();
      duo = {
        top: pinned,
        bottom: pickPartner(pinned, occasionBottoms, outfit?.bottom?.id),
      };
    } else if (pinned?.category === "bottom") {
      // No occasion-appropriate top to pair with the pinned bottom.
      if (occasionTops.length === 0) return clearAndReturn();
      duo = {
        top: pickPartner(pinned, occasionTops, outfit?.top?.id),
        bottom: pinned,
      };
    } else {
      // No pin (or a pinned add-on): need a full occasion-appropriate duo.
      if (occasionTops.length === 0 || occasionBottoms.length === 0)
        return clearAndReturn();
      duo = pickBestDuo(occasionTops, occasionBottoms);
    }

    // Fall back to the current top/bottom only if they still fit the occasion,
    // so regeneration never resurrects an off-occasion outfit.
    if (
      !duo &&
      state &&
      fitsOccasion(state.top, occasion) &&
      fitsOccasion(state.bottom, occasion)
    ) {
      duo = { top: state.top, bottom: state.bottom };
    }
    if (!duo) {
      return clearAndReturn();
    }

    const finalOutfit: Outfit = { top: duo.top, bottom: duo.bottom };

    // Re-attach the pinned add-on into its slot so the lock survives regeneration.
    if (pinned && pinned.category !== "top" && pinned.category !== "bottom") {
      if (pinned.category === "outerwear") finalOutfit.outerwear = pinned;
      else if (pinned.category === "shoes") finalOutfit.shoes = pinned;
      else if (pinned.category === "accessories")
        finalOutfit.accessories = [pinned];
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

  // Build an ordered list of distinct candidate outfits for the deck (Today page).
  // Reuses the same colour scoring as generateOutfit, but is deterministic and
  // exhaustive (closets are capped at ~10 items, so the top × bottom product is
  // tiny). The deck is local to the page: this never touches the singleton state
  // nor calls emitChange.
  const buildDeck = (
    filter: Occasion,
    deckSize = 10,
    pinnedId?: string,
  ): Outfit[] => {
    // "everyday" fits every item, so this naturally yields the unfiltered deck.
    const matchesFilter = (i: ClothingItem): boolean => fitsOccasion(i, filter);

    // Resolve the active pin. Dropped silently if the item is no longer in the
    // closet — mirrors generateOutfit.
    const pinned = pinnedId ? items.find((i) => i.id === pinnedId) : undefined;

    const tops = items.filter((i) => i.category === "top" && matchesFilter(i));
    const bottoms = items.filter(
      (i) => i.category === "bottom" && matchesFilter(i),
    );

    const duoScore = (top: ClothingItem, bottom: ClothingItem): number =>
      scoreColors({ a: top.color, b: bottom.color }) ?? 0;

    let ordered: { top: ClothingItem; bottom: ClothingItem }[] = [];

    if (pinned?.category === "top") {
      // Lock the pinned top into every card; the deck varies only the bottom.
      // The pinned anchor is kept as-is even if off-occasion (explicit choice),
      // but its partner must fit the filter.
      if (bottoms.length === 0) return [];
      ordered = bottoms
        .map((bottom) => ({ top: pinned, bottom, score: duoScore(pinned, bottom) }))
        .sort((a, b) => b.score - a.score)
        .map(({ top, bottom }) => ({ top, bottom }));
    } else if (pinned?.category === "bottom") {
      // Symmetric: lock the pinned bottom, vary the top.
      if (tops.length === 0) return [];
      ordered = tops
        .map((top) => ({ top, bottom: pinned, score: duoScore(top, pinned) }))
        .sort((a, b) => b.score - a.score)
        .map(({ top, bottom }) => ({ top, bottom }));
    } else {
      // No top/bottom pin: score every distinct duo, rank by score descending.
      if (tops.length === 0 || bottoms.length === 0) return [];
      const scored = [] as {
        top: ClothingItem;
        bottom: ClothingItem;
        score: number;
      }[];
      for (const top of tops) {
        for (const bottom of bottoms) {
          scored.push({ top, bottom, score: duoScore(top, bottom) });
        }
      }
      scored.sort((a, b) => b.score - a.score);

      // Greedy spread: avoid the same top anchoring two consecutive cards, so the
      // deck feels varied. Skipped duos are appended at the end to fill the deck.
      const head: typeof scored = [];
      const deferred: typeof scored = [];
      for (const duo of scored) {
        const prev = head[head.length - 1];
        if (prev && prev.top.id === duo.top.id) deferred.push(duo);
        else head.push(duo);
      }
      head.push(...deferred);
      ordered = head.map(({ top, bottom }) => ({ top, bottom }));
    }

    return ordered.slice(0, deckSize).map(({ top, bottom }) => {
      const out: Outfit = { top, bottom };
      // A pinned add-on (outerwear/shoes/accessory) locks into its slot on every
      // card. Layers are never suggested on their own — the user adds one from
      // the card's accessory shelf.
      if (pinned && pinned.category !== "top" && pinned.category !== "bottom") {
        if (pinned.category === "outerwear") out.outerwear = pinned;
        else if (pinned.category === "shoes") out.shoes = pinned;
        else if (pinned.category === "accessories") out.accessories = [pinned];
      }
      return out;
    });
  };

  const clearOutfit = async (): Promise<void> => await emitChange(null);

  const canGenerateOutfit = (): boolean => {
    // Mirror generateOutfit's hard occasion filter so the regenerate control
    // reflects what can actually be produced for the selected occasion.
    const occasion = getSelectedOccasion();
    const availableTops = items.filter(
      (i) => i.category === "top" && fitsOccasion(i, occasion),
    );
    const availableBottoms = items.filter(
      (i) => i.category === "bottom" && fitsOccasion(i, occasion),
    );

    if (availableTops.length === 0 || availableBottoms.length === 0) {
      return false;
    }
    if (!outfit) {
      // If there is no current outfit yet, regenerating/generating is possible.
      return true;
    }

    const pinned = outfit.pinnedItemId
      ? items.find((i) => i.id === outfit.pinnedItemId)
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
    buildDeck,
    clearOutfit,
    canGenerateOutfit,
    addItemToOutfit,
    removeItemFromOutfit,
    pinItem,
    unpinItem,
  };
};
