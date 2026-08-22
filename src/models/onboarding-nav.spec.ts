import { describe, it, expect } from "vitest";
import { PREV_STEP, previousStep, type Step } from "./onboarding-nav.ts";

describe("onboarding-nav", () => {
  describe("PREV_STEP", () => {
    it("maps the linear path back one step each", () => {
      expect(PREV_STEP["add-top"]).toBe("welcome");
      expect(PREV_STEP["add-bottom"]).toBe("add-top");
    });

    it("intentionally does not map welcome", () => {
      expect(PREV_STEP["welcome"]).toBeUndefined();
    });
  });

  describe("previousStep", () => {
    it("returns the prior linear step for each capture step", () => {
      expect(previousStep("add-top")).toBe("welcome");
      expect(previousStep("add-bottom")).toBe("add-top");
    });

    it("returns null for welcome", () => {
      expect(previousStep("welcome")).toBeNull();
    });

    it("covers every step in the Step union", () => {
      const steps: Step[] = ["welcome", "add-top", "add-bottom"];
      // Every step has a back target except the entry point.
      for (const s of steps) {
        const prev = previousStep(s);
        if (s === "welcome") {
          expect(prev).toBeNull();
        } else {
          expect(prev).not.toBeNull();
        }
      }
    });
  });
});
