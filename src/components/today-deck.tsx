import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  FaCheck,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaHandPointer,
  FaHeart,
  FaPlus,
  FaRegHeart,
  FaTimes,
} from "react-icons/fa";
import NavigationBar from "./navigation-bar.tsx";
import EmptyMessageTemplate from "./empty-message-template.tsx";
import { BasketStrip } from "./basket-strip.tsx";
import { AppFooter } from "./app-footer.tsx";
import { useOutfit } from "../hooks/outfit.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useLookbook } from "../hooks/lookbook.ts";
import { useWeather } from "../hooks/weather.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import type { Color } from "../models/color.ts";
import type { Outfit } from "../models/outfit.ts";
import { ALL_OCCASIONS, fitsOccasion, type Occasion } from "../models/occasion.ts";
import { isDarkColor } from "../utils/color.ts";
import "./today-deck.css";

type Filter = Occasion | "all";
const FILTERS: Filter[] = ["all", ...ALL_OCCASIONS];

// Card + collage geometry (mirrors the design prototype). The collage well is a
// fixed-size canvas so the overlapping tiles keep their composition regardless of
// the phone-frame width.
const CARD_W = 296;
const CARD_H = 426;
const WELL_W = 264;
const WELL_H = 330;

type Pos = { left: number; top: number; w: number; h: number; rot: number; z: number };
const POS: Record<"acc" | "top" | "bottom" | "shoes", Pos> = {
  acc: { left: 0, top: 8, w: 90, h: 104, rot: -8, z: 3 },
  top: { left: 84, top: 0, w: 176, h: 200, rot: 4, z: 2 },
  bottom: { left: 6, top: 150, w: 152, h: 178, rot: -3, z: 4 },
  shoes: { left: 152, top: 200, w: 112, h: 130, rot: 7, z: 5 },
};

// Flat collage tile chrome derived from the item colour. Dark items render as a
// solid block with white text; light items get a soft tint toward white.
const tints = (color: Color) => {
  const dark = isDarkColor(color);
  return {
    bg: dark ? color : `color-mix(in oklab, ${color} 62%, #ffffff)`,
    border: dark
      ? `color-mix(in oklab, ${color} 60%, #1a1a1a)`
      : `color-mix(in oklab, ${color} 72%, #ffffff)`,
    name: dark ? "#ffffff" : "var(--vera-fg-strong)",
    label: dark ? "rgba(255,255,255,0.6)" : "var(--vera-fg-muted)",
  };
};

const cardKeyOf = (o: Outfit): string => `${o.top.id}|${o.bottom.id}`;

// The piece that fills the "acc" collage well: the layer takes priority over an
// accessory on a cold day, otherwise the first accessory.
const accWellPiece = (o: Outfit): ClothingItem | undefined =>
  o.outerwear ?? o.accessories?.[0];

// ────────── Item tile (filled) ──────────
const ItemTile = ({
  piece,
  pos,
  imageSrc,
  onRemove,
}: {
  piece: ClothingItem;
  pos: Pos;
  imageSrc: string | undefined;
  onRemove?: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const tint = tints(piece.color);
  const big = pos.w > 120;
  return (
    <div
      className="deck-tile"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.w,
        height: pos.h,
        transform: `rotate(${pos.rot}deg)`,
        zIndex: pos.z,
        background: tint.bg,
        border: `1px solid ${tint.border}`,
        padding: big ? "9px 9px 8px" : "7px 6px 6px",
      }}
    >
      {onRemove && (
        <button
          type="button"
          className="deck-tile-remove"
          aria-label="Remove item"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
        >
          <FaTimes />
        </button>
      )}
      <div className="deck-tile-head">
        <div
          className="deck-tile-name"
          style={{ color: tint.name, fontSize: big ? 15 : 11.5 }}
        >
          {piece.name}
        </div>
        <div className="deck-tile-label" style={{ color: tint.label }}>
          {t(`today.tileLabel.${piece.category}`)}
        </div>
      </div>
      <div className="deck-tile-img">
        {imageSrc && <img src={imageSrc} alt={piece.name} loading="lazy" />}
      </div>
    </div>
  );
};

