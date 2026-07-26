import { describe, expect, it } from "vitest";

import {
  InMemoryEvidenceAuditLog,
  InMemoryEvidenceCatalog,
  InMemoryPrivateEvidenceStore,
  type EvidenceRecord,
} from "./publication-service.js";
import {
  deleteProjectEvidence,
  deleteRunEvidence,
  EVIDENCE_RETENTION_CRON,
  issueEvidenceAccess,
  runScheduledEvidenceRetention,
} from "./evidence-lifecycle.js";

const now = new Date("2026-07-26T05:00:00.000Z");
const tenantId = "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT";
const projectId = "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ";

function record(
  auditRunId: string,
  deleteAt = "2026-08-25T05:00:00.000Z",
): EvidenceRecord {
  return {
    tenantId,
    projectId,
    auditRunId,
    objectKey: `evidence/${auditRunId}.json`,
    contentSha256: "a".repeat(64),
    createdAt: "2026-07-26T05:00:00.000Z",
    deleteAt,
  };
}

async function seed(
  catalog: InMemoryEvidenceCatalog,
  objectStore: InMemoryPrivateEvidenceStore,
  evidenceRecord: EvidenceRecord,
) {
  await catalog.insert(evidenceRecord);
  await objectStore.put({
    key: evidenceRecord.objectKey,
    body: "{}\n",
    contentType: "application/json",
    cacheControl: "private, no-store",
    customMetadata: {
      auditRunId: evidenceRecord.auditRunId,
      projectId: evidenceRecord.projectId,
      contentSha256: evidenceRecord.contentSha256,
    },
  });
}

describe("MEM-9 private evidence lifecycle", () => {
  it("issues short-lived access only after tenant and Project authorization", async () => {
    const catalog = new InMemoryEvidenceCatalog();
    const objectStore = new InMemoryPrivateEvidenceStore();
    const auditLog = new InMemoryEvidenceAuditLog();
    await seed(catalog, objectStore, record("audit-authorized"));

    const access = await issueEvidenceAccess({
      actor: {
        actorId: "user-01JZ8JAV2SB3MPBTJ5CZB10YR4",
        tenantId,
        projectIds: [projectId],
      },
      projectId,
      auditRunId: "audit-authorized",
      requestedTtlSeconds: 300,
      now,
      catalog,
      objectStore,
      auditLog,
    });

    expect(access.expiresAt).toBe("2026-07-26T05:05:00.000Z");
    expect(access.url).toContain("expires=300");
    expect(auditLog.events).toEqual([
      expect.objectContaining({
        type: "evidence.access.granted",
        actorId: "user-01JZ8JAV2SB3MPBTJ5CZB10YR4",
      }),
    ]);

    await expect(
      issueEvidenceAccess({
        actor: {
          actorId: "user-attacker",
          tenantId: "tenant-attacker",
          projectIds: [projectId],
        },
        projectId,
        auditRunId: "audit-authorized",
        requestedTtlSeconds: 300,
        now,
        catalog,
        objectStore,
        auditLog,
      }),
    ).rejects.toThrow("Evidence access denied");
    expect(auditLog.events.at(-1)).toMatchObject({
      type: "evidence.access.denied",
      actorId: "user-attacker",
      reason: "authorization",
    });
    await expect(
      issueEvidenceAccess({
        actor: {
          actorId: "user-01JZ8JAV2SB3MPBTJ5CZB10YR4",
          tenantId,
          projectIds: [projectId],
        },
        projectId,
        auditRunId: "audit-authorized",
        requestedTtlSeconds: 301,
        now,
        catalog,
        objectStore,
        auditLog,
      }),
    ).rejects.toThrow("at most 300 seconds");
  });

  it("deletes evidence immediately by Audit Run and by Project", async () => {
    const catalog = new InMemoryEvidenceCatalog();
    const objectStore = new InMemoryPrivateEvidenceStore();
    const auditLog = new InMemoryEvidenceAuditLog();
    await seed(catalog, objectStore, record("audit-delete-one"));
    await seed(catalog, objectStore, record("audit-delete-two"));

    expect(
      await deleteRunEvidence({
        tenantId,
        projectId,
        auditRunId: "audit-delete-one",
        now,
        catalog,
        objectStore,
        auditLog,
      }),
    ).toBe(1);
    expect(catalog.records.map((item) => item.auditRunId)).toEqual([
      "audit-delete-two",
    ]);

    expect(
      await deleteProjectEvidence({
        tenantId,
        projectId,
        now,
        catalog,
        objectStore,
        auditLog,
      }),
    ).toBe(1);
    expect(catalog.records).toEqual([]);
    expect(objectStore.objects).toEqual([]);
    expect(auditLog.events.map((event) => event.type)).toEqual([
      "evidence.deleted",
      "evidence.deleted",
    ]);
  });

  it("reconciles every overdue object while preserving retained evidence", async () => {
    const catalog = new InMemoryEvidenceCatalog();
    const objectStore = new InMemoryPrivateEvidenceStore();
    const auditLog = new InMemoryEvidenceAuditLog();
    await seed(
      catalog,
      objectStore,
      record("audit-overdue", "2026-07-26T04:59:59.000Z"),
    );
    await seed(catalog, objectStore, record("audit-retained"));

    const result = await runScheduledEvidenceRetention({
      schedule: EVIDENCE_RETENTION_CRON,
      scheduledAt: now.toISOString(),
      catalog,
      objectStore,
      auditLog,
    });

    expect(result).toEqual({ examined: 1, deleted: 1, failed: 0 });
    expect(catalog.records.map((item) => item.auditRunId)).toEqual([
      "audit-retained",
    ]);
    expect(auditLog.events).toEqual([
      expect.objectContaining({
        type: "evidence.retention.reconciled",
        examined: 1,
        deleted: 1,
        failed: 0,
      }),
    ]);
  });
});
