// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Stub App's side-effecting children so we can assert only that the update
// prompt is mounted, without booting the router, i18n or storage layers.
vi.mock("./components/update-prompt.tsx", () => ({
  UpdatePrompt: () => <div data-testid="update-prompt" />,
}));
vi.mock("./components/toast-provider.tsx", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("./pages/today-page.tsx", () => ({ TodayPage: () => null }));
vi.mock("./pages/closet-page.tsx", () => ({ ClosetPage: () => null }));
vi.mock("./pages/lookbook-page.tsx", () => ({ LookbookPage: () => null }));
vi.mock("./pages/onboarding.tsx", () => ({ WelcomePage: () => null }));
vi.mock("./pages/google-callback.tsx", () => ({ GoogleCallbackPage: () => null }));
vi.mock("./pages/notification-test.tsx", () => ({ NotificationTest: () => null }));
vi.mock("./storage/onboarding.ts", () => ({ isOnboardingComplete: () => true }));
vi.mock("./App.css", () => ({}));

import App from "./App.tsx";

describe("App", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the UpdatePrompt component", () => {
    act(() => root.render(<App />));
    expect(
      container.querySelector('[data-testid="update-prompt"]'),
    ).not.toBeNull();
  });
});
