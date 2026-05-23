import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useCloset } from "../hooks/closet.ts";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import {
  categoryOptions,
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
import { FaCheck } from "react-icons/fa";
import { MdAdd, MdChevronLeft, MdLocalLaundryService } from "react-icons/md";
import "./closet-page.css";

const CategoryFilterBar = ({
  selectedCategory,
  onCategorySelected,
}: {
  selectedCategory: ClothingItemCategory | null;
  onCategorySelected: (category: ClothingItemCategory | null) => void;
}): React.JSX.Element => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedCategory]);

  const chips: { value: ClothingItemCategory | null; label: string }[] = [
    { value: null, label: "All" },
    ...categoryOptions.map(({ value, label }) => ({ value, label })),
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
const ItemCard = ({ item }: { item: ClothingItem }): React.JSX.Element => {
  const { getImage, removeImage } = useImage();
  const { removeClothingItem } = useCloset();
  const { outfit, clearOutfit } = useOutfit();

  async function remove(id: string): Promise<void> {
    if (window.confirm(`Are you sure you want to delete this item?`)) {
      await removeClothingItem(id);

      // Also remove the associated image
      if (item.imageId) {
        await removeImage(item.imageId);
      }

      if (item.id === outfit?.top.id || item.id === outfit?.bottom.id) {
        await clearOutfit();
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2 h-full" style={{ aspectRatio: "1 / 1.2" }}>
      <div
        className="vera-card flex flex-col items-center relative h-full"
      >
        <button
          onClick={() => remove(item.id)}
          className="delete-button absolute top-2 right-2 flex items-center justify-center transition-all text-sm font-bold vera-keep-opaque"
          aria-label="Delete item"
        >
          <IoClose size={14} />
        </button>

        <div className="flex-grow flex items-center justify-center w-full min-w-0">
          <div className="flex flex-col items-center w-full min-w-0">
            <div className="text-7xl flex items-center justify-center">
              <img
                src={getImage(item.imageId || item.id)} // Fallback to item.id for backwards compatibility
                alt={item.name}
                className="w-24 h-24 object-contain"
                loading="lazy"
              />
            </div>

            <div className="mt-2 text-sm font-semibold whitespace-nowrap text-ellipsis overflow-hidden w-full text-center">
              {item.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const AddItemButton = ({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}): React.JSX.Element => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Add a new item to your closet"
      title={
        disabled
          ? "The limit of uploaded items has been reached"
          : "Add a new item to your closet"
      }
      className="vera-nav-fab"
    >
      <MdAdd size={26} />
    </button>
  );
};
const BasketImage = ({
  full,
  width,
}: {
  full: boolean;
  width: number;
}): React.JSX.Element => {
  const src = full ? "/assets/basket_full.png" : "/assets/basket_empty.png";
  return (
    <img
      src={src}
      alt={full ? "Full basket" : "Empty basket"}
      style={{ width, height: "auto", display: "block", flexShrink: 0 }}
    />
  );
};

const BasketStrip = ({
  dirtyCount,
  viewingBasket,
  onTap,
  onWash,
}: {
  dirtyCount: number;
  viewingBasket: boolean;
  onTap: () => void;
  onWash: () => void;
}): React.JSX.Element | null => {
  if (dirtyCount === 0 && !viewingBasket) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      className="vera-basket-strip"
      aria-pressed={viewingBasket}
      aria-label={
        viewingBasket
          ? "Showing the basket — tap to go back"
          : `${dirtyCount} ${dirtyCount === 1 ? "item" : "items"} in the basket — tap to view`
      }
    >
      <div className="vera-basket-strip__media">
        <BasketImage full width={44} />
      </div>

      <div className="vera-basket-strip__text">
        {viewingBasket ? (
          <>
            <div className="vera-basket-strip__title">
              <MdChevronLeft size={16} aria-hidden />
              Showing the basket
            </div>
            <div className="vera-basket-strip__sub">Tap to go back</div>
          </>
        ) : (
          <>
            <div className="vera-basket-strip__title">
              {dirtyCount} {dirtyCount === 1 ? "item" : "items"} in the basket
            </div>
            <div className="vera-basket-strip__sub">
              Tap to see what's worn
            </div>
          </>
        )}
      </div>

      {dirtyCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWash();
          }}
          className="vera-btn-primary vera-basket-strip__wash"
          aria-label="Mark all worn items as clean"
          title="Mark all worn items as clean"
        >
          <MdLocalLaundryService size={14} />
          Wash
        </button>
      )}
    </div>
  );
};

