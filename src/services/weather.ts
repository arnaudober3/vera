import type { Season } from "../models/season.ts";
import type { Weather } from "../models/weather.ts";
import { getSessionId } from "../storage/session.ts";
import { lsGet, lsSet } from "../storage/local-store.ts";

const weatherKey = (sessionId: string): string => `vera:weather:${sessionId}`;

// How long a cached reading stays fresh before refreshWeather refetches.
export const WEATHER_TTL_MS = 60 * 60 * 1000; // 1 hour

// Map the current temperature onto a season so weather can flow through the
// existing season-scoring plumbing (getSeasonScore) instead of a new axis.
// Thresholds chosen to match the warmth semantics of subCategorySeasons.
export const temperatureToSeason = (tempC: number): Season => {
  if (tempC < 8) return "winter";
  if (tempC < 15) return "fall";
  if (tempC < 22) return "spring";
  return "summer";
};

// True when conditions warrant grabbing a layer: cold or actively precipitating.
export const COLD_OUTERWEAR_THRESHOLD_C = 12;
export const needsOuterwear = (weather: Weather): boolean =>
  weather.temperatureC < COLD_OUTERWEAR_THRESHOLD_C || weather.isPrecipitating;

export const getCachedWeather = (): Weather | null =>
  lsGet<Weather | null>(weatherKey(getSessionId()), null);

const cacheWeather = (weather: Weather): void =>
  lsSet(weatherKey(getSessionId()), weather);

const isFresh = (weather: Weather | null): weather is Weather =>
  !!weather && Date.now() - weather.fetchedAt < WEATHER_TTL_MS;

interface Coordinates {
  lat: number;
  lon: number;
}

export const getCoordinates = (): Promise<Coordinates> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10_000, maximumAge: 30 * 60 * 1000 },
    );
  });

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
  };
}

export const fetchWeather = async ({
  lat,
  lon,
}: Coordinates): Promise<Weather> => {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,weather_code`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather request failed: ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Weather response missing current conditions.");
  }
  return {
    temperatureC: Math.round(current.temperature_2m),
    isPrecipitating: (current.precipitation ?? 0) > 0,
    weatherCode: current.weather_code ?? 0,
    fetchedAt: Date.now(),
  };
};

// Build a manual reading from a user-entered temperature. We can't know the sky
// from a temperature alone, so precipitation defaults to false.
export const buildManualWeather = (temperatureC: number): Weather => ({
  temperatureC: Math.round(temperatureC),
  isPrecipitating: false,
  weatherCode: 0,
  fetchedAt: Date.now(),
  isManual: true,
});

// Resolve the current weather: reuse a fresh cached reading, otherwise locate
// the user and fetch. Returns null (and leaves any manual reading untouched) if
// geolocation is denied/unavailable so callers can fall back to the calendar.
export const refreshWeather = async (): Promise<Weather | null> => {
  const cached = getCachedWeather();
  if (isFresh(cached)) return cached;

  try {
    const coords = await getCoordinates();
    const weather = await fetchWeather(coords);
    cacheWeather(weather);
    return weather;
  } catch {
    // Keep a previously stored (possibly stale or manual) reading rather than
    // wiping it; only return what we have.
    return cached;
  }
};

// Persist a user-entered temperature as the active weather reading.
export const setManualWeather = (temperatureC: number): Weather => {
  const weather = buildManualWeather(temperatureC);
  cacheWeather(weather);
  return weather;
};
