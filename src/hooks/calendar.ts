import { useState, useEffect } from "react";
import {
  MOCK_TODAY_EVENT,
  type CalendarEvent,
} from "../models/calendar.ts";
import {
  isCalendarConnected,
  markCalendarConnected,
} from "../storage/calendar.ts";

// Private singleton state reused through the app (mirrors occasion.ts). Kept in
// sync so connecting during onboarding is reflected the moment Today mounts.
let connected = isCalendarConnected();
const listeners = new Set<(c: boolean) => void>();

// The day's pick the (mocked) sync engine surfaces. Null models a quiet day,
// which drives the "Nothing on today" fallback. Only meaningful when connected.
const todayEventFor = (isConnected: boolean): CalendarEvent | null =>
  isConnected ? MOCK_TODAY_EVENT : null;

export function useCalendar() {
  const [isConnected, setIsConnected] = useState(connected);

  useEffect(() => {
    const listener = (c: boolean): void => setIsConnected(c);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const connect = (): void => {
    markCalendarConnected();
    connected = true;
    listeners.forEach((listener) => listener(true));
  };

  return {
    connected: isConnected,
    todayEvent: todayEventFor(isConnected),
    connect,
  };
}
