import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  cookieOptions,
  DEVICE_VALID_DAYS,
  DISPLAY_COOKIE,
  newPairingCode,
  newSecret,
  PAIRING_COOKIE,
  sha256Hex,
} from "@/lib/display/credentials";
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

/** A TV pede um código de pareamento. O segredo do pareamento fica num cookie HttpOnly. */
export async function POST() {
  const admin = adminOrNull();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const secret = newSecret();

  // Colisão de código é rara (31^6); tenta de novo algumas vezes.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode();
    const { data: expiresAt, error } = await admin.rpc("display_pairing_start", { p_code: code, p_secret_hash: sha256Hex(secret) });
    if (!error) {
      const response = NextResponse.json({ code, expiresAt }, { headers: noStore });
      response.cookies.set(PAIRING_COOKIE, secret, cookieOptions(10 * 60));
      return response;
    }
    if (error.code !== "23505") break;
  }
  return NextResponse.json({ error: "Não foi possível gerar o código." }, { status: 503, headers: noStore });
}

/** A TV pergunta se o código já foi aceite; se sim, recebe a credencial (cookie HttpOnly). */
export async function GET() {
  const secret = (await cookies()).get(PAIRING_COOKIE)?.value;
  if (!secret) return NextResponse.json({ status: "none" }, { headers: noStore });

  const token = newSecret();
  const admin = adminOrNull();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: status, error } = await admin.rpc("display_pairing_exchange", {
    p_secret_hash: sha256Hex(secret),
    p_token_hash: sha256Hex(token),
    p_valid_days: DEVICE_VALID_DAYS,
  });
  if (error) return NextResponse.json({ status: "error" }, { status: 503, headers: noStore });

  const response = NextResponse.json({ status }, { headers: noStore });
  if (status === "paired") {
    response.cookies.set(DISPLAY_COOKIE, token, cookieOptions(DEVICE_VALID_DAYS * 86_400));
    response.cookies.delete({ name: PAIRING_COOKIE, path: "/api/display" });
  } else if (status === "expired" || status === "invalid") {
    response.cookies.delete({ name: PAIRING_COOKIE, path: "/api/display" });
  }
  return response;
}
