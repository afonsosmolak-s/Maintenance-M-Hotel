"use client";

import { useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { paginate, splitUrgent, type DisplayFeed, type DisplayItem } from "@/lib/display/config";
import { formatElapsed, PRIORITY_LABELS, PRIORITY_LEVEL, STATUS_LABELS } from "@/lib/domain/work-orders";

const FEED_INTERVAL_MS = 20_000;
const MAX_BACKOFF_MS = 120_000;
const STALE_AFTER_MS = 120_000;
const PAIR_POLL_MS = 3_000;
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

type Mode = "boot" | "pairing" | "live";

export function DisplayApp() {
  const [mode, setMode] = useState<Mode>("boot");
  const [pairing, setPairing] = useState<{ code: string } | null>(null);
  const [feed, setFeed] = useState<DisplayFeed | null>(null);
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Ciclo de vida da TV: pareamento ↔ atualização do feed, com espera crescente quando a rede falha.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let etag: string | null = null;
    let failures = 0;
    const startedAt = Date.now();
    const schedule = (fn: () => void, ms: number) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(fn, ms);
    };

    async function loadFeed() {
      try {
        const response = await fetch("/api/display/feed", {
          cache: "no-store",
          headers: etag ? { "If-None-Match": etag } : undefined,
        });
        if (stopped) return;
        if (response.status === 401) return startPairing();
        if (response.status === 304) {
          failures = 0;
          setLastSuccess(Date.now());
        } else if (response.ok) {
          etag = response.headers.get("ETag");
          setFeed((await response.json()) as DisplayFeed);
          setMode("live");
          failures = 0;
          setLastSuccess(Date.now());
        } else {
          throw new Error(String(response.status));
        }
        schedule(loadFeed, FEED_INTERVAL_MS);
      } catch {
        // Sem rede ou servidor indisponível: mantém o último ecrã e tenta de novo, esperando cada vez mais.
        failures += 1;
        schedule(loadFeed, Math.min(FEED_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS));
      }
    }

    async function startPairing() {
      setMode("pairing");
      setFeed(null);
      etag = null;
      try {
        const response = await fetch("/api/display/pair", { method: "POST", cache: "no-store" });
        if (!response.ok) throw new Error("pair");
        const body = (await response.json()) as { code: string };
        if (stopped) return;
        setPairing({ code: body.code });
        schedule(pollPairing, PAIR_POLL_MS);
      } catch {
        setPairing(null);
        schedule(startPairing, 10_000);
      }
    }

    async function pollPairing() {
      try {
        const response = await fetch("/api/display/pair", { cache: "no-store" });
        const body = (await response.json()) as { status: string };
        if (stopped) return;
        if (body.status === "paired") return loadFeed();
        if (body.status === "waiting" || !response.ok) return schedule(pollPairing, response.ok ? PAIR_POLL_MS : PAIR_POLL_MS * 3);
        return startPairing(); // expirado ou inválido: novo código
      } catch {
        schedule(pollPairing, PAIR_POLL_MS * 3);
      }
    }

    // Tema escuro, ecrã sempre ligado (quando o navegador permite), relógio e recarga diária às 4h.
    document.documentElement.dataset.theme = "dark";
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
        wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        // Nem todos os navegadores de TV suportam; o modo quiosque do dispositivo resolve.
      }
    };
    requestWakeLock();
    const onVisible = () => document.visibilityState === "visible" && requestWakeLock();
    document.addEventListener("visibilitychange", onVisible);

    const clock = setInterval(() => {
      const current = new Date();
      setNow(current);
      const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(current));
      if (hour === 4 && Date.now() - startedAt > 3_600_000) window.location.reload();
    }, 15_000);

    loadFeed();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock?.release().catch(() => undefined);
    };
  }, []);

  const stale = mode === "live" && lastSuccess !== null && now.getTime() - lastSuccess > STALE_AFTER_MS;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-paper text-ink"
      style={{ fontSize: "clamp(14px, 1.05vw, 64px)" }}
    >
      {mode === "boot" ? <Centered>Carregando…</Centered> : null}
      {mode === "pairing" ? <PairingScreen code={pairing?.code ?? null} /> : null}
      {mode === "live" && feed ? <LiveScreen feed={feed} now={now} lastSuccess={lastSuccess} stale={stale} /> : null}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center text-[1.5em] text-muted">{children}</div>;
}

