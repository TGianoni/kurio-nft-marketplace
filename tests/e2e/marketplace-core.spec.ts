import { expect, test, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, resetScenario } from "./helpers";

async function expectCatalogLoaded(page: Page) {
  const catalogSection = page.getByRole("region", {
    name: /catálogo de nfts/i,
  });

  try {
    await expect(catalogSection).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    const rootHtml = await page
      .locator("#root")
      .innerHTML()
      .catch(() => "");
    console.error("URL atual:", page.url());
    console.error("#root HTML (primeiros 500 chars):", rootHtml.slice(0, 500));
    throw err;
  }

  return catalogSection;
}

test.describe("KURIO Marketplace - Fluxos Principais", () => {
  test.beforeEach(async ({ page }) => {
    await resetScenario(page, "default");
  });

  test("01 - Home e catálogo carregam sem overflow horizontal e exibem NFTs", async ({
    page,
  }) => {
    const catalogSection = await expectCatalogLoaded(page);
    await assertNoHorizontalOverflow(page);

    const firstCard = catalogSection.locator("article").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await expect(firstCard.locator("h3")).toBeVisible();

    await page
      .getByRole("button", { name: /limpar filtros/i })
      .click()
      .catch(() => {});
    await assertNoHorizontalOverflow(page);
  });

  test("02 - Catálogo vazio exibe estado vazio e botão de restaurar", async ({
    page,
  }) => {
    await resetScenario(page, "empty_catalog");
    await expectCatalogLoaded(page);

    await expect(
      page.getByText(/nenhum nft encontrado com os filtros atuais/i),
    ).toBeVisible({ timeout: 15_000 });

    const restoreBtn = page.getByRole("button", {
      name: /restaurar catálogo/i,
    });
    await expect(restoreBtn).toBeVisible();
  });

  test("03 - Adiciona NFT ao carrinho pela home e acessa /cart", async ({
    page,
  }) => {
    const catalogSection = await expectCatalogLoaded(page);
    const firstCard = catalogSection.locator("article").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const addBtn = firstCard.getByRole("button", { name: /adicionar/i });
    await addBtn.click();

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await assertNoHorizontalOverflow(page);

    const couponInput = page
      .getByPlaceholder(/cupom|kurio10/i)
      .or(page.getByLabel(/cupom/i));
    if (await couponInput.isVisible().catch(() => false)) {
      await couponInput.fill("KURIO10");
      await page
        .getByRole("button", { name: /aplicar/i })
        .first()
        .click();
      await expect(page.getByText(/kurio10/i).first()).toBeVisible();
    }
  });
});
