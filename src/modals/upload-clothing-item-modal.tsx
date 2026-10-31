import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ALL_CATEGORIES,
  ALL_SUBCATEGORIES,
  type ClothingItemCategory,
  type ClothingItemSubCategory,
  type CreateClothingItem,
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
  const { t } = useTranslation();
  const { isUploadLimitReached } = useCloset();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      setError(t("upload.errorImagesOnly"));
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
        setError(t("upload.errorLimitReached"));
        setIsSaving(false);
        return;
      }

      if (!file) {
        setError(t("upload.errorChooseImage"));
        setIsSaving(false);
        return;
      }
      if (!name.trim()) {
        setError(t("upload.errorEnterName"));
        setIsSaving(false);
        return;
      }
      if (classificationFailed && !subCategory) {
        setError(t("upload.errorSelectCategory"));
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
        setError(t("upload.errorRemoveBg"));
        return;
      }

      let classification: ClassificationResult | null = null;
      if (!classificationFailed) {
        try {
          classification = await fashionClassifier.classifyClothing(noBgBlob);
        } catch {
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
        color: classification?.color ?? (await extractDominantColor(imageData)),
        imageData,
      };
      await onSave(item);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-300 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !isSaving && onClose()}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-4 shadow-xl" style={{ maxHeight: "85%", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("upload.title")}</h3>
          <button
            className="p-2 text-gray-500"
            onClick={onClose}
            aria-label={t("common.close")}
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
              {t("upload.photoLabel")}
            </label>
            <input
              id="photo-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => fileDragged(e.target.files?.[0])}
              className="hidden"
              aria-label={t("upload.chooseImageAria")}
              disabled={isSaving}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="vera-btn-secondary text-sm whitespace-nowrap"
                style={{ borderRadius: "var(--vera-radius-md)" }}
                disabled={isSaving}
              >
                {t("upload.chooseFile")}
              </button>
              <span className="text-sm text-gray-500 truncate min-w-0">
                {file ? file.name : t("upload.noFileChosen")}
              </span>
            </div>
            {preview && (
              <div className="mt-2">
                <img
                  src={preview}
                  alt={t("upload.previewAlt")}
                  className="w-full max-h-40 object-contain rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("common.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.namePlaceholder")}
              className="vera-input w-full text-base"
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
                {t("upload.categoryFallbackLabel")}
              </label>
              <select
                id="subcategory-input"
                className={`vera-input vera-select w-full text-base ${
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
                  {t("common.select")}
                </option>
                {ALL_CATEGORIES.map((cat) => (
                  <optgroup key={cat} label={t(`categories.${cat}` as const)}>
                    {ALL_SUBCATEGORIES.filter(
                      (sub) => subCategoryToCategory[sub] === cat,
                    ).map((sub) => (
                      <option key={sub} value={sub}>
                        {t(`subcategories.${sub}` as const)}
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
            className="vera-btn-secondary flex-1 text-base"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </button>
          <button
            className="vera-btn-primary flex-1 text-base disabled:opacity-60"
            onClick={save}
            disabled={
              !file ||
              !name ||
              (classificationFailed && !subCategory) ||
              isSaving
            }
          >
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
