export type NotificationPermissionStatus =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

class NotificationService {
  get isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  get permissionStatus(): NotificationPermissionStatus {
    if (!this.isSupported) return "unsupported";
    return Notification.permission as NotificationPermissionStatus;
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported) return "unsupported";

    // Some older browsers use a callback instead of returning a promise.
    // Modern browsers return a promise.
    const result = await Notification.requestPermission();
    return result as NotificationPermissionStatus;
  }
}

export const notificationService = new NotificationService();
