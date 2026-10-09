/** Período do painel e formatação dos indicadores. Datas no fuso do piloto (America/Sao_Paulo, UTC−3). */

export const PERIOD_PRESETS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type PeriodPreset = keyof typeof PERIOD_PRESETS;

const SAO_PAULO_OFFSET = "-03:00";
const DAY = 86_400_000;

/** "2026-10-09" no fuso de São Paulo. */
export function localDate(date: Date): string {
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Resolve o período pedido: um atalho (7d/30d/90d) ou datas de/até (inclusive).
 * Devolve instantes ISO [from, to) e as datas para mostrar nos campos.
 */
export function resolvePeriod(
  params: { periodo?: string; de?: string; ate?: string },
  now: Date,
): { from: string; to: string; fromDate: string; toDate: string; preset: PeriodPreset | "custom" } {
  const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));

  if (isDate(params.de) && isDate(params.ate) && params.de! <= params.ate!) {
    const spanDays = (Date.parse(params.ate!) - Date.parse(params.de!)) / DAY;
    if (spanDays <= 366) {
      return {
        from: `${params.de}T00:00:00${SAO_PAULO_OFFSET}`,
        to: new Date(Date.parse(`${params.ate}T00:00:00${SAO_PAULO_OFFSET}`) + DAY).toISOString(),
        fromDate: params.de!,
        toDate: params.ate!,
        preset: "custom",
      };
    }
  }

  const preset: PeriodPreset = params.periodo && params.periodo in PERIOD_PRESETS ? (params.periodo as PeriodPreset) : "30d";
  const today = localDate(now);
  const fromDate = localDate(new Date(Date.parse(`${today}T12:00:00Z`) - (PERIOD_PRESETS[preset] - 1) * DAY));
  return {
    from: `${fromDate}T00:00:00${SAO_PAULO_OFFSET}`,
    to: new Date(Date.parse(`${today}T00:00:00${SAO_PAULO_OFFSET}`) + DAY).toISOString(),
    fromDate,
    toDate: today,
    preset,
  };
}

/** 5.5 → "5,5 h"; 30 → "1 d 6 h". */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 24) return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest ? `${days} d ${rest} h` : `${days} d`;
}

/** Abaixo disto, médias não são mostradas como se fossem representativas. */
export const MIN_SAMPLE_FOR_AVERAGES = 3;