const BasketHero = ({ count }: { count: number }): React.JSX.Element => {
  return (
    <div className="vera-basket-hero">
      <BasketImage full={count > 0} width={110} />
      <div className="vera-basket-hero__title">
        {count} {count === 1 ? "item" : "items"} waiting
      </div>
      <div className="vera-basket-hero__sub">Worn since your last wash</div>
    </div>
  );
};

const OnboardingToast = ({
  onDismiss,
}: {
  onDismiss: () => void;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={onDismiss}
    aria-label="Dismiss"
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
        You're set up.
      </div>
      <div style={{ fontSize: 12, color: "#6a7282", marginTop: 2 }}>
        Tap + any time to add more. Check Today tomorrow morning.
      </div>
    </div>
  </button>
);

export const ClosetPage = (): React.JSX.Element => {
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
  const justOnboarded =
    (location.state as { justOnboarded?: boolean } | null)?.justOnboarded ??
    false;
  const [selectedCategory, setSelectedCategory] =
    useState<ClothingItemCategory | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showOnboardingToast, setShowOnboardingToast] = useState<boolean>(
    justOnboarded,
  );
  const [viewingBasket, setViewingBasket] = useState<boolean>(false);

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
    setViewingBasket(false);
    if (!outfit) {
      await generateOutfit();
    }
  }

  const showEmptyState = displayedItems.length === 0 && !viewingBasket;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="mx-auto max-w-4xl px-5 pb-1 w-full shrink-0">
        <h2 className="vera-page-title">My closet</h2>
      </div>

      {showOnboardingToast && (
        <div className="mx-auto max-w-4xl px-4 pb-2 w-full shrink-0">
          <OnboardingToast
            onDismiss={() => setShowOnboardingToast(false)}
          />
        </div>
      )}

      {!viewingBasket && (
        <div className="shrink-0">
          <CategoryFilterBar
            selectedCategory={selectedCategory}
            onCategorySelected={setSelectedCategory}
          />
        </div>
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col relative"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
        }}
      >
        {viewingBasket && <BasketHero count={dirtyCount} />}

        <div
          className={`w-full mx-auto max-w-4xl px-4 ${showEmptyState ? "flex-1 flex flex-col justify-center" : "pb-56"}`}
        >
          <div
            className={`rounded-2xl ${showEmptyState ? "flex-1 flex flex-col justify-center" : ""}`}
          >
            {displayedItems.length > 0 ? (
              <div className="grid gap-2 grid-cols-2 auto-rows-fr">
                {displayedItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
                {(() => {
                  const slotCount = viewingBasket ? 4 : 6;
                  return displayedItems.length < slotCount
                    ? Array.from({ length: slotCount - displayedItems.length }).map((_, i) => (
                        <div key={`placeholder-${i}`} className="flex flex-col gap-2 p-2 h-full">
                          <div className="vera-empty-slot w-full h-full" aria-hidden />
                        </div>
                      ))
                    : null;
                })()}
              </div>
            ) : (
              !viewingBasket && (
                <div className="flex-1 flex items-center justify-center pb-20">
                  <EmptyMessageTemplate
                    title="No items found."
                    subtitle="Try selecting a different filter or add a new item!"
                    buttonText="Add an item"
                    onButtonClick={() => setShowUploadModal(true)}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 h-20" />

      <BasketStrip
        dirtyCount={dirtyCount}
        viewingBasket={viewingBasket}
        onTap={() => setViewingBasket((v) => !v)}
        onWash={() => void onWash()}
      />

      <NavigationBar
        activePage="closet"
        action={
          items.length > 0 ? (
            <AddItemButton
              onClick={() => setShowUploadModal(true)}
              disabled={isUploadLimitReached()}
            />
          ) : undefined
        }
      />

      {showUploadModal && (
        <UploadClothingItemModal
          onClose={() => setShowUploadModal(false)}
          onSave={addItem}
        />
      )}
    </div>
  );
};
