import * as React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { BasketStrip } from "../components/basket-strip.tsx";
import { AppFooter } from "../components/app-footer.tsx";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useLookbook } from "../hooks/lookbook.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useTodaySession, cardKeyOf } from "../hooks/today-session.ts";
import { useMeasuredHeight } from "../hooks/use-measured-height.ts";
import {
  formatLookbookOutfitDate,
  type LookbookOutfit,
} from "../models/lookbook-outfit.ts";
import { isWashable, type ClothingItem } from "../models/clothing-item.ts";
import type { Outfit } from "../models/outfit.ts";
import { FaHeart } from "react-icons/fa";
import { MdEdit, MdLocalLaundryService } from "react-icons/md";
import { useNavigate } from "react-router";
import { formatRelativeDate } from "../utils/date.ts";
import "./lookbook-page.css";

type ResolvedLookbookOutfit = {
  outfit: LookbookOutfit;
  top: ClothingItem;
  bottom: ClothingItem;
  outerwear: ClothingItem | undefined;
  shoes: ClothingItem | undefined;
  accessories: (ClothingItem | undefined)[];
};

type Filter = "all" | "ready" | "recent" | "worn";

const isResolvedClean = (res: ResolvedLookbookOutfit): boolean => {
  const { top, bottom, outerwear, shoes, accessories } = res;
  if (isWashable(top.category) && !top.isClean) return false;
  if (isWashable(bottom.category) && !bottom.isClean) return false;
  if (outerwear && isWashable(outerwear.category) && !outerwear.isClean) return false;
  if (shoes && isWashable(shoes.category) && !shoes.isClean) return false;
  for (const a of accessories) {
    if (a && isWashable(a.category) && !a.isClean) return false;
  }
  return true;
};

const collectPieces = (res: ResolvedLookbookOutfit): ClothingItem[] => {
  const pieces: ClothingItem[] = [res.top, res.bottom];
  if (res.outerwear) pieces.push(res.outerwear);
  if (res.shoes) pieces.push(res.shoes);
  for (const a of res.accessories) if (a) pieces.push(a);
  return pieces;
};

