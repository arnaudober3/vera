import { getSessionId } from "./session.ts";

const onboardingKey = (sessionId: string): string =>
  `vera:onboardingComplete:${sessionId}`;

export const isOnboardingComplete = (): boolean =>
  localStorage.getItem(onboardingKey(getSessionId())) === "true";

export const markOnboardingComplete = (): void => {
  localStorage.setItem(onboardingKey(getSessionId()), "true");
};
