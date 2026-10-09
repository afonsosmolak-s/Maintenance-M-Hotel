"use client";

import { useEffect, useState } from "react";
import { LiveScreen, PairingScreen } from "@/app/display/display-app";
import type { DisplayFeed, DisplayItem } from "@/lib/display/config";

/** Dados fictícios, só para revisão visual do layout da TV. */
function sampleFeed(now: Date): DisplayFeed {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const items: DisplayItem[] = [
    { number: 42, title: "Banheira de hidromassagem com vazamento no ralo", priority: "critical", status: "in_progress", openedAt: ago(3), dueAt: ago(-1), overdue: false, preventive: false, location: "Bloco A › Suíte 12", assignee: "João" },
    { number: 39, title: "Ar-condicionado não liga", priority: "high", status: "assigned", openedAt: ago(30), dueAt: ago(6), overdue: true, preventive: false, location: "Bloco B › Suíte 21", assignee: "Carlos" },
    { number: 44, title: "Disjuntor desarmando", priority: "critical", status: "pending", openedAt: ago(0.5), dueAt: ago(-3.5), overdue: false, preventive: false, location: "Área técnica › Quadro geral", assignee: null },
    ...Array.from({ length: 11 }, (_, i): DisplayItem => ({
      number: 45 + i,
      title: ["Lâmpada queimada no corredor", "Chuveiro com baixa pressão", "Controle da TV sem pilha", "Limpar filtros do ar", "Porta rangendo"][i % 5],
      priority: (["medium", "low", "high", "medium"] as const)[i % 4],
      status: (["pending", "in_progress", "on_hold", "assigned"] as const)[i % 4],
      openedAt: ago(2 + i * 5),
      dueAt: ago(-24),
      overdue: false,
      preventive: i % 5 === 3,
      location: `Bloco ${i % 2 ? "A" : "B"} › Suíte ${10 + i}`,
      assignee: i % 3 ? "Marcos" : null,
    })),
  ];
  return {
    establishment: "Motel Exemplo (dados fictícios)",
    display: "Sala de manutenção",
    layout: "urgent_rotation",
    rotationSeconds: 12,
    counts: { critical: 2, overdue: 1, inProgress: 4, pending: 7, onHold: 3, total: items.length },
    items,
    generatedAt: now.toISOString(),
  };
}

export function TvPreview() {
  const [now] = useState(() => new Date());
  const [screen, setScreen] = useState<"live" | "pairing" | "stale">("live");

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-paper text-ink" style={{ fontSize: "clamp(14px, 1.05vw, 64px)" }}>
      <div className="fixed bottom-2 left-2 z-10 flex gap-1 text-xs" aria-label="Pré-visualização">
        {(["live", "stale", "pairing"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScreen(s)} className={s === screen ? "bg-ink px-2 py-1 text-paper" : "bg-surface px-2 py-1"}>
            {s}
          </button>
        ))}
      </div>
      {screen === "pairing" ? (
        <PairingScreen code="K7P4QX" />
      ) : (
        <LiveScreen feed={sampleFeed(now)} now={now} lastSuccess={now.getTime() - (screen === "stale" ? 300_000 : 5_000)} stale={screen === "stale"} />
      )}
    </div>
  );
}
