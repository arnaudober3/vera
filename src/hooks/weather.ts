import { useState, useEffect } from "react";
import type { Weather } from "../models/weather.ts";
import {
  getCachedWeather,
  refreshWeather as refreshWeatherService,
  setManualWeather as setManualWeatherService,
} from "../services/weather.ts";

// Private singleton state reused through the app (mirrors closet.ts / outfit.ts).
// The source of truth lives in localStorage via the weather service; this layer
// just mirrors it into React state and notifies subscribers on change.
let state: Weather | null = null;
let isInitialized = false;
const listeners = new Set<(w: Weather | null) => void>();

const initialize = (): void => {
  if (isInitialized) {
    return;
  }
  state = getCachedWeather();
  isInitialized = true;
};
initialize();

const emitChange = (next: Weather | null): void => {
  state = next;
  listeners.forEach((listener) => listener(next));
};

export function useWeather() {
  const [weather, setWeather] = useState(state);

  useEffect(() => {
    const listener = (w: Weather | null) => setWeather(w);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Fetch a fresh reading (only hits the network when the cache is stale) and
  // broadcast it. Returns the resolved weather so callers can react to it.
  const refreshWeather = async (): Promise<Weather | null> => {
    const next = await refreshWeatherService();
    emitChange(next);
    return next;
  };

  const setManualWeather = (temperatureC: number): void => {
    emitChange(setManualWeatherService(temperatureC));
  };

  return { weather, refreshWeather, setManualWeather };
}
