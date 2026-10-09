"use client";

import { useEffect } from "react";

/**
 * Raiz do site. Links de e-mail do Supabase (ex.: convite enviado pelo painel) chegam aqui
 * com a sessão no fragmento (#access_token=… ou #error=…), que o servidor não vê:
 * esses vão para /auth/aceitar com o fragmento intacto. O resto segue para /inicio.
 */
export default function Root() {
  useEffect(() => {
    const hash = window.location.hash;
    const fromEmailLink = /(^#|&)(access_token|error_description)=/.test(hash);
    window.location.replace(fromEmailLink ? `/auth/aceitar${hash}` : "/inicio");
  }, []);

  return <main className="flex-1" aria-busy="true" />;
}
