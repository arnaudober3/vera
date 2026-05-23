import * as React from "react";
import { useNavigate } from "react-router";
import { MdChevronLeft, MdLocalLaundryService } from "react-icons/md";
import { useCloset } from "../hooks/closet.ts";
import { isWashable } from "../models/clothing-item.ts";

export const BasketImage = ({
  full,
  width,
}: {
  full: boolean;
  width: number;
}): React.JSX.Element => {
  const src = full ? "/assets/basket_full.png" : "/assets/basket_empty.png";
  return (
    <img
      src={src}
      alt={full ? "Full basket" : "Empty basket"}
      style={{ width, height: "auto", display: "block", flexShrink: 0 }}
    />
  );
};

type BasketStripProps = {
  dirtyCount?: number;
  viewingBasket?: boolean;
  onTap?: () => void;
  onWash?: () => void;
};

export const BasketStrip = ({
  dirtyCount: dirtyCountProp,
  viewingBasket = false,
  onTap,
  onWash,
}: BasketStripProps): React.JSX.Element | null => {
  const navigate = useNavigate();
  const { items, markLaundryDone } = useCloset();

  const computedDirtyCount =
    dirtyCountProp ??
    items.filter((i) => isWashable(i.category) && !i.isClean).length;

  if (computedDirtyCount === 0 && !viewingBasket) return null;

  const handleTap = onTap ?? (() => navigate("/closet/basket"));
  const handleWash = onWash ?? (() => void markLaundryDone());

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleTap();
        }
      }}
      className="vera-basket-strip"
      aria-pressed={viewingBasket}
      aria-label={
        viewingBasket
          ? "Showing the basket — tap to go back"
          : `${computedDirtyCount} ${computedDirtyCount === 1 ? "item" : "items"} in the basket — tap to view`
      }
    >
      <div className="vera-basket-strip__media">
        <BasketImage full width={44} />
      </div>

      <div className="vera-basket-strip__text">
        {viewingBasket ? (
          <>
            <div className="vera-basket-strip__title">
              <MdChevronLeft size={16} aria-hidden />
              Showing the basket
            </div>
            <div className="vera-basket-strip__sub">Tap to go back</div>
          </>
        ) : (
          <>
            <div className="vera-basket-strip__title">
              {computedDirtyCount}{" "}
              {computedDirtyCount === 1 ? "item" : "items"} in the basket
            </div>
            <div className="vera-basket-strip__sub">
              Tap to see what's worn
            </div>
          </>
        )}
      </div>

      {computedDirtyCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleWash();
          }}
          className="vera-btn-primary vera-basket-strip__wash"
          aria-label="Mark all worn items as clean"
          title="Mark all worn items as clean"
        >
          <MdLocalLaundryService size={14} />
          Wash
        </button>
      )}
    </div>
  );
};
