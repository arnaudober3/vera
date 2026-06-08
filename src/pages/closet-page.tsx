import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useCloset } from "../hooks/closet.ts";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { BasketStrip } from "../components/basket-strip.tsx";
import { AppFooter } from "../components/app-footer.tsx";
import {
  ALL_CATEGORIES,
  isWashable,
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
import { FaCheck, FaChevronLeft } from "react-icons/fa";
import { BsPin, BsPinFill } from "react-icons/bs";
import { MdAdd } from "react-icons/md";
import { itemTint } from "../utils/color.ts";
import "./closet-page.css";

const CategoryFilterBar = ({
  selectedCategory,
  onCategorySelected,
}: {
  selectedCategory: ClothingItemCategory | null;
  onCategorySelected: (category: ClothingItemCategory | null) => void;
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
        return (
          <button
            key={value ?? "all"}
            type="button"
            ref={isActive ? activeRef : undefined}
            onClick={() => onCategorySelected(value)}
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
  const { removeClothingItem } = useCloset();
  const { outfit, clearOutfit, pinItem, unpinItem } = useOutfit();
  const navigate = useNavigate();

  const isPinned = outfit?.pinnedItemId === item.id;
  const trayBackground = itemTint(item.color);

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
      window.alert(t("closet.pinNoMatch"));
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
              className={`pin-button vera-keep-opaque ${isPinned ? "active" : ""}`}
              aria-label={isPinned ? t("closet.unpinAria") : t("closet.pinAria")}
              aria-pressed={isPinned}
            >
              {isPinned ? <BsPinFill size={14} /> : <BsPin size={14} />}
            </button>
          )}

          {editMode && (
            <button
              onClick={() => remove(item.id)}
              className="delete-button vera-keep-opaque"
              aria-label={t("closet.deleteAria")}
            >
              <IoClose size={14} />
            </button>
          )}
        </div>

        {/* name — reserved two-line area so every card is the same height */}
        <div className="vera-item-name">
          <span>{item.name}</span>
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
  const {
    items: _items,
    addClothingItem,
    isUploadLimitReached,
    markLaundryDone,
  } = useCloset();
  const items = import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _items) : _items;
  const { saveImage } = useImage();
  const { generateOutfit, outfit } = useOutfit();
  const location = useLocation();
  const navigate = useNavigate();
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
  const viewingBasket = location.pathname === "/closet/basket";
  // Destructive edit mode only applies to the closet grid, never the basket.
  const effectiveEdit = editMode && !viewingBasket;
  const toggleBasketView = (): void => {
    if (viewingBasket) {
      navigate(-1);
    } else {
      navigate("/closet/basket");
    }
  };

  useEffect(() => {
    if (!showOnboardingToast) return;
    const timer = window.setTimeout(() => setShowOnboardingToast(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showOnboardingToast]);

  const dirtyItems = useMemo(
    () => items.filter((i) => isWashable(i.category) && !i.isClean),
    [items],
  );
  const dirtyCount = dirtyItems.length;

  const cleanItems = useMemo(
    () => items.filter((i) => !isWashable(i.category) || i.isClean),
    [items],
  );

  const displayedItems = useMemo(() => {
    if (viewingBasket) return dirtyItems;
    return selectedCategory
      ? cleanItems.filter((item) => item.category === selectedCategory)
      : cleanItems;
  }, [viewingBasket, dirtyItems, cleanItems, selectedCategory]);

  async function addItem(item: CreateClothingItem): Promise<void> {
    const newItem = await addClothingItem(item);

    if (item.imageData) {
      await saveImage({
        id: newItem.imageId || newItem.id,
        imageData: item.imageData,
      });
    }
  }

  async function onWash(): Promise<void> {
    await markLaundryDone();
    if (viewingBasket) navigate(-1);
    if (!outfit) {
      await generateOutfit();
    }
  }

  const showEmptyState = displayedItems.length === 0 && !viewingBasket;
  const showAddTile = !viewingBasket && !effectiveEdit && !isUploadLimitReached();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="mx-auto max-w-4xl px-5 pt-3.5 w-full shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="vera-dressing-title">
            {viewingBasket ? t("closet.basketTitle") : t("closet.title")}
          </h2>
          {!viewingBasket && items.length > 0 && (
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
        <div className="mx-auto max-w-4xl px-4 pb-2 w-full shrink-0">
          <OnboardingToast
            onDismiss={() => setShowOnboardingToast(false)}
          />
        </div>
      )}

      {viewingBasket ? (
        <div className="mx-auto max-w-4xl px-4 w-full shrink-0">
          <button
            type="button"
            onClick={toggleBasketView}
            className="vera-back-link"
          >
            <FaChevronLeft />
            {t("closet.backToCloset")}
          </button>
        </div>
      ) : (
        <div className="shrink-0">
          <CategoryFilterBar
            selectedCategory={selectedCategory}
            onCategorySelected={setSelectedCategory}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative">
        <div
          className={`w-full mx-auto max-w-4xl px-4 ${showEmptyState ? "flex-1 flex flex-col justify-center" : "pb-4"}`}
          style={showEmptyState ? undefined : { paddingBottom: footerHeight + 12 }}
        >
          <div className="vera-dressing-sub">
            <span>
              {viewingBasket ? (
                <>
                  <span className="vera-dressing-sub__basket">
                    {t("closet.basketViewItems", { count: dirtyCount })}
                  </span>{" "}
                  · {t("closet.basketViewSub")}
                </>
              ) : (
                <>
                  {t("closet.available", { count: cleanItems.length })}
                  {" · "}
                  <span className="vera-dressing-sub__basket">
                    {t("closet.basketCountInline", { count: dirtyCount })}
                  </span>
                </>
              )}
            </span>
            <span className="vera-dressing-sub__rule" aria-hidden />
          </div>
          <div
            className={`rounded-2xl ${showEmptyState ? "flex-1 flex flex-col justify-center" : ""}`}
          >
            {!showEmptyState ? (
              <div className="grid gap-2.5 grid-cols-2 auto-rows-fr">
                {showAddTile && (
                  <AddItemTile
                    onClick={() => setShowUploadModal(true)}
                    disabled={isUploadLimitReached()}
                  />
                )}
                {displayedItems.map((item) => (
                  <ItemCard key={item.id} item={item} editMode={effectiveEdit} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center pb-20">
                <EmptyMessageTemplate
                  title={t("closet.emptyTitle")}
                  subtitle={t("closet.emptySubtitle")}
                  buttonText={t("closet.emptyButton")}
                  onButtonClick={() => setShowUploadModal(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={footerRef} className="absolute inset-x-0 bottom-0 z-10">
        <AppFooter>
          <BasketStrip
            dirtyCount={dirtyCount}
            viewingBasket={viewingBasket}
            onTap={toggleBasketView}
            onWash={() => void onWash()}
          />

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
