import { describe, expect, it } from "vitest";
import { formatPlatformDateTime, installPlatformTimeZoneDefaults, PLATFORM_TZ } from "@/lib/time/platform-tz";

installPlatformTimeZoneDefaults();
installPlatformTimeZoneDefaults(); // idempotent

const at = new Date("2026-10-09T19:00:00Z"); // 12:00 PM PDT

describe("platform time zone (PT)", () => {
  it("is the default for date formatting that names no zone", () => {
    expect(at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })).toBe("12:00 PM");
    expect(at.toLocaleDateString("en-US")).toBe("10/9/2026");
    expect(at.toLocaleString("en-US")).toBe("10/9/2026, 12:00:00 PM");
    expect(new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(at)).toBe("12 PM");
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(PLATFORM_TZ);
  });

  it("leaves an explicit zone alone", () => {
    expect(at.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" })).toBe("7 PM");
    expect(new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "Europe/Paris" }).format(at)).toBe("9 PM");
  });

  it("keeps Intl.DateTimeFormat working as before", () => {
    const f = new Intl.DateTimeFormat("en-US", { month: "short" });
    expect(f instanceof Intl.DateTimeFormat).toBe(true);
    expect(f.formatToParts(at)[0]?.value).toBe("Oct");
    expect(Intl.DateTimeFormat.supportedLocalesOf(["en-US"])).toEqual(["en-US"]);
    expect(Intl.DateTimeFormat("en-US", { day: "numeric" }).format(at)).toBe("9");
  });

  it("winter dates use standard time", () => {
    expect(new Date("2026-12-10T07:00:00Z").toLocaleString("en-US")).toBe("12/9/2026, 11:00:00 PM");
  });

  it("formats with a PT label", () => {
    expect(formatPlatformDateTime(at)).toBe("Oct 9, 2026, 12:00 PM PT");
  });
});

describe("plain calendar dates keep their day", () => {
  it("a date-only string (UTC midnight) is not pulled back a day", () => {
    expect(new Date("2026-10-07").toLocaleDateString("en-US", { month: "short", day: "numeric" })).toBe("Oct 7");
    expect(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date("2026-10-07"))).toBe("Oct 7");
  });
  it("a local-midnight date keeps its day", () => {
    expect(new Date(2026, 9, 7).toLocaleDateString("en-US", { month: "short", day: "numeric" })).toBe("Oct 7");
  });
  it("a real timestamp still shows its PT day", () => {
    // 03:00 UTC Oct 8 is 8 PM Oct 7 in PT.
    expect(new Date("2026-10-08T03:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })).toBe("Oct 7");
  });
});
