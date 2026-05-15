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
import { MdAdd, MdLocalLaundryService } from "react-icons/md";
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
    <div className="flex flex-col gap-2 p-2 h-full">
      <div
        className={`vera-card flex flex-col items-center relative h-full ${!item.isClean && isWashable(item.category) ? "vera-dirty-overlay" : ""}`}
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
                className="w-24 h-24 object-contain rounded-xl"
                loading="lazy"
              />
            </div>

            <div className="mt-2 text-sm text-black font-semibold whitespace-nowrap text-ellipsis overflow-hidden w-full text-center">
              {item.name}
            </div>
          </div>
        </div>

        {isWashable(item.category) && (
          <div className="vera-keep-opaque mt-1 flex-shrink-0">
            <span className={`vera-badge ${item.isClean ? "vera-badge--clean" : "vera-badge--dirty"}`}>
              {item.isClean ? "clean" : "dirty"}
            </span>
          </div>
        )}
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
    <div className="flex justify-center">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label="Add a new item to your closet"
        title={
          disabled
            ? "The limit of uploaded items has been reached"
            : "Add a new item to your closet"
        }
        className={`fixed right-5 z-200 shadow-lg vera-btn-primary transition-all ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ width: 56, height: 56, bottom: 116 }}
      >
        <div className="flex items-center justify-center">
          <MdAdd size={30} />
        </div>
      </button>
    </div>
  );
};
const LaundryButton = (): React.JSX.Element => {
  const { areAllItemsClean, markLaundryDone } = useCloset();
  const { generateOutfit, outfit } = useOutfit();

  async function onDoLaundry(): Promise<void> {
    await markLaundryDone();

    if (!outfit) {
      await generateOutfit();
    }
  }

  return (
    <button
      className="vera-btn-primary mb-4 w-full py-3 flex items-center justify-center gap-2 text-base font-semibold transition-all "
      aria-label="Mark all worn items as clean"
      title="Mark all worn items as clean"
      onClick={() => onDoLaundry()}
      disabled={areAllItemsClean()}
    >
      <MdLocalLaundryService size={20} />
      Wash all items
    </button>
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
  const { items, addClothingItem, isUploadLimitReached, areAllItemsClean } = useCloset();
  const { saveImage } = useImage();
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

  useEffect(() => {
    if (!showOnboardingToast) return;
    const timer = window.setTimeout(() => setShowOnboardingToast(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showOnboardingToast]);

  const filteredItems = useMemo(
    () =>
      selectedCategory
        ? items.filter((item) => item.category === selectedCategory)
        : items,
    [selectedCategory, items],
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-1 w-full shrink-0">
        <h2 className="vera-page-title">Your closet</h2>
      </div>

      {showOnboardingToast && (
        <div className="mx-auto max-w-4xl px-4 pb-2 w-full shrink-0">
          <OnboardingToast
            onDismiss={() => setShowOnboardingToast(false)}
          />
        </div>
      )}

      <div className="shrink-0">
        <CategoryFilterBar
          selectedCategory={selectedCategory}
          onCategorySelected={setSelectedCategory}
        />
      </div>

      <div className="shrink-0 w-full mx-auto max-w-4xl px-4 pt-2">
        <LaundryButton />
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col relative"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
        }}
      >
        <div className={`w-full mx-auto max-w-4xl px-4 ${filteredItems.length === 0 ? "flex-1 flex flex-col justify-center" : "pb-8"}`}>
          <div className={`rounded-2xl ${filteredItems.length === 0 ? "flex-1 flex flex-col justify-center" : ""}`}>
            {filteredItems.length > 0 ? (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
                {filteredItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
                {filteredItems.length < 4 &&
                  Array.from({ length: 4 - filteredItems.length }).map((_, i) => (
                    <div key={`placeholder-${i}`} className="flex flex-col gap-2 p-2 h-full">
                      <div className="vera-empty-slot w-full h-full" aria-hidden />
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyMessageTemplate
                  title="No items found."
                  subtitle="Try selecting a different filter or add a new item!"
                  buttonText="Add an item"
                  onButtonClick={() => setShowUploadModal(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for basket overflow */}
      <div className="shrink-0 h-8" />

      {/* Basket */}
      <div
        className="shrink-0 mx-auto w-64 md:w-80 h-44 md:h-56 mb-16 flex items-center justify-center pointer-events-none"
        aria-label="Wear basket"
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1/2",
            backgroundImage: "url(/assets/basket-grid.png)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "200% 100%",
            backgroundPosition: areAllItemsClean() ? "0 0" : "94% 0",
            imageRendering: "auto",
          }}
          aria-label={areAllItemsClean() ? "Empty basket" : "Full basket"}
        />
      </div>

      <NavigationBar activePage="closet" />
      <AddItemButton
        onClick={() => setShowUploadModal(true)}
        disabled={isUploadLimitReached()}
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
