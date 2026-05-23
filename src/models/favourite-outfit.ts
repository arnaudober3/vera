export interface FavouriteOutfit {
  id: string;
  name?: string;
  topId: string;
  bottomId: string;
  outerwearId?: string;
  shoesId?: string;
  accessoriesIds?: string[];
  savedAt: Date;
  sessionId: string;
  wornCount?: number;
  lastWornAt?: Date;
}

const NAME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
});

export const defaultFavouriteName = (savedAt: Date): string =>
  `Outfit · ${NAME_FORMATTER.format(savedAt)}`;
