import * as React from "react";
import { useMemo, useState } from "react";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { BasketStrip } from "../components/basket-strip.tsx";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useLookbook } from "../hooks/lookbook.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import {
  defaultLookbookOutfitName,
  type LookbookOutfit,
} from "../models/lookbook-outfit.ts";
import { isWashable, type ClothingItem } from "../models/clothing-item.ts";
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
  const { outfit } = resolved;
  const { removeFromLookbook, renameLookbookOutfit, recordWear } = useLookbook();
  const { markWorn } = useCloset();
  const { recordOutfit } = useOutfitHistory();

  const clean = isResolvedClean(resolved);
  const pieces = collectPieces(resolved);
  const displayName = outfit.name ?? defaultLookbookOutfitName(outfit.savedAt);
  const wornCount = outfit.wornCount ?? 0;

  const metaParts: string[] = [`${pieces.length} pieces`];
  if (wornCount > 0) metaParts.push(`worn ${wornCount}×`);
  if (outfit.lastWornAt) metaParts.push(formatRelativeDate(outfit.lastWornAt));

  async function remove(): Promise<void> {
    if (window.confirm("Remove this outfit from your lookbook?")) {
      await removeFromLookbook(outfit.id);
    }
  }

  async function rename(): Promise<void> {
    const next = window.prompt("Name this outfit", displayName);
    if (next === null) return;
    await renameLookbookOutfit(outfit.id, next);
  }

  async function wear(): Promise<void> {
    const { top, bottom, outerwear, shoes, accessories } = resolved;
    await recordWear(outfit.id);
    await recordOutfit(
      top.id,
      bottom.id,
      outerwear?.id,
      shoes?.id,
      accessories.filter((a): a is ClothingItem => !!a).map((a) => a.id),
    );
    if (isWashable(top.category)) await markWorn(top);
    if (isWashable(bottom.category)) await markWorn(bottom);
    if (outerwear && isWashable(outerwear.category)) await markWorn(outerwear);
    if (shoes && isWashable(shoes.category)) await markWorn(shoes);
    for (const accessory of accessories) {
      if (accessory && isWashable(accessory.category)) await markWorn(accessory);
    }
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
              aria-label="Rename outfit"
              title="Rename outfit"
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
          aria-label="Remove from lookbook"
        >
          <FaHeart size={14} />
        </button>
        {clean ? (
          <button type="button" className="lookbook-cta" onClick={wear}>
            I'm wearing this
          </button>
        ) : (
          <div className="lookbook-cta lookbook-cta--dirty" aria-disabled>
            <MdLocalLaundryService size={16} />
            In the wash
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
  const chips: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "ready", label: "Ready", count: counts.ready },
    { id: "recent", label: "Recent" },
    { id: "worn", label: "Most worn" },
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
  const { lookbook: _lookbook } = useLookbook();
  const lookbook = import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _lookbook) : _lookbook;
  const { items } = useCloset();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="mx-auto max-w-4xl px-5 pb-1 w-full shrink-0">
        <h2 className="vera-page-title">My lookbook</h2>
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

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 3rem), transparent)",
        }}
      >
        <div
          className={`w-full mx-auto max-w-4xl px-4 ${lookbook.length === 0 ? "flex-1 flex flex-col justify-center" : "pb-3"}`}
        >
          {lookbook.length === 0 ? (
            <div className="flex-1 flex items-center justify-center pb-20">
              <EmptyMessageTemplate
                title="Your lookbook is empty."
                subtitle="Save outfits you love from the today page!"
                buttonText="My today's outfit"
                onButtonClick={() => navigate("/")}
              />
            </div>
          ) : filter === "all" ? (
            <>
              {cleanOutfits.length > 0 && (
                <>
                  <LookbookSectionHead>
                    Ready to wear · {cleanOutfits.length}
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
                    In the wash · {dirtyOutfits.length}
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

      <div className="shrink-0 h-20" />

      <BasketStrip />

      <NavigationBar activePage="lookbook" />
    </div>
  );
};
