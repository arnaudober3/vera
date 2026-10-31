import { describe, expect, it } from "vitest";
import {
  parseClassificationReply,
  resolveColorName,
  resolveSubCategory,
} from "./fashion-classifier.ts";
import { NAMED_COLORS } from "../utils/color.ts";

const hex = (name: string) => NAMED_COLORS.find((c) => c.name === name)?.hex;

describe("parseClassificationReply", () => {
  it("parses a clean JSON reply", () => {
    expect(parseClassificationReply('{"type": "shirt", "color": "Yellow"}')).toEqual({
      subCategory: "shirt",
      category: "top",
      color: hex("Yellow"),
    });
  });

  it("parses JSON wrapped in a code fence", () => {
    const reply = '```json\n{"type": "pants", "color": "Navy"}\n```';
    expect(parseClassificationReply(reply)).toEqual({
      subCategory: "pants",
      category: "bottom",
      color: hex("Navy"),
    });
  });

  it("falls back to a bare label reply", () => {
    expect(parseClassificationReply("T-shirt")).toEqual({
      subCategory: "t-shirt",
      category: "top",
      color: undefined,
    });
  });

  it("leaves colour undefined when it is not recognised", () => {
    expect(
      parseClassificationReply('{"type": "jeans", "color": "multicolour"}')
        .color,
    ).toBeUndefined();
  });

  it("throws when the garment type is unknown", () => {
    expect(() =>
      parseClassificationReply('{"type": "necklace", "color": "Black"}'),
    ).toThrow(/Unrecognized classification/);
  });
});

describe("resolveSubCategory", () => {
  it.each([
    ["polo", "shirt"],
    ["polo shirt", "shirt"],
    ["oxford shirt", "shirt"],
    ["short sleeve shirt", "shirt"],
    ["sneaker", "sneakers"],
    ["boot", "boots"],
    ["dress shoes", "dress_shoes"],
    ["dress_shoes", "dress_shoes"],
    ["loafers", "dress_shoes"],
    ["cardigan", "sweater"],
    ["sweatshirt", "sweater"],
    ["track pants", "joggers"],
    ["chinos", "pants"],
    ["denim jacket", "jacket"],
    ["denim shorts", "shorts"],
    ["tank top", "t-shirt"],
    ["parka", "coat"],
    ["earrings", "earring"],
  ])("maps %s to %s", (reply, expected) => {
    expect(resolveSubCategory(reply)).toBe(expected);
  });
});

describe("resolveColorName", () => {
  it.each([
    ["White", "White"],
    ["navy blue", "Navy"],
    ["gray", "Grey"],
    ["dark gray", "Charcoal"],
    ["mustard", "Yellow"],
    ["light blue", "Light blue"],
    ["khaki green", "Olive"],
    ["bright red", "Red"],
  ])("maps %s to %s", (name, expected) => {
    expect(resolveColorName(name)).toBe(hex(expected));
  });

  it("returns undefined for an empty or unknown colour", () => {
    expect(resolveColorName("")).toBeUndefined();
    expect(resolveColorName("multicolour")).toBeUndefined();
  });
});
