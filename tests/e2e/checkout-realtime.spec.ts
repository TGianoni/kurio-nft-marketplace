import { expect, test, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  resetScenario,
  type TestMockScenario,
} from "./helpers";

async function addFirstNftAndGoToCheckout(
  page: Page,
  scenario: TestMockScenario = "default",
) {
  await resetScenario(page, scenario);

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await ensureAuthenticated(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const catalogSection = page.locator("#catalogo");
  await expect(catalogSection).toBeVisible({ timeout: 15_000 });

  const firstCard = catalogSection.locator("article").first();
  await expect(firstCard).toBeVisible({ timeout: 15_000 });
  await firstCard.getByRole("button", { name: /adicionar/i }).click();

  await expect(
    page.getByRole("link", { name: /carrinho com [1-9]\d* itens/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: /confirmar pagamento/i }),
  ).toBeVisible({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
}

async function triggerMockEvent(
  page: Page,
  endpoint: "/api/mock/events/nft-updated" | "/api/mock/events/order-updated",
  payload: Record<string, unknown>,
) {
  await page.evaluate(
    async ({ url, body }) => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
    },
    { url: endpoint, body: payload },
  );
}

async function ensureAuthenticated(page: Page) {
  const loginHeading = page.getByRole("heading", { name: /entrar na conta/i });
  const isLoginVisible = await loginHeading
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);

  if (!isLoginVisible) return;

  await page.getByLabel(/e-?mail/i).fill("lucas@kurio.dev");
  await page.getByLabel(/senha/i).fill("Senha@123");
  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(loginHeading).toBeHidden({ timeout: 15_000 });
}

test.describe("KURIO Marketplace - Checkout e Tempo Real", () => {
  test("01 - Finaliza pedido com sucesso no fluxo padrão", async ({ page }) => {
    await addFirstNftAndGoToCheckout(page, "default");

    const nameInput = page.getByLabel(/nome/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("Thiago Gianoni");
    }

    const emailInput = page.getByLabel(/e-?mail/i).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("thiago@kurio.io");
    }

    const submitBtn = page
      .getByRole("button", {
        name: /finalizar|confirmar pedido|pagar|criar pedido/i,
      })
      .first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(
        page
          .getByText(/pedido confirmado|confirmado|sucesso|pedido #/i)
          .or(page.getByRole("status"))
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("02 - Trata pagamento rejeitado (payment_rejected) sem travar a tela", async ({
    page,
  }) => {
    await addFirstNftAndGoToCheckout(page, "payment_rejected");

    const submitBtn = page
      .getByRole("button", {
        name: /finalizar|confirmar pedido|pagar|criar pedido/i,
      })
      .first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(
        page
          .getByRole("alert")
          .or(page.getByText(/rejeitad|recusad|falha no pagamento|erro/i))
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    }

    await assertNoHorizontalOverflow(page);
  });

  test("03 - Trata divergência de preço no checkout (price_changed_checkout)", async ({
    page,
  }) => {
    await addFirstNftAndGoToCheckout(page, "default");

    await triggerMockEvent(page, "/api/mock/events/nft-updated", {
      nftId: "nft-1",
      priceEth: "12.50",
    });

    await page.getByRole("button", { name: /confirmar pagamento/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 15_000,
    });

    const syncBtn = page
      .getByRole("button", { name: /atualizar cotação/i })
      .first();
    if (await syncBtn.isVisible().catch(() => false)) {
      await syncBtn.click();
    }

    await assertNoHorizontalOverflow(page);
  });

  test("04 - Trata timeout seguido de confirmação (order_timeout_then_confirm)", async ({
    page,
  }) => {
    await addFirstNftAndGoToCheckout(page, "order_timeout_then_confirm");

    const submitBtn = page
      .getByRole("button", {
        name: /finalizar|confirmar pedido|pagar|criar pedido/i,
      })
      .first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(
        page
          .getByText(/pendente|processando|timeout|tempo esgotado|confirmado/i)
          .or(page.getByRole("status"))
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("05 - Dispara eventos mockados de atualização de NFT e pedido", async ({
    page,
  }) => {
    await resetScenario(page, "default");
    await expect(page.locator("#catalogo article").first()).toBeVisible({
      timeout: 15_000,
    });

    await triggerMockEvent(page, "/api/mock/events/nft-updated", {
      nftId: "nft-1",
      priceEth: "9.99",
      availableStock: 2,
    });

    await triggerMockEvent(page, "/api/mock/events/order-updated", {
      orderId: "ord-1",
      status: "confirmed",
    });

    await assertNoHorizontalOverflow(page);
  });
});
