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
