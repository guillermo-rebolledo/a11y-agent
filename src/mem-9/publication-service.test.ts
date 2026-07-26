import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { EvidenceBundle } from "../mem-22/evidence-bundle.js";
import {
  InMemoryPublicationReplayStore,
  type GitHubOidcClaims,
  type PublicationPolicy,
} from "../mem-22/publication.js";
import {
  EvidenceSuppressedError,
  InMemoryEvidenceAuditLog,
  InMemoryEvidenceCatalog,
  InMemoryPrivateEvidenceStore,
  publishEvidence,
} from "./publication-service.js";
import { R2PrivateEvidenceStore } from "./r2-private-evidence-store.js";

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
    auditEngine: "0.0.0+mem9",
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

const evidencePolicy = {
  auditRunId: bundle.auditRunId,
  journeyId: bundle.journeyId,
  provenance: bundle.provenance,
  assertionIds: ["invitation-status-visible"],
  findingRuleIds: [],
} as const;

function createDependencies() {
  return {
    replayStore: new InMemoryPublicationReplayStore(),
    objectStore: new InMemoryPrivateEvidenceStore(),
    catalog: new InMemoryEvidenceCatalog(),
    auditLog: new InMemoryEvidenceAuditLog(),
  };
}

describe("MEM-9 trusted evidence publication", () => {
  it("stores exactly one validated bundle under an opaque private key", async () => {
    const dependencies = createDependencies();

    const result = await publishEvidence({
      source: JSON.stringify(bundle),
      claims,
      policy,
      evidencePolicy,
      tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
      projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
      sensitiveValues: [],
      now,
      ...dependencies,
    });

    expect(result).toMatchObject({
      auditRunId: bundle.auditRunId,
      contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(result.objectKey).toMatch(/^evidence\/[0-9a-f]{64}\.json$/);
    expect(dependencies.objectStore.objects).toHaveLength(1);
    expect(dependencies.objectStore.objects[0]).toMatchObject({
      key: result.objectKey,
      contentType: "application/json",
      cacheControl: "private, no-store",
    });
    expect(
      createHash("sha256")
        .update(dependencies.objectStore.objects[0]?.body ?? "")
        .digest("hex"),
    ).toBe(result.contentSha256);
    expect(dependencies.catalog.records).toHaveLength(1);
    expect(dependencies.catalog.records[0]?.deleteAt).toBe(
      "2026-08-25T04:05:00.000Z",
    );
    expect(dependencies.auditLog.events).toEqual([
      expect.objectContaining({
        type: "evidence.publication.accepted",
        auditRunId: bundle.auditRunId,
      }),
    ]);
  });

  it("composes trusted publication directly with the Cloudflare R2 adapter", async () => {
    const bucket = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const dependencies = createDependencies();
    const objectStore = new R2PrivateEvidenceStore(bucket, vi.fn());

    await publishEvidence({
      source: JSON.stringify(bundle),
      claims,
      policy,
      evidencePolicy,
      tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
      projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
      sensitiveValues: [],
      now,
      ...dependencies,
      objectStore,
    });

    expect(bucket.put).toHaveBeenCalledOnce();
    expect(bucket.put).toHaveBeenCalledWith(
      expect.stringMatching(/^evidence\/[0-9a-f]{64}\.json$/),
      JSON.stringify(bundle),
      expect.objectContaining({
        httpMetadata: {
          contentType: "application/json",
          cacheControl: "private, no-store",
        },
      }),
    );
  });

  it.each([
    ["email", "mem9-email-canary@example.invalid"],
    ["phone", "+1 (415) 555-0199"],
    ["token", "ghp_012345678901234567890123456789012345"],
    ["cookie", "mem9-cookie-canary"],
    ["secret", "mem9-secret-canary"],
  ])("suppresses the bundle when the %s canary survives", async (_kind, canary) => {
    const dependencies = createDependencies();
    const source = JSON.stringify(bundle).replace(
      bundle.journeyId,
      canary,
    );

    await expect(
      publishEvidence({
        source,
        claims,
        policy,
        evidencePolicy,
        tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
        projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
        sensitiveValues: ["mem9-cookie-canary", "mem9-secret-canary"],
        now,
        ...dependencies,
      }),
    ).rejects.toBeInstanceOf(EvidenceSuppressedError);

    expect(dependencies.objectStore.objects).toEqual([]);
    expect(dependencies.catalog.records).toEqual([]);
    expect(dependencies.auditLog.events).toEqual([
      expect.objectContaining({
        type: "evidence.publication.suppressed",
        reason: "sensitive-content",
      }),
    ]);
    expect(JSON.stringify(dependencies.auditLog.events)).not.toContain(canary);
  });

  it("detects a canary even when the untrusted JSON uses Unicode escaping", async () => {
    const dependencies = createDependencies();
    const source = JSON.stringify(bundle).replace(
      bundle.journeyId,
      "mem9-email-canary\\u0040example.invalid",
    );

    await expect(
      publishEvidence({
        source,
        claims,
        policy,
        evidencePolicy,
        tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
        projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
        sensitiveValues: [],
        now,
        ...dependencies,
      }),
    ).rejects.toBeInstanceOf(EvidenceSuppressedError);
    expect(dependencies.objectStore.objects).toEqual([]);
  });

  it("rejects page content smuggled through a structurally permitted field", async () => {
    const dependencies = createDependencies();

    await expect(
      publishEvidence({
        source: JSON.stringify({
          ...bundle,
          provenance: {
            ...bundle.provenance,
            auditEngine: "Private account balance 1234",
          },
        }),
        claims,
        policy,
        evidencePolicy,
        tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
        projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
        sensitiveValues: [],
        now,
        ...dependencies,
      }),
    ).rejects.toThrow("server-owned evidence policy");

    expect(dependencies.objectStore.objects).toEqual([]);
    expect(dependencies.auditLog.events).toEqual([
      expect.objectContaining({
        type: "evidence.publication.rejected",
        reason: "content-policy",
      }),
    ]);
  });

  it("rejects malformed, oversized, unsupported, duplicate, and replayed input before another write", async () => {
    const invalidSources = [
      "{not-json",
      JSON.stringify({ ...bundle, schemaVersion: 2 }),
      `{"padding":"${"x".repeat(65_536)}"}`,
    ];

    for (const source of invalidSources) {
      const dependencies = createDependencies();
      await expect(
        publishEvidence({
          source,
          claims,
          policy,
          evidencePolicy,
          tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
          projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
          sensitiveValues: [],
          now,
          ...dependencies,
        }),
      ).rejects.toThrow();
      expect(dependencies.objectStore.objects).toEqual([]);
    }

    const dependencies = createDependencies();
    const input = {
      source: JSON.stringify(bundle),
      claims,
      policy,
      evidencePolicy,
      tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
      projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
      sensitiveValues: [],
      now,
      ...dependencies,
    };
    await publishEvidence(input);
    await expect(publishEvidence(input)).rejects.toThrow(
      "replayed or duplicate publication",
    );
    expect(dependencies.objectStore.objects).toHaveLength(1);
  });
});
