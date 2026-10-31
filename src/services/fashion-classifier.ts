import {
  ALL_SUBCATEGORIES,
  type ClothingItemCategory,
  type ClothingItemSubCategory,
  subCategoryToCategory,
} from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import { NAMED_COLORS } from "../utils/color.ts";
import { flattenOnBackground } from "./image-processing.ts";

export interface ClassificationResult {
  subCategory: ClothingItemSubCategory;
  category: ClothingItemCategory;
  color?: Color;
}

const promptLabels = ALL_SUBCATEGORIES.map((sc) => sc.replace(/_/g, " "));

// Order matters: first match wins ("oxford shirt" → shirt, "denim jacket" → jacket).
const SUBCATEGORY_SYNONYMS: {
  match: RegExp;
  subCategory: ClothingItemSubCategory;
}[] = [
  { match: /\btee\b|\bt[- ]?shirt/, subCategory: "t-shirt" },
  { match: /jogg|sweat ?pant|track ?pant/, subCategory: "joggers" },
  {
    match: /parka|puffer|trench|overcoat|peacoat|raincoat|\bcoat\b/,
    subCategory: "coat",
  },
  {
    match: /blazer|bomber|windbreaker|anorak|gilet|\bjacket\b/,
    subCategory: "jacket",
  },
  { match: /hood|zip[- ]?up/, subCategory: "hoodie" },
  {
    match: /sweat(er|shirt)|crew ?neck|cardigan|pullover|jumper|knit|turtleneck/,
    subCategory: "sweater",
  },
  {
    match: /polo|blouse|button[- ]?(up|down)|flannel|\bshirt\b/,
    subCategory: "shirt",
  },
  { match: /\btank\b|camisole|\bcrop\b|\btop\b/, subCategory: "t-shirt" },
  { match: /\bshorts?\b(?![- ]?sleeve)/, subCategory: "shorts" },
  { match: /chino|trouser|slack|legging|\bpant\b/, subCategory: "pants" },
  { match: /denim|\bjean\b/, subCategory: "jeans" },
  { match: /sneaker|trainer|plimsoll/, subCategory: "sneakers" },
  { match: /\bboots?\b|bootie/, subCategory: "boots" },
  { match: /sandal|flip[- ]?flop/, subCategory: "sandals" },
  {
    match: /dress ?shoe|loafer|oxford|derby|brogue|\bheels?\b|\bpumps?\b/,
    subCategory: "dress_shoes",
  },
  { match: /handbag|backpack|\btote\b|purse/, subCategory: "bag" },
  { match: /\bcap\b|beanie/, subCategory: "hat" },
  // "earrings" contains "ring".
  { match: /earring|\bstuds?\b|hoops?\b/, subCategory: "earring" },
];

export const resolveSubCategory = (
  text: string,
): ClothingItemSubCategory | undefined => {
  const reply = text.trim().toLowerCase().replace(/_/g, " ");
  const exact = ALL_SUBCATEGORIES.find(
    (sc) => reply === sc.replace(/_/g, " "),
  );
  if (exact) return exact;
  const synonym = SUBCATEGORY_SYNONYMS.find((s) => s.match.test(reply));
  if (synonym) return synonym.subCategory;
  return ALL_SUBCATEGORIES.find((sc) => reply.includes(sc.replace(/_/g, " ")));
};

const COLOR_SYNONYMS: { match: RegExp; name: string }[] = [
  { match: /navy|dark blue|midnight|indigo/, name: "Navy" },
  { match: /sky|baby blue|pale blue|powder blue/, name: "Light blue" },
  { match: /dark grey|anthracite|graphite/, name: "Charcoal" },
  { match: /off[- ]?white|ivory|ecru|eggshell/, name: "Cream" },
  { match: /army|khaki green|olive/, name: "Olive" },
  { match: /khaki|sand|stone|taupe/, name: "Beige" },
  { match: /camel|cognac/, name: "Tan" },
  { match: /mustard|gold|lemon/, name: "Yellow" },
  { match: /maroon|wine|bordeaux|oxblood/, name: "Burgundy" },
  { match: /turquoise|petrol/, name: "Teal" },
  { match: /mint|emerald|forest|sage/, name: "Green" },
  { match: /lavender|lilac|violet|plum/, name: "Purple" },
  { match: /rose|blush|fuchsia|magenta/, name: "Pink" },
  { match: /rust|terracotta|coral|peach/, name: "Orange" },
  { match: /chocolate|espresso|coffee/, name: "Brown" },
  { match: /denim|cobalt|royal/, name: "Blue" },
];

