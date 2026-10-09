import { describe, expect, it } from "vitest";
import { canTransition, compareByUrgency, formatElapsed, isOverdue } from "./work-orders";

const now = new Date("2026-10-09T12:00:00Z");

describe("isOverdue", () => {
  it("is overdue when the due date has passed and the work order is open", () => {
    expect(isOverdue({ status: "in_progress", dueAt: new Date("2026-10-09T11:00:00Z") }, now)).toBe(true);
  });

  it("is not overdue without a due date", () => {
    expect(isOverdue({ status: "pending", dueAt: null }, now)).toBe(false);
  });

  it("is never overdue once closed", () => {
    const past = new Date("2026-10-01T00:00:00Z");
    expect(isOverdue({ status: "done", dueAt: past }, now)).toBe(false);
    expect(isOverdue({ status: "cancelled", dueAt: past }, now)).toBe(false);
  });
});

describe("canTransition", () => {
  it("allows the normal flow", () => {
    expect(canTransition("pending", "in_progress")).toBe(true);
    expect(canTransition("assigned", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "on_hold")).toBe(true);
    expect(canTransition("on_hold", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "done")).toBe(true);
  });

  it("rejects leaving a closed state", () => {
    expect(canTransition("done", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
  });

  it("requires starting before finishing", () => {
    expect(canTransition("pending", "done")).toBe(false);
  });

  it("leaves pending ↔ assigned to the assignment action", () => {
    expect(canTransition("pending", "assigned")).toBe(false);
    expect(canTransition("assigned", "pending")).toBe(false);
  });
});

describe("formatElapsed", () => {
  it.each([
    ["2026-10-09T11:59:40Z", "agora"],
    ["2026-10-09T11:45:00Z", "há 15 min"],
    ["2026-10-09T09:00:00Z", "há 3 h"],
    ["2026-10-07T10:00:00Z", "há 2 d"],
  ])("formats %s as %s", (since, expected) => {
    expect(formatElapsed(new Date(since), now)).toBe(expected);
  });
});

describe("compareByUrgency", () => {
  const base = { status: "pending" as const, openedAt: new Date("2026-10-09T08:00:00Z") };
  it("orders by priority, then overdue, then due date, then age", () => {
    const items = [
      { id: "low", ...base, priority: "low" as const, dueAt: null },
      { id: "high-later", ...base, priority: "high" as const, dueAt: new Date("2026-10-10T00:00:00Z") },
      { id: "high-overdue", ...base, priority: "high" as const, dueAt: new Date("2026-10-09T10:00:00Z") },
      { id: "critical", ...base, priority: "critical" as const, dueAt: null },
    ];
    const sorted = [...items].sort((a, b) => compareByUrgency(a, b, now)).map((i) => i.id);
    expect(sorted).toEqual(["critical", "high-overdue", "high-later", "low"]);
  });
});
