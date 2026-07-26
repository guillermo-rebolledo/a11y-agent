import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./application.js";

const project = {
  installationId: 24680,
  repositoryId: 13579,
  repository: "memoji-inc/example",
  mainDeployment: {
    source: "vercel",
    environment: "main",
    originPattern: "https://example.test",
  },
  previewDeployment: {
    source: "vercel",
    environment: "preview",
    originPattern: "https://example-git-*.vercel.app",
  },
  trustedWorkflow: {
    repository: "memoji-inc/example",
    workflow: ".github/workflows/a11y-audit.yml",
    ref: "refs/heads/main",
    environment: "a11y-publication",
    audience: "https://api.example.test/publications",
    commit: "a".repeat(40),
  },
  approvedRunnerClass: "github-hosted-ephemeral",
} as const;

const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("control-plane onboarding API", () => {
  it("reports source contents and production execution as unavailable", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/capabilities" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      environmentClass: "construction-nonproduction",
      repositoryContents: "inaccessible",
      authenticatedExecution: false,
      pilotProvisioning: false,
    });
  });

  it("scopes created Projects to the authenticated test installation", async () => {
    const app = buildApp({
      fixtureSession: {
        token: "fixture-session",
        repositories: [
          {
            installationId: 24680,
            repositoryId: 13579,
            repository: "memoji-inc/example",
          },
        ],
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: "Bearer fixture-session" },
      payload: project,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: "project-13579",
      repository: "memoji-inc/example",
      executionState: "disabled-pending-authenticated-enablement",
    });

    const persisted = await app.inject({
      method: "GET",
      url: "/projects/project-13579",
      headers: { authorization: "Bearer fixture-session" },
    });
    expect(persisted.json()).toMatchObject({
      repository: "memoji-inc/example",
      mainDeployment: { originPattern: "https://example.test" },
    });
  });

  it("rejects a repository outside the GitHub App installation", async () => {
    const app = buildApp({
      fixtureSession: {
        token: "fixture-session",
        repositories: [
          {
            installationId: 99999,
            repositoryId: 11111,
            repository: "other/example",
          },
        ],
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { authorization: "Bearer fixture-session" },
      payload: project,
    });

    expect(response.statusCode).toBe(403);
  });
});
