// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Outfit } from "../models/outfit.ts";
import type { Occasion } from "../models/occasion.ts";

// buildDeck is the app's core suggestion path and had no test. It now ranks on
// colour alone — the "clean pool" filter, the recency penalty and the season
// multiplier are gone — so this guards the regression those removals could
// cause: a garment silently dropped from the deck.

type StoredItem = {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  color: { mode: "rgb"; r: number; g: number; b: number };
  // The field this clean-up removed — still present in every existing browser.
  isClean?: boolean;
};

const item = (
  id: string,
  category: string,
  rgb: [number, number, number],
  extra: Partial<StoredItem> = {},
): StoredItem => ({
  id,
  name: id,
  category,
  color: { mode: "rgb", r: rgb[0], g: rgb[1], b: rgb[2] },
  ...extra,
});

const SESSION = "session_test";

// The hooks initialise their singletons at import time, so the closet has to be
// in localStorage before the module graph is (re-)loaded.
const loadDeck = async (
  items: StoredItem[],
  filter: Occasion = "everyday",
): Promise<Outfit[]> => {
  localStorage.clear();
  localStorage.setItem("session_id", SESSION);
  localStorage.setItem(`vera:clothingItems:${SESSION}`, JSON.stringify(items));

  vi.resetModules();
  const { useOutfit } = await import("./outfit.ts");

  let deck: Outfit[] = [];
  const Probe = (): null => {
    deck = useOutfit().buildDeck(filter);
    return null;
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  container.remove();

  return deck;
};

describe("buildDeck", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("offers every top × bottom pairing", async () => {
    const deck = await loadDeck([
      item("top1", "top", [10, 10, 10]),
      item("top2", "top", [200, 200, 200]),
      item("bot1", "bottom", [20, 20, 20]),
      item("bot2", "bottom", [180, 180, 180]),
    ]);

    expect(deck).toHaveLength(4);
  });

  it("includes items still carrying a legacy isClean: false flag", async () => {
    const deck = await loadDeck([
      item("top1", "top", [10, 10, 10], { isClean: false }),
      item("bot1", "bottom", [20, 20, 20], { isClean: false }),
    ]);

    expect(deck).toHaveLength(1);
    expect(deck[0].top.id).toBe("top1");
    expect(deck[0].bottom.id).toBe("bot1");
  });

  it("spreads the deck so two consecutive cards don't share a top", async () => {
    const deck = await loadDeck([
      item("top1", "top", [10, 10, 10]),
      item("top2", "top", [200, 200, 200]),
      item("bot1", "bottom", [20, 20, 20]),
      item("bot2", "bottom", [180, 180, 180]),
    ]);

    for (let i = 1; i < deck.length; i++) {
      expect(deck[i].top.id).not.toBe(deck[i - 1].top.id);
    }
  });

  it("keeps only occasion-appropriate pieces", async () => {
    const deck = await loadDeck(
      [
        item("shirt", "top", [10, 10, 10], { subCategory: "shirt" }),
        item("tee", "top", [10, 10, 10], { subCategory: "t-shirt" }),
        item("chinos", "bottom", [20, 20, 20], { subCategory: "pants" }),
        item("joggers", "bottom", [20, 20, 20], { subCategory: "joggers" }),
      ],
      "work",
    );

    // Only the shirt + chinos suit "work"; the gym pieces are excluded outright.
    expect(deck).toHaveLength(1);
    expect(deck[0].top.id).toBe("shirt");
    expect(deck[0].bottom.id).toBe("chinos");
  });

  it("returns nothing when the closet has no top/bottom duo", async () => {
    const deck = await loadDeck([item("top1", "top", [10, 10, 10])]);

    expect(deck).toEqual([]);
  });
});
