import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";

/** Alfabeto sem caracteres ambíguos na TV (sem 0/O, 1/I/L). Tem de corresponder ao CHECK do banco. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newPairingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Segredo aleatório de 256 bits, em base64url (vai só para um cookie HttpOnly). */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda só isto. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const DISPLAY_COOKIE = "zm_display";
export const PAIRING_COOKIE = "zm_pair";
export const DEVICE_VALID_DAYS = 90;

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/display",
    maxAge: maxAgeSeconds,
  };
}
