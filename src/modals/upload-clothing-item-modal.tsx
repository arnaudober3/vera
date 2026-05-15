import { useState } from "react";
import {
  categoryOptions,
  type ClothingItemCategory,
  type ClothingItemSubCategory,
  type CreateClothingItem,
  subCategoryLabels,
  subCategoryToCategory,
} from "../models/clothing-item.ts";
import { useCloset } from "../hooks/closet.ts";
import { uploadService } from "../services/remove-bg.ts";
import {
  fashionClassifier,
  type ClassificationResult,
} from "../services/fashion-classifier.ts";
import {
  dataURLToBlob,
  extractDominantColor,
  processImageToBase64,
} from "../services/image-processing.ts";

interface ModalData {
  onClose: () => void;
  onSave: (item: CreateClothingItem) => Promise<void>;
}

export default function UploadClothingItemModal({
  onClose,
  onSave,
}: ModalData) {
  const { isUploadLimitReached } = useCloset();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingItemCategory | "">("");
  const [subCategory, setSubCategory] = useState<
    ClothingItemSubCategory | ""
  >("");
  const [classificationFailed, setClassificationFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fileDragged(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    setFile(file);

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      setError("Only images are supported.");
      setFile(null);
      setPreview(null);

      return;
    }

    // Show an immediate preview, we'll replace it after processing on save
    setPreview(URL.createObjectURL(file));
  }

  async function save() {
    try {
      setIsSaving(true);
      setError(null);

      if (isUploadLimitReached()) {
        setError(
          "You've hit our current MVP limit of 10 items. We're working on expanding this soon!",
        );
        setIsSaving(false);
        return;
      }

      if (!file) {
        setError("Please choose an image.");
        setIsSaving(false);
        return;
      }
      if (!name.trim()) {
        setError("Please enter a name.");
        setIsSaving(false);
        return;
      }
      if (classificationFailed && !subCategory) {
        setError("Please select a category.");
        setIsSaving(false);
        return;
      }

      let imageData = await processImageToBase64(file);
      let noBgBlob: Blob;

      try {
        const compressedBlob = dataURLToBlob(imageData);
        const compressedFile = new File([compressedBlob], file.name, {
          type: "image/png",
        });

        noBgBlob = await uploadService.removeBackground(compressedFile);
        const noBgFile = new File([noBgBlob], file.name, {
          type: "image/png",
        });

        imageData = await processImageToBase64(noBgFile);
      } catch {
        setError("Failed to remove the background from the image.");
        return;
      }

      // Classify the clothing item
      let classification: ClassificationResult | null = null;
      if (!classificationFailed) {
        try {
          classification = await fashionClassifier.classifyClothing(noBgBlob);
        } catch {
          // Classification failed — fall back to manual selection
          setClassificationFailed(true);
          setIsSaving(false);
          return;
        }
      }

      const resolvedSubCategory =
        subCategory || classification?.subCategory || undefined;
      const resolvedCategory =
        resolvedSubCategory
          ? subCategoryToCategory[resolvedSubCategory]
          : (category as ClothingItemCategory);

      const item: CreateClothingItem = {
        name: name.trim(),
        category: resolvedCategory,
        subCategory: resolvedSubCategory,
        color: await extractDominantColor(imageData),
        isClean: true,
        imageData,
      };
      await onSave(item);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-300 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !isSaving && onClose()}
      />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add item</h3>
          <button
            className="p-2 text-gray-500"
            onClick={onClose}
            aria-label="Close"
            disabled={isSaving}
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="photo-input"
            >
              Photo
            </label>
            <div className="flex items-center gap-3">
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                onChange={(e) => fileDragged(e.target.files?.[0])}
                className="input border block w-full text-sm text-gray-400"
                aria-label="Choose image"
                disabled={isSaving}
              />
            </div>
            {preview && (
              <div className="mt-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-40 object-contain rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Navy tee"
              className="input w-full border text-base"
              aria-required
              disabled={isSaving}
            />
          </div>

          {classificationFailed && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="subcategory-input"
              >
                Category (auto-detection failed)
              </label>
              <select
                id="subcategory-input"
                className={`input select w-full border text-base ${
                  !subCategory ? "placeholder" : null
                }`}
                value={subCategory}
                onChange={(e) => {
                  const value = e.target.value as ClothingItemSubCategory;
                  setSubCategory(value);
                  setCategory(subCategoryToCategory[value]);
                }}
                disabled={isSaving}
              >
                <option disabled value="">
                  Select…
                </option>
                {categoryOptions.map((cat) => (
                  <optgroup key={cat.value} label={cat.label}>
                    {Object.entries(subCategoryLabels)
                      .filter(
                        ([subCat]) =>
                          subCategoryToCategory[
                            subCat as ClothingItemSubCategory
                          ] === cat.value,
                      )
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            className="secondary-button flex-1 text-base"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="primary-button flex-1 text-base disabled:opacity-60"
            onClick={save}
            disabled={
              !file ||
              !name ||
              (classificationFailed && !subCategory) ||
              isSaving
            }
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
