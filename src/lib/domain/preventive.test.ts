import { describe, expect, it } from "vitest";
import { dueState, dueStateLabel, intervalLabel } from "./preventive";

describe("intervalLabel", () => {
  it.each([
    ["month", 1, "Todo mês"],
    ["month", 3, "A cada 3 meses"],
    ["week", 1, "Toda semana"],
    ["week", 2, "A cada 2 semanas"],
    ["day", 1, "Todo dia"],
  ] as const)("%s × %i → %s", (unit, count, expected) => {
    expect(intervalLabel(unit, count)).toBe(expected);
  });
});

describe("dueState", () => {
  const today = "2026-10-09";
  it("classifies relative to today and the lead window", () => {
    expect(dueState("2026-10-07", today, 7)).toEqual({ kind: "overdue", days: 2 });
    expect(dueState("2026-10-09", today, 7)).toEqual({ kind: "today" });
    expect(dueState("2026-10-14", today, 7)).toEqual({ kind: "soon", days: 5 });
    expect(dueState("2026-11-09", today, 7)).toEqual({ kind: "later", days: 31 });
  });

  it("labels in Portuguese", () => {
    expect(dueStateLabel({ kind: "overdue", days: 1 })).toBe("Venceu ontem");
    expect(dueStateLabel({ kind: "soon", days: 1 })).toBe("Vence amanhã");
    expect(dueStateLabel({ kind: "later", days: 31 })).toBe("Vence em 31 dias");
  });
});
