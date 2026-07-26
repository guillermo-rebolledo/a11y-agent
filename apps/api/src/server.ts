import Fastify from "fastify";

import { buildApp } from "./application.js";
import { NeonProjectStore } from "./project-store.js";

// Vercel's Fastify detector requires the recognized entrypoint to import
// Fastify directly, while buildApp keeps route construction testable.
void Fastify;

const databaseUrl = process.env.DATABASE_URL;
const store = databaseUrl ? new NeonProjectStore(databaseUrl) : undefined;
const fixtureSession =
  process.env.APP_ENV !== "production" &&
  process.env.FIXTURE_GITHUB_SESSION_TOKEN
    ? {
        token: process.env.FIXTURE_GITHUB_SESSION_TOKEN,
        actor: "fixture-admin",
        installationIds: [Number(process.env.FIXTURE_GITHUB_INSTALLATION_ID)],
      }
    : undefined;
const app = buildApp({
  ...(store ? { store } : {}),
  ...(fixtureSession ? { fixtureSession } : {}),
});

const port = Number(process.env.PORT ?? 3000);
void app.listen({ port, host: "0.0.0.0" });
