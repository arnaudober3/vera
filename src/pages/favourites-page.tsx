import * as React from "react";
import { useMemo, useState } from "react";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useFavouriteOutfits } from "../hooks/favourite-outfits.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import type { FavouriteOutfit } from "../models/favourite-outfit.ts";
import { isWashable, type ClothingItem } from "../models/clothing-item.ts";
import { FaHeart, FaCheck } from "react-icons/fa";
import { useNavigate } from "react-router";
import "./favourites-page.css";
import "../pages/closet-page.css";

const FavouriteOutfitCard = ({
  favourite,
  top,
  bottom,
  outerwear,
  shoes,
  accessories,
}: {
  favourite: FavouriteOutfit;
  top: ClothingItem;
  bottom: ClothingItem;
  outerwear: ClothingItem | undefined;
  shoes: ClothingItem | undefined;
  accessories: (ClothingItem | undefined)[];
}): React.JSX.Element => {
  const { getImage } = useImage();
  const { removeFavourite } = useFavouriteOutfits();
  const { markWorn } = useCloset();
  const { recordOutfit } = useOutfitHistory();

  async function remove(): Promise<void> {
    if (window.confirm("Are you sure you want to remove this favourite?")) {
      await removeFavourite(favourite.id);
    }
  }

  async function wearOutfit(): Promise<void> {
    if (!top || !bottom) return;
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
    <div className="flex flex-col gap-2 p-2 h-full">
      <div
        className={`vera-card flex flex-col items-center relative overflow-hidden !pt-3 !px-0 !pb-0 h-full ${
          (top && !top.isClean && isWashable(top.category)) ||
          (bottom && !bottom.isClean && isWashable(bottom.category)) ||
          (outerwear && !outerwear.isClean && isWashable(outerwear.category)) ||
          (shoes && !shoes.isClean && isWashable(shoes.category)) ||
          accessories.some((a) => a && !a.isClean && isWashable(a.category))
            ? "vera-dirty-overlay"
            : ""
        }`}
      >
        <button
          onClick={() => remove()}
          className="unfavourite-button absolute top-2 right-2 z-20 pointer-events-auto flex items-center justify-center transition-all text-sm font-bold vera-keep-opaque"
          aria-label="Remove favourite"
        >
          <FaHeart size={10} />
        </button>

        <div className="flex flex-col items-center gap-3 w-full min-w-0 px-3">
          <div className="flex flex-col items-center w-full min-w-0">
            <img
              src={getImage(top.imageId || top.id)}
              alt={top.name}
              className="w-20 h-20 object-contain rounded-xl"
              loading="lazy"
            />
            <div className="mt-1 text-xs text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center">
              {top.name}
            </div>
          </div>

          <div className="w-full border-t border-gray-100" />

          <div className="flex flex-col items-center w-full min-w-0">
            <img
              src={getImage(bottom.imageId || bottom.id)}
              alt={bottom.name}
              className="w-20 h-20 object-contain rounded-xl"
              loading="lazy"
            />
            <div className="mt-1 text-xs text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center">
              {bottom.name}
            </div>
          </div>

          <div className="w-full border-t border-gray-100" />
          <div className="flex flex-nowrap justify-center gap-2 h-10 items-center w-full px-2 mb-2 overflow-hidden">
            <div className="flex items-center justify-center gap-2 h-full">
              {(() => {
                const hasAnyOptionalItems = !!(outerwear || shoes || accessories.filter(a => !!a).length > 0);
                if (!hasAnyOptionalItems) {
                  return (
                    <span className="inline-block leading-none p-0 m-0 text-black font-semibold text-center text-xs whitespace-nowrap">
                      No accessories
                    </span>
                  );
                }
                return (
                  <>
                    {outerwear && (
                      <div className="flex flex-col items-center justify-center min-w-0 max-w-[2.5rem] h-full">
                        <img
                          src={getImage(outerwear.imageId || outerwear.id)}
                          alt={outerwear.name}
                          className="w-full h-auto max-h-8 object-contain rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {shoes && (
                      <div className="flex flex-col items-center justify-center min-w-0 max-w-[2.5rem] h-full">
                        <img
                          src={getImage(shoes.imageId || shoes.id)}
                          alt={shoes.name}
                          className="w-full h-auto max-h-8 object-contain rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {accessories.map(
                      (accessory, index) =>
                        accessory && (
                          <div
                            key={accessory.id || index}
                            className="flex flex-col items-center justify-center min-w-0 max-w-[2.5rem] h-full"
                          >
                            <img
                              src={getImage(accessory.imageId || accessory.id)}
                              alt={accessory.name}
                              className="w-full h-auto max-h-8 object-contain rounded-lg"
                              loading="lazy"
                            />
                          </div>
                        ),
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div
          className={`w-full h-12 flex items-stretch ${
            !(
              top?.isClean &&
              bottom?.isClean &&
              (!outerwear || outerwear.isClean) &&
              (!shoes || shoes.isClean) &&
              accessories.every((a) => !a || a.isClean)
            )
              ? "keep-opaque"
              : ""
          }`}
        >
          {top?.isClean &&
          bottom?.isClean &&
          (!outerwear || outerwear.isClean) &&
          (!shoes || shoes.isClean) &&
          accessories.every((a) => !a || a.isClean) ? (
            <button
              onClick={() => wearOutfit()}
              className="wear-button w-full font-medium transition-all flex items-center justify-center gap-1.5"
            >
              <FaCheck size={10} />
              Wear it
            </button>
          ) : (
            <div className="w-full flex items-center justify-center z-10">
              <span className="vera-badge vera-badge--dirty vera-keep-opaque">dirty</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FavouritesFilterBar = ({
  readyToWearOnly,
  onFilterChange,
}: {
  readyToWearOnly: boolean;
  onFilterChange: (readyToWear: boolean) => void;
}): React.JSX.Element => {
  return (
    <div className="vera-chip-row mx-auto max-w-4xl w-full">
      <button
        type="button"
        onClick={() => onFilterChange(false)}
        className={`vera-chip ${!readyToWearOnly ? "active" : ""}`}
        aria-pressed={!readyToWearOnly}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => onFilterChange(true)}
        className={`vera-chip ${readyToWearOnly ? "active" : ""}`}
        aria-pressed={readyToWearOnly}
      >
        Ready to wear
      </button>
    </div>
  );
};

export const FavouritesPage = (): React.JSX.Element => {
  const { favourites } = useFavouriteOutfits();
  const { items } = useCloset();
  const navigate = useNavigate();

  const [readyToWearOnly, setReadyToWearOnly] = useState(false);

  const resolvedFavourites = useMemo(() => {
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
        (res): res is typeof res & { top: ClothingItem; bottom: ClothingItem } =>
          !!res.top && !!res.bottom,
      );
  }, [favourites, items]);

  const filteredFavourites = useMemo(() => {
    if (!readyToWearOnly) return resolvedFavourites;
    return resolvedFavourites.filter(
      ({ top, bottom, outerwear, shoes, accessories }) =>
        top?.isClean &&
        bottom?.isClean &&
        (!outerwear || outerwear.isClean) &&
        (!shoes || shoes.isClean) &&
        accessories.every((a) => !a || a.isClean),
    );
  }, [resolvedFavourites, readyToWearOnly]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="mx-auto max-w-4xl p-4 pb-2 w-full shrink-0">
        <h2 className="vera-page-title">Your favourites</h2>
      </div>

      {favourites.length > 0 && (
        <div className="shrink-0">
          <FavouritesFilterBar
            readyToWearOnly={readyToWearOnly}
            onFilterChange={setReadyToWearOnly}
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
        <div className={`w-full mx-auto max-w-4xl px-4 ${favourites.length === 0 ? "flex-1 flex flex-col justify-center" : "p-4"}`}>
          <div className={`rounded-2xl ${favourites.length === 0 ? "flex-1 flex flex-col justify-center" : ""}`}>
            {favourites.length > 0 ? (
              filteredFavourites.length > 0 ? (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
                  {filteredFavourites.map(
                    ({
                      favourite,
                      top,
                      bottom,
                      outerwear,
                      shoes,
                      accessories,
                    }) => (
                      <FavouriteOutfitCard
                        key={favourite.id}
                        favourite={favourite}
                        top={top}
                        bottom={bottom}
                        outerwear={outerwear}
                        shoes={shoes}
                        accessories={accessories}
                      />
                    ),
                  )}
                  {filteredFavourites.length < 4 &&
                    Array.from({ length: 4 - filteredFavourites.length }).map((_, i) => (
                      <div key={`placeholder-${i}`} className="flex flex-col gap-2 p-2 h-full">
                        <div className="vera-empty-slot w-full h-full" aria-hidden />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-gray-500 text-lg">
                    No outfits match your filters.
                  </p>
                  <p className="text-gray-400 text-sm">
                    Try adjusting your filters above.
                  </p>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyMessageTemplate
                  title="No favourites yet."
                  subtitle="Save outfits you love from the today page!"
                  buttonText="My today's outfit"
                  onButtonClick={() => navigate("/")}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 h-20" />

      <NavigationBar activePage="favourites" />
    </div>
  );
};