const LookbookPieceRow = ({ pieces }: { pieces: ClothingItem[] }) => {
  const { getImage } = useImage();
  const ordered = [...pieces].sort((a, b) => {
    const priority = (c: ClothingItem["category"]) =>
      c === "outerwear" ? 0 : c === "top" ? 1 : c === "bottom" ? 2 : c === "shoes" ? 3 : 4;
    return priority(a.category) - priority(b.category);
  });
  return (
    <div className="lookbook-row">
      {ordered.slice(0, 4).map((p) => {
        const small = p.category === "shoes" || p.category === "accessories";
        return (
          <div
            key={p.id}
            className={`lookbook-row-piece ${small ? "lookbook-row-piece--small" : "lookbook-row-piece--large"}`}
          >
            <img
              src={getImage(p.imageId || p.id)}
              alt={p.name}
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
};

const LookbookCard = ({ resolved }: { resolved: ResolvedLookbookOutfit }) => {
  const { t, i18n } = useTranslation();
  const { outfit } = resolved;
  const { removeFromLookbook, renameLookbookOutfit, recordWear } = useLookbook();
  const { markWorn } = useCloset();
  const { recordOutfit } = useOutfitHistory();
  const { setWorn } = useTodaySession();

  const clean = isResolvedClean(resolved);
  const pieces = collectPieces(resolved);
  const displayName =
    outfit.name ??
    t("lookbook.defaultName", {
      date: formatLookbookOutfitDate(outfit.savedAt, i18n.language || "en"),
    });
  const wornCount = outfit.wornCount ?? 0;

  const metaParts: string[] = [t("lookbook.pieces", { count: pieces.length })];
  if (wornCount > 0)
    metaParts.push(t("lookbook.wornCount", { count: wornCount }));
  if (outfit.lastWornAt)
    metaParts.push(formatRelativeDate(outfit.lastWornAt, t));

  async function remove(): Promise<void> {
    if (window.confirm(t("lookbook.removeConfirm"))) {
      await removeFromLookbook(outfit.id);
    }
  }

  async function rename(): Promise<void> {
    const next = window.prompt(t("lookbook.renamePrompt"), displayName);
    if (next === null) return;
    await renameLookbookOutfit(outfit.id, next);
  }

  async function wear(): Promise<void> {
    const { top, bottom, outerwear, shoes, accessories } = resolved;
    const accs = accessories.filter((a): a is ClothingItem => !!a);
    await recordWear(outfit.id);
    const recordId = await recordOutfit(
      top.id,
      bottom.id,
      outerwear?.id,
      shoes?.id,
      accs.map((a) => a.id),
    );
    if (isWashable(top.category)) await markWorn(top);
    if (isWashable(bottom.category)) await markWorn(bottom);
    if (outerwear && isWashable(outerwear.category)) await markWorn(outerwear);
    if (shoes && isWashable(shoes.category)) await markWorn(shoes);
    for (const accessory of accs) {
      if (isWashable(accessory.category)) await markWorn(accessory);
    }

    // Surface this outfit on the Today page as worn today, so it shows with the
    // worn badge and stays undoable there — mirrors the deck's own commitWear.
    const snapshot: Outfit = {
      top,
      bottom,
      ...(outerwear && { outerwear }),
      ...(shoes && { shoes }),
      ...(accs.length > 0 && { accessories: accs }),
    };
    setWorn({ cardKey: cardKeyOf(snapshot), recordId, snapshot });
  }

  return (
    <article className="lookbook-card">
      <div className={clean ? undefined : "lookbook-dimmed"}>
        <header className="lookbook-header">
          <div className="lookbook-header-text">
            <button
              type="button"
              className="lookbook-name"
              onClick={rename}
              aria-label={t("lookbook.renameAria")}
              title={t("lookbook.renameTitle")}
            >
              <span className="lookbook-name__text">{displayName}</span>
              <MdEdit
                size={14}
                className="lookbook-name__edit"
                aria-hidden
              />
            </button>
            <div className="lookbook-meta">{metaParts.join(" · ")}</div>
          </div>
        </header>
        <LookbookPieceRow pieces={pieces} />
      </div>

      <footer className="lookbook-footer">
        <button
          type="button"
          className="lookbook-heart-btn"
          onClick={remove}
          aria-label={t("lookbook.removeAria")}
        >
          <FaHeart size={14} />
        </button>
        {clean ? (
          <button type="button" className="lookbook-cta" onClick={wear}>
            {t("lookbook.wearCta")}
          </button>
        ) : (
          <div className="lookbook-cta lookbook-cta--dirty" aria-disabled>
            <MdLocalLaundryService size={16} />
            {t("lookbook.inWash")}
          </div>
        )}
      </footer>
    </article>
  );
};

const LookbookFilterBar = ({
  filter,
  onFilterChange,
  counts,
}: {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  counts: { all: number; ready: number };
}) => {
  const { t } = useTranslation();
  const chips: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t("lookbook.filter.all"), count: counts.all },
    { id: "ready", label: t("lookbook.filter.ready"), count: counts.ready },
    { id: "recent", label: t("lookbook.filter.recent") },
    { id: "worn", label: t("lookbook.filter.worn") },
  ];
  return (
    <div className="vera-chip-row mx-auto max-w-4xl w-full">
      {chips.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onFilterChange(id)}
          className={`vera-chip ${filter === id ? "active" : ""}`}
          aria-pressed={filter === id}
        >
          {label}
          {count != null && ` · ${count}`}
        </button>
      ))}
    </div>
  );
};

const LookbookSectionHead = ({ children }: { children: React.ReactNode }) => (
  <div className="lookbook-section-head">
    {children}
    <span className="lookbook-section-head__rule" aria-hidden />
  </div>
);

const MIN_VISIBLE_SLOTS = 3;

const LookbookPlaceholders = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`placeholder-${i}`} className="lookbook-empty-slot" aria-hidden />
      ))}
    </>
  );
};

