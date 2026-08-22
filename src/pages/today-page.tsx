import * as React from "react";
import { useTranslation } from "react-i18next";
import { TodayDeck } from "../components/today-deck.tsx";
import "../pages/today-page.css";

const formatDate = (d: Date, locale: string): string => {
  const s = d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const TodayPage = (): React.JSX.Element => {
  const { i18n } = useTranslation();
  const today = formatDate(new Date(), i18n.language || "en");

  return (
    <div className="today-page">
      <div className="today-header">
        <div className="today-header-row">
          <h2 className="vera-page-title today-title">{today}</h2>
        </div>
      </div>

      <TodayDeck />
    </div>
  );
};
