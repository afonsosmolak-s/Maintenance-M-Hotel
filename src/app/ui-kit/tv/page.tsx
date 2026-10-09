import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TvPreview } from "./tv-preview";

export const metadata: Metadata = { title: "Pré-visualização TV" };

/** Pré-visualização do painel de TV com dados de exemplo. Não existe em produção. */
export default function TvPreviewPage() {
  return (
    <Suspense fallback={null}>
      <RequestTime />
    </Suspense>
  );
}

async function RequestTime() {
  await connection();
  if (process.env.VERCEL_ENV === "production") notFound();
  return <TvPreview />;
}
