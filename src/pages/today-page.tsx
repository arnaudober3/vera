import * as React from "react";
import { useEffect, useState } from "react";
import NavigationBar from "../components/navigation-bar.tsx";
import EmptyMessageTemplate from "../components/empty-message-template.tsx";
import { useOutfit } from "../hooks/outfit.ts";
import { useCloset } from "../hooks/closet.ts";
import { useImage } from "../hooks/image.ts";
import { useOutfitHistory } from "../hooks/outfit-history.ts";
import { useFavouriteOutfits } from "../hooks/favourite-outfits.ts";
import { FaCheck, FaHeart, FaRegHeart, FaSyncAlt } from "react-icons/fa";
import { useNavigate } from "react-router";
import "../pages/today-page.css";

const FavouriteButton = () => {
  const { outfit } = useOutfit();
  const { addFavourite, removeFavouriteByOutfit, isFavourite } =
    useFavouriteOutfits();

  if (!outfit) {
    return null;
  }

  const favourited = isFavourite(
    outfit.top.id,
    outfit.bottom.id,
    outfit.outerwear?.id,
    outfit.shoes?.id,
    outfit.accessories?.map((a) => a.id),
  );

  async function onToggle(): Promise<void> {
    if (!outfit) return;
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
  }

  return (
    <button
      onClick={() => onToggle()}
      aria-label={favourited ? "Remove from favourites" : "Add to favourites"}
      title={favourited ? "Remove from favourites" : "Add to favourites"}
      className="favourite-button absolute top-3 right-3 flex items-center justify-center transition-all text-sm font-bold"
    >
      {favourited ? <FaHeart size={10} /> : <FaRegHeart size={10} />}
    </button>
  );
};

