import { describe, expect, it } from "vitest";
import { formatHours, localDate, resolvePeriod } from "./dashboard";

// 2026-10-09 01:30 em São Paulo (04:30 UTC).
const now = new Date("2026-10-09T04:30:00Z");

describe("localDate", () => {
  it("uses the São Paulo calendar day", () => {
    expect(localDate(new Date("2026-10-09T02:00:00Z"))).toBe("2026-10-08");
    expect(localDate(now)).toBe("2026-10-09");
  });
});

describe("resolvePeriod", () => {
  it("defaults to the last 30 days including today", () => {
    const p = resolvePeriod({}, now);
    expect(p.preset).toBe("30d");
    expect(p.fromDate).toBe("2026-09-10");
    expect(p.toDate).toBe("2026-10-09");
    expect(p.from).toBe("2026-09-10T00:00:00-03:00");
    expect(p.to).toBe("2026-10-10T03:00:00.000Z");
  });

  it("accepts a custom inclusive range", () => {
    const p = resolvePeriod({ de: "2026-10-01", ate: "2026-10-05" }, now);
    expect(p.preset).toBe("custom");
    expect(p.from).toBe("2026-10-01T00:00:00-03:00");
    expect(p.to).toBe("2026-10-06T03:00:00.000Z");
  });

  it("falls back to the default for invalid ranges", () => {
    expect(resolvePeriod({ de: "2026-10-05", ate: "2026-10-01" }, now).preset).toBe("30d");
    expect(resolvePeriod({ de: "lixo", ate: "2026-10-01" }, now).preset).toBe("30d");
    expect(resolvePeriod({ periodo: "7d" }, now).fromDate).toBe("2026-10-03");
  });
});

describe("formatHours", () => {
  it.each([
    [5.5, "5,5 h"],
    [24, "1 d"],
    [30, "1 d 6 h"],
    [null, "—"],
  ])("formats %s as %s", (hours, expected) => {
    expect(formatHours(hours)).toBe(expected);
  });
});
