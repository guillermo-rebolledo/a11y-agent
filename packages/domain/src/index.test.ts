import { describe, expect, it } from "vitest";

import {
  createProject,
  GITHUB_APP_PERMISSIONS,
  runtimeGate,
  type ProjectInput,
} from "./index.js";

const input: ProjectInput = {
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
};

describe("Project onboarding contract", () => {
  it("creates a disabled scaffold Project from an approved GitHub installation", () => {
    expect(createProject(input)).toMatchObject({
      repository: "memoji-inc/example",
      installationId: 24680,
      executionState: "disabled-pending-authenticated-enablement",
      pilotState: "not-provisioned",
    });
  });

  it("rejects deployment origins that are not bounded HTTPS patterns", () => {
    expect(() =>
      createProject({
        ...input,
        previewDeployment: {
          ...input.previewDeployment,
          originPattern: "http://*",
        },
      }),
    ).toThrow("approved HTTPS origin");
  });

  it("keeps authenticated execution and pilot provisioning disabled", () => {
    expect(runtimeGate()).toEqual({
      authenticatedExecution: false,
      pilotProvisioning: false,
      reason: "ADR-0005 authenticated-enablement gate has not passed",
    });
  });

  it("does not request repository source-content access", () => {
    expect(GITHUB_APP_PERMISSIONS).toEqual({
      repository: {
        metadata: "read",
        pullRequests: "read",
        deployments: "read",
        checks: "write",
        actions: "write",
        contents: "none",
      },
      organization: { members: "none" },
    });
  });
});
