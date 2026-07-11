import { test, expect, type Page } from "@playwright/test";

// The full mock-mode journey: signup -> verify -> list a tool -> rent someone
// else's -> checkout (guaranteed first-attempt failure/compensation) -> retry
// -> return. Runs against `npm run dev` with no AWS involved (see
// playwright.config.ts). Steps share one page/session on purpose — this is a
// single user's session, not independent unit tests, so the tests share a
// single browser context/page (mock auth state lives in that page's
// localStorage; a fresh fixture page per test would come back signed out).
test.describe.serial("golden path (mock mode)", () => {
  const email = `e2e-${Date.now()}@toolshare.dev`;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("sign up and verify", async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Password").fill("doesnt-matter-in-mock");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL(/\/verify$/);
    await page.getByPlaceholder("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("demo mode")).toBeVisible();
  });

  test("browse: search and type filter narrow the grid", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Rent a tool near you" })).toBeVisible();

    const cardCount = () => page.locator("a[href^='/tools/t-']").count();
    await expect(page.getByText("Cordless Drill 18V")).toBeVisible();
    const before = await cardCount();
    expect(before).toBeGreaterThan(1);

    await page.getByPlaceholder("Search tools…").fill("drill");
    await expect(page.getByText("Cordless Drill 18V")).toBeVisible();
    expect(await cardCount()).toBe(1);

    await page.getByPlaceholder("Search tools…").fill("");
    await page.getByRole("combobox").selectOption("garden");
    await expect(page.getByText("Hedge Trimmer")).toBeVisible();
    expect(await cardCount()).toBe(1);
  });

  test("list a tool and see it in My tools", async () => {
    await page.goto("/tools/new");
    await page.getByPlaceholder("Cordless Drill 18V").fill("E2E Test Grinder");
    await page.getByPlaceholder("120").fill("75");
    await page.getByRole("button", { name: "List it" }).click();

    await expect(page).toHaveURL(/\/my-tools$/);
    await expect(page.getByText("E2E Test Grinder")).toBeVisible();
  });

  test("rent a tool owned by someone else", async () => {
    await page.goto("/");
    await page.getByText("Circular Saw").click();
    await expect(page).toHaveURL(/\/tools\/t-saw$/);

    await expect(page.getByRole("button", { name: "Request rental" })).toBeVisible();
    await page.getByRole("button", { name: "Request rental" }).click();

    await expect(page).toHaveURL(/\/rentals$/);
    await expect(page.getByRole("link", { name: "Circular Saw" })).toBeVisible();
  });

  test("checkout fails once, shows compensation banner, retry succeeds, then return", async () => {
    // Client-side nav, not page.goto(): mock state is an in-memory module,
    // and a hard navigation reloads the bundle and resets it.
    await page.getByRole("link", { name: "My rentals" }).click();
    await expect(page).toHaveURL(/\/rentals$/);
    const row = page.locator("li").filter({ hasText: "Circular Saw" });
    await expect(row).toBeVisible();

    // Mock guarantees the first checkout on a fresh rental fails.
    await row.getByRole("button", { name: "Checkout" }).click();
    await expect(row.getByText("Payment failed.")).toBeVisible();
    await expect(
      row.getByText("Your reservation was automatically released")
    ).toBeVisible();

    // Retry until the (small, randomized) chance of a repeat failure clears.
    await retryCheckoutUntilActive(page, row);

    await row.getByRole("button", { name: "Return" }).click();
    await expect(row.getByText("returned", { exact: true })).toBeVisible();
  });
});

async function retryCheckoutUntilActive(_page: Page, row: ReturnType<Page["locator"]>) {
  const succeeded = row.getByRole("button", { name: "Return" });
  const failedAgain = row.getByRole("button", { name: "Retry payment" });
  for (let attempt = 0; attempt < 10; attempt++) {
    // Each retry lands in exactly one terminal state (active or failed-again)
    // — race the two rather than polling blind, so a successful retry can't
    // hang waiting on a "Retry payment" button that will never reappear.
    await expect(succeeded.or(failedAgain)).toBeVisible({ timeout: 5_000 });
    if (await succeeded.isVisible()) return;
    await failedAgain.click();
  }
  await expect(succeeded).toBeVisible();
}
