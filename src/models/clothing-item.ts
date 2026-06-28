import type { Color } from "./color.ts";

export type ClothingItemCategory =
  | "top"
  | "bottom"
  | "outerwear"
  | "shoes"
  | "accessories";

export const WASHABLE_CATEGORIES: ClothingItemCategory[] = ["top", "bottom"];

export const isWashable = (category: ClothingItemCategory): boolean => {
  return WASHABLE_CATEGORIES.includes(category);
};

export type ClothingItemSubCategory =
  | "t-shirt"
  | "shirt"
  | "sweater"
  | "jacket"
  | "coat"
  | "hoodie"
  | "pants"
  | "joggers"
  | "jeans"
  | "shorts"
  | "skirt"
  | "sneakers"
  | "boots"
  | "sandals"
  | "dress_shoes"
  | "bag"
  | "belt"
  | "scarf"
  | "hat"
  | "watch"
  | "ring"
  | "earring";

export const subCategoryToCategory: Record<
  ClothingItemSubCategory,
  ClothingItemCategory
> = {
  "t-shirt": "top",
  shirt: "top",
  sweater: "top",
  jacket: "outerwear",
  coat: "outerwear",
  hoodie: "top",
  pants: "bottom",
  joggers: "bottom",
  jeans: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  sneakers: "shoes",
  boots: "shoes",
  sandals: "shoes",
  dress_shoes: "shoes",
  bag: "accessories",
  belt: "accessories",
  scarf: "accessories",
  hat: "accessories",
  watch: "accessories",
  ring: "accessories",
  earring: "accessories",
};

// Friendly nouns for auto-naming a piece during onboarding ("Navy tee",
// "Beige chinos"). Keyed by detected sub-category, with a per-category fallback
// used when classification is unavailable.
export const subCategoryToNoun: Record<ClothingItemSubCategory, string> = {
  "t-shirt": "tee",
  shirt: "shirt",
  sweater: "sweater",
  jacket: "jacket",
  coat: "coat",
  hoodie: "hoodie",
  pants: "chinos",
  joggers: "joggers",
  jeans: "jeans",
  shorts: "shorts",
  skirt: "skirt",
  sneakers: "sneakers",
  boots: "boots",
  sandals: "sandals",
  dress_shoes: "dress shoes",
  bag: "bag",
  belt: "belt",
  scarf: "scarf",
  hat: "hat",
  watch: "watch",
  ring: "ring",
  earring: "earrings",
};

export const categoryToNoun: Record<ClothingItemCategory, string> = {
  top: "top",
  bottom: "bottoms",
  outerwear: "jacket",
  shoes: "shoes",
  accessories: "piece",
};

export const ALL_SUBCATEGORIES: ClothingItemSubCategory[] = Object.keys(
  subCategoryToCategory,
) as ClothingItemSubCategory[];

export const ALL_CATEGORIES: ClothingItemCategory[] = [
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessories",
];

export type ClothingItem = {
  id: string;
  name: string;
  category: ClothingItemCategory;
  subCategory?: ClothingItemSubCategory;
  color: Color;
  isClean: boolean;
  imageId?: string;
};

export interface CreateClothingItem
  extends Omit<ClothingItem, "id" | "imageId"> {
  imageData: string;
}
