import type { ReactNode } from "react";

export type BarListItem = { key: string; label: ReactNode; value: number; detail?: string; title?: string };

/**
 * Barras horizontais de uma só série (magnitude): uma cor, barra fina com ponta arredondada,
 * valor em texto ao lado. É também a "tabela" acessível: rótulo e número são texto.
 */
export function BarList({ items, emptyText, valueLabel }: { items: BarListItem[]; emptyText: string; valueLabel: string }) {
  if (items.length === 0) return <p className="border-y border-line py-6 text-sm text-muted">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="flex flex-col gap-3" aria-label={valueLabel}>
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1" title={item.title}>
          <span className="truncate text-sm">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums">
            {item.value}
            {item.detail ? <span className="ml-2 text-xs font-normal text-muted">{item.detail}</span> : null}
          </span>
          <span className="col-span-2 h-2 rounded-r-[4px] bg-surface" aria-hidden>
            <span className="block h-2 rounded-r-[4px] bg-ink" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 2 : 0)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
