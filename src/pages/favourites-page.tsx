import * as React from "react";
import { useMemo, useState } from "react";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useFavouriteOutfits } from "../hooks/favourite-outfits.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import {
  defaultFavouriteName,
  type FavouriteOutfit,
} from "../models/favourite-outfit.ts";
import { isWashable, type ClothingItem } from "../models/clothing-item.ts";
import { FaHeart } from "react-icons/fa";
import { MdLocalLaundryService } from "react-icons/md";
import { useNavigate } from "react-router";
import { formatRelativeDate } from "../utils/date.ts";
import "./favourites-page.css";

type ResolvedFavourite = {
  favourite: FavouriteOutfit;
  top: ClothingItem;
  bottom: ClothingItem;
  outerwear: ClothingItem | undefined;
  shoes: ClothingItem | undefined;
  accessories: (ClothingItem | undefined)[];
};

type Filter = "all" | "ready" | "recent" | "worn";

const isResolvedClean = (res: ResolvedFavourite): boolean => {
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

const collectPieces = (res: ResolvedFavourite): ClothingItem[] => {
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

const LookbookCard = ({ resolved }: { resolved: ResolvedFavourite }) => {
  const { favourite } = resolved;
  const { removeFavourite, renameFavourite, recordWear } = useFavouriteOutfits();
  const { markWorn } = useCloset();
  const { recordOutfit } = useOutfitHistory();

  const clean = isResolvedClean(resolved);
  const pieces = collectPieces(resolved);
  const displayName = favourite.name ?? defaultFavouriteName(favourite.savedAt);
  const wornCount = favourite.wornCount ?? 0;

  const metaParts: string[] = [`${pieces.length} pieces`];
  if (wornCount > 0) metaParts.push(`worn ${wornCount}×`);
  if (favourite.lastWornAt) metaParts.push(formatRelativeDate(favourite.lastWornAt));

  async function remove(): Promise<void> {
    if (window.confirm("Are you sure you want to remove this favourite?")) {
      await removeFavourite(favourite.id);
    }
  }

  async function rename(): Promise<void> {
    const next = window.prompt("Name this outfit", displayName);
    if (next === null) return;
    await renameFavourite(favourite.id, next);
  }

  async function wear(): Promise<void> {
    const { top, bottom, outerwear, shoes, accessories } = resolved;
    await recordWear(favourite.id);
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
              {displayName}
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
          aria-label="Remove favourite"
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

export const FavouritesPage = (): React.JSX.Element => {
  const { favourites: _favourites } = useFavouriteOutfits();
  const favourites = import.meta.env.VITE_ENABLE_DEBUG === "true" ? ([] as typeof _favourites) : _favourites;
  const { items } = useCloset();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");

  const resolvedFavourites = useMemo<ResolvedFavourite[]>(() => {
    return favourites
      .map((fav) => ({
        favourite: fav,
        top: items.find((i) => i.id === fav.topId),
        bottom: items.find((i) => i.id === fav.bottomId),
        outerwear: items.find((i) => i.id === fav.outerwearId),
        shoes: items.find((i) => i.id === fav.shoesId),
        accessories: (fav.accessoriesIds || []).map((id) =>
          items.find((i) => i.id === id),
        ),
      }))
      .filter(
        (res): res is ResolvedFavourite => !!res.top && !!res.bottom,
      );
  }, [favourites, items]);

  const cleanFavourites = useMemo(
    () => resolvedFavourites.filter(isResolvedClean),
    [resolvedFavourites],
  );
  const dirtyFavourites = useMemo(
    () => resolvedFavourites.filter((r) => !isResolvedClean(r)),
    [resolvedFavourites],
  );

  const sortedForFilter = useMemo<ResolvedFavourite[]>(() => {
    if (filter === "ready") return cleanFavourites;
    if (filter === "recent") {
      return resolvedFavourites
        .filter((r) => r.favourite.lastWornAt)
        .sort(
          (a, b) =>
            (b.favourite.lastWornAt?.getTime() ?? 0) -
            (a.favourite.lastWornAt?.getTime() ?? 0),
        );
    }
    if (filter === "worn") {
      return resolvedFavourites
        .filter((r) => (r.favourite.wornCount ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.favourite.wornCount ?? 0) - (a.favourite.wornCount ?? 0),
        );
    }
    return resolvedFavourites;
  }, [filter, resolvedFavourites, cleanFavourites]);

  const counts = { all: resolvedFavourites.length, ready: cleanFavourites.length };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="mx-auto max-w-4xl px-5 pb-1 w-full shrink-0">
        <h2 className="vera-page-title">Your favourites</h2>
      </div>

      {favourites.length > 0 && (
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
          className={`w-full mx-auto max-w-4xl px-4 ${favourites.length === 0 ? "flex-1 flex flex-col justify-center" : "py-3"}`}
        >
          {favourites.length === 0 ? (
            <div className="flex-1 flex items-center justify-center pb-20">
              <EmptyMessageTemplate
                title="No favourites yet."
                subtitle="Save outfits you love from the today page!"
                buttonText="My today's outfit"
                onButtonClick={() => navigate("/")}
              />
            </div>
          ) : filter === "all" ? (
            <>
              {cleanFavourites.length > 0 && (
                <>
                  <LookbookSectionHead>
                    Ready to wear · {cleanFavourites.length}
                  </LookbookSectionHead>
                  <div className="lookbook-feed">
                    {cleanFavourites.map((r) => (
                      <LookbookCard key={r.favourite.id} resolved={r} />
                    ))}
                  </div>
                </>
              )}
              {dirtyFavourites.length > 0 && (
                <>
                  <LookbookSectionHead>
                    In the wash · {dirtyFavourites.length}
                  </LookbookSectionHead>
                  <div className="lookbook-feed">
                    {dirtyFavourites.map((r) => (
                      <LookbookCard key={r.favourite.id} resolved={r} />
                    ))}
                  </div>
                </>
              )}
              {resolvedFavourites.length < MIN_VISIBLE_SLOTS && (
                <div className="lookbook-feed" style={{ marginTop: 10 }}>
                  <LookbookPlaceholders
                    count={MIN_VISIBLE_SLOTS - resolvedFavourites.length}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="lookbook-feed">
              {sortedForFilter.map((r) => (
                <LookbookCard key={r.favourite.id} resolved={r} />
              ))}
              <LookbookPlaceholders
                count={MIN_VISIBLE_SLOTS - sortedForFilter.length}
              />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 h-20" />

      <NavigationBar activePage="favourites" />
    </div>
  );
};
