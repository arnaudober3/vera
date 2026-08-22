// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The register hook is a virtual module provided by vite-plugin-pwa at build
// time; in tests we control its return value to drive needRefresh.
const updateServiceWorker = vi.fn();
let needRefresh = false;
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, vi.fn()],
    updateServiceWorker,
  }),
}));

// Identity translation so assertions can key off the i18n paths directly.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { UpdatePrompt } from "./update-prompt.tsx";

describe("UpdatePrompt", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    updateServiceWorker.mockClear();
    needRefresh = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders nothing when needRefresh is false", () => {
    needRefresh = false;
    act(() => root.render(<UpdatePrompt />));
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders the title and reload button when needRefresh is true", () => {
    needRefresh = true;
    act(() => root.render(<UpdatePrompt />));
    expect(container.textContent).toContain("update.title");
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("update.reload");
  });

  it("calls updateServiceWorker with true when reload is clicked", () => {
    needRefresh = true;
    act(() => root.render(<UpdatePrompt />));
    const button = container.querySelector("button");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
