import { expect, type Page } from "@playwright/test";

export type TestMockScenario =
  | "default"
  | "empty_catalog"
  | "slow_network"
  | "server_error"
  | "network_error"
  | "expired_session"
  | "payment_rejected"
  | "order_timeout_then_confirm"
  | "price_changed_checkout";

const STORAGE_KEY = "kurio_mock_db_v1";

export function attachPageDiagnostics(page: Page) {
  page.on("pageerror", (err) => {
    console.error("[PAGEERROR]", err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("[CONSOLE ERROR]", msg.text());
    }
  });
}

export async function resetScenario(
  page: Page,
  scenario: TestMockScenario = "default",
) {
  attachPageDiagnostics(page);

  await page.goto("/", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  const runResetInBrowser = () =>
    page.evaluate(
      async ({ key, targetScenario }) => {
        try {
          if (targetScenario === "default") {
            localStorage.removeItem(key);
          }
        } catch {
          // ignora erros de storage
        }

        if ("serviceWorker" in navigator) {
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((resolve) => setTimeout(resolve, 4_000)),
          ]);

          if (!navigator.serviceWorker.controller) {
            await Promise.race([
              new Promise<void>((resolve) => {
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => resolve(),
                  { once: true },
                );
              }),
              new Promise((resolve) => setTimeout(resolve, 1_500)),
            ]);
          }
        }

        let lastStatus = 0;
        for (let attempt = 0; attempt < 6; attempt++) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3_000);
          try {
            const res = await fetch("/api/mock/reset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scenario: targetScenario }),
              signal: controller.signal,
            });
            lastStatus = res.status;
            if (res.ok) {
              clearTimeout(timer);
              return { ok: true, status: res.status };
            }
          } catch {
            // tenta novamente
          } finally {
            clearTimeout(timer);
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return { ok: false, status: lastStatus };
      },
      { key: STORAGE_KEY, targetScenario: scenario },
    );

  let result = await runResetInBrowser();

  if (!result.ok && result.status === 404) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
    result = await runResetInBrowser();
  }

  if (!result.ok) {
    throw new Error(`Falha ao resetar cenário: ${result.status}`);
  }

  await page.reload({
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
}

export async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasOverflow).toBeFalsy();
}
