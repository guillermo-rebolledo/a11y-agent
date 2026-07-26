import type {
  EvidenceAuditLog,
  EvidenceCatalog,
  EvidenceRecord,
  PrivateEvidenceStore,
} from "./publication-service.js";

type LifecycleDependencies = {
  catalog: EvidenceCatalog;
  objectStore: PrivateEvidenceStore;
  auditLog: EvidenceAuditLog;
};

export const EVIDENCE_RETENTION_CRON = "0 * * * *";

async function deleteRecords(
  records: readonly EvidenceRecord[],
  input: LifecycleDependencies & {
    now: Date;
    reason?: "run-request" | "project-deletion";
  },
): Promise<number> {
  let deleted = 0;
  for (const record of records) {
    await input.objectStore.delete(record.objectKey);
    await input.catalog.remove(record.objectKey);
    deleted += 1;
    if (input.reason !== undefined) {
      await input.auditLog.append({
        type: "evidence.deleted",
        tenantId: record.tenantId,
        projectId: record.projectId,
        auditRunId: record.auditRunId,
        reason: input.reason,
        occurredAt: input.now.toISOString(),
      });
    }
  }
  return deleted;
}

export async function issueEvidenceAccess(
  input: LifecycleDependencies & {
    actor: {
      actorId: string;
      tenantId: string;
      projectIds: readonly string[];
    };
    projectId: string;
    auditRunId: string;
    requestedTtlSeconds: number;
    now?: Date;
  },
): Promise<{ url: string; expiresAt: string }> {
  const now = input.now ?? new Date();
  if (
    !Number.isInteger(input.requestedTtlSeconds) ||
    input.requestedTtlSeconds < 1 ||
    input.requestedTtlSeconds > 300
  ) {
    await input.auditLog.append({
      type: "evidence.access.denied",
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      actorId: input.actor.actorId,
      reason: "invalid-ttl",
      occurredAt: now.toISOString(),
    });
    throw new Error("Evidence access must last at most 300 seconds");
  }
  if (!input.actor.projectIds.includes(input.projectId)) {
    await input.auditLog.append({
      type: "evidence.access.denied",
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      actorId: input.actor.actorId,
      reason: "authorization",
      occurredAt: now.toISOString(),
    });
    throw new Error("Evidence access denied");
  }
  const record = await input.catalog.find({
    tenantId: input.actor.tenantId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
  });
  if (record === undefined) {
    await input.auditLog.append({
      type: "evidence.access.denied",
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      actorId: input.actor.actorId,
      reason: "authorization",
      occurredAt: now.toISOString(),
    });
    throw new Error("Evidence access denied");
  }

  const expiresAt = new Date(
    now.getTime() + input.requestedTtlSeconds * 1_000,
  ).toISOString();
  const url = await input.objectStore.issueReadUrl(
    record.objectKey,
    input.requestedTtlSeconds,
  );
  await input.auditLog.append({
    type: "evidence.access.granted",
    tenantId: record.tenantId,
    projectId: record.projectId,
    auditRunId: record.auditRunId,
    actorId: input.actor.actorId,
    expiresAt,
    occurredAt: now.toISOString(),
  });
  return { url, expiresAt };
}

export async function deleteRunEvidence(
  input: LifecycleDependencies & {
    tenantId: string;
    projectId: string;
    auditRunId: string;
    now?: Date;
  },
): Promise<number> {
  const records = await input.catalog.list({
    tenantId: input.tenantId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
  });
  return deleteRecords(records, {
    ...input,
    now: input.now ?? new Date(),
    reason: "run-request",
  });
}

export async function deleteProjectEvidence(
  input: LifecycleDependencies & {
    tenantId: string;
    projectId: string;
    now?: Date;
  },
): Promise<number> {
  const records = await input.catalog.list({
    tenantId: input.tenantId,
    projectId: input.projectId,
  });
  return deleteRecords(records, {
    ...input,
    now: input.now ?? new Date(),
    reason: "project-deletion",
  });
}

export async function reconcileEvidenceRetention(
  input: LifecycleDependencies & { now?: Date },
): Promise<{ examined: number; deleted: number; failed: number }> {
  const now = input.now ?? new Date();
  const records = await input.catalog.list({
    deleteBefore: now.toISOString(),
  });
  let deleted = 0;
  let failed = 0;

  for (const record of records) {
    try {
      await input.objectStore.delete(record.objectKey);
      await input.catalog.remove(record.objectKey);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  const result = { examined: records.length, deleted, failed };
  await input.auditLog.append({
    type: "evidence.retention.reconciled",
    ...result,
    occurredAt: now.toISOString(),
  });
  return result;
}

export async function runScheduledEvidenceRetention(
  input: LifecycleDependencies & {
    schedule: typeof EVIDENCE_RETENTION_CRON;
    scheduledAt: string;
  },
): ReturnType<typeof reconcileEvidenceRetention> {
  const scheduledAt = new Date(input.scheduledAt);
  if (
    Number.isNaN(scheduledAt.getTime()) ||
    scheduledAt.toISOString() !== input.scheduledAt
  ) {
    throw new Error("Retention schedule requires an ISO-8601 timestamp");
  }
  return reconcileEvidenceRetention({
    catalog: input.catalog,
    objectStore: input.objectStore,
    auditLog: input.auditLog,
    now: scheduledAt,
  });
}
