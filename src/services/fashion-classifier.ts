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
                text: `Classify this clothing item into exactly one of these categories: ${validSubCategories.join(", ")}. Reply with only the category name, nothing else.`,
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

    // Match the reply against valid sub-categories
    const matched = validSubCategories.find(
      (sc) => reply === sc || reply.includes(sc),
    );

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