export function PairingScreen({ code }: { code: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[1.5em] p-[2em] text-center">
      <p className="text-[1em] font-semibold uppercase tracking-[0.3em] text-muted">{brand.productName}</p>
      <h1 className="text-[2.2em] font-[550] tracking-[-0.03em]">Parear esta TV</h1>
      {code ? (
        <p className="font-mono text-[6em] font-semibold tracking-[0.15em] tabular-nums" aria-label={`Código ${code.split("").join(" ")}`}>
          {code.slice(0, 3)}-{code.slice(3)}
        </p>
      ) : (
        <p className="text-[1.4em] text-muted">Gerando código…</p>
      )}
      <p className="max-w-[40em] text-[1.2em] text-muted">
        No aplicativo, abra <strong className="text-ink">TV</strong> no menu do estabelecimento, toque em{" "}
        <strong className="text-ink">Parear TV</strong> e digite este código. Ele vale por 10 minutos e é renovado
        automaticamente.
      </p>
    </div>
  );
}

export function LiveScreen({ feed, now, lastSuccess, stale }: { feed: DisplayFeed; now: Date; lastSuccess: number | null; stale: boolean }) {
  const { urgent, rest } = useMemo(() => splitUrgent(feed.items), [feed.items]);
  const isList = feed.layout === "list";
  const URGENT_SLOTS = 5;
  const pages = useMemo(() => paginate(isList ? feed.items : rest, isList ? 8 : 6), [feed.items, rest, isList]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.length <= 1) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pages.length), feed.rotationSeconds * 1000);
    return () => clearInterval(id);
  }, [pages.length, feed.rotationSeconds]);

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const c = feed.counts;

  return (
    <>
      <header className="flex items-end justify-between gap-[1em] border-b border-line px-[2em] pb-[0.8em] pt-[1.2em]">
        <div className="min-w-0">
          {feed.establishment ? (
            <p className="truncate text-[0.9em] font-semibold uppercase tracking-[0.25em] text-muted">{feed.establishment}</p>
          ) : null}
          <h1 className="truncate text-[2em] font-[550] leading-tight tracking-[-0.03em]">{feed.display}</h1>
        </div>
        <div className="flex items-end gap-[1.5em]">
          <p className="flex items-center gap-[0.5em] text-[0.95em] text-muted">
            <span className={cn("inline-block h-[0.6em] w-[0.6em] rounded-full", stale ? "bg-overdue" : "bg-success")} aria-hidden />
            {lastSuccess ? `Atualizado ${timeFormat.format(lastSuccess)}` : "Atualizando…"}
          </p>
          <p className="text-[2.6em] font-[550] leading-none tabular-nums tracking-[-0.03em]">{timeFormat.format(now)}</p>
        </div>
      </header>

      {stale ? (
        <div role="status" className="bg-overdue-bg px-[2em] py-[0.5em] text-[1.1em] font-semibold text-overdue">
          Sem ligação ao servidor — mostrando dados de {lastSuccess ? timeFormat.format(lastSuccess) : "—"}. Tentando reconectar.
        </div>
      ) : null}

      <section aria-label="Resumo" className="grid grid-cols-5 gap-px border-b border-line bg-line">
        <Kpi label="Críticas" value={c.critical} tone={c.critical ? "critical" : undefined} />
        <Kpi label="Atrasadas" value={c.overdue} tone={c.overdue ? "overdue" : undefined} />
        <Kpi label="Em andamento" value={c.inProgress} />
        <Kpi label="Pendentes" value={c.pending} />
        <Kpi label="Aguardando material" value={c.onHold} />
      </section>

      {feed.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.5em]">
          <p className="text-[3em] font-[550] tracking-[-0.03em]">Sem pendências</p>
          <p className="text-[1.3em] text-muted">Nenhuma ocorrência aberta neste painel.</p>
        </div>
      ) : isList ? (
        <main className="flex flex-1 flex-col gap-[0.8em] overflow-hidden px-[2em] py-[1.2em]">
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-[0.8em]">
            {current.map((item) => (
              <Card key={item.number} item={item} now={now} />
            ))}
          </div>
          <PageDots page={page} total={pages.length} />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-12 gap-[1.5em] overflow-hidden px-[2em] py-[1.2em]">
          <section aria-label="Urgentes" className="col-span-5 flex min-h-0 flex-col gap-[0.8em]">
            <h2 className="text-[1em] font-semibold uppercase tracking-[0.25em] text-critical">Urgente</h2>
            {urgent.length === 0 ? (
              <p className="flex flex-1 items-center justify-center rounded-[2px] border border-line text-[1.4em] text-muted">
                Nada crítico ou atrasado
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-[0.8em]">
                {urgent.slice(0, URGENT_SLOTS).map((item) => (
                  <Card key={item.number} item={item} now={now} emphasis />
                ))}
                {urgent.length > URGENT_SLOTS ? (
                  <p className="text-[1.4em] font-semibold text-critical">+{urgent.length - URGENT_SLOTS} urgentes</p>
                ) : null}
              </div>
            )}
          </section>
          <section aria-label="Demais ocorrências" className="col-span-7 flex min-h-0 flex-col gap-[0.8em]">
            <h2 className="text-[1em] font-semibold uppercase tracking-[0.25em] text-muted">Demais ({rest.length})</h2>
            {rest.length === 0 ? (
              <p className="flex flex-1 items-center justify-center rounded-[2px] border border-line text-[1.4em] text-muted">
                Nenhuma outra pendência
              </p>
            ) : (
              <>
                <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-[0.8em]">
                  {current.map((item) => (
                    <Card key={item.number} item={item} now={now} />
                  ))}
                </div>
                <PageDots page={page} total={pages.length} />
              </>
            )}
          </section>
        </main>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "critical" | "overdue" }) {
  return (
    <div className="flex flex-col gap-[0.2em] bg-paper px-[1.2em] py-[0.8em]">
      <span className={cn("text-[3em] font-[550] leading-none tabular-nums tracking-[-0.03em]", tone === "critical" && "text-critical", tone === "overdue" && "text-overdue")}>
        {value}
      </span>
      <span className="text-[1em] text-muted">{label}</span>
    </div>
  );
}

