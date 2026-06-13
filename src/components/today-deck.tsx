import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  FaTshirt,
} from "react-icons/fa";
import NavigationBar from "./navigation-bar.tsx";
import { BasketStrip } from "./basket-strip.tsx";
import { AppFooter } from "./app-footer.tsx";
import { useOutfit } from "../hooks/outfit.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useLookbook } from "../hooks/lookbook.ts";
import { useWeather } from "../hooks/weather.ts";
import { useTodaySession, cardKeyOf, type Filter } from "../hooks/today-session.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import type { Outfit } from "../models/outfit.ts";
import { ALL_OCCASIONS, fitsOccasion } from "../models/occasion.ts";
import { itemTint } from "../utils/color.ts";
import "./today-deck.css";

const FILTERS: Filter[] = ["all", ...ALL_OCCASIONS];

// Card + collage geometry (mirrors the design prototype). The collage well is a
// fixed-size canvas so the overlapping tiles keep their composition regardless of
// the phone-frame width.
const CARD_W = 296;
const CARD_H = 426;
// The garment collage fills the upper card; the well is shortened so the
// accessory shelf has a clean row along the bottom of the same card.
const WELL_W = 268;
// Shortened so the compact square-thumbnail accessory shelf fits inside the
// fixed-height card below the two hero garments.
const WELL_H = 240;

type Pos = { left: number; top: number; w: number; h: number; rot: number; z: number };
// The collage holds only the two hero garments (top + bottom). Everything else
// the picker can add — outerwear, shoes, accessories — lives on the shelf below.
const POS: Record<"top" | "bottom", Pos> = {
  top: { left: 76, top: 0, w: 172, h: 192, rot: 4, z: 2 },
  bottom: { left: 8, top: 76, w: 148, h: 160, rot: -4, z: 3 },
};

// Everything that isn't the top/bottom hero — outerwear, shoes and accessories.
// These are exactly the items the "Add an accessory" picker offers, and they all
// land on the shelf so none hide behind a "+N".
const shelfPieces = (o: Outfit): ClothingItem[] =>
  [o.outerwear, o.shoes, ...(o.accessories ?? [])].filter(
    (x): x is ClothingItem => Boolean(x),
  );

// ────────── Item tile (filled) ──────────
const ItemTile = ({
  piece,
  pos,
  imageSrc,
  onRemove,
  compact,
}: {
  piece: ClothingItem;
  pos: Pos;
  imageSrc: string | undefined;
  onRemove?: () => void;
  // The small accessory tile lets its name area hug the text instead of
  // reserving the full two-line height, so the photo keeps room to breathe.
  compact?: boolean;
}): React.JSX.Element => {
  const big = pos.w > 120;
  return (
    <div
      className={`deck-tile ${compact ? "deck-tile--compact" : ""}`}
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.w,
        height: pos.h,
        transform: `rotate(${pos.rot}deg)`,
        zIndex: pos.z,
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
      {/* name sits on top so it stays readable where tiles overlap */}
      <div className="deck-tile-name">
        <span style={{ fontSize: big ? 13 : 10 }}>{piece.name}</span>
      </div>
      {/* photo floats on a soft tint of its own colour — mirrors the closet card */}
      <div className="deck-tile-tray" style={{ background: itemTint(piece.color) }}>
        {imageSrc && <img src={imageSrc} alt={piece.name} loading="lazy" />}
      </div>
    </div>
  );
};

// ────────── Accessory shelf ──────────
// Every accessory on a look gets its own tile on a tidy shelf along the bottom
// of the card — none hide behind a "+N". The rare 4+ case rolls the tail into a
// single overflow tile so the row stays clean.
const AccessoryShelfTile = ({
  piece,
  imageSrc,
  onRemove,
}: {
  piece: ClothingItem;
  imageSrc: string | undefined;
  onRemove?: () => void;
}): React.JSX.Element => (
  <div className="deck-shelf-tile">
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
    <div className="deck-shelf-tray" style={{ background: itemTint(piece.color) }}>
      {imageSrc && <img src={imageSrc} alt={piece.name} loading="lazy" />}
    </div>
    <div className="deck-shelf-name">{piece.name}</div>
  </div>
);

