import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseEvidenceBundle,
  type EvidenceBundle,
} from "./evidence-bundle.js";

export type GitHubOidcClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  repository: string;
  repository_id: string;
  repository_owner: string;
  repository_owner_id: string;
  workflow_ref: string;
  workflow_sha: string;
  job_workflow_ref: string;
  job_workflow_sha: string;
  ref: string;
  sha: string;
  environment: string;
  run_id: string;
  run_attempt: string;
  actor_id: string;
};

export type PublicationPolicy = {
  issuer: string;
  audience: string;
  subject: string;
  repository: string;
  repositoryId: string;
  repositoryOwner: string;
  repositoryOwnerId: string;
  callerWorkflowRef: string;
  trustedWorkflowRef: string;
  trustedWorkflowSha: string;
  ref: string;
  environment: string;
  commit: string;
  maxTokenAgeSeconds: number;
  revoked: boolean;
};

export type PublicationReceipt = {
  auditRunId: string;
  repository: string;
  commit: string;
  outcome: "accepted";
  contentSha256: string;
  acceptedAt: string;
};

export interface PublicationReplayStore {
  reserve(keys: readonly string[]): Promise<boolean>;
}

export class InMemoryPublicationReplayStore
  implements PublicationReplayStore
{
  readonly #keys = new Set<string>();

  async reserve(keys: readonly string[]): Promise<boolean> {
    if (keys.some((key) => this.#keys.has(key))) return false;
    keys.forEach((key) => this.#keys.add(key));
    return true;
  }
}

export class FilePublicationReplayStore implements PublicationReplayStore {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  async reserve(keys: readonly string[]): Promise<boolean> {
    await mkdir(this.#directory, { recursive: true });
    const created: string[] = [];

    try {
      for (const key of keys) {
        const filename = createHash("sha256").update(key).digest("hex");
        const path = join(this.#directory, filename);
        await writeFile(path, "", { flag: "wx", mode: 0o600 });
        created.push(path);
      }
      return true;
    } catch (error) {
      await Promise.all(
        created.map(async (path) => {
          await unlink(path).catch(() => undefined);
        }),
      );
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        return false;
      }
      throw error;
    }
  }
}

function includesAudience(audience: string | string[], expected: string): boolean {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected;
}

function rejectIdentity(field: string): never {
  throw new Error(`OIDC identity does not match publication policy: ${field}`);
}

export async function acceptPublication(input: {
  bundle: unknown;
  claims: GitHubOidcClaims;
  policy: PublicationPolicy;
  replayStore: PublicationReplayStore;
  now?: Date;
}): Promise<PublicationReceipt> {
  const now = input.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const { claims, policy } = input;

  if (policy.revoked) throw new Error("OIDC publication trust is revoked");
  if (claims.iss !== policy.issuer) rejectIdentity("issuer");
  if (!includesAudience(claims.aud, policy.audience)) rejectIdentity("audience");
  if (claims.sub !== policy.subject) rejectIdentity("subject");
  if (claims.repository !== policy.repository) rejectIdentity("repository");
  if (claims.repository_id !== policy.repositoryId) {
    rejectIdentity("repository_id");
  }
  if (claims.repository_owner_id !== policy.repositoryOwnerId) {
    rejectIdentity("repository_owner_id");
  }
  if (claims.repository_owner !== policy.repositoryOwner) {
    rejectIdentity("repository_owner");
  }
  if (claims.workflow_ref !== policy.callerWorkflowRef) {
    rejectIdentity("workflow_ref");
  }
  if (claims.job_workflow_ref !== policy.trustedWorkflowRef) {
    rejectIdentity("job_workflow_ref");
  }
  if (claims.job_workflow_sha !== policy.trustedWorkflowSha) {
    rejectIdentity("job_workflow_sha");
  }
  if (claims.ref !== policy.ref) rejectIdentity("ref");
  if (claims.environment !== policy.environment) rejectIdentity("environment");
  if (claims.sha !== policy.commit || claims.workflow_sha !== policy.commit) {
    rejectIdentity("commit");
  }
  if (claims.nbf > nowSeconds) throw new Error("OIDC identity is not active yet");
  if (claims.exp <= nowSeconds) throw new Error("OIDC identity is expired");
  if (
    claims.iat > nowSeconds ||
    nowSeconds - claims.iat > policy.maxTokenAgeSeconds
  ) {
    throw new Error("OIDC identity is outside the freshness window");
  }

  const bundle = parseEvidenceBundle(input.bundle);
  if (Date.parse(bundle.expiresAt) <= now.getTime()) {
    throw new Error("Evidence Bundle is expired");
  }
  if (bundle.provenance.repository !== claims.repository) {
    rejectIdentity("bundle repository");
  }
  if (bundle.provenance.commit !== claims.sha) {
    rejectIdentity("bundle commit");
  }
  if (bundle.provenance.workflow !== claims.job_workflow_ref) {
    rejectIdentity("bundle workflow");
  }
  if (
    bundle.provenance.runId !== claims.run_id ||
    String(bundle.provenance.runAttempt) !== claims.run_attempt
  ) {
    rejectIdentity("bundle run");
  }

  const canonicalBundle = JSON.stringify(bundle);
  const contentSha256 = createHash("sha256")
    .update(canonicalBundle)
    .digest("hex");
  const accepted = await input.replayStore.reserve([
    `oidc:${claims.jti}`,
    `publication:${claims.repository_id}:${claims.run_id}:${claims.run_attempt}:${bundle.auditRunId}:${bundle.publicationNonce}`,
    `journey-publication:${claims.repository_id}:${bundle.auditRunId}:${bundle.journeyId}`,
    `artifact:${contentSha256}`,
  ]);
  if (!accepted) throw new Error("replayed or duplicate publication");

  return {
    auditRunId: bundle.auditRunId,
    repository: claims.repository,
    commit: claims.sha,
    outcome: "accepted",
    contentSha256,
    acceptedAt: now.toISOString(),
  };
}
