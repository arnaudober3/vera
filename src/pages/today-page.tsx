import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { BasketStrip } from "../components/basket-strip.tsx";
import { AppFooter } from "../components/app-footer.tsx";
import { useOutfit } from "../hooks/outfit.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useLookbook } from "../hooks/lookbook.ts";
import { useOccasion } from "../hooks/occasion.ts";
import { useWeather } from "../hooks/weather.ts";
import type { ClothingItem } from "../models/clothing-item.ts";
import { ALL_OCCASIONS, fitsOccasion, type Occasion } from "../models/occasion.ts";
import type { Weather } from "../models/weather.ts";
import {
  FaCheck,
  FaChevronRight,
  FaHeart,
  FaPlus,
  FaRegHeart,
  FaSyncAlt,
  FaThumbtack,
  FaTimes,
} from "react-icons/fa";
import { PiPantsFill, PiTShirtFill } from "react-icons/pi";
import {
  MdAcUnit,
  MdCloud,
  MdGrain,
  MdThermostat,
  MdWbSunny,
} from "react-icons/md";
import { useNavigate } from "react-router";
import { isDarkColor } from "../utils/color.ts";
import "../pages/today-page.css";

const formatDate = (d: Date, locale: string): string => {
  const s = d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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
  pinned,
  onUnpin,
}: {
  piece: ClothingItem;
  label: string;
  rail: { glyph: React.ReactNode; topLine: boolean; bottomLine: boolean };
  imageSrc: string | undefined;
  pinned?: boolean;
  onUnpin?: () => void;
}) => {
  const { t } = useTranslation();
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
        {pinned && (
          <button
            type="button"
            onClick={onUnpin}
            aria-label={t("today.unpinAria")}
            className="today-pin"
          >
            <FaThumbtack size={12} />
          </button>
        )}
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
  pinnedId,
}: {
  added: ClothingItem[];
  onAddClick: () => void;
  onRemove: (id: string) => void;
  getImage: (id: string) => string | undefined;
  pinnedId?: string;
}) => {
  const { t } = useTranslation();
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
            {t("today.addAccessory")}
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
                {it.id === pinnedId && (
                  <FaThumbtack size={9} className="today-accessory-pin" />
                )}
                <span className="today-accessory-name">{it.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  aria-label={t("today.removeAria", { name: it.name })}
                  className="today-accessory-remove"
                >
                  <FaTimes />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddClick}
              aria-label={t("today.addAnotherAria")}
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
  const { t } = useTranslation();
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
        <span style={{ opacity: 1 - progress * 0.7 }}>{t("today.swipeToWear")}</span>
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

const LookbookHeart = () => {
  const { t } = useTranslation();
  const { outfit } = useOutfit();
  const { addToLookbook, removeFromLookbookByOutfit, isInLookbook } =
    useLookbook();

  if (!outfit) return null;

  const saved = isInLookbook(
    outfit.top.id,
    outfit.bottom.id,
    outfit.outerwear?.id,
    outfit.shoes?.id,
    outfit.accessories?.map((a) => a.id),
  );

  const onToggle = async (): Promise<void> => {
    if (saved) {
      await removeFromLookbookByOutfit(
        outfit.top.id,
        outfit.bottom.id,
        outfit.outerwear?.id,
        outfit.shoes?.id,
        outfit.accessories?.map((a) => a.id),
      );
    } else {
      await addToLookbook(
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
      aria-label={saved ? t("today.heartRemoveAria") : t("today.heartAddAria")}
      className={`today-heart ${saved ? "active" : ""}`}
    >
      {saved ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
    </button>
  );
};

const TodayOutfit = (): React.JSX.Element => {
  const { t } = useTranslation();
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
    unpinItem,
  } = useOutfit();
  const outfit = import.meta.env.VITE_ENABLE_DEBUG === "true" ? undefined : _outfit;
  const { recordOutfit } = useOutfitHistory();
  const { lookbook, recordWear } = useLookbook();
  const { occasion } = useOccasion();
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
    const accessoryIds = (outfit.accessories?.map((a) => a.id) || [])
      .slice()
      .sort();
    const matchingEntry = lookbook.find(
      (entry) =>
        entry.topId === outfit.top.id &&
        entry.bottomId === outfit.bottom.id &&
        entry.outerwearId === outfit.outerwear?.id &&
        entry.shoesId === outfit.shoes?.id &&
        JSON.stringify([...(entry.accessoriesIds || [])].sort()) ===
          JSON.stringify(accessoryIds),
    );
    if (matchingEntry) await recordWear(matchingEntry.id);
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
    // Distinguish "nothing clean at all" from "nothing clean fits this
    // occasion": when clean clothes exist but none suit the occasion, the
    // hard occasion filter leaves no outfit, so guide the user accordingly.
    const cleanTops = items.filter(
      (i) => i.category === "top" && isItemClean(i.id),
    );
    const cleanBottoms = items.filter(
      (i) => i.category === "bottom" && isItemClean(i.id),
    );
    const hasCleanDuo = cleanTops.length > 0 && cleanBottoms.length > 0;
    const hasOccasionDuo =
      cleanTops.some((t) => fitsOccasion(t, occasion)) &&
      cleanBottoms.some((b) => fitsOccasion(b, occasion));
    const occasionBlocked = hasCleanDuo && !hasOccasionDuo;
    const emptyKey = occasionBlocked ? "today.emptyOccasion" : "today.empty";

    return (
      <>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyMessageTemplate
            title={t(`${emptyKey}.title`)}
            subtitle={t(`${emptyKey}.subtitle`)}
            buttonText={t(`${emptyKey}.button`)}
            onButtonClick={() => navigate("/closet")}
          />
        </div>
        <AppFooter>
          <BasketStrip />
          <NavigationBar activePage="today" />
        </AppFooter>
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
          <LookbookHeart />
          <PieceRow
            piece={outfit!.top}
            label={t("today.topLabel")}
            rail={{ glyph: <PiTShirtFill size={10} />, topLine: false, bottomLine: true }}
            imageSrc={getImage(outfit!.top.id)}
            pinned={outfit!.pinnedItemId === outfit!.top.id}
            onUnpin={() => void unpinItem()}
          />
          <PieceRow
            piece={outfit!.bottom}
            label={t("today.bottomLabel")}
            rail={{
              glyph: <PiPantsFill size={10} />,
              topLine: true,
              bottomLine: true,
            }}
            imageSrc={getImage(outfit!.bottom.id)}
            pinned={outfit!.pinnedItemId === outfit!.bottom.id}
            onUnpin={() => void unpinItem()}
          />
          <AccessoryRow
            added={added}
            onAddClick={() => setPickerOpen(true)}
            onRemove={(id) => void removeItemFromOutfit(id)}
            getImage={getImage}
            pinnedId={outfit!.pinnedItemId}
          />
          <div className="today-swipe-inline">
            <SwipeToWear onConfirm={() => void handleConfirmWorn()} />
          </div>
        </div>
        {/* Clearance pour le fondu (mask) en bas de la zone scrollable, afin
            que le swipe-to-wear ne soit pas estompé. */}
        <div style={{ height: 48 }} />
      </div>

      <AppFooter>
        <BasketStrip />
        <NavigationBar
          activePage="today"
          action={
            <button
              type="button"
              onClick={() => void onRegenerate()}
              aria-label={t("today.regenerateAria")}
              disabled={!canGenerateOutfit()}
              className="vera-nav-fab"
            >
              <FaSyncAlt size={18} />
            </button>
          }
        />
      </AppFooter>

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

const weatherGlyph = (w: Weather): React.ReactNode => {
  if (w.isManual) return <MdThermostat size={14} aria-hidden />;
  if (w.isPrecipitating) return <MdGrain size={14} aria-hidden />;
  const c = w.weatherCode;
  if (c >= 71 && c <= 77) return <MdAcUnit size={14} aria-hidden />; // snow
  if (c >= 45) return <MdGrain size={14} aria-hidden />; // fog/rain/thunder
  if (c >= 2) return <MdCloud size={14} aria-hidden />; // cloudy
  return <MdWbSunny size={14} aria-hidden />; // clear
};

const OccasionChips = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { occasion, setOccasion } = useOccasion();
  const { generateOutfit } = useOutfit();

  const onSelect = (next: Occasion): void => {
    if (next === occasion) return;
    setOccasion(next);
    void generateOutfit();
  };

  return (
    <div
      className="today-occasions"
      role="group"
      aria-label={t("today.occasionLabel")}
    >
      {ALL_OCCASIONS.map((o) => (
        <button
          key={o}
          type="button"
          className={`today-occasion-chip ${o === occasion ? "active" : ""}`}
          aria-pressed={o === occasion}
          onClick={() => onSelect(o)}
        >
          {t(`today.occasion.${o}`)}
        </button>
      ))}
    </div>
  );
};

const WeatherBadge = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { weather, setManualWeather } = useWeather();
  const { generateOutfit } = useOutfit();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const submit = (): void => {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) {
      setManualWeather(n);
      void generateOutfit();
    }
    setEditing(false);
    setValue("");
  };

  if (editing) {
    return (
      <div className="today-weather-edit">
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={t("today.weather.manualPrompt")}
          aria-label={t("today.weather.manualPrompt")}
          className="today-weather-input"
        />
        <button
          type="button"
          className="today-weather-done"
          onClick={submit}
        >
          {t("today.weather.done")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="today-weather-badge"
      onClick={() => {
        setValue(weather ? String(weather.temperatureC) : "");
        setEditing(true);
      }}
      aria-label={
        weather ? `${weather.temperatureC}°C` : t("today.weather.setManual")
      }
    >
      {weather ? (
        <>
          {weatherGlyph(weather)}
          <span>{weather.temperatureC}°</span>
        </>
      ) : (
        <>
          <MdThermostat size={14} aria-hidden />
          <span>{t("today.weather.setManual")}</span>
        </>
      )}
    </button>
  );
};

const TodayContextBar = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { weather, refreshWeather } = useWeather();
  const { generateOutfit } = useOutfit();
  // Only regenerate when a genuinely new reading arrives, so revisiting the
  // Today page with a fresh cache doesn't reshuffle the current outfit.
  const initialFetchedAt = useRef(weather?.fetchedAt);

  useEffect(() => {
    let cancelled = false;
    void refreshWeather().then((w) => {
      if (cancelled || !w) return;
      if (w.fetchedAt !== initialFetchedAt.current) void generateOutfit();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="today-context">
      <div className="today-context-row">
        <OccasionChips />
        <WeatherBadge />
      </div>
      {weather?.isPrecipitating && (
        <div className="today-weather-hint">{t("today.weather.rainHint")}</div>
      )}
    </div>
  );
};

export const TodayPage = (): React.JSX.Element => {
  const { i18n } = useTranslation();
  const today = formatDate(new Date(), i18n.language || "en");

  return (
    <div className="today-page">
      <div className="today-header">
        <h2 className="vera-page-title">{today}</h2>
        <TodayContextBar />
      </div>

      <TodayOutfit />
    </div>
  );
};
