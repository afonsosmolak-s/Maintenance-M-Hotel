import { connection } from "next/server";
import { brand } from "@/config/brand";
import { renderTvPage } from "@/lib/display/tv-page";

/**
 * Painel para TV: HTML simples, sem React, para funcionar em navegadores de Smart TV antigos.
 * Sem sessão de utilizador: a TV é pareada com um código e usa uma credencial própria (cookie HttpOnly).
 * /display?demo=1 mostra o layout com dados fictícios (sem rede).
 */
export async function GET() {
  // Gerada a cada pedido: nunca pré-renderizada nem guardada em cache.
  await connection();

  return new Response(renderTvPage(brand.productName), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}
