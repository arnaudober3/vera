import type { ClothingItem } from "./clothing-item.ts";

export interface Outfit {
  top: ClothingItem;
  bottom: ClothingItem;
  outerwear?: ClothingItem;
  shoes?: ClothingItem;
  accessories?: ClothingItem[];
  /** Id of an item the user has pinned; the rest of the outfit regenerates around it. */
  pinnedItemId?: string;
}
