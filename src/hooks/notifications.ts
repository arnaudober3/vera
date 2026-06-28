import { useState, useEffect } from "react";
import {
  notificationService,
  type NotificationPermissionStatus,
} from "../services/notifications.ts";
import {
  isNotificationPromptDismissed,
  setNotificationPromptDismissed,
} from "../storage/notifications.ts";

const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

let currentStatus = notificationService.permissionStatus;
let promptDismissed = isNotificationPromptDismissed();

// Poll for permission changes (in case the user changes them in browser settings)
// and notify listeners if it changes.
if (typeof window !== "undefined") {
  setInterval(() => {
    const nextStatus = notificationService.permissionStatus;
    if (nextStatus !== currentStatus) {
      currentStatus = nextStatus;
      notify();
    }
  }, 1000);
}

export function useNotifications() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = (): void => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const requestPermission = async (): Promise<NotificationPermissionStatus> => {
    const result = await notificationService.requestPermission();
    currentStatus = result;
    notify();
    return result;
  };

  const dismissPrompt = (): void => {
    setNotificationPromptDismissed(true);
    promptDismissed = true;
    notify();
  };

  return {
    supported: notificationService.isSupported,
    permissionStatus: currentStatus,
    promptDismissed,
    requestPermission,
    dismissPrompt,
  };
}
