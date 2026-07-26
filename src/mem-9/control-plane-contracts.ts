const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/u;

const QUEUE_KINDS = new Set([
  "finalize-audit-run",
  "delete-run-evidence",
  "delete-project-evidence",
  "reconcile-evidence-retention",
] as const);

const TELEMETRY_EVENTS = new Set([
  "evidence-publication",
  "evidence-access",
  "evidence-deletion",
  "retention-reconciliation",
] as const);

const TELEMETRY_OUTCOMES = new Set([
  "accepted",
  "rejected",
  "suppressed",
  "deleted",
  "failed",
] as const);

export type ControlPlaneQueuePayload = {
  schemaVersion: 1;
  kind:
    | "finalize-audit-run"
    | "delete-run-evidence"
    | "delete-project-evidence"
    | "reconcile-evidence-retention";
  tenantId: string;
  projectId: string;
  auditRunId: string;
};

export type OperationalTelemetry = {
  schemaVersion: 1;
  event:
    | "evidence-publication"
    | "evidence-access"
    | "evidence-deletion"
    | "retention-reconciliation";
  tenantId: string;
  projectId: string;
  auditRunId: string;
  outcome: "accepted" | "rejected" | "suppressed" | "deleted" | "failed";
  durationMs: number;
  retryCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, contract: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${contract} must be an object`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown !== undefined) throw new Error(`unknown field: ${unknown}`);
  const missing = keys.find((key) => !(key in value));
  if (missing !== undefined) throw new Error(`missing field: ${missing}`);
}

function assertIdentifiers(
  value: Record<string, unknown>,
): asserts value is Record<"tenantId" | "projectId" | "auditRunId", string> {
  for (const field of ["tenantId", "projectId", "auditRunId"] as const) {
    if (typeof value[field] !== "string" || !OPAQUE_ID.test(value[field])) {
      throw new Error(`${field} must be an opaque identifier`);
    }
  }
}

export function parseControlPlaneQueuePayload(
  value: unknown,
): ControlPlaneQueuePayload {
  assertRecord(value, "Control-plane queue payload");
  assertExactKeys(value, [
    "schemaVersion",
    "kind",
    "tenantId",
    "projectId",
    "auditRunId",
  ]);
  if (value.schemaVersion !== 1) {
    throw new Error("unsupported queue schema version");
  }
  if (
    typeof value.kind !== "string" ||
    !QUEUE_KINDS.has(value.kind as ControlPlaneQueuePayload["kind"])
  ) {
    throw new Error("unsupported queue payload kind");
  }
  assertIdentifiers(value);
  return value as ControlPlaneQueuePayload;
}

export function parseOperationalTelemetry(
  value: unknown,
): OperationalTelemetry {
  assertRecord(value, "Operational telemetry");
  assertExactKeys(value, [
    "schemaVersion",
    "event",
    "tenantId",
    "projectId",
    "auditRunId",
    "outcome",
    "durationMs",
    "retryCount",
  ]);
  if (value.schemaVersion !== 1) {
    throw new Error("unsupported telemetry schema version");
  }
  if (
    typeof value.event !== "string" ||
    !TELEMETRY_EVENTS.has(value.event as OperationalTelemetry["event"])
  ) {
    throw new Error("unsupported event");
  }
  if (
    typeof value.outcome !== "string" ||
    !TELEMETRY_OUTCOMES.has(value.outcome as OperationalTelemetry["outcome"])
  ) {
    throw new Error("unsupported telemetry outcome");
  }
  if (
    typeof value.durationMs !== "number" ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0 ||
    value.durationMs > 60 * 60 * 1_000
  ) {
    throw new Error("durationMs is outside the telemetry bound");
  }
  if (
    typeof value.retryCount !== "number" ||
    !Number.isInteger(value.retryCount) ||
    value.retryCount < 0 ||
    value.retryCount > 10
  ) {
    throw new Error("retryCount is outside the telemetry bound");
  }
  assertIdentifiers(value);
  return value as OperationalTelemetry;
}
