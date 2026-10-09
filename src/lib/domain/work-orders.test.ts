import { describe, expect, it } from "vitest";
import { canTransition, formatElapsed, isOverdue } from "./work-orders";

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
    expect(canTransition("pending", "assigned")).toBe(true);
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
