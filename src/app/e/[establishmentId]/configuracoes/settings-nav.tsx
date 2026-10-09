import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "", label: "Locais" },
  { href: "/categorias", label: "Categorias" },
] as const;

export function SettingsHeader({ establishmentId, active }: { establishmentId: string; active: (typeof TABS)[number]["label"] }) {
  const base = `/e/${establishmentId}/configuracoes`;
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Configurações</h1>
        <p className="text-sm text-muted">A estrutura do estabelecimento: onde as coisas ficam e como os problemas são classificados.</p>
      </div>
      <nav aria-label="Configurações" className="flex gap-6 border-b border-line text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={`${base}${tab.href}`}
            aria-current={tab.label === active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-3",
              tab.label === active ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
