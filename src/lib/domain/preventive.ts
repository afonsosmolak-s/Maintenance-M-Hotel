export const INTERVAL_UNITS = ["day", "week", "month"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

const UNIT_NAMES: Record<IntervalUnit, [string, string]> = {
  day: ["dia", "dias"],
  week: ["semana", "semanas"],
  month: ["mês", "meses"],
};

export function isIntervalUnit(value: string): value is IntervalUnit {
  return (INTERVAL_UNITS as readonly string[]).includes(value);
}

/** "Todo mês", "A cada 3 meses", "Toda semana"… */
export function intervalLabel(unit: IntervalUnit, count: number): string {
  if (count === 1) return unit === "week" ? "Toda semana" : unit === "day" ? "Todo dia" : "Todo mês";
  return `A cada ${count} ${UNIT_NAMES[unit][1]}`;
}

export type DueState =
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "soon"; days: number }
  | { kind: "later"; days: number };

/** Situação do próximo vencimento em relação a hoje (datas "AAAA-MM-DD"). "soon" = dentro da antecedência. */
export function dueState(nextDueOn: string, today: string, leadDays: number): DueState {
  const days = Math.round((Date.parse(`${nextDueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (days <= leadDays) return { kind: "soon", days };
  return { kind: "later", days };
}

export function dueStateLabel(state: DueState): string {
  switch (state.kind) {
    case "overdue":
      return state.days === 1 ? "Venceu ontem" : `Venceu há ${state.days} dias`;
    case "today":
      return "Vence hoje";
    case "soon":
    case "later":
      return state.days === 1 ? "Vence amanhã" : `Vence em ${state.days} dias`;
  }
}
