import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const startedAt = performance.now();
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head><title>Synthetic Journey</title></head>
      <body>
        <main>
          <h1>Invite a teammate</h1>
          <label>Email <input type="email" /></label>
          <button type="button">Send invitation</button>
          <p role="status" aria-live="polite"></p>
        </main>
        <script>
          document.querySelector("button").addEventListener("click", () => {
            document.querySelector("[role=status]").textContent =
              "Invitation sent";
          });
        </script>
      </body>
    </html>`);

  const controlStartedAt = performance.now();
  await page.getByLabel("Email").fill("synthetic@example.invalid");
  await page.getByRole("button", { name: "Send invitation" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").getByText("Invitation sent").waitFor();
  const controlDurationMs = performance.now() - controlStartedAt;

  const axeStartedAt = performance.now();
  const axe = await new AxeBuilder({ page }).analyze();
  const axeDurationMs = performance.now() - axeStartedAt;

  const result = {
    status: axe.violations.length === 0 ? "passed" : "failed",
    assertion: "Invitation sent",
    browserVersion: browser.version(),
    playwrightVersion: require("playwright/package.json").version,
    axeVersion: require("axe-core/package.json").version,
    checkpoints: axe.passes.length,
    violations: axe.violations.map(({ id, impact }) => ({ id, impact })),
    timings: {
      controlMs: Math.round(controlDurationMs),
      axeMs: Math.round(axeDurationMs),
      totalMs: Math.round(performance.now() - startedAt)
    }
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "passed" ? 0 : 1;
} finally {
  await browser.close();
}
