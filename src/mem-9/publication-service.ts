import { createHash } from "node:crypto";

import { parseEvidenceBundle } from "../mem-22/evidence-bundle.js";
import {
  acceptPublication,
  type GitHubOidcClaims,
  type PublicationPolicy,
  type PublicationReplayStore,
} from "../mem-22/publication.js";

const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/u;
const TOKEN = /\b(?:gh[opusr]_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._~-]{16,})\b/iu;

export class EvidenceSuppressedError extends Error {
  constructor() {
    super("Evidence Bundle suppressed because sensitive content was detected");
    this.name = "EvidenceSuppressedError";
  }
}

export type StoredPrivateEvidenceObject = {
  key: string;
  body: string;
  contentType: "application/json";
  cacheControl: "private, no-store";
  customMetadata: {
    auditRunId: string;
    projectId: string;
    contentSha256: string;
  };
};

export interface PrivateEvidenceStore {
  put(object: StoredPrivateEvidenceObject): Promise<void>;
  delete(key: string): Promise<void>;
  issueReadUrl(key: string, ttlSeconds: number): Promise<string>;
}

export class InMemoryPrivateEvidenceStore implements PrivateEvidenceStore {
  readonly objects: StoredPrivateEvidenceObject[] = [];

  async put(object: StoredPrivateEvidenceObject): Promise<void> {
    this.objects.push(structuredClone(object));
  }

  async delete(key: string): Promise<void> {
    const index = this.objects.findIndex((object) => object.key === key);
    if (index >= 0) this.objects.splice(index, 1);
  }

  async issueReadUrl(key: string, ttlSeconds: number): Promise<string> {
    if (!this.objects.some((object) => object.key === key)) {
      throw new Error("Evidence object not found");
    }
    return `https://private-r2.invalid/${encodeURIComponent(key)}?expires=${ttlSeconds}`;
  }
}

export type EvidenceRecord = {
  tenantId: string;
  projectId: string;
  auditRunId: string;
  objectKey: string;
  contentSha256: string;
  createdAt: string;
  deleteAt: string;
};

export interface EvidenceCatalog {
  insert(record: EvidenceRecord): Promise<void>;
  find(input: {
    tenantId: string;
    projectId: string;
    auditRunId: string;
  }): Promise<EvidenceRecord | undefined>;
  list(input: {
    tenantId?: string;
    projectId?: string;
    auditRunId?: string;
    deleteBefore?: string;
  }): Promise<EvidenceRecord[]>;
  remove(objectKey: string): Promise<void>;
}

export class InMemoryEvidenceCatalog implements EvidenceCatalog {
  readonly records: EvidenceRecord[] = [];

  async insert(record: EvidenceRecord): Promise<void> {
    this.records.push(structuredClone(record));
  }

  async find(input: {
    tenantId: string;
    projectId: string;
    auditRunId: string;
  }): Promise<EvidenceRecord | undefined> {
    return this.records.find(
      (record) =>
        record.tenantId === input.tenantId &&
        record.projectId === input.projectId &&
        record.auditRunId === input.auditRunId,
    );
  }

  async list(input: {
    tenantId?: string;
    projectId?: string;
    auditRunId?: string;
    deleteBefore?: string;
  }): Promise<EvidenceRecord[]> {
    return this.records
      .filter(
        (record) =>
          (input.tenantId === undefined ||
            record.tenantId === input.tenantId) &&
          (input.projectId === undefined ||
            record.projectId === input.projectId) &&
          (input.auditRunId === undefined ||
            record.auditRunId === input.auditRunId) &&
          (input.deleteBefore === undefined ||
            record.deleteAt <= input.deleteBefore),
      )
      .map((record) => structuredClone(record));
  }

  async remove(objectKey: string): Promise<void> {
    const index = this.records.findIndex(
      (record) => record.objectKey === objectKey,
    );
    if (index >= 0) this.records.splice(index, 1);
  }
}

export type EvidenceAuditEvent =
  | {
      type: "evidence.publication.accepted";
      tenantId: string;
      projectId: string;
      auditRunId: string;
      repository: string;
      commit: string;
      actorId: string;
      occurredAt: string;
    }
  | {
      type: "evidence.publication.suppressed";
      tenantId: string;
      projectId: string;
      auditRunId: string;
      reason: "sensitive-content";
      occurredAt: string;
    }
  | {
      type: "evidence.access.granted";
      tenantId: string;
      projectId: string;
      auditRunId: string;
      actorId: string;
      expiresAt: string;
      occurredAt: string;
    }
  | {
      type: "evidence.deleted";
      tenantId: string;
      projectId: string;
      auditRunId: string;
      reason: "run-request" | "project-deletion" | "retention-expired";
      occurredAt: string;
    }
  | {
      type: "evidence.retention.reconciled";
      examined: number;
      deleted: number;
      failed: number;
      occurredAt: string;
    };

