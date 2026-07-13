export type NotificationPermissionStatus =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

// Max time we wait for `navigator.serviceWorker.ready` before giving up. The
// reminder ping is best-effort: readiness only settles once a worker becomes
// active for the scope, which may never happen (registration failed/blocked/not
// yet installed). Bounding it keeps enableDailyReminder()/bootstrap() from
// hanging the UI.
const SERVICE_WORKER_READY_TIMEOUT_MS = 3000;

class NotificationService {
  get isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /**
   * Wait for the service worker to become ready, but never block longer than
   * SERVICE_WORKER_READY_TIMEOUT_MS. Any timeout or rejection is swallowed and
   * resolves to null so the caller can continue without pinging the worker.
   */
  private async readyRegistrationOrNull(): Promise<ServiceWorkerRegistration | null> {
    if (!("serviceWorker" in navigator)) return null;

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), SERVICE_WORKER_READY_TIMEOUT_MS);
    });

    try {
      return await Promise.race([navigator.serviceWorker.ready, timeout]);
    } catch {
      return null;
    }
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

  async enableDailyReminder(): Promise<void> {
    if (!this.isSupported) return;

    const permission = await this.requestPermission();
    if (permission !== "granted") return;

    const registration = await this.readyRegistrationOrNull();
    if (registration) {
      // Ping the SW to perform an initial check
      registration.active?.postMessage({ type: "CHECK_REMINDERS" });
    }
  }

  async bootstrap(): Promise<void> {
    if (!this.isSupported) return;

    if (this.permissionStatus === "granted") {
      const registration = await this.readyRegistrationOrNull();
      if (registration) {
        registration.active?.postMessage({ type: "CHECK_REMINDERS" });
      }
    }
  }
}

export const notificationService = new NotificationService();