// "+N more" card — fills the final slot when the accessories don't all fit.
// Tapping it opens a read-only view of every accessory on the look.
const AccessoryShelfMore = ({
  count,
  onOpen,
}: {
  count: number;
  onOpen?: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="deck-shelf-overflow"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
    >
      <span className="deck-shelf-overflow-count">
        <FaPlus size={12} />
        {count}
      </span>
      <span className="deck-shelf-overflow-more">{t("today.moreLabel")}</span>
    </button>
  );
};

// Compact "Add" card at the end of the shelf — replaces the old chrome button.
const AccessoryShelfAdd = ({ onAdd }: { onAdd: () => void }): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="deck-shelf-add"
      aria-label={t("today.addAccessory")}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onAdd}
    >
      <FaPlus size={12} />
      <span>{t("today.addShort")}</span>
    </button>
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
  onShowMore,
}: {
  outfit: Outfit;
  worn: boolean;
  fav: boolean;
  getImage: (id: string) => string | undefined;
  editable: boolean;
  onToggleFav?: () => void;
  onAddSlot?: () => void;
  onRemovePiece?: (id: string) => void;
  onShowMore?: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const extras = shelfPieces(outfit);
  // The "Add" affordance lives in the shelf's first slot (front, unworn card).
  const showAdd = editable && Boolean(onAddSlot);

  // The shelf is always three equal-width slots. Add takes the first slot; the
  // accessories fill the rest, and when they don't all fit the final slot
  // collapses to a "+N more" card that opens the read-only list.
  type Cell =
    | { kind: "add" }
    | { kind: "tile"; piece: ClothingItem }
    | { kind: "more"; count: number };
  const cells: Cell[] = [];
  if (showAdd) cells.push({ kind: "add" });
  const slotsLeft = 3 - cells.length;
  if (extras.length <= slotsLeft) {
    extras.forEach((p) => cells.push({ kind: "tile", piece: p }));
  } else {
    const visible = slotsLeft - 1;
    extras
      .slice(0, visible)
      .forEach((p) => cells.push({ kind: "tile", piece: p }));
    cells.push({ kind: "more", count: extras.length - visible });
  }
  const showShelf = cells.length > 0;

  return (
    <div className={`deck-card ${worn ? "worn" : ""}`}>
      <div className="deck-card-chrome">
        {worn && (
          <div className="deck-worn-badge">
            <FaCheck size={11} />
            {t("today.wearingBadge")}
          </div>
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

      <div
        className={`deck-well-wrap ${showShelf ? "deck-well-wrap--shelf" : ""}`}
      >
        <div className="deck-well" style={{ width: WELL_W, height: WELL_H }}>
          <ItemTile piece={outfit.top} pos={POS.top} imageSrc={getImage(outfit.top.id)} />
          <ItemTile
            piece={outfit.bottom}
            pos={POS.bottom}
            imageSrc={getImage(outfit.bottom.id)}
          />
        </div>
      </div>

      {/* Accessory shelf — three equal-width slots: an "Add" card (editable) then
          the look's extras, the final slot collapsing to a "+N more" card. */}
      {showShelf && (
        <div className="deck-shelf">
          <div className="deck-shelf-label">{t("today.accessoriesLabel")}</div>
          <div className="deck-shelf-row">
            {cells.map((c) => {
              if (c.kind === "add")
                return <AccessoryShelfAdd key="add" onAdd={onAddSlot!} />;
              if (c.kind === "more")
                return (
                  <AccessoryShelfMore key="more" count={c.count} onOpen={onShowMore} />
                );
              return (
                <AccessoryShelfTile
                  key={c.piece.id}
                  piece={c.piece}
                  imageSrc={getImage(c.piece.id)}
                  onRemove={editable ? () => onRemovePiece?.(c.piece.id) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
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
  onShowMore,
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
  onShowMore: () => void;
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
        onShowMore={onShowMore}
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
  onShowMore,
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
  onShowMore: () => void;
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
        onShowMore={onShowMore}
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
  availableFilters,
  disabled = false,
}: {
  active: Filter;
  onSelect: (f: Filter) => void;
  // Filters with no available outfit (no clean duo for that occasion) are
  // disabled so the user can't land on an empty deck.
  availableFilters: Set<Filter>;
  // Disabled while an outfit is worn: the deck can't regenerate, so the filter
  // is locked until the wear is undone.
  disabled?: boolean;
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
          // "all" is the default filter, so it stays selectable even when no
          // clean duo is available — only the worn lock can disable it.
          disabled={disabled || (f !== "all" && !availableFilters.has(f))}
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

// ────────── Read-only accessory list (opened from the "+N more" card) ──────────
const AccessoryListSheet = ({
  open,
  onClose,
  pieces,
  getImage,
}: {
  open: boolean;
  onClose: () => void;
  pieces: ClothingItem[];
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
          <h3 className="text-lg font-semibold">{t("today.accessoriesLabel")}</h3>
          <button
            className="p-2 text-gray-500"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
        <div className="today-sheet-grid">
          {pieces.map((it) => (
            <div key={it.id} className="today-sheet-item" aria-disabled="true">
              <div className="today-sheet-thumb">
                {getImage(it.id) && (
                  <img src={getImage(it.id)} alt={it.name} loading="lazy" />
                )}
              </div>
              <div className="today-sheet-name">{it.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ────────── Page (deck) ──────────
export const TodayDeck = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { getImage } = useImage();
  const { items, markWorn, markClean, isItemClean } = useCloset();
  const { buildDeck, outfit } = useOutfit();
  const { weather } = useWeather();
  const { recordOutfit, removeOutfitRecord } = useOutfitHistory();
  const {
    lookbook,
    recordWear,
    isInLookbook,
    addToLookbook,
    removeFromLookbookByOutfit,
  } = useLookbook();

  const {
    filter,
    index,
    edits,
    worn,
    selected,
    setFilter,
    setIndex,
    setEdits,
    setWorn,
    setSelected,
  } = useTodaySession();
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  // Opens the read-only list of every accessory on the look (the "+N more" card).
  const [moreOpen, setMoreOpen] = useState(false);

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
    const HINT_RESERVE = 48;
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

  // An active pin (set from the closet) locks its garment into every deck card,
  // so swiping to regenerate only varies the rest of the outfit.
  const pinnedItemId = outfit?.pinnedItemId;
  const _deck = useMemo(
    () => buildDeck(filter, 10, pinnedItemId),
    // buildDeck is recreated each render; rebuild only on the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filter, weather?.fetchedAt, pinnedItemId],
  );
  const deck =
    import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _deck) : _deck;

  // A filter has an available outfit when a clean top and a clean bottom both
  // fit its occasion — the same duo logic that drives the empty state below.
  const availableFilters = useMemo(() => {
    const cleanTops = items.filter(
      (i) => i.category === "top" && isItemClean(i.id),
    );
    const cleanBottoms = items.filter(
      (i) => i.category === "bottom" && isItemClean(i.id),
    );
    const hasDuo = (f: Filter): boolean => {
      const fits = (i: ClothingItem): boolean =>
        f === "all" || fitsOccasion(i, f);
      return cleanTops.some(fits) && cleanBottoms.some(fits);
    };
    return new Set(FILTERS.filter(hasDuo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // The worn/selected snapshot is the render source even once its pieces are
  // dirty. If a key piece (top/bottom) has since been deleted from the closet,
  // the outfit can no longer be reconstituted — drop it so the deck returns to
  // normal suggestions.
  const hasDuo = (o: Outfit): boolean =>
    items.some((i) => i.id === o.top.id || i.id === o.bottom.id);
  useEffect(() => {
    if (worn && !hasDuo(worn.snapshot)) setWorn(null);
    if (selected && !hasDuo(selected)) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, worn, selected]);

  const mergeEdits = (base: Outfit): Outfit => {
    const o = edits[cardKeyOf(base)];
    return o ? { ...base, ...o } : base;
  };

  const len = deck.length;
  // A kept outfit (post-undo) takes the front slot over the deck card; the deck
  // sits right behind it so a swipe simply moves on to the regular suggestions.
  const baseFront: Outfit | null = selected ?? (len ? deck[index % len] : null);
  const front: Outfit | null = worn
    ? worn.snapshot
    : baseFront
      ? mergeEdits(baseFront)
      : null;
  const frontKey = worn ? worn.cardKey : baseFront ? cardKeyOf(baseFront) : "";
  // Swiping (and its chevron/peek affordances) only makes sense when the deck
  // holds an outfit different from the one on display — otherwise there's
  // nothing to regenerate. After undoing a worn look the kept outfit is often
  // the deck's only card, so guard against that rather than just `len >= 1`.
  const hasAlternative = deck.some((d) => cardKeyOf(d) !== frontKey);
  const swipeEnabled = !worn && hasAlternative;
  const peekA = worn
    ? deck[0]
    : !hasAlternative
      ? undefined
      : selected
        ? mergeEdits(deck[index % len])
        : len > 1
          ? mergeEdits(deck[(index + 1) % len])
          : undefined;
  const peekB = worn
    ? deck[1]
    : !hasAlternative
      ? undefined
      : selected
        ? len > 1
          ? mergeEdits(deck[(index + 1) % len])
          : undefined
        : len > 2
          ? mergeEdits(deck[(index + 2) % len])
          : undefined;

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
    // Keep the outfit on the deck (unworn) instead of regenerating; the user
    // swipes to move on to fresh suggestions.
    setSelected(eff);
    setWorn(null);
  };

  // ── Per-card secondary editing ──
  const applyEdit = (key: string, eff: Outfit, item: ClothingItem): void => {
    setEdits((prev) => {
      const cur: Partial<Outfit> = { ...(prev[key] || {}) };
      if (item.category === "outerwear") cur.outerwear = item;
      else if (item.category === "shoes") cur.shoes = item;
      else if (item.category === "accessories") {
        // Seed from the effective outfit so a kept outfit's existing accessories
        // (or a deck card's pinned one) survive when a new accessory is added.
        const existing = cur.accessories ?? eff.accessories ?? [];
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
        <FilterChips
          active={filter}
          onSelect={setFilter}
          availableFilters={availableFilters}
        />
        <div className="deck-lead-spacer" aria-hidden>
          &nbsp;
        </div>
        <div className="deck-region" ref={setRegionRef}>
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
              <div className="deck-card">
                <div className="deck-empty-body">
                  <div className="deck-empty-icon" aria-hidden>
                    <FaTshirt />
                  </div>
                  <p className="deck-empty-title">{t(`${emptyKey}.title`)}</p>
                  <p className="deck-empty-sub">{t(`${emptyKey}.subtitle`)}</p>
                </div>
              </div>
            </div>
          </div>
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
      <FilterChips
        active={filter}
        onSelect={setFilter}
        availableFilters={availableFilters}
        disabled={!!worn}
      />

      <div className="deck-lead-spacer" aria-hidden>
        &nbsp;
      </div>

      <div className="deck-region" ref={setRegionRef}>
        {swipeEnabled && (
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
          swipeEnabled={swipeEnabled}
          onToggleFav={onToggleFav}
          onAddSlot={() => setSheetKey(frontKey)}
          onRemovePiece={(id) => removePiece(frontKey, front, id)}
          onShowMore={() => setMoreOpen(true)}
          onWearToggle={() => (worn ? void undoWear() : void commitWear(front, frontKey))}
          onSwiped={() => {
            // Dismiss a kept outfit to reveal the deck; otherwise advance it.
            if (selected) setSelected(null);
            else setIndex((i) => i + 1);
          }}
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
              {swipeEnabled && (
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
          if (sheetKey && front) applyEdit(sheetKey, front, it);
          setSheetKey(null);
        }}
        getImage={getImage}
      />

      <AccessoryListSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pieces={shelfPieces(front)}
        getImage={getImage}
      />
    </>
  );
};

export default TodayDeck;
