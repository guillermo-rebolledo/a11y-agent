import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: [
    {
      command: "pnpm --filter @a11y-agent/api start",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: !process.env.CI,
      env: {
        APP_ENV: "test",
        PORT: "3101",
        FIXTURE_GITHUB_SESSION_TOKEN: "fixture-session",
        FIXTURE_GITHUB_INSTALLATION_ID: "24680",
        FIXTURE_GITHUB_REPOSITORY_ID: "13579",
        FIXTURE_GITHUB_REPOSITORY: "memoji-inc/example",
      },
    },
    {
      command: "pnpm dev --hostname 127.0.0.1 --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      env: {
        APP_ENV: "test",
        GITHUB_FIXTURE_AUTH_ENABLED: "true",
        CONTROL_PLANE_URL: "http://127.0.0.1:3101",
      },
    },
  ],
});
