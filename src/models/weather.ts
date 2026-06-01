export interface Weather {
  /** Current air temperature in degrees Celsius. */
  temperatureC: number;
  /** Whether it is currently raining/snowing (precipitation > 0). */
  isPrecipitating: boolean;
  /** Open-Meteo WMO weather code, used to pick a condition glyph. */
  weatherCode: number;
  /** Epoch ms the reading was taken, for cache TTL. */
  fetchedAt: number;
  /** True when the reading was entered by the user rather than fetched. */
  isManual?: boolean;
}
