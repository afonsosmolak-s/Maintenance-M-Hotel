export const ASSET_STATUSES = ["operational", "degraded", "down", "retired"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  operational: "Em funcionamento",
  degraded: "Funcionando com defeito",
  down: "Parado",
  retired: "Desativado",
};

export function isAssetStatus(value: string): value is AssetStatus {
  return (ASSET_STATUSES as readonly string[]).includes(value);
}

/** Garantia vigente na data indicada (inclusive o último dia). */
export function isUnderWarranty(warrantyUntil: string | null, today: string): boolean {
  return Boolean(warrantyUntil && warrantyUntil >= today);
}
