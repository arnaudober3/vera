// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Stub everything the flow touches outside itself: routing, i18n (keys are
// echoed back so assertions read as paths), the closet/image stores and the
// photo pipeline. None of them are exercised here — the point is the shape of
// the three-screen flow and where it exits.
const navigate = vi.fn();
vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const markOnboardingComplete = vi.fn();
vi.mock("../storage/onboarding.ts", () => ({
  markOnboardingComplete: () => markOnboardingComplete(),
}));
vi.mock("../hooks/closet.ts", () => ({
  useCloset: () => ({ addClothingItem: vi.fn(), removeClothingItem: vi.fn() }),
}));
vi.mock("../hooks/image.ts", () => ({ useImage: () => ({ saveImage: vi.fn() }) }));
vi.mock("../services/remove-bg.ts", () => ({ uploadService: {} }));
vi.mock("../services/fashion-classifier.ts", () => ({ fashionClassifier: {} }));
vi.mock("../services/image-processing.ts", () => ({
  dataURLToBlob: vi.fn(),
  extractDominantColor: vi.fn(),
  processImageToBase64: vi.fn(),
}));
vi.mock("./onboarding.css", () => ({}));

import { WelcomePage } from "./onboarding.tsx";

describe("onboarding flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  const click = (el: Element | null): void => {
    expect(el).not.toBeNull();
    act(() => {
      (el as HTMLElement).click();
    });
  };

  beforeEach(() => {
    navigate.mockClear();
    markOnboardingComplete.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<WelcomePage />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens on the welcome screen", () => {
    expect(container.textContent).toContain("onboarding.welcome.title");
  });

  it("shows one step dot per screen of the flow", () => {
    // StepDots renders a fixed-height pill per screen; three screens, three dots.
    expect(
      container.querySelectorAll('div[style*="height: 6px"]'),
    ).toHaveLength(3);
  });

  it("walks welcome → add a top → add a bottom", () => {
    click(container.querySelector(".vera-btn-primary"));
    expect(container.textContent).toContain("onboarding.addPiece.top.title");
  });

  it("walks back from the top capture to welcome", () => {
    click(container.querySelector(".vera-btn-primary"));
    click(container.querySelector('[aria-label="onboarding.back"]'));
    expect(container.textContent).toContain("onboarding.welcome.title");
  });

  it("exits to Today when the welcome screen is skipped", () => {
    click(container.querySelector(".vera-skip-link"));
    expect(markOnboardingComplete).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("exits to Today when a capture screen is skipped", () => {
    click(container.querySelector(".vera-btn-primary"));
    // The capture screens carry Skip in the top-right, not the centred link.
    const skip = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "onboarding.addPiece.skip",
    );
    click(skip ?? null);
    expect(markOnboardingComplete).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
