import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FilePublicationReplayStore,
  InMemoryPublicationReplayStore,
  acceptPublication,
  type GitHubOidcClaims,
  type PublicationPolicy,
} from "./publication.js";
import type { EvidenceBundle } from "./evidence-bundle.js";

const now = new Date("2026-07-26T04:05:00.000Z");
const commit = "abcdef0123456789abcdef0123456789abcdef01";
const trustedSha = "0123456789abcdef0123456789abcdef01234567";

const bundle: EvidenceBundle = {
  schemaVersion: 1,
  auditRunId: "audit-01JZ8F2V6YB5FQX0MB7K2CS4RA",
  journeyId: "journey-invite-member",
  status: "passed",
  terminalReason: "completed",
  createdAt: "2026-07-26T04:00:00.000Z",
  expiresAt: "2026-07-26T04:15:00.000Z",
  publicationNonce: "pub-01JZ8F3AJ2RG8NTG2RZ5QH1K5P",
  provenance: {
    auditEngine: "0.0.0+mem22",
    playwright: "1.61.1",
    chromium: "141.0.7390.37",
    axe: "4.12.1",
    image:
      "mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48",
    action: `guillermo-rebolledo/a11y-agent/packages/action@${trustedSha}`,
    workflow: `guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@${trustedSha}`,
    repository: "guillermo-rebolledo/a11y-demo",
    commit,
    runId: "123456789",
    runAttempt: 1,
    runnerEnvironment: "github-hosted",
    runnerArchitecture: "X64",
  },
  assertions: [{ id: "invitation-status-visible", status: "passed" }],
  findings: [],
  measurements: { startupMs: 500, runtimeMs: 1_500, actionMinutes: 0.04 },
};

const claims: GitHubOidcClaims = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "https://api.a11y-agent.example/publications",
  sub: "repo:guillermo-rebolledo/a11y-demo:environment:a11y-synthetic",
  iat: Math.floor(new Date("2026-07-26T04:04:30.000Z").getTime() / 1_000),
  nbf: Math.floor(new Date("2026-07-26T04:04:30.000Z").getTime() / 1_000),
  exp: Math.floor(new Date("2026-07-26T04:09:30.000Z").getTime() / 1_000),
  jti: "token-01JZ8F4KSCX4TKE37WKBNPN4PK",
  repository: "guillermo-rebolledo/a11y-demo",
  repository_id: "987654321",
  repository_owner: "guillermo-rebolledo",
  repository_owner_id: "1234567",
  workflow_ref:
    "guillermo-rebolledo/a11y-demo/.github/workflows/a11y-audit.yml@refs/heads/main",
  workflow_sha: commit,
  job_workflow_ref: `guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@${trustedSha}`,
  job_workflow_sha: trustedSha,
  ref: "refs/heads/main",
  sha: commit,
  environment: "a11y-synthetic",
  run_id: "123456789",
  run_attempt: "1",
  actor_id: "7654321",
};

const policy: PublicationPolicy = {
  issuer: "https://token.actions.githubusercontent.com",
  audience: "https://api.a11y-agent.example/publications",
  subject: "repo:guillermo-rebolledo/a11y-demo:environment:a11y-synthetic",
  repository: "guillermo-rebolledo/a11y-demo",
  repositoryId: "987654321",
  repositoryOwner: "guillermo-rebolledo",
  repositoryOwnerId: "1234567",
  callerWorkflowRef:
    "guillermo-rebolledo/a11y-demo/.github/workflows/a11y-audit.yml@refs/heads/main",
  trustedWorkflowRef: `guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@${trustedSha}`,
  trustedWorkflowSha: trustedSha,
  ref: "refs/heads/main",
  environment: "a11y-synthetic",
  commit,
  maxTokenAgeSeconds: 300,
  revoked: false,
};

describe("MEM-22 publication boundary", () => {
  it("accepts a matching fresh identity exactly once", async () => {
    const replayStore = new InMemoryPublicationReplayStore();

    const receipt = await acceptPublication({
      bundle,
      claims,
      policy,
      replayStore,
      now,
    });

    expect(receipt).toMatchObject({
      auditRunId: bundle.auditRunId,
      repository: policy.repository,
      commit,
      outcome: "accepted",
    });

    await expect(
      acceptPublication({ bundle, claims, policy, replayStore, now }),
    ).rejects.toThrow("replayed or duplicate publication");
  });

  it.each([
    ["repository", { repository: "attacker/example" }],
    ["workflow", { job_workflow_ref: "attacker/action/.github/workflows/x.yml@main" }],
    ["ref", { ref: "refs/heads/attacker" }],
    ["environment", { environment: "unprotected" }],
    ["audience", { aud: "https://attacker.example" }],
    ["commit", { sha: "f".repeat(40) }],
  ])("rejects the wrong %s identity", async (_name, claimPatch) => {
    await expect(
      acceptPublication({
        bundle,
        claims: { ...claims, ...claimPatch },
        policy,
        replayStore: new InMemoryPublicationReplayStore(),
        now,
      }),
    ).rejects.toThrow("OIDC identity");
  });

  it("rejects expired and revoked identities", async () => {
    await expect(
      acceptPublication({
        bundle,
        claims: { ...claims, exp: Math.floor(now.getTime() / 1_000) - 1 },
        policy,
        replayStore: new InMemoryPublicationReplayStore(),
        now,
      }),
    ).rejects.toThrow("expired");

    await expect(
      acceptPublication({
        bundle,
        claims,
        policy: { ...policy, revoked: true },
        replayStore: new InMemoryPublicationReplayStore(),
        now,
      }),
    ).rejects.toThrow("revoked");
  });

  it("rejects a replay after the verifier store is recreated", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mem22-replay-"));
    const path = join(directory, "publication-keys.json");

    await acceptPublication({
      bundle,
      claims,
      policy,
      replayStore: new FilePublicationReplayStore(path),
      now,
    });

    await expect(
      acceptPublication({
        bundle,
        claims,
        policy,
        replayStore: new FilePublicationReplayStore(path),
        now,
      }),
    ).rejects.toThrow("replayed or duplicate publication");
  });
});
