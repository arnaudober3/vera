import { differenceCiede2000 } from "culori";

// A small curated palette of garment-friendly colour names. Auto-naming a piece
// picks the perceptually-closest entry (CIEDE2000) so "#2a3550" reads as "Navy"
// rather than a raw hex. Uses the same culori distance as the outfit matcher.
const NAMED_COLORS: { name: string; hex: string }[] = [
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
 * Closest human-readable colour name for a hex value, used to auto-name newly
 * added garments (e.g. "#2a3550" → "Navy"). Returns "" for an unparseable input
 * so callers can fall back gracefully.
 */
export function colorName(hex: string): string {
  const distance = differenceCiede2000();
  let best = "";
  let bestScore = Infinity;
  for (const entry of NAMED_COLORS) {
    const d = distance(hex, entry.hex);
    if (typeof d === "number" && d < bestScore) {
      bestScore = d;
      best = entry.name;
    }
  }
  return best;
}

export function isDarkColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
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
