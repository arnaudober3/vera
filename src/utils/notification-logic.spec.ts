import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatDate,
  getDayDiff,
  getNotificationContent,
  shouldNotify,
} from "./notification-logic.ts";

describe("notification-logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotificationContent", () => {
    it('should return English content for "en" locale', () => {
      const content = getNotificationContent("en");
      expect(content).toEqual({
        title: expect.any(String),
        body: expect.any(String),
      });
      expect(content.title).toBe("Check today's suggestion");
    });

    it('should return French content for "fr" locale', () => {
      const content = getNotificationContent("fr");
      expect(content.title).toBe("Découvre la suggestion du jour");
    });

    it('should return French content for "fr-FR" locale variant', () => {
      const content = getNotificationContent("fr-FR");
      expect(content.title).toBe("Découvre la suggestion du jour");
    });

    it('should return French content for "fr-CA" locale variant', () => {
      const content = getNotificationContent("fr-CA");
      expect(content.title).toBe("Découvre la suggestion du jour");
    });

    it("should return English content for unknown locales", () => {
      const content = getNotificationContent("de");
      expect(content.title).toBe("Check today's suggestion");
    });

    it("should return English content for empty locale string", () => {
      const content = getNotificationContent("");
      expect(content.title).toBe("Check today's suggestion");
    });
  });

  describe("getNotificationContent with laundry hint", () => {
    it("should append English laundry hint when showLaundryHint is true", () => {
      const content = getNotificationContent("en", true);
      expect(content.body).toContain("(time for a laundry?)");
      expect(content.body).toContain("Looking for some outfit ideas for today?");
    });

    it("should append French laundry hint when showLaundryHint is true", () => {
      const content = getNotificationContent("fr", true);
      expect(content.body).toContain("(C’est l’heure de la lessive ?)");
      expect(content.body).toContain(
        "Tu cherches des idées de tenues pour aujourd’hui ?",
      );
    });

    it("should fallback to English laundry hint for unknown locale", () => {
      const content = getNotificationContent("de", true);
      expect(content.body).toContain("(time for a laundry?)");
    });
  });

  describe("formatDate", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2026-06-28T10:00:00");
      expect(formatDate(date)).toBe("2026-06-28");
    });

    it("should pad single digit month and day", () => {
      const date = new Date("2026-01-05T10:00:00");
      expect(formatDate(date)).toBe("2026-01-05");
    });
  });

  describe("getDayDiff", () => {
    it("should return 0 for same day", () => {
      expect(getDayDiff("2026-06-28", "2026-06-28")).toBe(0);
    });

    it("should return 1 for next day", () => {
      expect(getDayDiff("2026-06-29", "2026-06-28")).toBe(1);
    });

    it("should return 2 for two days after", () => {
      expect(getDayDiff("2026-06-30", "2026-06-28")).toBe(2);
    });

    it("should handle month rollover", () => {
      expect(getDayDiff("2026-07-01", "2026-06-30")).toBe(1);
      expect(getDayDiff("2026-07-02", "2026-06-30")).toBe(2);
    });

    it("should handle year rollover", () => {
      expect(getDayDiff("2027-01-01", "2026-12-31")).toBe(1);
      expect(getDayDiff("2027-01-02", "2026-12-30")).toBe(3);
    });

    it("should handle leap years", () => {
      expect(getDayDiff("2024-03-01", "2024-02-28")).toBe(2);
      expect(getDayDiff("2024-03-01", "2024-02-29")).toBe(1);
    });
  });

  describe("shouldNotify", () => {
    it("should allow notification at 6:00 AM when no prior notification today", () => {
      const now = new Date("2024-06-28T06:00:00");
      const result = shouldNotify(now, null);
      expect(result).toBe(true);
    });

    it("should allow notification at 6:01 AM when no prior notification today", () => {
      const now = new Date("2024-06-28T06:01:00");
      const result = shouldNotify(now, null);
      expect(result).toBe(true);
    });

    it("should block notification before 6:00 AM", () => {
      const now = new Date("2024-06-28T05:59:59");
      const result = shouldNotify(now, null);
      expect(result).toBe(false);
    });

    it("should block notification at 5:59 AM", () => {
      const now = new Date("2024-06-28T05:59:00");
      const result = shouldNotify(now, null);
      expect(result).toBe(false);
    });

    it("should block duplicate notification same day", () => {
      const now = new Date("2024-06-28T10:00:00");
      const lastNotifiedDay = "2024-06-28";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(false);
    });

    it("should allow notification on different day even at early hour", () => {
      const now = new Date("2024-06-29T06:00:00");
      const lastNotifiedDay = "2024-06-28";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(true);
    });

    it("should allow next day notification after 6 AM", () => {
      const now = new Date("2024-06-29T08:00:00");
      const lastNotifiedDay = "2024-06-28";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(true);
    });

    it("should block next day before 6 AM", () => {
      const now = new Date("2024-06-29T05:30:00");
      const lastNotifiedDay = "2024-06-28";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(false);
    });

    it("should handle year rollover correctly", () => {
      const now = new Date("2025-01-01T06:00:00");
      const lastNotifiedDay = "2024-12-31";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(true);
    });

    it("should handle month rollover correctly", () => {
      const now = new Date("2024-07-01T06:00:00");
      const lastNotifiedDay = "2024-06-30";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(true);
    });

    it("should format date correctly (zero-padded)", () => {
      // Test that month and day are properly zero-padded
      const now = new Date("2024-01-05T06:00:00");
      const lastNotifiedDay = "2024-01-05";
      const result = shouldNotify(now, lastNotifiedDay);
      expect(result).toBe(false); // Should be blocked because same day
    });

    it("should handle late-night scenarios (after 6 AM for multiple hours)", () => {
      const now = new Date("2024-06-28T23:59:59");
      const result = shouldNotify(now, null);
      expect(result).toBe(true);
    });
  });

  describe("integration: day rollover scenarios", () => {
    it("should allow notification again the next day at 6 AM", () => {
      const today = new Date("2024-06-28T06:00:00");
      const tomorrow = new Date("2024-06-29T06:00:00");
      const lastNotifiedDay = "2024-06-28";

      // Verify today would have been blocked (already notified)
      const todayCheck = shouldNotify(today, lastNotifiedDay);
      expect(todayCheck).toBe(false);

      // Verify tomorrow at 6 AM is allowed
      const tomorrowCheck = shouldNotify(tomorrow, lastNotifiedDay);
      expect(tomorrowCheck).toBe(true);
    });

    it("should block duplicate even if second call is hours later same day", () => {
      const morning = new Date("2024-06-28T06:00:00");
      const evening = new Date("2024-06-28T18:00:00");
      const lastNotifiedDay = "2024-06-28";

      const morningCheck = shouldNotify(morning, lastNotifiedDay);
      const eveningCheck = shouldNotify(evening, lastNotifiedDay);

      expect(morningCheck).toBe(false);
      expect(eveningCheck).toBe(false);
    });
  });
});
