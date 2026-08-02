import { describe, it, expect } from "vitest";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Every leaf path in a locale bundle, e.g. "today.empty.title".
const keyPaths = (value: unknown, prefix = ""): string[] => {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
};

// Nothing in the build fails on a key that exists in one locale only — it just
// falls back to English at runtime, in front of a French user. Trimming the
// bundles by hand is exactly when that happens, so it gets a test.
describe("locale parity", () => {
  it("exposes the same key paths in both locales", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it("has no empty string anywhere", () => {
    for (const bundle of [en, fr]) {
      for (const path of keyPaths(bundle)) {
        const value = path
          .split(".")
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], bundle);
        expect(typeof value, path).toBe("string");
        expect((value as string).length, path).toBeGreaterThan(0);
      }
    }
  });
});

// Guards the clean-up: these blocks belonged to the removed notifications,
// calendar, lookbook and laundry features and must not creep back in.
describe("removed feature keys", () => {
  it("no longer carries the lookbook, basket, calendar or date blocks", () => {
    for (const bundle of [en, fr]) {
      for (const block of ["lookbook", "basket", "calendarCallback", "date"]) {
        expect(bundle).not.toHaveProperty(block);
      }
      expect(bundle.nav).not.toHaveProperty("lookbook");
      expect(bundle.onboarding).not.toHaveProperty("calendar");
      expect(bundle.onboarding).not.toHaveProperty("notifications");
      for (const key of ["wearingBadge", "hintWorn", "heartAddAria", "weather"]) {
        expect(bundle.today).not.toHaveProperty(key);
      }
    }
  });

  // The onboarding was cut back to welcome → add a top → add a bottom → Today.
  // These blocks belonged to the removed first-outfit reveal, the level-up hub
  // and its optional extra-piece detour, plus the closet's just-onboarded toast.
  it("no longer carries the outfit reveal, level-up or onboarding toast blocks", () => {
    for (const bundle of [en, fr]) {
      for (const block of ["outfit", "levelup"]) {
        expect(bundle.onboarding).not.toHaveProperty(block);
      }
      expect(bundle.onboarding.addPiece).not.toHaveProperty("more");
      expect(bundle.onboarding.addPiece).not.toHaveProperty("optional");
      for (const key of [
        "onboardingToastTitle",
        "onboardingToastSub",
        "onboardingToastDismissAria",
      ]) {
        expect(bundle.closet).not.toHaveProperty(key);
      }
    }
  });
});

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

// Guards the update-available prompt strings so the reload prompt renders real
// copy (no i18next missing-key fallback) in both locales.
describe("update locale keys", () => {
  it("exposes update.title and update.reload in English", () => {
    expect(typeof en.update.title).toBe("string");
    expect(en.update.title.length).toBeGreaterThan(0);
    expect(typeof en.update.reload).toBe("string");
    expect(en.update.reload.length).toBeGreaterThan(0);
  });

  it("exposes update.title and update.reload in French", () => {
    expect(typeof fr.update.title).toBe("string");
    expect(fr.update.title.length).toBeGreaterThan(0);
    expect(typeof fr.update.reload).toBe("string");
    expect(fr.update.reload.length).toBeGreaterThan(0);
  });
});
