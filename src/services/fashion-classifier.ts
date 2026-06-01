import {
  ALL_SUBCATEGORIES,
  type ClothingItemCategory,
  type ClothingItemSubCategory,
  subCategoryToCategory,
} from "../models/clothing-item.ts";

export interface ClassificationResult {
  subCategory: ClothingItemSubCategory;
  category: ClothingItemCategory;
}

const validSubCategories = ALL_SUBCATEGORIES;

// The model often replies with everyday synonyms rather than our exact labels.
// We resolve these BEFORE the generic substring match so, e.g., "track pants"
// maps to joggers instead of falling through to the earlier "pants" label.
// Ordered most-specific first.
const SUBCATEGORY_SYNONYMS: {
  match: RegExp;
  subCategory: ClothingItemSubCategory;
}[] = [
  { match: /jogg|sweat ?pant|track ?pant|sweatpant/, subCategory: "joggers" },
  { match: /chino|trouser|slack/, subCategory: "pants" },
  { match: /denim/, subCategory: "jeans" },
  { match: /\btee\b|t[- ]?shirt/, subCategory: "t-shirt" },
  { match: /pullover|jumper|knit/, subCategory: "sweater" },
  { match: /trainer|plimsoll/, subCategory: "sneakers" },
];

const resolveSubCategory = (
  reply: string,
): ClothingItemSubCategory | undefined => {
  // Prefer a synonym hit (handles multi-word, natural replies) ...
  const synonym = SUBCATEGORY_SYNONYMS.find((s) => s.match.test(reply));
  if (synonym) return synonym.subCategory;
  // ... otherwise fall back to an exact or substring match on a known label.
  return validSubCategories.find((sc) => reply === sc || reply.includes(sc));
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

    const base64 = await this.blobToBase64(imageBlob);
    const mimeType = imageBlob.type || "image/png";

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
                  `Classify this clothing item into exactly one of these labels: ${validSubCategories.join(", ")}.\n` +
                  `Guidance for trousers: use "joggers" for athletic/sweat/track pants with an elastic or drawstring waist and cuffs; ` +
                  `use "pants" only for tailored trousers, chinos or dress pants; use "jeans" for denim.\n` +
                  `Reply with only the label, nothing else.`,
              },
            ],
          },
        ],
        max_tokens: 20,
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
    const reply = data.choices?.[0]?.message?.content?.trim().toLowerCase();

    if (!reply) {
      throw new Error("No classification result returned.");
    }

    // Match the reply against valid sub-categories (synonyms first)
    const matched = resolveSubCategory(reply);

    if (!matched) {
      throw new Error(`Unrecognized classification: "${reply}"`);
    }

    return {
      subCategory: matched,
      category: subCategoryToCategory[matched],
    };
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
