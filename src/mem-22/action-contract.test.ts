import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type Workflow = {
  on: {
    workflow_call: {
      inputs: Record<string, unknown>;
      secrets: Record<string, unknown>;
    };
    workflow_dispatch: unknown;
  };
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      if?: string;
      needs?: string | string[];
      permissions?: Record<string, string>;
      environment?: string;
      container?: { image?: string; options?: string };
      strategy?: { matrix?: Record<string, unknown> };
      steps?: Array<{
        uses?: string;
        with?: Record<string, unknown>;
        env?: Record<string, unknown>;
      }>;
    }
  >;
};

const SHA_REF = /@[0-9a-f]{40}$/;
const DIGEST_REF = /@sha256:[0-9a-f]{64}$/;

async function loadWorkflow(): Promise<Workflow> {
  const source = await readFile(
    new URL("../../.github/workflows/customer-audit.yml", import.meta.url),
    "utf8",
  );
  return parse(source) as Workflow;
}

describe("MEM-22 trusted GitHub Actions contract", () => {
  it("pins every external Action and the Playwright image immutably", async () => {
    const workflow = await loadWorkflow();
    const uses = Object.values(workflow.jobs).flatMap(
      (job) => job.steps?.flatMap((step) => step.uses ?? []) ?? [],
    );

    expect(uses.length).toBeGreaterThan(0);
    expect(uses).not.toContainEqual(expect.stringContaining("@main"));
    for (const reference of uses) {
      expect(reference).toMatch(SHA_REF);
    }
    expect(workflow.jobs.browser?.container?.image).toMatch(DIGEST_REF);
  });

  it("keeps browser and publisher permissions, secrets, and code separate", async () => {
    const workflow = await loadWorkflow();
    const browser = workflow.jobs.browser;
    const publisher = workflow.jobs.publisher;

    expect(workflow.permissions).toEqual({});
    expect(browser).toMatchObject({
      permissions: {},
      environment: "a11y-synthetic",
    });
    expect(browser?.container?.options).toContain("--user 1001:1001");
    expect(JSON.stringify(browser?.permissions)).not.toContain("id-token");

    expect(publisher).toMatchObject({
      permissions: { "id-token": "write" },
      environment: "a11y-publication",
    });
    expect(publisher?.needs).toEqual(["gate", "browser"]);
    expect(publisher?.container).toBeUndefined();
    expect(JSON.stringify(publisher)).not.toMatch(
      /SYNTHETIC_LOGIN|playwright|chromium/i,
    );
  });

  it("does not expose credentials or arbitrary URLs as workflow inputs", async () => {
    const workflow = await loadWorkflow();
    const inputNames = Object.keys(workflow.on.workflow_call.inputs);
    const serializedInputs = JSON.stringify(workflow.on.workflow_call.inputs);

    expect(inputNames).toEqual(
      expect.arrayContaining([
        "audit-run-id",
        "journey-id",
        "commit-sha",
        "scenario",
      ]),
    );
    expect(serializedInputs).not.toMatch(
      /password|credential|cookie|storage|target-url|deployment-url/i,
    );
    expect(Object.keys(workflow.on.workflow_call.secrets)).toEqual([
      "synthetic-login-email",
      "synthetic-login-password",
    ]);
  });

  it("denies fork automation and requires the protected browser environment", async () => {
    const workflow = await loadWorkflow();
    const gate = workflow.jobs.gate;

    expect(gate?.if).toContain("head.repo.fork == false");
    expect(workflow.jobs.browser?.needs).toBe("gate");
    expect(workflow.jobs.browser?.environment).toBe("a11y-synthetic");
  });

  it("runs five isolated browser jobs for the representative success proof", async () => {
    const workflow = await loadWorkflow();
    const browser = workflow.jobs.browser;

    expect(browser?.strategy?.matrix).toBeDefined();
    expect(JSON.stringify(workflow.jobs.gate)).toContain("journey-index");
    expect(workflow.jobs.publisher?.needs).toContain("browser");
  });

  it("uses GitHub's hard job timeout for the timeout proof", async () => {
    const workflow = await loadWorkflow();

    expect(JSON.stringify(workflow.jobs.browser)).toContain(
      "inputs.scenario == 'timeout'",
    );
    expect(JSON.stringify(workflow.jobs.browser)).toContain("timeout-minutes");
  });

  it("removes browser credentials before installing Action dependencies", async () => {
    const source = await readFile(
      new URL("../../packages/action/action.yml", import.meta.url),
      "utf8",
    );
    const unsetAt = source.indexOf(
      "unset SYNTHETIC_LOGIN_EMAIL SYNTHETIC_LOGIN_PASSWORD",
    );
    const installAt = source.indexOf("install --frozen-lockfile");

    expect(unsetAt).toBeGreaterThan(-1);
    expect(unsetAt).toBeLessThan(installAt);
  });
});
