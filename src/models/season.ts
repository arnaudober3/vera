import type {
  ClothingItem,
  ClothingItemSubCategory,
} from "./clothing-item.ts";

export type Season = "spring" | "summer" | "fall" | "winter";

export const ALL_SEASONS: Season[] = ["spring", "summer", "fall", "winter"];

// Soft-preference multipliers folded into the outfit score. The 0.4 floor keeps
// season influential without dominating: a great colour match can still win over
// a season mismatch, but in-season pieces are clearly preferred.
export const IN_SEASON_SCORE = 1.0;
export const OUT_OF_SEASON_SCORE = 0.4;

// Warmth-based seasonality for the subcategories the algorithm scores (tops and
// bottoms). Any subcategory not listed here — and items without a subCategory —
// are treated as all-season (neutral) via getItemSeasons below.
export const subCategorySeasons: Partial<
  Record<ClothingItemSubCategory, Season[]>
> = {
  // Tops
  "t-shirt": ["spring", "summer", "fall"],
  sweater: ["spring", "fall", "winter"],
  hoodie: ["spring", "fall", "winter"],

  // Bottoms
  shorts: ["spring", "summer"],
  skirt: ["spring", "summer", "fall"],
};

// Seasons an item is suitable for. Unmapped or undefined subCategory => all-season.
export const getItemSeasons = (item: ClothingItem): Season[] =>
  (item.subCategory && subCategorySeasons[item.subCategory]) ?? ALL_SEASONS;

// Soft multiplier: in-season => 1.0, out-of-season => 0.4.
export const getSeasonScore = (
  item: ClothingItem,
  currentSeason: Season,
): number =>
  getItemSeasons(item).includes(currentSeason)
    ? IN_SEASON_SCORE
    : OUT_OF_SEASON_SCORE;