const statusTone: Record<DisplayItem["status"], string> = {
  pending: "bg-surface-strong text-ink",
  assigned: "bg-surface-strong text-ink",
  in_progress: "bg-info-bg text-info",
  on_hold: "bg-waiting-bg text-waiting",
};
const priorityTone: Record<DisplayItem["priority"], string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-ink",
  low: "text-muted",
};

function Card({ item, now, emphasis = false }: { item: DisplayItem; now: Date; emphasis?: boolean }) {
  const level = PRIORITY_LEVEL[item.priority];
  return (
    <article
      className={cn(
        "flex min-h-0 flex-col justify-between gap-[0.4em] overflow-hidden rounded-[2px] border-l-[0.3em] bg-surface px-[1em] py-[0.7em]",
        item.priority === "critical" ? "border-critical" : item.overdue ? "border-overdue" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-[0.8em]">
        <p className={cn("min-w-0 truncate font-[550] tracking-[-0.02em]", emphasis ? "text-[1.7em]" : "text-[1.4em]")}>
          {item.location ?? "—"}
        </p>
        <span className={cn("flex shrink-0 items-center gap-[0.3em] text-[1em] font-semibold", priorityTone[item.priority])}>
          <span aria-hidden className="inline-flex h-[0.9em] items-end gap-[0.1em]">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className={cn("w-[0.25em] rounded-[1px] bg-current", step > level && "opacity-20")} style={{ height: `${25 * step}%` }} />
            ))}
          </span>
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>
      <p className={cn("line-clamp-2 text-ink", emphasis ? "text-[1.35em]" : "text-[1.15em]")}>{item.title}</p>
      <div className="flex flex-wrap items-center gap-[0.5em] text-[0.95em] text-muted">
        <span className={cn("rounded-[2px] px-[0.5em] py-[0.1em] font-semibold", statusTone[item.status])}>{STATUS_LABELS[item.status]}</span>
        {item.overdue ? <span className="rounded-[2px] bg-overdue-bg px-[0.5em] py-[0.1em] font-semibold text-overdue">Atrasada</span> : null}
        {item.preventive ? <span className="rounded-[2px] border border-line px-[0.5em] py-[0.1em] font-semibold">Preventiva</span> : null}
        <span>{item.assignee ?? "Sem responsável"}</span>
        <span aria-hidden>·</span>
        <span>{formatElapsed(new Date(item.openedAt), now)}</span>
        <span className="ml-auto tabular-nums">#{String(item.number).padStart(4, "0")}</span>
      </div>
    </article>
  );
}

function PageDots({ page, total }: { page: number; total: number }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-[0.4em] text-[0.95em] text-muted" aria-label={`Página ${page + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-[0.5em] rounded-full transition-all", i === page ? "w-[1.6em] bg-ink" : "w-[0.5em] bg-line")} />
      ))}
      <span className="ml-[0.4em] tabular-nums">
        {page + 1}/{total}
      </span>
    </div>
  );
}
