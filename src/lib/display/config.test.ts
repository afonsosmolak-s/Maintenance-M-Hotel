import { describe, expect, it } from "vitest";
import { paginate, parseDisplayConfig, splitUrgent, type DisplayItem } from "./config";

const item = (number: number, priority: DisplayItem["priority"], overdue = false): DisplayItem => ({
  number,
  title: `#${number}`,
  priority,
  status: "pending",
  openedAt: "2026-10-09T10:00:00Z",
  dueAt: null,
  overdue,
  preventive: false,
  location: "Suíte",
  assignee: null,
});

describe("parseDisplayConfig", () => {
  it("fills defaults (show everything)", () => {
    const c = parseDisplayConfig({});
    expect(c.priorities).toHaveLength(4);
    expect(c.statuses).toHaveLength(4);
    expect(c.sectorIds).toEqual([]);
    expect(c.layout).toBe("urgent_rotation");
  });

  it("falls back to defaults for invalid stored config", () => {
    expect(parseDisplayConfig({ rotationSeconds: 1 }).rotationSeconds).toBe(12);
    expect(parseDisplayConfig({ priorities: [] }).priorities).toHaveLength(4);
  });
});

describe("splitUrgent", () => {
  it("keeps critical and overdue items in the fixed zone", () => {
    const { urgent, rest } = splitUrgent([item(1, "critical"), item(2, "low", true), item(3, "high")]);
    expect(urgent.map((i) => i.number)).toEqual([1, 2]);
    expect(rest.map((i) => i.number)).toEqual([3]);
  });
});

describe("paginate", () => {
  it("splits into pages and keeps one empty page for no items", () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([], 6)).toEqual([[]]);
  });
});
