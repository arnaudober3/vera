import { describe, it, expect } from "vitest";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Guards the onboarding back-navigation label so it resolves in both locales
// (no i18next missing-key fallback) and stays at the same path across languages.
describe("onboarding locale keys", () => {
  it("exposes onboarding.back in English", () => {
    expect(en.onboarding.back).toBe("Back");
  });

  it("exposes onboarding.back in French", () => {
    expect(fr.onboarding.back).toBe("Retour");
  });

  it("has the back key at the same path in both locales", () => {
    expect(typeof en.onboarding.back).toBe("string");
    expect(typeof fr.onboarding.back).toBe("string");
    expect(en.onboarding.back.length).toBeGreaterThan(0);
    expect(fr.onboarding.back.length).toBeGreaterThan(0);
  });
});
