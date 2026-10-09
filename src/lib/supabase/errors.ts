import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Converte erros do banco em mensagens para o utilizador.
 * As mensagens das nossas funções (42501, 23514) já estão em português e são seguras de mostrar;
 * o resto vira uma mensagem genérica, sem detalhes internos.
 */
export function friendlyDbError(error: Pick<PostgrestError, "code" | "message"> | null, fallback: string): string {
  if (!error) return fallback;
  switch (error.code) {
    case "42501":
      return error.message.startsWith("new row violates") ? "Sem permissão para esta ação." : error.message;
    case "23514":
      return error.message.startsWith("new row") ? "Dados inválidos." : error.message;
    case "23505":
      return "Este registo já existe.";
    case "23503":
      return "Não é possível: há registos ligados a este item.";
    default:
      return fallback;
  }
}
