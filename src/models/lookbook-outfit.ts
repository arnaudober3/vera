export interface LookbookOutfit {
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

export const formatLookbookOutfitDate = (savedAt: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(savedAt);
