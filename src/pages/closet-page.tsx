import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useCloset } from "../hooks/closet.ts";
import NavigationBar from "../components/navigation-bar.tsx";
import { AppFooter } from "../components/app-footer.tsx";
import {
  ALL_CATEGORIES,
  type ClothingItem,
  type ClothingItemCategory,
  type CreateClothingItem,
} from "../models/clothing-item.ts";
import UploadClothingItemModal from "../modals/upload-clothing-item-modal.tsx";
import * as React from "react";
import { useImage } from "../hooks/image.ts";
import { IoClose } from "react-icons/io5";
import { useOutfit } from "../hooks/outfit.ts";
import { useMeasuredHeight } from "../hooks/use-measured-height.ts";
import { FaCheck } from "react-icons/fa";
import { BsPin, BsPinFill } from "react-icons/bs";
import { MdAdd } from "react-icons/md";
import { itemTint } from "../utils/color.ts";
import { useToast } from "../components/toast-context.ts";
import "./closet-page.css";

const CategoryFilterBar = ({
  selectedCategory,
  onCategorySelected,
  availableCategories,
}: {
  selectedCategory: ClothingItemCategory | null;
  onCategorySelected: (category: ClothingItemCategory | null) => void;
  availableCategories: Set<ClothingItemCategory>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedCategory]);

  const chips: { value: ClothingItemCategory | null; label: string }[] = [
    { value: null, label: t("categories.all") },
    ...ALL_CATEGORIES.map((c) => ({
      value: c,
      label: t(`categories.${c}` as const),
    })),
  ];

  return (
    <div className="vera-chip-row mx-auto max-w-4xl w-full">
      {chips.map(({ value, label }) => {
        const isActive = selectedCategory === value;
        const isDisabled = value !== null && !availableCategories.has(value);
        return (
          <button
            key={value ?? "all"}
            type="button"
            ref={isActive ? activeRef : undefined}
            onClick={() => onCategorySelected(value)}
            disabled={isDisabled}
            className={`vera-chip ${isActive ? "active" : ""}`}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

const ItemCard = ({
  item,
  editMode,
}: {
  item: ClothingItem;
  editMode: boolean;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const { getImage, removeImage } = useImage();
  const { removeClothingItem, renameClothingItem } = useCloset();
  const { outfit, clearOutfit, pinItem, unpinItem } = useOutfit();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isPinned = outfit?.pinnedItemId === item.id;
  const trayBackground = itemTint(item.color);

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(item.name);

  // Leaving edit mode while a card is mid-rename should drop back to the plain name.
  useEffect(() => {
    if (!editMode) {
      setIsRenaming(false);
    }
  }, [editMode]);

  function startRenaming(): void {
    setDraftName(item.name);
    setIsRenaming(true);
  }

  async function commitRename(): Promise<void> {
    await renameClothingItem(item.id, draftName);
    setIsRenaming(false);
  }

  function cancelRename(): void {
    setDraftName(item.name);
    setIsRenaming(false);
  }

  async function remove(id: string): Promise<void> {
    if (window.confirm(t("closet.deleteConfirm"))) {
      await removeClothingItem(id);

      // Also remove the associated image
      if (item.imageId) {
        await removeImage(item.imageId);
      }

      if (
        item.id === outfit?.top.id ||
        item.id === outfit?.bottom.id ||
        item.id === outfit?.pinnedItemId
      ) {
        await clearOutfit();
      }
    }
  }

  async function pin(): Promise<void> {
    // Tapping an already-pinned item releases the lock (and stays on the closet);
    // otherwise pin it into today's outfit and jump to the Today page.
    if (isPinned) {
      await unpinItem();
      return;
    }
    const result = await pinItem(item);
    if (result) {
      navigate("/");
    } else {
      showToast(t("closet.pinNoMatch"));
    }
  }

  return (
    <div
      className="h-full min-w-0"
      style={{ aspectRatio: "1 / 1.05" }}
    >
      <div className="vera-item-card">
        {/* tinted tray — the cutout photo floats on a soft tint of its own colour */}
        <div className="vera-item-tray" style={{ background: trayBackground }}>
          <img
            src={getImage(item.imageId || item.id)} // Fallback to item.id for backwards compatibility
            alt={item.name}
            className="vera-item-photo"
            loading="lazy"
          />

          {!editMode && (
            <button
              onClick={() => pin()}
              className={`pin-button ${isPinned ? "active" : ""}`}
              aria-label={isPinned ? t("closet.unpinAria") : t("closet.pinAria")}
              aria-pressed={isPinned}
            >
              {isPinned ? <BsPinFill size={14} /> : <BsPin size={14} />}
            </button>
          )}

          {editMode && (
            <button
              onClick={() => remove(item.id)}
              className="delete-button"
              aria-label={t("closet.deleteAria")}
            >
              <IoClose size={14} />
            </button>
          )}
        </div>

        {/* name — reserved two-line area so every card is the same height */}
        <div className="vera-item-name">
          {editMode && isRenaming ? (
            <input
              className="vera-item-name-edit"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
            />
          ) : editMode ? (
            <span
              className="vera-item-name-editable"
              role="button"
              tabIndex={0}
              aria-label={t("closet.renameAria")}
              onClick={startRenaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startRenaming();
                }
              }}
            >
              {item.name}
            </span>
          ) : (
            <span>{item.name}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const AddItemTile = ({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="h-full min-w-0" style={{ aspectRatio: "1 / 1.05" }}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={t("closet.addItemAria")}
        title={
          disabled ? t("closet.addItemLimitTitle") : t("closet.addItemTitle")
        }
        className="vera-add-tile"
      >
        <span className="vera-add-tile__icon">
          <MdAdd size={20} />
        </span>
        <span className="vera-add-tile__label">{t("closet.addTile")}</span>
      </button>
    </div>
  );
};

const OnboardingToast = ({
  onDismiss,
}: {
  onDismiss: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
  <button
    type="button"
    onClick={onDismiss}
    aria-label={t("closet.onboardingToastDismissAria")}
    style={{
      width: "100%",
      textAlign: "left",
      background: "#ffffff",
      border: "1px solid #e3ebec",
      borderRadius: 16,
      padding: 14,
      display: "flex",
      gap: 12,
      alignItems: "center",
      boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      cursor: "pointer",
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "#65aaa7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <FaCheck size={14} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>
        {t("closet.onboardingToastTitle")}
      </div>
      <div style={{ fontSize: 12, color: "#6a7282", marginTop: 2 }}>
        {t("closet.onboardingToastSub")}
      </div>
    </div>
  </button>
  );
};

export const ClosetPage = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { items, addClothingItem, isUploadLimitReached } = useCloset();
  const { saveImage } = useImage();
  const location = useLocation();
  const justOnboarded =
    (location.state as { justOnboarded?: boolean } | null)?.justOnboarded ??
    false;
  // The footer floats over the scroll area; reserve its measured height as bottom
  // padding so the last cards can scroll clear of the nav pill.
  const [footerRef, footerHeight] = useMeasuredHeight();
  const [selectedCategory, setSelectedCategory] =
    useState<ClothingItemCategory | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [showOnboardingToast, setShowOnboardingToast] = useState<boolean>(
    justOnboarded,
  );
  useEffect(() => {
    if (!showOnboardingToast) return;
    const timer = window.setTimeout(() => setShowOnboardingToast(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showOnboardingToast]);

  const availableCategories = useMemo(
    () => new Set(items.map((i) => i.category)),
    [items],
  );

  const displayedItems = useMemo(
    () =>
      selectedCategory
        ? items.filter((item) => item.category === selectedCategory)
        : items,
    [items, selectedCategory],
  );

  async function addItem(item: CreateClothingItem): Promise<void> {
    const newItem = await addClothingItem(item);

    if (item.imageData) {
      await saveImage({
        id: newItem.imageId || newItem.id,
        imageData: item.imageData,
      });
    }
  }

  const showAddTile = !editMode && !isUploadLimitReached();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="mx-auto max-w-4xl px-5 pt-3.5 w-full shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="vera-dressing-title">{t("closet.title")}</h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`vera-edit-toggle ${editMode ? "active" : ""}`}
            >
              {editMode ? t("closet.editDone") : t("closet.edit")}
            </button>
          )}
        </div>
      </div>

      {showOnboardingToast && (
        // Float above the nav dock, matching the error toast's placement
        // (.vera-toast): fixed to the phone frame — its transform makes it the
        // containing block, so ClosetPage's overflow-hidden never clips it.
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: "calc(env(safe-area-inset-bottom) + 92px)",
            maxWidth: 360,
            margin: "0 auto",
            zIndex: 200,
            animation: "veraToastUp 0.32s var(--vera-ease) both",
          }}
        >
          <OnboardingToast onDismiss={() => setShowOnboardingToast(false)} />
        </div>
      )}

      <div className="shrink-0">
        <CategoryFilterBar
          selectedCategory={selectedCategory}
          onCategorySelected={setSelectedCategory}
          availableCategories={availableCategories}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative">
        <div
          className="w-full mx-auto max-w-4xl px-4 pb-4"
          style={{ paddingBottom: footerHeight + 12 }}
        >
          <div className="vera-dressing-sub">
            <span>{t("closet.available", { count: items.length })}</span>
            <span className="vera-dressing-sub__rule" aria-hidden />
          </div>
          <div className="rounded-2xl">
            <div className="grid gap-2.5 grid-cols-2 auto-rows-fr">
              {showAddTile && (
                <AddItemTile
                  onClick={() => setShowUploadModal(true)}
                  disabled={isUploadLimitReached()}
                />
              )}
              {displayedItems.map((item) => (
                <ItemCard key={item.id} item={item} editMode={editMode} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div ref={footerRef} className="absolute inset-x-0 bottom-0 z-10">
        <AppFooter>
          <NavigationBar activePage="closet" />
        </AppFooter>
      </div>

      {showUploadModal && (
        <UploadClothingItemModal
          onClose={() => setShowUploadModal(false)}
          onSave={addItem}
        />
      )}
    </div>
  );
};
