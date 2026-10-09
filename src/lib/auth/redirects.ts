/** Aceita só caminhos internos, para impedir redirecionamentos para outros sites. */
export function safeNextPath(value: unknown, fallback = "/inicio"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
