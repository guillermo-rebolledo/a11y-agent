import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { chromium } from "playwright";

import {
  parseEvidenceBundle,
  parseEvidenceBundleText,
  type EvidenceBundle,
} from "./evidence-bundle.js";
import {
  InMemoryPublicationReplayStore,
  acceptPublication,
  type GitHubOidcClaims,
  type PublicationPolicy,
} from "./publication.js";

const PLAYWRIGHT_IMAGE =
  "mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48";
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveIntegerEnvironment(name: string): number {
  const value = Number(requiredEnvironment(name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function runBrowser(): Promise<void> {
  const outputPath = requiredEnvironment("A11Y_OUTPUT_PATH");
  const scenario = process.env.A11Y_PROOF_SCENARIO ?? "success";
  if (scenario === "runner-failure") {
    throw new Error("Deliberate MEM-22 runner failure");
  }

  const startedAt = new Date();
  const startupStarted = performance.now();
  const browser = await chromium.launch({ headless: true });
  const startupMs = Math.round(performance.now() - startupStarted);

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("https://synthetic.invalid/**", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html>
      <html lang="en">
        <head><title>Synthetic authenticated Journey</title></head>
        <body>
          <main>
            <h1>Private team</h1>
            <form id="login" onsubmit="return false">
              <label>Email <input name="login-email" type="email"></label>
              <label>Password <input name="login-password" type="password"></label>
              <button id="sign-in" type="button">Sign in</button>
            </form>
            <section id="private" hidden>
              <h2>Invite a teammate</h2>
              <label>Invite email <input name="invite-email" type="email"></label>
              <button id="invite" type="button">Send invitation</button>
              <p role="status" aria-live="polite"></p>
            </section>
          </main>
          <script>
            document.querySelector("#sign-in").addEventListener("click", () => {
              document.cookie = "synthetic-session=browser-job-only; SameSite=Strict";
              document.querySelector("#login").hidden = true;
              document.querySelector("#private").hidden = false;
            });
            document.querySelector("#invite").addEventListener("click", () => {
              document.querySelector("[role=status]").textContent = "Invitation sent";
            });
          </script>
        </body>
      </html>`,
      });
    });
    await page.goto("https://synthetic.invalid/private");

    const loginEmail = requiredEnvironment("SYNTHETIC_LOGIN_EMAIL");
    const loginPassword = requiredEnvironment("SYNTHETIC_LOGIN_PASSWORD");
    await page.getByLabel("Email", { exact: true }).fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    const findings: EvidenceBundle["findings"] = [];
    const firstCheckpoint = await new AxeBuilder({ page }).analyze();
    findings.push(
      ...firstCheckpoint.violations.map(({ id, impact }) => ({
        ruleId: id,
        impact: impact ?? null,
        checkpoint: 1,
      })),
    );

    await page
      .getByLabel("Invite email")
      .fill(`journey-${requiredEnvironment("A11Y_JOURNEY_INDEX")}@example.invalid`);
    await page.getByRole("button", { name: "Send invitation" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("status").getByText("Invitation sent").waitFor();

    const secondCheckpoint = await new AxeBuilder({ page }).analyze();
    findings.push(
      ...secondCheckpoint.violations.map(({ id, impact }) => ({
        ruleId: id,
        impact: impact ?? null,
        checkpoint: 2,
      })),
    );

    const finishedAt = new Date();
    const status = scenario === "timeout" ? "timed-out" : "passed";
    const bundle: EvidenceBundle = {
      schemaVersion: 1,
      auditRunId: requiredEnvironment("A11Y_AUDIT_RUN_ID"),
      journeyId: requiredEnvironment("A11Y_JOURNEY_ID"),
      status,
      terminalReason: scenario === "timeout" ? "timeout" : "completed",
      createdAt: finishedAt.toISOString(),
      expiresAt: new Date(finishedAt.getTime() + 15 * 60 * 1_000).toISOString(),
      publicationNonce: `pub-${randomUUID()}`,
      provenance: {
        auditEngine: "0.0.0+mem22",
        playwright: "1.61.1",
        chromium: browser.version(),
        axe: "4.12.1",
        image: PLAYWRIGHT_IMAGE,
        action: requiredEnvironment("A11Y_ACTION_REF"),
        workflow: requiredEnvironment("A11Y_WORKFLOW_REF"),
        repository: requiredEnvironment("GITHUB_REPOSITORY"),
        commit: requiredEnvironment("A11Y_COMMIT_SHA"),
        runId: requiredEnvironment("GITHUB_RUN_ID"),
        runAttempt: positiveIntegerEnvironment("GITHUB_RUN_ATTEMPT"),
        runnerEnvironment: "github-hosted",
        runnerArchitecture:
          requiredEnvironment("RUNNER_ARCH") === "ARM64" ? "ARM64" : "X64",
      },
      assertions: [
        { id: "synthetic-authentication-established", status: "passed" },
        { id: "invitation-status-visible", status: "passed" },
        { id: "session-material-absent", status: "passed" },
      ],
      findings,
      measurements: {
        startupMs,
        runtimeMs: finishedAt.getTime() - startedAt.getTime(),
        actionMinutes:
          Math.round(
            ((finishedAt.getTime() - startedAt.getTime()) / 60_000) * 10_000,
          ) / 10_000,
      },
    };

    const output: unknown =
      scenario === "malformed-artifact"
        ? { ...bundle, unsupportedField: "bounded-malformed-proof" }
        : bundle;
    const serialized = `${JSON.stringify(output, null, 2)}\n`;
    for (const canary of [loginEmail, loginPassword, "browser-job-only"]) {
      if (serialized.includes(canary)) {
        throw new Error("Sensitive browser material reached the Evidence Bundle");
      }
    }
    if (scenario !== "malformed-artifact") parseEvidenceBundle(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, { mode: 0o600 });
  } finally {
    await browser.close();
  }
}

async function requestOidcToken(audience: string): Promise<string> {
  const requestUrl = new URL(requiredEnvironment("ACTIONS_ID_TOKEN_REQUEST_URL"));
  requestUrl.searchParams.set("audience", audience);
  const response = await fetch(requestUrl, {
    headers: {
      authorization: `Bearer ${requiredEnvironment("ACTIONS_ID_TOKEN_REQUEST_TOKEN")}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub OIDC request failed with HTTP ${response.status}`);
  }
  const body = (await response.json()) as { value?: unknown };
  if (typeof body.value !== "string") {
    throw new Error("GitHub OIDC response did not contain a token");
  }
  return body.value;
}

function claimsFromPayload(payload: JWTPayload): GitHubOidcClaims {
  return payload as unknown as GitHubOidcClaims;
}

function publicationPolicyFromEnvironment(): PublicationPolicy {
  return {
    issuer: OIDC_ISSUER,
    audience: requiredEnvironment("A11Y_OIDC_AUDIENCE"),
    repository: requiredEnvironment("A11Y_EXPECTED_REPOSITORY"),
    repositoryId: requiredEnvironment("A11Y_EXPECTED_REPOSITORY_ID"),
    repositoryOwnerId: requiredEnvironment("A11Y_EXPECTED_OWNER_ID"),
    callerWorkflowRef: requiredEnvironment(
      "A11Y_EXPECTED_CALLER_WORKFLOW_REF",
    ),
    trustedWorkflowRef: requiredEnvironment("A11Y_EXPECTED_WORKFLOW_REF"),
    trustedWorkflowSha: requiredEnvironment("A11Y_EXPECTED_WORKFLOW_SHA"),
    ref: requiredEnvironment("A11Y_EXPECTED_REF"),
    environment: requiredEnvironment("A11Y_EXPECTED_ENVIRONMENT"),
    commit: requiredEnvironment("A11Y_EXPECTED_COMMIT"),
    maxTokenAgeSeconds: 300,
    revoked: process.env.A11Y_PROOF_SCENARIO === "oidc-revoked",
  };
}

async function findBundlePaths(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await findBundlePaths(path)));
    if (entry.isFile() && entry.name === "bundle.json") paths.push(path);
  }
  return paths.sort();
}

async function runPublisher(): Promise<void> {
  const audience = requiredEnvironment("A11Y_OIDC_AUDIENCE");
  const scenario = process.env.A11Y_PROOF_SCENARIO ?? "success";
  const receipts = [];
  const bundlePaths = await findBundlePaths(
    requiredEnvironment("A11Y_OUTPUT_PATH"),
  );
  if (bundlePaths.length === 0) throw new Error("No Evidence Bundles found");

  for (const path of bundlePaths) {
    const source = await readFile(path, "utf8");
    parseEvidenceBundleText(source);
    const token = await requestOidcToken(audience);
    const response = await fetch(requiredEnvironment("A11Y_PUBLICATION_ENDPOINT"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: source,
    });
    if (!response.ok) {
      throw new Error(
        `Control plane rejected publication with HTTP ${response.status}: ${await response.text()}`,
      );
    }
    receipts.push((await response.json()) as unknown);
  }

  if (scenario === "publisher-failure") {
    throw new Error("Deliberate MEM-22 publisher failure");
  }
  const receiptsPath = requiredEnvironment("A11Y_RECEIPTS_PATH");
  await mkdir(dirname(receiptsPath), { recursive: true });
  await writeFile(receiptsPath, `${JSON.stringify(receipts, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function readBoundedRequest(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1_024) throw new Error("Evidence Bundle exceeds 64 KiB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function runControlPlane(): Promise<void> {
  const policy = publicationPolicyFromEnvironment();
  const replayStore = new InMemoryPublicationReplayStore();
  const jwks = createRemoteJWKSet(
    new URL(`${OIDC_ISSUER}/.well-known/jwks`),
  );
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { status: "ready" });
        return;
      }
      if (request.method !== "POST" || request.url !== "/publications") {
        sendJson(response, 404, { error: "not found" });
        return;
      }

      const authorization = request.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) {
        sendJson(response, 401, { error: "missing OIDC bearer token" });
        return;
      }
      const { payload } = await jwtVerify(authorization.slice(7), jwks, {
        issuer: OIDC_ISSUER,
        audience: policy.audience,
      });
      const receipt = await acceptPublication({
        bundle: parseEvidenceBundleText(await readBoundedRequest(request)),
        claims: claimsFromPayload(payload),
        policy,
        replayStore,
      });
      sendJson(response, 201, receipt);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "publication failed";
      sendJson(response, 403, { error: message });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(8_787, "127.0.0.1", resolve);
  });
}

const mode = requiredEnvironment("A11Y_ACTION_MODE");
if (mode === "browser") {
  await runBrowser();
} else if (mode === "control-plane") {
  await runControlPlane();
} else if (mode === "publisher") {
  await runPublisher();
} else {
  throw new Error(`Unsupported Action mode: ${mode}`);
}
