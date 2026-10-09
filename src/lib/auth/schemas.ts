import { z } from "zod";

export const emailSchema = z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(10, { error: "A senha precisa de pelo menos 10 caracteres." })
  .max(72, { error: "A senha pode ter no máximo 72 caracteres." });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Informe o seu nome." })
  .max(120, { error: "Nome muito longo." });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "As senhas não coincidem.", path: ["confirm"] });
