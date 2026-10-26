import { expect, test } from "@playwright/test";

test("hoje exige sessão autenticada", async ({ page }) => {
  await page.goto("/hoje");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
});

test("login apresenta os campos essenciais e os caminhos de autenticação", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Esqueceu a senha?" })).toHaveAttribute("href", "/recuperar-senha");
  await expect(page.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
});

test("cadastro apresenta campos acessíveis, validação de senha e retorno ao login", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/cadastro");

  await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
  await expect(page.getByText("Comece a organizar seus conteúdos em um só lugar.")).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByText("Use pelo menos 8 caracteres.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("Use pelo menos 8 caracteres.", { exact: true })).toHaveCount(2);

  await page.locator("#password").fill("12345678");
  await expect(page.getByText("Mínimo de 8 caracteres atendido.")).toBeVisible();
  await expect(page.getByText("Use pelo menos 8 caracteres.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toHaveAttribute("href", "/login");
  await page.getByRole("button", { name: "Criar conta" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeInViewport();

  const layout = await page.evaluate(() => ({
    googleBottom: document.querySelector(".google-button")?.getBoundingClientRect().bottom ?? 0,
    footerTop: document.querySelector(".auth-switch")?.getBoundingClientRect().top ?? 0,
  }));
  expect(layout.footerTop).toBeGreaterThanOrEqual(layout.googleBottom);
});

test("cadastro mantém o rodapé abaixo do Google em largura tablet", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/cadastro");

  const layout = await page.evaluate(() => ({
    googleBottom: document.querySelector(".google-button")?.getBoundingClientRect().bottom ?? 0,
    footerTop: document.querySelector(".auth-switch")?.getBoundingClientRect().top ?? 0,
  }));
  expect(layout.footerTop).toBeGreaterThanOrEqual(layout.googleBottom);
});

test("cadastro não sobrepõe o rodapé ao botão Google em telas desktop baixas", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 700 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/cadastro");
    await expect(page.locator(".google-button")).toBeVisible();

    const layout = await page.evaluate(() => ({
      googleBottom: document.querySelector(".google-button")?.getBoundingClientRect().bottom ?? 0,
      footerTop: document.querySelector(".auth-switch")?.getBoundingClientRect().top ?? 0,
    }));
    expect(layout.footerTop).toBeGreaterThanOrEqual(layout.googleBottom + 20);
  }
});

test("recuperação mostra instruções acessíveis e mantém o CTA visível em viewport estreita", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/recuperar-senha");

  await expect(page.getByRole("heading", { name: "Recuperar sua senha" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByRole("link", { name: "Voltar ao login" }).first()).toHaveAttribute("href", "/login");
  await page.getByLabel("E-mail").fill("email-invalido");
  await page.getByLabel("E-mail").press("Enter");
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByRole("button", { name: "Enviar link de recuperação" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Enviar link de recuperação" })).toBeInViewport();

  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("redefinição sem sessão de recovery não mostra formulário de senha", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/redefinir-senha");

  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Solicitar novo link" })).toHaveAttribute("href", "/recuperar-senha");
  await expect(page.getByLabel("Nova senha")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("callback não aceita token_hash fora da estratégia PKCE e não mantém tokens na URL", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalid&type=recovery&next=%2Fredefinir-senha");
  await expect(page).toHaveURL(/\/redefinir-senha\?erro=link-invalido$/);
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
});
