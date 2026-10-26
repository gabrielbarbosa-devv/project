import { describe, expect, it } from "vitest";
import { recoverySchema, signInSchema, signUpSchema, updatePasswordSchema } from "../../src/features/auth/schemas/auth";
import { channelSchema, workspaceSchema } from "../../src/features/onboarding/schemas/onboarding";
import { getEmailConfirmationRedirectUrl, getPasswordRecoveryRedirectUrl } from "../../src/lib/auth/redirect-urls";

describe("schemas de autenticação", () => {
  it("normaliza nome e e-mail no cadastro", () => {
    const result = signUpSchema.parse({
      name: "  Ana Souza  ",
      email: " Ana@Example.com ",
      password: "senha-segura",
    });

    expect(result).toEqual({ name: "Ana Souza", email: "ana@example.com", password: "senha-segura" });
  });

  it("aplica os limites de nome e senha do cadastro", () => {
    expect(signUpSchema.safeParse({ name: "A", email: "ana@example.com", password: "senha-segura" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "A".repeat(81), email: "ana@example.com", password: "senha-segura" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Ana Souza", email: "ana@example.com", password: "curta" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Ana Souza", email: "ana@example.com", password: "12345678" }).success).toBe(true);
  });

  it("rejeita credenciais inválidas", () => {
    expect(signInSchema.safeParse({ email: "invalido", password: "" }).success).toBe(false);
    expect(recoverySchema.safeParse({ email: "invalido" }).success).toBe(false);
  });

  it("normaliza o endereço usado no pedido de recuperação", () => {
    expect(recoverySchema.parse({ email: "  ANA@Example.com " })).toEqual({ email: "ana@example.com" });
  });

  it("exige confirmação igual à nova senha", () => {
    const mismatch = updatePasswordSchema.safeParse({ password: "senha-segura", confirmPassword: "outra-senha" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(updatePasswordSchema.safeParse({ password: "curta", confirmPassword: "curta" }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ password: "senha-segura", confirmPassword: "senha-segura" }).success).toBe(true);
  });
});

describe("schemas de onboarding", () => {
  it("valida os três tipos de workspace e os limites do nome", () => {
    expect(workspaceSchema.safeParse({ name: "Ana Studio", persona: "creator" }).success).toBe(true);
    expect(workspaceSchema.safeParse({ name: "A", persona: "creator" }).success).toBe(false);
    expect(workspaceSchema.safeParse({ name: "Ana Studio", persona: "unknown" }).success).toBe(false);
  });

  it("aceita canal manual com URL opcional e rejeita URL malformada", () => {
    expect(channelSchema.safeParse({ platform: "youtube", name: "Canal da Ana", url: "https://youtube.com/@ana" }).success).toBe(true);
    expect(channelSchema.safeParse({ platform: "youtube", name: "Canal da Ana", url: "site inválido" }).success).toBe(false);
  });
});

describe("retorno de confirmação de e-mail", () => {
  it("usa a URL SSR configurada como callback de confirmação", () => {
    expect(getEmailConfirmationRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"))
      .toBe("http://localhost:3000/auth/confirm");
  });

  it("leva a recuperação para a rota SSR com destino interno permitido", () => {
    expect(getPasswordRecoveryRedirectUrl("https://amora.example")).toBe("https://amora.example/auth/confirm?next=%2Fredefinir-senha");
  });
});
