import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo.").max(80, "Use até 80 caracteres."),
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use até 72 caracteres."),
});

export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe sua senha."),
});

export const recoverySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Use pelo menos 8 caracteres."),
  confirmPassword: z.string().min(1, "Confirme sua nova senha."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "As senhas não coincidem.",
});

export type AuthActionResult = {
  error?: string;
  success?: string;
  recoveryExpired?: boolean;
};
