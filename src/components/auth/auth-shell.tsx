import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";

/** Moldura das telas sem sessão: login, recuperação, convite. */
export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {brand.productName}
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl leading-[1.1] font-[550] tracking-[-0.04em]">{title}</h1>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
