import { describe, it, expect } from "vitest";
import { PREV_STEP, previousStep, type Step } from "./onboarding-nav.ts";

describe("onboarding-nav", () => {
  describe("PREV_STEP", () => {
    it("maps the linear path back one step each", () => {
      expect(PREV_STEP["add-top"]).toBe("welcome");
      expect(PREV_STEP["add-bottom"]).toBe("add-top");
      expect(PREV_STEP["outfit"]).toBe("add-bottom");
    });

    it("maps each detour back to levelup", () => {
      expect(PREV_STEP["add-more"]).toBe("levelup");
      expect(PREV_STEP["calendar"]).toBe("levelup");
      expect(PREV_STEP["notifications"]).toBe("levelup");
    });

    it("intentionally does not map welcome or levelup", () => {
      expect(PREV_STEP["welcome"]).toBeUndefined();
      expect(PREV_STEP["levelup"]).toBeUndefined();
    });
  });

  describe("previousStep", () => {
    it("returns the prior linear step for each capture/outfit step", () => {
      expect(previousStep("add-top")).toBe("welcome");
      expect(previousStep("add-bottom")).toBe("add-top");
      expect(previousStep("outfit")).toBe("add-bottom");
    });

    it("returns levelup for each detour", () => {
      expect(previousStep("add-more")).toBe("levelup");
      expect(previousStep("calendar")).toBe("levelup");
      expect(previousStep("notifications")).toBe("levelup");
    });

    it("returns null for welcome and levelup", () => {
      expect(previousStep("welcome")).toBeNull();
      expect(previousStep("levelup")).toBeNull();
    });

    it("covers every step in the Step union", () => {
      const steps: Step[] = [
        "welcome",
        "add-top",
        "add-bottom",
        "outfit",
        "levelup",
        "add-more",
        "calendar",
        "notifications",
      ];
      // Every step either has a back target or is one of the two hubs.
      for (const s of steps) {
        const prev = previousStep(s);
        if (s === "welcome" || s === "levelup") {
          expect(prev).toBeNull();
        } else {
          expect(prev).not.toBeNull();
        }
      }
    });
  });
});