const PALETTE_BY_LENGTH = [...NAMED_COLORS].sort(
  (a, b) => b.name.length - a.name.length,
);

export const resolveColorName = (text: string): Color | undefined => {
  const value = text.trim().toLowerCase().replace(/gray/g, "grey");
  if (!value) return undefined;
  const exact = NAMED_COLORS.find((c) => c.name.toLowerCase() === value);
  if (exact) return exact.hex as Color;
  const synonym = COLOR_SYNONYMS.find((s) => s.match.test(value));
  if (synonym) {
    return NAMED_COLORS.find((c) => c.name === synonym.name)?.hex as Color;
  }
  const contained = PALETTE_BY_LENGTH.find((c) =>
    value.includes(c.name.toLowerCase()),
  );
  return contained?.hex as Color | undefined;
};

export const parseClassificationReply = (
  reply: string,
): ClassificationResult => {
  let typeText = reply;
  let colorText = "";

  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const type = parsed.type ?? parsed.label ?? parsed.category;
      if (typeof type === "string") typeText = type;
      if (typeof parsed.color === "string") colorText = parsed.color;
    } catch {
      /* not JSON: parse the reply as a bare label */
    }
  }

  const subCategory = resolveSubCategory(typeText);
  if (!subCategory) {
    throw new Error(`Unrecognized classification: "${reply}"`);
  }

  return {
    subCategory,
    category: subCategoryToCategory[subCategory],
    color: resolveColorName(colorText),
  };
};

const HF_BASE_URL = import.meta.env.DEV
  ? "/api/huggingface"
  : "https://router.huggingface.co";

class FashionClassifierService {
  private apiKey: string = import.meta.env.VITE_HF_API_KEY;
  private chatUrl = `${HF_BASE_URL}/v1/chat/completions`;

  async classifyClothing(imageBlob: Blob): Promise<ClassificationResult> {
    if (!this.apiKey) {
      throw new Error("Hugging Face API key is not configured.");
    }

    // Transparent pixels can be decoded as black, hiding dark garments.
    const flattened = await flattenOnBackground(imageBlob);
    const base64 = await this.blobToBase64(flattened);
    const mimeType = flattened.type || "image/png";

    const response = await fetch(this.chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen3-VL-8B-Instruct:novita",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text:
                  `This is a photo of a single clothing item on a plain grey background (the background is not part of the item).\n` +
                  `1. "type": classify the item into exactly one of these labels: ${promptLabels.join(", ")}.\n` +
                  `   Polo shirts and blouses are "shirt"; sweatshirts and cardigans are "sweater"; tank tops are "t-shirt".\n` +
                  `   For trousers: use "joggers" for athletic/sweat/track pants with an elastic or drawstring waist and cuffs; ` +
                  `use "pants" only for tailored trousers, chinos or dress pants; use "jeans" for denim.\n` +
                  `2. "color": the main fabric colour, picked from exactly one of: ${NAMED_COLORS.map((c) => c.name).join(", ")}.\n` +
                  `   Ignore logos, prints, shadows and lighting — a white tee in shade is still "White", dark navy is "Navy", not "Black".\n` +
                  `Reply with only a JSON object like {"type": "shirt", "color": "Yellow"} and nothing else.`,
              },
            ],
          },
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `Fashion classification failed: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const reply: string | undefined =
      data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("No classification result returned.");
    }

    try {
      return parseClassificationReply(reply);
    } catch (error) {
      console.warn("Fashion classifier reply could not be parsed:", reply);
      throw error;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const fashionClassifier = new FashionClassifierService();
