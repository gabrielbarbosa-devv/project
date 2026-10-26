import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, cookieStore } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  cookieStore: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { requestPasswordRecovery, updatePassword } from "../../src/features/auth/actions/auth";

const auth = {
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

describe("ações de recuperação de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ auth });
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    cookieStore.get.mockReturnValue({ value: "verified" });
  });

  it("envia por callback PKCE SSR e retorna mensagem genérica sem confirmar cadastro", async () => {
    const result = await requestPasswordRecovery({ email: " ANA@Example.com " });

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@example.com", {
      redirectTo: "http://localhost:3000/auth/confirm?next=%2Fredefinir-senha",
    });
    expect(result.success).toContain("Se o endereço estiver cadastrado");
  });

  it("não enumera endereço e traduz limitação real do serviço", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    expect((await requestPasswordRecovery({ email: "unknown@example.com" })).success).toContain("Se o endereço estiver cadastrado");

    auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    expect((await requestPasswordRecovery({ email: "ana@example.com" })).error).toContain("Aguarde alguns minutos");
  });

  it("traduz falha de rede sem expor erro técnico", async () => {
    auth.resetPasswordForEmail.mockRejectedValue(new Error("internal transport details"));
    const result = await requestPasswordRecovery({ email: "ana@example.com" });

    expect(result.error).toContain("Verifique sua conexão");
    expect(JSON.stringify(result)).not.toContain("internal transport details");
  });

  it("não altera senha sem marcador httpOnly de recovery verificado", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await updatePassword({ password: "nova-senha-segura", confirmPassword: "nova-senha-segura" });

    expect(result.recoveryExpired).toBe(true);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("valida usuário, altera senha, encerra a sessão local e limpa o marcador", async () => {
    const result = await updatePassword({ password: "nova-senha-segura", confirmPassword: "nova-senha-segura" });

    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nova-senha-segura" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cookieStore.delete).toHaveBeenCalledWith("amora_password_recovery");
    expect(result.success).toContain("Senha atualizada");
  });
});
