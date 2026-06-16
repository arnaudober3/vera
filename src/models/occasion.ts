import type {
  ClothingItem,
  ClothingItemSubCategory,
} from "./clothing-item.ts";

export type Occasion = "everyday" | "work" | "gym" | "dinner" | "date-night";

// Design order — "everyday" leads as the relaxed, fits-everything default.
export const ALL_OCCASIONS: Occasion[] = [
  "everyday",
  "work",
  "gym",
  "dinner",
  "date-night",
];

// Occasions each subcategory is appropriate for. "everyday" is neutral and
// handled in fitsOccasion (it fits everything), so it never needs listing here.
// Any subcategory not listed — and items without a subCategory — are treated as
// all-occasion (neutral) via getItemOccasions below.
export const subCategoryOccasions: Partial<
  Record<ClothingItemSubCategory, Occasion[]>
> = {
  // Tops
  "t-shirt": ["gym"],
  shirt: ["work", "dinner", "date-night"],
  sweater: ["work", "dinner"],
  hoodie: ["gym"],

  // Bottoms
  joggers: ["gym"],
  pants: ["work", "dinner", "date-night"],
  shorts: ["gym"],
  skirt: ["work", "dinner", "date-night"],

  // Shoes
  sneakers: ["gym"],
  boots: ["work", "dinner", "date-night"],
  dress_shoes: ["work", "dinner", "date-night"],

  // Outerwear
  jacket: ["work", "dinner", "date-night"],
  coat: ["work", "dinner", "date-night"],
};

// Occasions an item suits. Unmapped or undefined subCategory => all-occasion.
export const getItemOccasions = (item: ClothingItem): Occasion[] =>
  (item.subCategory && subCategoryOccasions[item.subCategory]) ?? ALL_OCCASIONS;

// Hard filter: an item suits the occasion only if its subcategory lists it
// (items without a subCategory are neutral => all occasions). "everyday" is the
// relaxed default and fits every item, so the deck is never empty on it. Unlike
// a soft multiplier, an off-occasion item is excluded outright, so a "dinner"
// pick never falls back to joggers just because the closet is sparse.
export const fitsOccasion = (item: ClothingItem, occasion: Occasion): boolean =>
  occasion === "everyday" || getItemOccasions(item).includes(occasion);
