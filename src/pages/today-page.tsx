import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { useOutfit } from "../hooks/outfit.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useFavouriteOutfits } from "../hooks/favourite-outfits.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import {
  FaCheck,
  FaChevronRight,
  FaHeart,
  FaPlus,
  FaRegHeart,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";
import { PiPantsFill, PiTShirtFill } from "react-icons/pi";
import { useNavigate } from "react-router";
import { isDarkColor } from "../utils/color.ts";
import "../pages/today-page.css";

const formatDate = (d: Date): string =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

type RailProps = {
  glyph: React.ReactNode;
  topLine: boolean;
  bottomLine: boolean;
  muted?: boolean;
};

const RailColumn = ({ glyph, topLine, bottomLine, muted }: RailProps) => (
  <div
    className={[
      "today-rail-col",
      !topLine ? "no-top-line" : "",
      !bottomLine ? "no-bottom-line" : "",
    ].join(" ")}
  >
    <div className={`today-rail-dot ${muted ? "muted" : "solid"}`}>{glyph}</div>
  </div>
);

const PieceRow = ({
  piece,
  label,
  rail,
  imageSrc,
}: {
  piece: ClothingItem;
  label: string;
  rail: { glyph: React.ReactNode; topLine: boolean; bottomLine: boolean };
  imageSrc: string | undefined;
}) => {
  const dark = isDarkColor(piece.color);
  const tint = dark
    ? piece.color
    : `color-mix(in oklab, ${piece.color} 22%, #ffffff)`;
  const borderColor = dark
    ? `color-mix(in oklab, ${piece.color} 60%, #ffffff)`
    : `color-mix(in oklab, ${piece.color} 28%, #ffffff)`;
  const nameColor = dark ? "#ffffff" : "var(--vera-fg-strong)";
  const labelColor = dark ? "rgba(255,255,255,0.65)" : "var(--vera-fg-muted)";

  return (
    <div className="today-piece-row">
      <RailColumn
        glyph={rail.glyph}
        topLine={rail.topLine}
        bottomLine={rail.bottomLine}
      />
      <div
        className="today-piece-card"
        style={{ background: tint, border: `1px solid ${borderColor}` }}
      >
        <div className="today-piece-well">
          {imageSrc && (
            <img src={imageSrc} alt={piece.name} loading="lazy" />
          )}
        </div>
        <div className="today-piece-text">
          <div className="today-piece-name" style={{ color: nameColor }}>
            {piece.name}
          </div>
          <div className="today-piece-label" style={{ color: labelColor }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};

const AccessoryRow = ({
  added,
  onAddClick,
  onRemove,
  getImage,
}: {
  added: ClothingItem[];
  onAddClick: () => void;
  onRemove: (id: string) => void;
  getImage: (id: string) => string | undefined;
}) => {
  const empty = added.length === 0;
  return (
    <div className="today-accessory-row">
      <RailColumn
        glyph={<FaPlus size={10} />}
        topLine
        bottomLine={false}
        muted={empty}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", marginBlock: 6 }}>
        {empty ? (
          <button
            type="button"
            onClick={onAddClick}
            className="today-accessory-add"
          >
            <FaPlus size={10} />
            Add an accessory
          </button>
        ) : (
          <div className="today-accessory-list">
            {added.map((it) => (
              <div key={it.id} className="today-accessory-chip">
                <div className="today-accessory-thumb">
                  {getImage(it.id) && (
                    <img src={getImage(it.id)} alt={it.name} loading="lazy" />
                  )}
                </div>
                <span className="today-accessory-name">{it.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  aria-label={`Remove ${it.name}`}
                  className="today-accessory-remove"
                >
                  <FaTimes />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddClick}
              aria-label="Add another item"
              className="today-accessory-add-more"
            >
              <FaPlus />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SwipeToWear = ({ onConfirm }: { onConfirm: () => void }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const thumbSize = 48;
  const padding = 4;

  useLayoutEffect(() => {
    const update = (): void => {
      if (!trackRef.current) return;
      const w = trackRef.current.offsetWidth;
      setMaxDrag(Math.max(0, w - thumbSize - padding * 2));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding - thumbSize / 2;
    setDrag(Math.max(0, Math.min(maxDrag, x)));
  };

  const onPointerUp = (): void => {
    if (!dragging) return;
    setDragging(false);
    setDrag(0);
    if (drag > maxDrag * 0.7) {
      onConfirm();
    }
  };

  const progress = maxDrag === 0 ? 0 : drag / maxDrag;

  return (
    <div ref={trackRef} className="today-swipe-track">
      <div className="today-swipe-label">
        <span style={{ opacity: 1 - progress * 0.7 }}>Swipe to wear</span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="today-swipe-thumb"
        style={{
          transform: `translateX(${drag}px)`,
          transition: dragging ? "none" : "transform 220ms var(--vera-ease)",
        }}
      >
        <FaChevronRight size={16} />
      </div>
    </div>
  );
};

const AccessorySheet = ({
  open,
  onClose,
  library,
  selectedIds,
  onPick,
  getImage,
}: {
  open: boolean;
  onClose: () => void;
  library: ClothingItem[];
  selectedIds: string[];
  onPick: (it: ClothingItem) => void;
  getImage: (id: string) => string | undefined;
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-300 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl p-4 shadow-xl"
        style={{ maxHeight: "70%", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Add an accessory</h3>
          <button
            className="p-2 text-gray-500"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="today-sheet-grid">
          {library.length === 0 ? (
            <div className="today-sheet-empty">
              Nothing to add, your closet doesn't have any extra items yet.
            </div>
          ) : (
            library.map((it) => {
              const picked = selectedIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={picked}
                  onClick={() => onPick(it)}
                  className="today-sheet-item"
                >
                  <div className="today-sheet-thumb">
                    {getImage(it.id) && (
                      <img
                        src={getImage(it.id)}
                        alt={it.name}
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="today-sheet-name">{it.name}</div>
                  <div className="today-sheet-added" style={{ visibility: picked ? "visible" : "hidden" }}>
                    <FaCheck size={10} />
                    added
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const FavouriteHeart = () => {
  const { outfit } = useOutfit();
  const { addFavourite, removeFavouriteByOutfit, isFavourite } =
    useFavouriteOutfits();

  if (!outfit) return null;

  const favourited = isFavourite(
    outfit.top.id,
    outfit.bottom.id,
    outfit.outerwear?.id,
    outfit.shoes?.id,
    outfit.accessories?.map((a) => a.id),
  );

  const onToggle = async (): Promise<void> => {
    if (favourited) {
      await removeFavouriteByOutfit(
        outfit.top.id,
        outfit.bottom.id,
        outfit.outerwear?.id,
        outfit.shoes?.id,
        outfit.accessories?.map((a) => a.id),
      );
    } else {
      await addFavourite(
        outfit.top.id,
        outfit.bottom.id,
        outfit.outerwear?.id,
        outfit.shoes?.id,
        outfit.accessories?.map((a) => a.id),
      );
    }
  };

  return (
    <button
      type="button"
      onClick={() => onToggle()}
      aria-label={
        favourited ? "Remove from favourites" : "Add to favourites"
      }
      className={`today-heart ${favourited ? "active" : ""}`}
    >
      {favourited ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
    </button>
  );
};

const TodayOutfit = (): React.JSX.Element => {
  const { getImage } = useImage();
  const { items: _items, isItemClean, markWorn } = useCloset();
  const items = import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _items) : _items;
  const {
    outfit: _outfit,
    generateOutfit,
    clearOutfit,
    canGenerateOutfit,
    addItemToOutfit,
    removeItemFromOutfit,
  } = useOutfit();
  const outfit = import.meta.env.VITE_ENABLE_DEBUG === "true" ? undefined : _outfit;
  const { recordOutfit } = useOutfitHistory();
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!outfit) {
      void generateOutfit();
    } else if (!isItemClean(outfit.top.id) || !isItemClean(outfit.bottom.id)) {
      void clearOutfit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit, items, generateOutfit, clearOutfit]);

  const handleConfirmWorn = async (): Promise<void> => {
    if (!outfit) return;
    await recordOutfit(
      outfit.top.id,
      outfit.bottom.id,
      outfit.outerwear?.id,
      outfit.shoes?.id,
      outfit.accessories?.map((a) => a.id),
    );
    await markWorn(outfit.top);
    await markWorn(outfit.bottom);
    if (outfit.outerwear) await markWorn(outfit.outerwear);
    if (outfit.shoes) await markWorn(outfit.shoes);
    if (outfit.accessories) {
      for (const accessory of outfit.accessories) {
        await markWorn(accessory);
      }
    }
    await clearOutfit();
    await generateOutfit();
  };

  const hasVisibleOutfit =
    !!outfit &&
    isItemClean(outfit.top.id) &&
    isItemClean(outfit.bottom.id);

  if (!hasVisibleOutfit) {
    return (
      <>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "100px" }}>
          <EmptyMessageTemplate
            title="No outfit right now."
            subtitle="All your clothes are in the basket — time to do laundry!"
            buttonText="Go to closet"
            onButtonClick={() => navigate("/closet")}
          />
        </div>
        <NavigationBar activePage="today" />
      </>
    );
  }

  const added: ClothingItem[] = [
    outfit!.outerwear,
    outfit!.shoes,
    ...(outfit!.accessories ?? []),
  ].filter((x): x is ClothingItem => Boolean(x));

  const library = items.filter(
    (i) => i.category !== "top" && i.category !== "bottom",
  );

  const onRegenerate = async (): Promise<void> => {
    await generateOutfit();
  };

  return (
    <>
      <div className="today-rail-area">
        <div className="today-rail-stack">
          <FavouriteHeart />
          <PieceRow
            piece={outfit!.top}
            label="Top"
            rail={{ glyph: <PiTShirtFill size={10} />, topLine: false, bottomLine: true }}
            imageSrc={getImage(outfit!.top.id)}
          />
          <PieceRow
            piece={outfit!.bottom}
            label="Bottom"
            rail={{
              glyph: <PiPantsFill size={10} />,
              topLine: true,
              bottomLine: true,
            }}
            imageSrc={getImage(outfit!.bottom.id)}
          />
          <AccessoryRow
            added={added}
            onAddClick={() => setPickerOpen(true)}
            onRemove={(id) => void removeItemFromOutfit(id)}
            getImage={getImage}
          />
        </div>
        <div style={{ height: 160 }} />
      </div>

      <div className="today-swipe-wrap">
        <SwipeToWear onConfirm={() => void handleConfirmWorn()} />
      </div>

      <NavigationBar
        activePage="today"
        action={
          <button
            type="button"
            onClick={() => void onRegenerate()}
            aria-label="Regenerate the outfit"
            disabled={!canGenerateOutfit()}
            className="vera-nav-fab"
          >
            <FaSyncAlt size={18} />
          </button>
        }
      />

      <AccessorySheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        library={library}
        selectedIds={added.map((a) => a.id)}
        onPick={(it) => {
          void addItemToOutfit(it);
          setPickerOpen(false);
        }}
        getImage={getImage}
      />
    </>
  );
};

export const TodayPage = (): React.JSX.Element => {
  const today = formatDate(new Date());

  return (
    <div className="today-page">
      <div className="today-header">
        <h2 className="vera-page-title">{today}</h2>
      </div>

      <TodayOutfit />
    </div>
  );
};
