import type { Outfit } from "../models/outfit.ts";
import { useCloset } from "./closet.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import { fitsOccasion, type Occasion } from "../models/occasion.ts";
import { matchesPaletteColor } from "../utils/color.ts";
import { differenceCiede2000 } from "culori";

const scoreColors = ({ a, b }: { a: Color; b: Color }): number | null => {
  if (!a || !b) {
    return null;
  }

  // Simple scoring: higher score for closer colours. A distance of 0 (identical
  // colours) is valid and must not be treated as a failed calculation.
  const distance = differenceCiede2000()(a, b);
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    throw new Error(
      "An error occurred while calculating the outfit color score.",
    );
  }

  // Convert distance to score (0-1, where 1 is closest). Delta E of 100 is quite different, 0 is identical
  return 1 - Math.min(distance / 100, 1);
};

// Whether an item's real colour is close enough to one of the picked palette
// swatches (see matchesPaletteColor). True with no colours picked, so that
// case never constrains anything.
const matchesAnyColor = (item: ClothingItem, colors: string[]): boolean =>
  colors.length === 0 || colors.some((name) => matchesPaletteColor(item.color, name));

export const useOutfit = () => {
  const { items } = useCloset();

  // Build an ordered list of distinct candidate outfits for the deck (Today page):
  // every eligible top × bottom duo, ranked by colour match. Deterministic and
  // exhaustive — closets are capped at ~10 items, so the product is tiny.
  const buildDeck = (
    filter: Occasion,
    colors: string[] = [],
    deckSize = 10,
  ): Outfit[] => {
    const tops = items.filter(
      (i) => i.category === "top" && fitsOccasion(i, filter),
    );
    const bottoms = items.filter(
      (i) => i.category === "bottom" && fitsOccasion(i, filter),
    );
    if (tops.length === 0 || bottoms.length === 0) return [];

    const duoScore = (top: ClothingItem, bottom: ClothingItem): number =>
      scoreColors({ a: top.color, b: bottom.color }) ?? 0;

    // Colour requirement scales with how many are picked: one colour just has
    // to show up somewhere in the duo (the other piece is free); two colours
    // require every piece to be one of the two — never neither.
    const satisfiesColors = (top: ClothingItem, bottom: ClothingItem): boolean => {
      if (colors.length === 0) return true;
      if (colors.length === 1)
        return matchesAnyColor(top, colors) || matchesAnyColor(bottom, colors);
      return matchesAnyColor(top, colors) && matchesAnyColor(bottom, colors);
    };

    const scored: { top: ClothingItem; bottom: ClothingItem; score: number }[] = [];
    for (const top of tops) {
      for (const bottom of bottoms) {
        if (!satisfiesColors(top, bottom)) continue;
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

    return head.slice(0, deckSize).map(({ top, bottom }) => ({ top, bottom }));
  };

  return { buildDeck };
};
