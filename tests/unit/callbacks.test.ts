import { describe, expect, it } from "vitest";
import { getSafeAuthDestination } from "../../src/lib/auth/safe-redirect";

describe("destinos de autenticação", () => {
  it.each(["/", "/onboarding", "/redefinir-senha"])("permite destino interno %s", (destination) => {
    expect(getSafeAuthDestination(destination)).toBe(destination);
  });

  it.each([null, "https://example.com", "//example.com", "/admin", ""]) (
    "usa destino padrão para valor não permitido (%s)",
    (destination) => {
      expect(getSafeAuthDestination(destination)).toBe("/");
    },
  );
});