export interface EvidenceAuditLog {
  append(event: EvidenceAuditEvent): Promise<void>;
}

export class InMemoryEvidenceAuditLog implements EvidenceAuditLog {
  readonly events: EvidenceAuditEvent[] = [];

  async append(event: EvidenceAuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

function containsSensitiveContent(
  source: string,
  sensitiveValues: readonly string[],
): boolean {
  return (
    EMAIL.test(source) ||
    PHONE.test(source) ||
    TOKEN.test(source) ||
    sensitiveValues.some(
      (value) => value.length > 0 && source.includes(value),
    )
  );
}

function readBoundedArtifact(source: string): {
  value: unknown;
  auditRunId: string;
  normalized: string;
} {
  if (Buffer.byteLength(source, "utf8") > 64 * 1_024) {
    throw new Error("Evidence Bundle exceeds 64 KiB");
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    throw new Error("Evidence Bundle must be valid JSON");
  }
  const auditRunId =
    typeof value === "object" &&
    value !== null &&
    "auditRunId" in value &&
    typeof value.auditRunId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/u.test(value.auditRunId)
      ? value.auditRunId
      : "audit-unknown";
  return { value, auditRunId, normalized: JSON.stringify(value) };
}

function privateObjectKey(input: {
  tenantId: string;
  projectId: string;
  auditRunId: string;
  contentSha256: string;
}): string {
  const opaqueId = createHash("sha256")
    .update(
      [
        input.tenantId,
        input.projectId,
        input.auditRunId,
        input.contentSha256,
      ].join("\0"),
    )
    .digest("hex");
  return `evidence/${opaqueId}.json`;
}

export async function publishEvidence(input: {
  source: string;
  claims: GitHubOidcClaims;
  policy: PublicationPolicy;
  replayStore: PublicationReplayStore;
  objectStore: PrivateEvidenceStore;
  catalog: EvidenceCatalog;
  auditLog: EvidenceAuditLog;
  tenantId: string;
  projectId: string;
  sensitiveValues: readonly string[];
  now?: Date;
}): Promise<{
  auditRunId: string;
  objectKey: string;
  contentSha256: string;
}> {
  const now = input.now ?? new Date();
  const artifact = readBoundedArtifact(input.source);

  if (containsSensitiveContent(artifact.normalized, input.sensitiveValues)) {
    await input.auditLog.append({
      type: "evidence.publication.suppressed",
      tenantId: input.tenantId,
      projectId: input.projectId,
      auditRunId: artifact.auditRunId,
      reason: "sensitive-content",
      occurredAt: now.toISOString(),
    });
    throw new EvidenceSuppressedError();
  }

  const bundle = parseEvidenceBundle(artifact.value);
  const receipt = await acceptPublication({
    bundle,
    claims: input.claims,
    policy: input.policy,
    replayStore: input.replayStore,
    now,
  });
  const objectKey = privateObjectKey({
    tenantId: input.tenantId,
    projectId: input.projectId,
    auditRunId: bundle.auditRunId,
    contentSha256: receipt.contentSha256,
  });
  const body = JSON.stringify(bundle);
  const record: EvidenceRecord = {
    tenantId: input.tenantId,
    projectId: input.projectId,
    auditRunId: bundle.auditRunId,
    objectKey,
    contentSha256: receipt.contentSha256,
    createdAt: now.toISOString(),
    deleteAt: new Date(now.getTime() + DEFAULT_RETENTION_MS).toISOString(),
  };

  await input.objectStore.put({
    key: objectKey,
    body,
    contentType: "application/json",
    cacheControl: "private, no-store",
    customMetadata: {
      auditRunId: bundle.auditRunId,
      projectId: input.projectId,
      contentSha256: receipt.contentSha256,
    },
  });
  try {
    await input.catalog.insert(record);
  } catch (error) {
    await input.objectStore.delete(objectKey).catch(() => undefined);
    throw error;
  }
  await input.auditLog.append({
    type: "evidence.publication.accepted",
    tenantId: input.tenantId,
    projectId: input.projectId,
    auditRunId: bundle.auditRunId,
    repository: receipt.repository,
    commit: receipt.commit,
    actorId: input.claims.actor_id,
    occurredAt: receipt.acceptedAt,
  });

  return {
    auditRunId: bundle.auditRunId,
    objectKey,
    contentSha256: receipt.contentSha256,
  };
}
