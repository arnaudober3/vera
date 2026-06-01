import type {
  ClothingItem,
  ClothingItemSubCategory,
} from "./clothing-item.ts";

export type Occasion = "casual" | "smart" | "formal" | "sport";

export const ALL_OCCASIONS: Occasion[] = ["casual", "smart", "formal", "sport"];

// Soft-preference multipliers folded into the outfit score, mirroring season
// scoring. The 0.4 floor keeps occasion influential without hard-excluding an
// item, so generation never gets stuck when the closet is sparse.
export const IN_OCCASION_SCORE = 1.0;
export const OUT_OF_OCCASION_SCORE = 0.4;

// Occasions each subcategory is appropriate for. Mirrors subCategorySeasons:
// any subcategory not listed here — and items without a subCategory — are
// treated as all-occasion (neutral) via getItemOccasions below.
export const subCategoryOccasions: Partial<
  Record<ClothingItemSubCategory, Occasion[]>
> = {
  // Tops
  "t-shirt": ["casual", "sport"],
  shirt: ["smart", "formal", "casual"],
  sweater: ["casual", "smart"],
  hoodie: ["casual", "sport"],

  // Bottoms
  jeans: ["casual"],
  joggers: ["sport", "casual"],
  pants: ["smart", "formal", "casual"],
  shorts: ["casual", "sport"],
  skirt: ["casual", "smart", "formal"],

  // Shoes
  sneakers: ["casual", "sport"],
  boots: ["casual", "smart"],
  sandals: ["casual"],
  dress_shoes: ["formal", "smart"],

  // Outerwear
  jacket: ["casual", "smart"],
  coat: ["smart", "formal", "casual"],
};

// Occasions an item suits. Unmapped or undefined subCategory => all-occasion.
export const getItemOccasions = (item: ClothingItem): Occasion[] =>
  (item.subCategory && subCategoryOccasions[item.subCategory]) ?? ALL_OCCASIONS;

// Soft multiplier: in-occasion => 1.0, out-of-occasion => 0.4.
export const getOccasionScore = (
  item: ClothingItem,
  occasion: Occasion,
): number =>
  getItemOccasions(item).includes(occasion)
    ? IN_OCCASION_SCORE
    : OUT_OF_OCCASION_SCORE;
