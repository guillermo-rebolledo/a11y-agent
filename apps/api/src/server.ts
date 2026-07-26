import Fastify from "fastify";

import { buildApp } from "./application.js";
import { NeonProjectStore } from "./project-store.js";

const databaseUrl = process.env.DATABASE_URL;
const vercelEnvironment = process.env.VERCEL_ENV;
if (
  (vercelEnvironment === "production" || vercelEnvironment === "preview") &&
  !databaseUrl
) {
  throw new Error("DATABASE_URL is required for deployed control planes");
}
const store = databaseUrl ? new NeonProjectStore(databaseUrl) : undefined;
const fixtureEnvironments = new Set(["development", "test", "preview"]);
const fixtureSession =
  fixtureEnvironments.has(process.env.APP_ENV ?? "") &&
  process.env.FIXTURE_GITHUB_SESSION_TOKEN
    ? {
        token: process.env.FIXTURE_GITHUB_SESSION_TOKEN,
        repositories: [
          {
            installationId: Number(process.env.FIXTURE_GITHUB_INSTALLATION_ID),
            repositoryId: Number(process.env.FIXTURE_GITHUB_REPOSITORY_ID),
            repository:
              process.env.FIXTURE_GITHUB_REPOSITORY ?? "memoji-inc/example",
          },
        ],
      }
    : undefined;
const app = buildApp(
  {
    ...(store ? { store } : {}),
    ...(fixtureSession ? { fixtureSession } : {}),
  },
  Fastify({ logger: true }),
);

const port = Number(process.env.PORT ?? 3000);
void app.listen({ port, host: "0.0.0.0" });
