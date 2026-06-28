import { useState } from "react";
import { getNotificationContent } from "../utils/notification-logic";
import "./notification-test.css";

export function NotificationTest() {
  const [permission, setPermission] = useState(Notification.permission);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  const requestPermission = async () => {
    try {
      addLog("Requesting notification permission...");
      const result = await Notification.requestPermission();
      setPermission(result);
      addLog(`Permission result: ${result}`);
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  };

  const sendNotification = (lang: "en" | "fr") => {
    if (permission !== "granted") {
      addLog("❌ Permission not granted");
      return;
    }

    try {
      const content = getNotificationContent(lang);
      addLog(`Sending ${lang.toUpperCase()} notification...`);

      const notification = new Notification(content.title, {
        icon: "/icon_192x192.png",
        body: content.body,
        tag: "vera-debug-notification",
        requireInteraction: true,
      });

      notification.onclick = () => {
        addLog("✅ Notification clicked!");
        window.focus();
        window.location.href = "/";
      };

      addLog("✅ Notification sent");
    } catch (error) {
      addLog(`Error sending notification: ${error}`);
    }
  };

  const clearLog = () => setLog([]);

  return (
    <div className="debug-notifications-page">
      <h1>🧪 Debug: Notifications</h1>

      <section className="debug-section">
        <h2>Status</h2>
        <div className="debug-status">
          <p>
            <strong>Permission:</strong>{" "}
            <code className={permission === "granted" ? "granted" : "denied"}>
              {permission}
            </code>
          </p>
          <p>
            <strong>API Supported:</strong>{" "}
            <code className={"Notification" in window ? "granted" : "denied"}>
              {"Notification" in window ? "yes" : "no"}
            </code>
          </p>
        </div>
      </section>

      <section className="debug-section">
        <h2>Actions</h2>
        <div className="debug-actions">
          <button className="vera-btn-primary" onClick={requestPermission}>
            Request Permission
          </button>
          <button
            className="vera-btn-primary"
            onClick={() => sendNotification("en")}
            disabled={permission !== "granted"}
          >
            Send EN Notification
          </button>
          <button
            className="vera-btn-primary"
            onClick={() => sendNotification("fr")}
            disabled={permission !== "granted"}
          >
            Send FR Notification
          </button>
        </div>
      </section>

      <section className="debug-section">
        <h2>Log</h2>
        <button className="vera-btn-secondary" onClick={clearLog}>
          Clear Log
        </button>
        <div className="debug-log">
          {log.length === 0 ? (
            <p className="debug-log-empty">No logs yet...</p>
          ) : (
            log.map((line, i) => (
              <div key={i} className="debug-log-line">
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
