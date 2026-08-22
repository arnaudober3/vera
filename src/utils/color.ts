import { differenceCiede2000 } from "culori";

export type NamedColor = { name: string; hex: string };

// A small curated palette of garment-friendly colour names. Auto-naming a piece
// picks the perceptually-closest entry (CIEDE2000) so "#2a3550" reads as "Navy"
// rather than a raw hex. Uses the same culori distance as the outfit matcher.
// Also doubles as the Today page's colour-filter swatches, so picking "Yellow"
// there matches exactly the items Vera would name "Yellow".
export const NAMED_COLORS: NamedColor[] = [
  { name: "White", hex: "#ffffff" },
  { name: "Cream", hex: "#f3ead7" },
  { name: "Beige", hex: "#d9c8a9" },
  { name: "Tan", hex: "#c19a6b" },
  { name: "Brown", hex: "#6f4e37" },
  { name: "Charcoal", hex: "#36393f" },
  { name: "Black", hex: "#1a1a1a" },
  { name: "Grey", hex: "#9aa0a6" },
  { name: "Navy", hex: "#1f2a48" },
  { name: "Blue", hex: "#2f5fa8" },
  { name: "Light blue", hex: "#9fc1e8" },
  { name: "Teal", hex: "#2f8f8a" },
  { name: "Green", hex: "#3f7d4f" },
  { name: "Olive", hex: "#6b6b3a" },
  { name: "Red", hex: "#c0392b" },
  { name: "Burgundy", hex: "#6e1f2e" },
  { name: "Pink", hex: "#e6a8bf" },
  { name: "Purple", hex: "#6c4a8c" },
  { name: "Yellow", hex: "#e8c44d" },
  { name: "Orange", hex: "#d6803a" },
];

/**
 * Closest palette entry to a hex value (CIEDE2000). Undefined for an
 * unparseable input so callers can fall back gracefully.
 */
export function nearestNamedColor(hex: string): NamedColor | undefined {
  const distance = differenceCiede2000();
  let best: NamedColor | undefined;
  let bestScore = Infinity;
  for (const entry of NAMED_COLORS) {
    const d = distance(hex, entry.hex);
    if (typeof d === "number" && d < bestScore) {
      bestScore = d;
      best = entry;
    }
  }
  return best;
}

/**
 * Closest human-readable colour name for a hex value, used to auto-name newly
 * added garments (e.g. "#2a3550" → "Navy"). Returns "" for an unparseable input.
 */
export function colorName(hex: string): string {
  return nearestNamedColor(hex)?.name ?? "";
}

// Distance (CIEDE2000) below which a garment's real, photo-extracted colour
// counts as matching a picked palette swatch — see matchesPaletteColor.
const COLOR_MATCH_THRESHOLD = 15;

/**
 * Whether a colour is close enough to a named palette swatch to count as that
 * colour for the Today page's colour filter. Deliberately distance-based
 * rather than "is this swatch the single nearest of all 20" — a pale, photo-
 * extracted yellow can sit slightly closer to "Beige" than to "Yellow" while
 * still plainly being a yellow the wearer would pick "Yellow" for, so bucket
 * equality would silently drop it from the deck.
 */
export function matchesPaletteColor(hex: string, name: string): boolean {
  const target = NAMED_COLORS.find((c) => c.name === name);
  if (!target) return false;
  const d = differenceCiede2000()(hex, target.hex);
  return typeof d === "number" && !Number.isNaN(d) && d <= COLOR_MATCH_THRESHOLD;
}

/**
 * Soft tray background derived from a garment's own colour — a gentle gradient
 * mostly toward white (14% → 26% of the garment colour), so the blue jean sits
 * on pale blue, the chino on beige, the cream sweater on cream. Kept light on
 * purpose so it reads as a calm backdrop, not a coloured block.
 */
export function itemTint(color: string): string {
  const tint1 = `color-mix(in srgb, ${color} 14%, #ffffff)`;
  const tint2 = `color-mix(in srgb, ${color} 26%, #ffffff)`;
  return `linear-gradient(155deg, ${tint1} 0%, ${tint2} 100%)`;
}
