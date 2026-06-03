import type {
  ClothingItem,
  ClothingItemSubCategory,
} from "./clothing-item.ts";

export type Occasion = "casual" | "smart" | "formal" | "sport";

export const ALL_OCCASIONS: Occasion[] = ["casual", "smart", "formal", "sport"];

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

// Hard filter: an item suits the occasion only if its subcategory lists it
// (items without a subCategory are neutral => all occasions). Unlike a soft
// multiplier, an off-occasion item is excluded outright, so a "formal" pick
// never falls back to joggers just because the closet is sparse.
export const fitsOccasion = (item: ClothingItem, occasion: Occasion): boolean =>
  getItemOccasions(item).includes(occasion);
