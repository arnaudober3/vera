import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const src = full ? "/assets/basket_full.png" : "/assets/basket_empty.png";
  return (
    <img
      src={src}
      alt={full ? t("basket.fullAlt") : t("basket.emptyAlt")}
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
  const location = useLocation();
  const { t } = useTranslation();
  const { items, markLaundryDone } = useCloset();

  const computedDirtyCount =
    dirtyCountProp ??
    items.filter((i) => isWashable(i.category) && !i.isClean).length;

  if (computedDirtyCount === 0 && !viewingBasket) return null;

  const handleTap =
    onTap ??
    (() => navigate("/closet/basket", { state: { from: location.pathname } }));
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
          ? t("basket.viewingAria")
          : t("basket.tapAria", { count: computedDirtyCount })
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
              {t("basket.countTitle", { count: computedDirtyCount })}
            </div>
            <div className="vera-basket-strip__sub">{t("basket.viewingSub")}</div>
          </>
        ) : (
          <>
            <div className="vera-basket-strip__title">
              {t("basket.countTitle", { count: computedDirtyCount })}
            </div>
            <div className="vera-basket-strip__sub">{t("basket.countSub")}</div>
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
          aria-label={t("basket.washAria")}
          title={t("basket.washTitle")}
        >
          <MdLocalLaundryService size={14} />
          {t("basket.wash")}
        </button>
      )}
    </div>
  );
};
