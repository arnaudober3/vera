import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TodayDeck } from "../components/today-deck.tsx";
import { useWeather } from "../hooks/weather.ts";
import type { Weather } from "../models/weather.ts";
import {
  MdAcUnit,
  MdCloud,
  MdGrain,
  MdThermostat,
  MdWbSunny,
} from "react-icons/md";
import "../pages/today-page.css";

const formatDate = (d: Date, locale: string): string => {
  const s = d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// Glanceable weather pill: shows today's temperature + condition icon, tappable to
// override the temperature manually. The deck rebuilds itself when the weather
// changes (it keys on the cached reading), so no outfit regeneration is needed here.
const WeatherBadge = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { weather, setManualWeather } = useWeather();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const submit = (): void => {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) setManualWeather(n);
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
        <button type="button" className="today-weather-done" onClick={submit}>
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

export const TodayPage = (): React.JSX.Element => {
  const { i18n } = useTranslation();
  const today = formatDate(new Date(), i18n.language || "en");
  const { refreshWeather } = useWeather();
  const refreshed = useRef(false);

  // Fetch today's weather once on mount so the pill + deck reflect real
  // conditions. The deck reacts to the cached reading on its own.
  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    void refreshWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="today-page">
      <div className="today-header">
        <div className="today-header-row">
          <h2 className="vera-page-title today-title">{today}</h2>
          <WeatherBadge />
        </div>
      </div>

      <TodayDeck />
    </div>
  );
};