export const LookbookPage = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { lookbook: _lookbook } = useLookbook();
  const lookbook = import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _lookbook) : _lookbook;
  const { items } = useCloset();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  // The footer floats over the scroll area; reserve its measured height as bottom
  // padding so the last cards can scroll clear of the nav pill.
  const [footerRef, footerHeight] = useMeasuredHeight();

  const resolvedOutfits = useMemo<ResolvedLookbookOutfit[]>(() => {
    return lookbook
      .map((entry) => ({
        outfit: entry,
        top: items.find((i) => i.id === entry.topId),
        bottom: items.find((i) => i.id === entry.bottomId),
        outerwear: items.find((i) => i.id === entry.outerwearId),
        shoes: items.find((i) => i.id === entry.shoesId),
        accessories: (entry.accessoriesIds || []).map((id) =>
          items.find((i) => i.id === id),
        ),
      }))
      .filter(
        (res): res is ResolvedLookbookOutfit => !!res.top && !!res.bottom,
      );
  }, [lookbook, items]);

  const cleanOutfits = useMemo(
    () => resolvedOutfits.filter(isResolvedClean),
    [resolvedOutfits],
  );
  const dirtyOutfits = useMemo(
    () => resolvedOutfits.filter((r) => !isResolvedClean(r)),
    [resolvedOutfits],
  );

  const sortedForFilter = useMemo<ResolvedLookbookOutfit[]>(() => {
    if (filter === "ready") return cleanOutfits;
    if (filter === "recent") {
      return resolvedOutfits
        .filter((r) => r.outfit.lastWornAt)
        .sort(
          (a, b) =>
            (b.outfit.lastWornAt?.getTime() ?? 0) -
            (a.outfit.lastWornAt?.getTime() ?? 0),
        );
    }
    if (filter === "worn") {
      return resolvedOutfits
        .filter((r) => (r.outfit.wornCount ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.outfit.wornCount ?? 0) - (a.outfit.wornCount ?? 0),
        );
    }
    return resolvedOutfits;
  }, [filter, resolvedOutfits, cleanOutfits]);

  const counts = { all: resolvedOutfits.length, ready: cleanOutfits.length };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="mx-auto max-w-4xl px-5 w-full shrink-0">
        <h2 className="vera-page-title">{t("lookbook.title")}</h2>
      </div>

      {lookbook.length > 0 && (
        <div className="shrink-0">
          <LookbookFilterBar
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div
          className={`w-full mx-auto max-w-4xl px-4 ${lookbook.length === 0 ? "flex-1 flex flex-col justify-center" : `pb-3${filter !== "all" ? " pt-[33px]" : ""}`}`}
          style={
            lookbook.length === 0
              ? undefined
              : { paddingBottom: footerHeight + 12 }
          }
        >
          {lookbook.length === 0 ? (
            <div className="flex-1 flex items-center justify-center pb-20">
              <EmptyMessageTemplate
                title={t("lookbook.empty.title")}
                subtitle={t("lookbook.empty.subtitle")}
                buttonText={t("lookbook.empty.button")}
                onButtonClick={() => navigate("/")}
              />
            </div>
          ) : filter === "all" ? (
            <>
              {cleanOutfits.length > 0 && (
                <>
                  <LookbookSectionHead>
                    {t("lookbook.sectionReady")} · {cleanOutfits.length}
                  </LookbookSectionHead>
                  <div className="lookbook-feed">
                    {cleanOutfits.map((r) => (
                      <LookbookCard key={r.outfit.id} resolved={r} />
                    ))}
                  </div>
                </>
              )}
              {dirtyOutfits.length > 0 && (
                <>
                  <LookbookSectionHead>
                    {t("lookbook.sectionDirty")} · {dirtyOutfits.length}
                  </LookbookSectionHead>
                  <div className="lookbook-feed">
                    {dirtyOutfits.map((r) => (
                      <LookbookCard key={r.outfit.id} resolved={r} />
                    ))}
                  </div>
                </>
              )}
              {resolvedOutfits.length < MIN_VISIBLE_SLOTS && (
                <div className="lookbook-feed" style={{ marginTop: 10 }}>
                  <LookbookPlaceholders
                    count={MIN_VISIBLE_SLOTS - resolvedOutfits.length}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="lookbook-feed">
              {sortedForFilter.map((r) => (
                <LookbookCard key={r.outfit.id} resolved={r} />
              ))}
              <LookbookPlaceholders
                count={MIN_VISIBLE_SLOTS - sortedForFilter.length}
              />
            </div>
          )}
        </div>
      </div>

      <div ref={footerRef} className="absolute inset-x-0 bottom-0 z-10">
        <AppFooter>
          <BasketStrip />

          <NavigationBar activePage="lookbook" />
        </AppFooter>
      </div>
    </div>
  );
};
