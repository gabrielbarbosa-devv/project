import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, cookieStore } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  cookieStore: {
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "../../src/app/auth/confirm/route";

const auth = {
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  verifyOtp: vi.fn(),
};

function request(search: string) {
  return new Request(`http://localhost:3000/auth/confirm${search}`);
}

describe("callback SSR PKCE de confirmação e recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ auth });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("troca o código de recovery, valida o usuário e grava cookies SSR antes de abrir a redefinição", async () => {
    const response = await GET(request("?code=pkce-code&next=%2Fredefinir-senha"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/redefinir-senha");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(cookieStore.set).toHaveBeenCalledWith("amora_password_recovery", "verified", expect.objectContaining({ httpOnly: true, maxAge: 600 }));
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("confirma cadastro com PKCE e mantém a rota de onboarding", async () => {
    const response = await GET(request("?code=signup-code"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("signup-code");
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it.each([
    ["?token_hash=untrusted&type=recovery&next=%2Fredefinir-senha", "http://localhost:3000/redefinir-senha?erro=link-invalido"],
    ["?code=bad-code&next=https%3A%2F%2Fevil.example", "http://localhost:3000/onboarding"],
    ["?next=%2Fredefinir-senha", "http://localhost:3000/redefinir-senha?erro=link-invalido"],
  ])("recusa parâmetros inválidos ou estratégia não configurada (%s)", async (search, destination) => {
    const response = await GET(request(search));

    expect(response.headers.get("location")).toBe(destination);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("redireciona código expirado de recovery para pedir outro link", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const response = await GET(request("?code=expired&next=%2Fredefinir-senha"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/redefinir-senha?erro=link-invalido");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
