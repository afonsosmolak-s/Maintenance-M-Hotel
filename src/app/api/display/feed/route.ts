import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, DEVICE_VALID_DAYS, DISPLAY_COOKIE, sha256Hex } from "@/lib/display/credentials";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Sem a chave secreta configurada, responde 503 (a TV tenta de novo) em vez de falhar com 500. */
function adminOrNull() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

const noStore = { "Cache-Control": "no-store" };

/**
 * Dados do painel para a TV pareada. Responde 304 quando nada mudou (ETag), para TVs com
 * rede fraca. 401 = credencial inválida, revogada ou expirada → a TV volta ao pareamento.
 */
export async function GET(request: NextRequest) {
  const token = (await cookies()).get(DISPLAY_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unpaired" }, { status: 401, headers: noStore });

  const admin = adminOrNull();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data, error } = await admin.rpc("display_feed", { p_token_hash: sha256Hex(token), p_valid_days: DEVICE_VALID_DAYS });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });

  if (!data) {
    const response = NextResponse.json({ error: "unpaired" }, { status: 401, headers: noStore });
    response.cookies.delete({ name: DISPLAY_COOKIE, path: "/api/display" });
    return response;
  }

  const { renewed, generatedAt, ...content } = data as Record<string, unknown>;
  const etag = `"${sha256Hex(JSON.stringify(content)).slice(0, 32)}"`;
  const headers = { ...noStore, ETag: etag };

  const response =
    request.headers.get("if-none-match") === etag
      ? new NextResponse(null, { status: 304, headers })
      : NextResponse.json({ ...content, generatedAt }, { headers });

  if (renewed) response.cookies.set(DISPLAY_COOKIE, token, cookieOptions(DEVICE_VALID_DAYS * 86_400));
  return response;
}
