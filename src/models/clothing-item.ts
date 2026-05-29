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