// ────────── Card face (flat collage + chrome) ──────────
const CardFace = ({
  outfit,
  worn,
  fav,
  getImage,
  editable,
  onToggleFav,
  onAddSlot,
  onRemovePiece,
}: {
  outfit: Outfit;
  worn: boolean;
  fav: boolean;
  getImage: (id: string) => string | undefined;
  editable: boolean;
  onToggleFav?: () => void;
  onAddSlot?: () => void;
  onRemovePiece?: (id: string) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const acc = accWellPiece(outfit);
  // Pieces beyond the single acc well (e.g. a layer + accessory both present).
  const accBucket = [outfit.outerwear, ...(outfit.accessories ?? [])].filter(
    (x): x is ClothingItem => Boolean(x),
  );
  const extraCount = Math.max(0, accBucket.length - 1);

  return (
    <div className={`deck-card ${worn ? "worn" : ""}`}>
      <div className="deck-card-chrome">
        {worn ? (
          <div className="deck-worn-badge">
            <FaCheck size={11} />
            {t("today.wearingBadge")}
          </div>
        ) : (
          editable &&
          onAddSlot && (
            <button
              type="button"
              className="deck-add-btn"
              aria-label={t("today.addAccessory")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onAddSlot}
            >
              <FaPlus size={10} />
              {t("today.addAccessory")}
            </button>
          )
        )}
        {onToggleFav && (
          <button
            type="button"
            className={`deck-heart ${fav ? "active" : ""}`}
            aria-label={fav ? t("today.heartRemoveAria") : t("today.heartAddAria")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleFav}
          >
            {fav ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
          </button>
        )}
      </div>

      <div className="deck-well-wrap">
        <div className="deck-well" style={{ width: WELL_W, height: WELL_H }}>
          {acc && (
            <ItemTile
              piece={acc}
              pos={POS.acc}
              imageSrc={getImage(acc.id)}
              onRemove={editable ? () => onRemovePiece?.(acc.id) : undefined}
            />
          )}
          {extraCount > 0 && (
            <div className="deck-extra-badge" style={{ zIndex: POS.acc.z + 1 }}>
              +{extraCount}
            </div>
          )}

          <ItemTile piece={outfit.top} pos={POS.top} imageSrc={getImage(outfit.top.id)} />
          <ItemTile
            piece={outfit.bottom}
            pos={POS.bottom}
            imageSrc={getImage(outfit.bottom.id)}
          />

          {outfit.shoes && (
            <ItemTile
              piece={outfit.shoes}
              pos={POS.shoes}
              imageSrc={getImage(outfit.shoes.id)}
              onRemove={
                editable ? () => onRemovePiece?.(outfit.shoes!.id) : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ────────── Peek card (behind the front) ──────────
const PeekCard = ({
  outfit,
  depth,
  getImage,
}: {
  outfit: Outfit;
  depth: 1 | 2;
  getImage: (id: string) => string | undefined;
}): React.JSX.Element => {
  const scale = depth === 1 ? 0.955 : 0.91;
  const y = depth === 1 ? 12 : 24;
  return (
    <div
      aria-hidden="true"
      className="deck-peek"
      style={{
        transform: `translateY(${y}px) scale(${scale})`,
        opacity: depth === 1 ? 0.7 : 0.45,
      }}
    >
      <CardFace
        outfit={outfit}
        worn={false}
        fav={false}
        getImage={getImage}
        editable={false}
      />
    </div>
  );
};

// ────────── Front (interactive) card ──────────
const FrontCard = ({
  outfit,
  worn,
  fav,
  getImage,
  swipeEnabled,
  onToggleFav,
  onAddSlot,
  onRemovePiece,
  onWearToggle,
  onSwiped,
}: {
  outfit: Outfit;
  worn: boolean;
  fav: boolean;
  getImage: (id: string) => string | undefined;
  swipeEnabled: boolean;
  onToggleFav: () => void;
  onAddSlot: () => void;
  onRemovePiece: (id: string) => void;
  onWearToggle: () => void;
  onSwiped: () => void;
}): React.JSX.Element => {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flyDir, setFlyDir] = useState(0);
  const st = useRef({ down: false, x: 0, y: 0, moved: false, dx: 0, consumed: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (flyDir) return;
    st.current = { down: true, x: e.clientX, y: e.clientY, moved: false, dx: 0, consumed: false };
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!st.current.down || flyDir) return;
    const ddx = e.clientX - st.current.x;
    const ddy = e.clientY - st.current.y;
    if (!st.current.moved && Math.hypot(ddx, ddy) > 6) st.current.moved = true;
    if (st.current.moved && swipeEnabled) {
      st.current.dx = ddx;
      setDx(ddx);
    }
  };
  const finishDrag = (): void => {
    if (!st.current.down || flyDir) return;
    st.current.down = false;
    setDragging(false);
    // A press without movement is a tap → toggle "worn".
    if (!st.current.moved) {
      onWearToggle();
      setDx(0);
      return;
    }
    if (!swipeEnabled) {
      setDx(0);
      return;
    }
    const cur = st.current.dx;
    if (Math.abs(cur) > 86) {
      const dir = cur > 0 ? 1 : -1;
      setFlyDir(dir);
      window.setTimeout(() => {
        if (st.current.consumed) return;
        st.current.consumed = true;
        onSwiped();
      }, 300);
    } else {
      setDx(0);
    }
  };

  const transform = flyDir
    ? `translateX(${flyDir * 560}px) rotate(${flyDir * 20}deg)`
    : `translateX(${dx}px) rotate(${dx * 0.05}deg)`;

  return (
    <div
      className="deck-front"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{
        transform,
        opacity: flyDir ? 0 : 1,
        transition: dragging
          ? "none"
          : "transform .32s var(--vera-ease), opacity .32s var(--vera-ease)",
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <CardFace
        outfit={outfit}
        worn={worn}
        fav={fav}
        getImage={getImage}
        editable={!worn}
        onToggleFav={onToggleFav}
        onAddSlot={onAddSlot}
        onRemovePiece={onRemovePiece}
      />
    </div>
  );
};

// ────────── Deck (stack) ──────────
// The whole stack is authored at a fixed design size (CARD_W × CARD_H) and scaled
// uniformly to fill the available height — so the collage, chrome and peek offsets
// all grow together and the hint sits snugly below instead of floating in a void.
const Deck = ({
  front,
  frontKey,
  peekA,
  peekB,
  worn,
  fav,
  scale,
  getImage,
  swipeEnabled,
  onToggleFav,
  onAddSlot,
  onRemovePiece,
  onWearToggle,
  onSwiped,
}: {
  front: Outfit;
  frontKey: string;
  peekA?: Outfit;
  peekB?: Outfit;
  worn: boolean;
  fav: boolean;
  scale: number;
  getImage: (id: string) => string | undefined;
  swipeEnabled: boolean;
  onToggleFav: () => void;
  onAddSlot: () => void;
  onRemovePiece: (id: string) => void;
  onWearToggle: () => void;
  onSwiped: () => void;
}): React.JSX.Element => (
  <div
    className="deck-scale-box"
    style={{ width: CARD_W * scale, height: CARD_H * scale }}
  >
    <div
      className="deck-stack"
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {peekB && <PeekCard outfit={peekB} depth={2} getImage={getImage} />}
      {peekA && <PeekCard outfit={peekA} depth={1} getImage={getImage} />}
      <FrontCard
        key={frontKey}
        outfit={front}
        worn={worn}
        fav={fav}
        getImage={getImage}
        swipeEnabled={swipeEnabled}
        onToggleFav={onToggleFav}
        onAddSlot={onAddSlot}
        onRemovePiece={onRemovePiece}
        onWearToggle={onWearToggle}
        onSwiped={onSwiped}
      />
    </div>
  </div>
);

// ────────── Filter chips ──────────
const FilterChips = ({
  active,
  onSelect,
}: {
  active: Filter;
  onSelect: (f: Filter) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="today-occasions" role="group" aria-label={t("today.occasionLabel")}>
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          className={`today-occasion-chip ${f === active ? "active" : ""}`}
          aria-pressed={f === active}
          onClick={() => onSelect(f)}
        >
          {f === "all" ? t("today.filterAll") : t(`today.occasion.${f}`)}
        </button>
      ))}
    </div>
  );
};

// ────────── Accessory picker sheet (reused from the rail layout) ──────────
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
}): React.JSX.Element | null => {
  const { t } = useTranslation();
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
          <h3 className="text-lg font-semibold">{t("today.sheetTitle")}</h3>
          <button
            className="p-2 text-gray-500"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
        <div className="today-sheet-grid">
          {library.length === 0 ? (
            <div className="today-sheet-empty">{t("today.sheetEmpty")}</div>
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
                      <img src={getImage(it.id)} alt={it.name} loading="lazy" />
                    )}
                  </div>
                  <div className="today-sheet-name">{it.name}</div>
                  <div
                    className="today-sheet-added"
                    style={{ visibility: picked ? "visible" : "hidden" }}
                  >
                    <FaCheck size={10} />
                    {t("today.sheetAdded")}
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

type WornState = { cardKey: string; recordId: string; snapshot: Outfit };

// ────────── Page (deck) ──────────
export const TodayDeck = (): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getImage } = useImage();
  const { items, markWorn, markClean, isItemClean } = useCloset();
  const { buildDeck } = useOutfit();
  const { weather } = useWeather();
  const { recordOutfit, removeOutfitRecord } = useOutfitHistory();
  const {
    lookbook,
    recordWear,
    isInLookbook,
    addToLookbook,
    removeFromLookbookByOutfit,
  } = useLookbook();

  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState<Record<string, Partial<Outfit>>>({});
  const [worn, setWorn] = useState<WornState | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);

  // Scale the fixed-design card to fill the available height of the deck region,
  // so the card grows on taller phones and the hint stays snug beneath it. A
  // callback ref wires up the observer the moment the region mounts (which only
  // happens in the non-empty branch).
  const [scale, setScale] = useState(1);
  const roRef = useRef<ResizeObserver | null>(null);
  const setRegionRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    // Space the hint + peek tail need below the card, in design pixels.
    const HINT_RESERVE = 70;
    let raf = 0;
    const measure = (): void => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = el.clientWidth - padX;
      const availH = el.clientHeight - padY - HINT_RESERVE;
      if (availW <= 0 || availH <= 0) return;
      const s = Math.min(availW / CARD_W, availH / CARD_H);
      setScale(Math.max(0.8, Math.min(1.35, s)));
    };
    const onResize = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  const deck = useMemo(
    () => buildDeck(filter),
    // buildDeck is recreated each render; rebuild only on the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filter, weather?.fetchedAt],
  );

  // Picking a chip narrows the deck and resets to the top; per-card edits don't
  // carry across filters.
  useEffect(() => {
    setIndex(0);
    setEdits({});
  }, [filter]);

  const mergeEdits = (base: Outfit): Outfit => {
    const o = edits[cardKeyOf(base)];
    return o ? { ...base, ...o } : base;
  };

  const len = deck.length;
  const canSwipe = len > 1;
  const baseFront = len ? deck[index % len] : null;
  const front: Outfit | null = worn ? worn.snapshot : baseFront ? mergeEdits(baseFront) : null;
  const frontKey = worn ? worn.cardKey : baseFront ? cardKeyOf(baseFront) : "";
  const peekA = worn ? deck[0] : len > 1 ? mergeEdits(deck[(index + 1) % len]) : undefined;
  const peekB = worn ? deck[1] : len > 2 ? mergeEdits(deck[(index + 2) % len]) : undefined;

  // ── Wear commit + undo ──
  const commitWear = async (eff: Outfit, key: string): Promise<void> => {
    const accessoryIds = (eff.accessories?.map((a) => a.id) || []).slice().sort();
    const matching = lookbook.find(
      (entry) =>
        entry.topId === eff.top.id &&
        entry.bottomId === eff.bottom.id &&
        entry.outerwearId === eff.outerwear?.id &&
        entry.shoesId === eff.shoes?.id &&
        JSON.stringify([...(entry.accessoriesIds || [])].sort()) ===
          JSON.stringify(accessoryIds),
    );
    if (matching) await recordWear(matching.id);
    const recordId = await recordOutfit(
      eff.top.id,
      eff.bottom.id,
      eff.outerwear?.id,
      eff.shoes?.id,
      eff.accessories?.map((a) => a.id),
    );
    await markWorn(eff.top);
    await markWorn(eff.bottom);
    if (eff.outerwear) await markWorn(eff.outerwear);
    if (eff.shoes) await markWorn(eff.shoes);
    for (const a of eff.accessories ?? []) await markWorn(a);
    setWorn({ cardKey: key, recordId, snapshot: eff });
  };

  const undoWear = async (): Promise<void> => {
    if (!worn) return;
    const eff = worn.snapshot;
    await markClean(eff.top);
    await markClean(eff.bottom);
    if (eff.outerwear) await markClean(eff.outerwear);
    if (eff.shoes) await markClean(eff.shoes);
    for (const a of eff.accessories ?? []) await markClean(a);
    await removeOutfitRecord(worn.recordId);
    setWorn(null);
  };

  // ── Per-card secondary editing ──
  const applyEdit = (key: string, item: ClothingItem): void => {
    setEdits((prev) => {
      const cur: Partial<Outfit> = { ...(prev[key] || {}) };
      if (item.category === "outerwear") cur.outerwear = item;
      else if (item.category === "shoes") cur.shoes = item;
      else if (item.category === "accessories") {
        const existing = cur.accessories ?? [];
        if (!existing.some((a) => a.id === item.id))
          cur.accessories = [...existing, item];
      }
      return { ...prev, [key]: cur };
    });
  };

  const removePiece = (key: string, eff: Outfit, itemId: string): void => {
    setEdits((prev) => {
      const cur: Partial<Outfit> = { ...(prev[key] || {}) };
      if (eff.outerwear?.id === itemId) cur.outerwear = undefined;
      if (eff.shoes?.id === itemId) cur.shoes = undefined;
      if (eff.accessories?.some((a) => a.id === itemId))
        cur.accessories = eff.accessories.filter((a) => a.id !== itemId);
      return { ...prev, [key]: cur };
    });
  };

  const library = items.filter(
    (i) => i.category !== "top" && i.category !== "bottom",
  );
  const selectedIds = front
    ? [front.outerwear?.id, front.shoes?.id, ...(front.accessories?.map((a) => a.id) ?? [])].filter(
        (x): x is string => Boolean(x),
      )
    : [];

  // ── Empty state (no clean duo for this filter) ──
  if (!front) {
    const cleanTops = items.filter(
      (i) => i.category === "top" && isItemClean(i.id),
    );
    const cleanBottoms = items.filter(
      (i) => i.category === "bottom" && isItemClean(i.id),
    );
    const hasCleanDuo = cleanTops.length > 0 && cleanBottoms.length > 0;
    const matchesFilter = (i: ClothingItem): boolean =>
      filter === "all" || fitsOccasion(i, filter);
    const hasFilterDuo =
      cleanTops.some(matchesFilter) && cleanBottoms.some(matchesFilter);
    const occasionBlocked = hasCleanDuo && !hasFilterDuo;
    const emptyKey = occasionBlocked ? "today.emptyOccasion" : "today.empty";

    return (
      <>
        <FilterChips active={filter} onSelect={setFilter} />
        <div className="deck-region deck-region-empty">
          <EmptyMessageTemplate
            title={t(`${emptyKey}.title`)}
            subtitle={t(`${emptyKey}.subtitle`)}
            buttonText={t(`${emptyKey}.button`)}
            onButtonClick={() => navigate("/closet")}
          />
        </div>
        <AppFooter>
          <div className="deck-basket-slot">
            <BasketStrip />
          </div>
          <NavigationBar activePage="today" />
        </AppFooter>
      </>
    );
  }

  const fav = isInLookbook(
    front.top.id,
    front.bottom.id,
    front.outerwear?.id,
    front.shoes?.id,
    front.accessories?.map((a) => a.id),
  );

  const onToggleFav = (): void => {
    if (fav) {
      void removeFromLookbookByOutfit(
        front.top.id,
        front.bottom.id,
        front.outerwear?.id,
        front.shoes?.id,
        front.accessories?.map((a) => a.id),
      );
    } else {
      void addToLookbook(
        front.top.id,
        front.bottom.id,
        front.outerwear?.id,
        front.shoes?.id,
        front.accessories?.map((a) => a.id),
      );
    }
  };

  return (
    <>
      <FilterChips active={filter} onSelect={setFilter} />

      <div className="deck-region" ref={setRegionRef}>
        {!worn && canSwipe && (
          <>
            <div className="deck-chevron left" aria-hidden="true">
              <FaChevronLeft />
            </div>
            <div className="deck-chevron right" aria-hidden="true">
              <FaChevronRight />
            </div>
          </>
        )}

        <Deck
          front={front}
          frontKey={frontKey}
          peekA={peekA}
          peekB={peekB}
          worn={!!worn}
          fav={fav}
          scale={scale}
          getImage={getImage}
          swipeEnabled={!worn && canSwipe}
          onToggleFav={onToggleFav}
          onAddSlot={() => setSheetKey(frontKey)}
          onRemovePiece={(id) => removePiece(frontKey, front, id)}
          onWearToggle={() => (worn ? void undoWear() : void commitWear(front, frontKey))}
          onSwiped={() => setIndex((i) => i + 1)}
        />

        <div className={`deck-hint ${worn ? "worn" : ""}`}>
          {worn ? (
            <>
              <FaCheckCircle />
              <span>{t("today.hintWorn")}</span>
              <span className="deck-hint-sub">{t("today.hintWornUndo")}</span>
            </>
          ) : (
            <>
              <FaHandPointer size={12} />
              <span>
                <b>{t("today.hintTap")}</b> {t("today.hintWear")}
              </span>
              {canSwipe && (
                <>
                  <span className="deck-hint-dot">·</span>
                  <span>
                    <b>{t("today.hintSwipe")}</b> {t("today.hintAnother")}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AppFooter>
        <div className="deck-basket-slot">
          <BasketStrip />
        </div>
        <NavigationBar activePage="today" />
      </AppFooter>

      <AccessorySheet
        open={sheetKey !== null}
        onClose={() => setSheetKey(null)}
        library={library}
        selectedIds={selectedIds}
        onPick={(it) => {
          if (sheetKey) applyEdit(sheetKey, it);
          setSheetKey(null);
        }}
        getImage={getImage}
      />
    </>
  );
};

export default TodayDeck;
