import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisplayApp } from "./display-app";

export const metadata: Metadata = { title: "Painel de manutenção" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Painel para TV. Sem sessão de utilizador: a TV é pareada com um código e usa uma credencial própria. */
export default function DisplayPage() {
  return (
    <Suspense fallback={null}>
      <RequestTime />
    </Suspense>
  );
}

/** Renderiza no pedido (o relógio da TV depende da hora atual, não da hora do build). */
async function RequestTime() {
  await connection();
  return <DisplayApp />;
}
