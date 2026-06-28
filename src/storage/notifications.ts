import { lsGet, lsSet } from "./local-store.ts";
import { getSessionId } from "./session.ts";

const promptDismissedKey = (sessionId: string): string =>
  `vera:notifications:promptDismissed:${sessionId}`;

export const isNotificationPromptDismissed = (): boolean =>
  lsGet<boolean>(promptDismissedKey(getSessionId()), false);

export const setNotificationPromptDismissed = (dismissed: boolean): void =>
  lsSet(promptDismissedKey(getSessionId()), dismissed);