const RegenerateOutfitFab = () => {
  const { generateOutfit, canGenerateOutfit } = useOutfit();

  async function onRegenerate(): Promise<void> {
    await generateOutfit();
  }

  return (
    <button
      onClick={() => onRegenerate()}
      aria-label="Regenerate the outfit"
      title="Regenerate the outfit"
      disabled={!canGenerateOutfit()}
      className={`fixed bottom-12 right-5 z-200 shadow-lg primary-button transition-all ${!canGenerateOutfit() ? "opacity-50 cursor-not-allowed" : ""}`}
      style={{ width: 56, height: 56 }}
    >
      <div className="flex items-center justify-center text-2xl">
        <FaSyncAlt />
      </div>
    </button>
  );
};
const OutfitTemplate = (): React.JSX.Element => {
  const { getImage } = useImage();
  const { isItemClean, markWorn } = useCloset();
  const { outfit, clearOutfit, generateOutfit } = useOutfit();
  const { recordOutfit } = useOutfitHistory();
  const [isMarking, setIsMarking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!outfit) {
      void generateOutfit();
    }
  }, [generateOutfit, outfit]);

  const handleConfirmWorn = async (): Promise<void> => {
    if (!outfit) return;
    setIsMarking(true);
    try {
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
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {outfit ? (
        <>
          {(() => {
            const hasVisibleItems =
              outfit.top &&
              isItemClean(outfit.top.id) &&
              outfit.bottom &&
              isItemClean(outfit.bottom.id);
            if (!hasVisibleItems) {
              return (
                <EmptyMessageTemplate
                  title="No outfit right now."
                  subtitle="All your clothes are in the basket — time to do laundry!"
                  buttonText="Go to closet"
                  onButtonClick={() => navigate("/closet")}
                />
              );
            }

            return (
              <div className="relative mx-auto w-full max-w-md flex flex-col h-full min-h-0 overflow-hidden">
                <div className="card flex flex-col items-center relative min-h-0 gap-3 p-4">
                  <FavouriteButton />
                  {/* Top item */}
                  {outfit.top && isItemClean(outfit.top.id) && (
                    <div
                      className="flex flex-col items-center w-full justify-center overflow-hidden"
                      style={{ height: 200 }}
                    >
                      <img
                        src={getImage(outfit.top.id)}
                        alt={outfit.top.name}
                        className="max-h-full w-auto object-contain rounded-xl shrink min-h-0"
                        loading="lazy"
                      />
                      <div className="mt-1 text-sm text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center shrink-0">
                        {outfit.top.name}
                      </div>
                    </div>
                  )}

                  <div className="w-full border-t border-gray-100 shrink-0" />

                  {/* Bottom item */}
                  {outfit.bottom && isItemClean(outfit.bottom.id) && (
                    <div
                      className="flex flex-col items-center w-full justify-center overflow-hidden"
                      style={{ height: 200 }}
                    >
                      <img
                        src={getImage(outfit.bottom.id)}
                        alt={outfit.bottom.name}
                        className="max-h-full w-auto object-contain rounded-xl shrink min-h-0"
                        loading="lazy"
                      />
                      <div className="mt-1 text-sm text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center shrink-0">
                        {outfit.bottom.name}
                      </div>
                    </div>
                  )}

                  {/* Optional items */}
                  <div className="w-full border-t border-gray-100 shrink-0" />

                  <div className="flex flex-nowrap justify-center gap-2 shrink-0 w-full px-2 overflow-hidden items-end h-24">
                    {(() => {
                      const visibleOuterwear =
                        outfit.outerwear && isItemClean(outfit.outerwear.id)
                          ? outfit.outerwear
                          : null;
                      const visibleShoes =
                        outfit.shoes && isItemClean(outfit.shoes.id)
                          ? outfit.shoes
                          : null;
                      const visibleAccessories =
                        outfit.accessories?.filter((a) => isItemClean(a.id)) ||
                        [];
                      const hasAnyOptionalItems = !!(
                        visibleOuterwear ||
                        visibleShoes ||
                        visibleAccessories.length > 0
                      );

                      if (!hasAnyOptionalItems) {
                        return (
                          <div className="flex flex-col items-center justify-center flex-1 h-full">
                            <span className="leading-tight text-black font-semibold text-center mt-1 text-sm">
                              No accessories
                            </span>
                          </div>
                        );
                      }

                      return (
                        <>
                          {visibleOuterwear && (
                            <div className="flex flex-col items-center flex-1 min-w-0 max-w-[5rem] h-full">
                              <div className="flex-1 flex items-center justify-center w-full min-h-0">
                                <img
                                  src={getImage(visibleOuterwear.id)}
                                  alt={visibleOuterwear.name}
                                  className="w-full h-auto max-h-16 object-contain rounded-lg"
                                  loading="lazy"
                                />
                              </div>
                              <div className="mt-1 text-[10px] leading-tight text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center shrink-0">
                                {visibleOuterwear.name}
                              </div>
                            </div>
                          )}
                          {visibleShoes && (
                            <div className="flex flex-col items-center flex-1 min-w-0 max-w-[5rem] h-full">
                              <div className="flex-1 flex items-center justify-center w-full min-h-0">
                                <img
                                  src={getImage(visibleShoes.id)}
                                  alt={visibleShoes.name}
                                  className="w-full h-auto max-h-16 object-contain rounded-lg"
                                  loading="lazy"
                                />
                              </div>
                              <div className="mt-1 text-[10px] leading-tight text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center shrink-0">
                                {visibleShoes.name}
                              </div>
                            </div>
                          )}
                          {visibleAccessories.map((accessory) => (
                            <div
                              key={accessory.id}
                              className="flex flex-col items-center flex-1 min-w-0 max-w-[5rem] h-full"
                            >
                              <div className="flex-1 flex items-center justify-center w-full min-h-0">
                                <img
                                  src={getImage(accessory.id)}
                                  alt={accessory.name}
                                  className="w-full h-auto max-h-16 object-contain rounded-lg"
                                  loading="lazy"
                                />
                              </div>
                              <div className="mt-1 text-[10px] leading-tight text-black font-semibold whitespace-nowrap text-ellipsis w-full overflow-hidden text-center shrink-0">
                                {accessory.name}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={handleConfirmWorn}
                  disabled={isMarking}
                  className={`primary-button mt-4 mb-2 w-full py-3 flex items-center justify-center gap-2 text-base font-semibold shrink-0 transition-all ${isMarking ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <FaCheck />
                  {isMarking ? "Marking as worn..." : "I'm wearing this"}
                </button>
              </div>
            );
          })()}
        </>
      ) : (
        <EmptyMessageTemplate
          title="No outfit right now."
          subtitle="All your clothes are in the basket — time to do laundry!"
          buttonText="Go to closet"
          onButtonClick={() => navigate("/closet")}
        />
      )}
    </div>
  );
};

export const TodayPage = (): React.JSX.Element => {
  return (
    <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden">
      {/* Header */}
      <div className="w-full mx-auto max-w-4xl px-4 pt-4 shrink-0">
        <h2 className="page-title">Today's outfit</h2>
      </div>

      <div className="w-full mx-auto max-w-4xl px-4 flex-1 flex flex-col items-center justify-center mb-20 overflow-hidden">
        <OutfitTemplate />
      </div>

      <NavigationBar activePage="today" />
      <RegenerateOutfitFab />
    </div>
  );
};
