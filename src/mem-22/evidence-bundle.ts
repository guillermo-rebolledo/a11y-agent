const SHA_REF = /^[^@\s]+@[0-9a-f]{40}$/;
const IMAGE_DIGEST = /^.+@sha256:[0-9a-f]{64}$/;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const SHA = /^[0-9a-f]{40}$/;
const MAX_SERIALIZED_BYTES = 64 * 1_024;

const FORBIDDEN_KEYS = new Set([
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "logincredential",
  "logincredentials",
  "localstorage",
  "password",
  "requestbody",
  "responsebody",
  "secret",
  "storagestate",
  "token",
]);

const ROOT_KEYS = new Set([
  "schemaVersion",
  "auditRunId",
  "journeyId",
  "status",
  "terminalReason",
  "createdAt",
  "expiresAt",
  "publicationNonce",
  "provenance",
  "assertions",
  "findings",
  "measurements",
]);

export type EvidenceTerminalStatus =
  | "passed"
  | "failed"
  | "crashed"
  | "timed-out"
  | "cancelled";

export type EvidenceBundle = {
  schemaVersion: 1;
  auditRunId: string;
  journeyId: string;
  status: EvidenceTerminalStatus;
  terminalReason:
    | "completed"
    | "assertion-failed"
    | "runner-failure"
    | "timeout"
    | "operator-cancellation";
  createdAt: string;
  expiresAt: string;
  publicationNonce: string;
  provenance: {
    auditEngine: string;
    playwright: string;
    chromium: string;
    axe: string;
    image: string;
    action: string;
    workflow: string;
    repository: string;
    commit: string;
    runId: string;
    runAttempt: number;
    runnerEnvironment: "github-hosted";
    runnerArchitecture: "X64" | "ARM64";
  };
  assertions: Array<{
    id: string;
    status: "passed" | "failed";
  }>;
  findings: Array<{
    ruleId: string;
    impact: "minor" | "moderate" | "serious" | "critical" | null;
    checkpoint: number;
  }>;
  measurements: {
    startupMs: number;
    runtimeMs: number;
    actionMinutes: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`${path} contains unknown field: ${unknown}`);
  }
}

function assertNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenFields);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.replaceAll(/[-_]/g, "").toLowerCase())) {
      throw new Error(
        `Evidence Bundle contains forbidden browser-session or content field: ${key}`,
      );
    }
    assertNoForbiddenFields(child);
  }
}

function assertString(
  value: unknown,
  path: string,
  maximumLength = 256,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    throw new Error(`${path} must be a non-empty bounded string`);
  }
}

function assertFiniteNonNegative(
  value: unknown,
  path: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a finite non-negative number`);
  }
}

function assertIsoDate(value: unknown, path: string): asserts value is string {
  assertString(value, path, 32);
  if (new Date(value).toISOString() !== value) {
    throw new Error(`${path} must be an ISO-8601 UTC timestamp`);
  }
}

export function parseEvidenceBundle(value: unknown): EvidenceBundle {
  assertNoForbiddenFields(value);
  if (!isRecord(value)) throw new Error("Evidence Bundle must be an object");
  assertExactKeys(value, ROOT_KEYS, "Evidence Bundle");

  if (value.schemaVersion !== 1) {
    throw new Error("unsupported Evidence Bundle schemaVersion");
  }
  assertString(value.auditRunId, "auditRunId", 128);
  assertString(value.journeyId, "journeyId", 128);
  assertString(value.publicationNonce, "publicationNonce", 128);
  if (
    !OPAQUE_ID.test(value.auditRunId) ||
    !OPAQUE_ID.test(value.journeyId) ||
    !OPAQUE_ID.test(value.publicationNonce)
  ) {
    throw new Error("Evidence Bundle identifiers must be opaque identifiers");
  }

  const statuses: EvidenceTerminalStatus[] = [
    "passed",
    "failed",
    "crashed",
    "timed-out",
    "cancelled",
  ];
  if (!statuses.includes(value.status as EvidenceTerminalStatus)) {
    throw new Error("invalid terminal status");
  }
  const terminalReasons = [
    "completed",
    "assertion-failed",
    "runner-failure",
    "timeout",
    "operator-cancellation",
  ];
  if (!terminalReasons.includes(value.terminalReason as string)) {
    throw new Error("invalid terminal reason");
  }

  assertIsoDate(value.createdAt, "createdAt");
  assertIsoDate(value.expiresAt, "expiresAt");
  const validityMs =
    Date.parse(value.expiresAt) - Date.parse(value.createdAt);
  if (validityMs <= 0 || validityMs > 60 * 60 * 1_000) {
    throw new Error("Evidence Bundle must expire within 1 hour");
  }

  if (!isRecord(value.provenance)) {
    throw new Error("provenance must be an object");
  }
  const provenanceKeys = new Set([
    "auditEngine",
    "playwright",
    "chromium",
    "axe",
    "image",
    "action",
    "workflow",
    "repository",
    "commit",
    "runId",
    "runAttempt",
    "runnerEnvironment",
    "runnerArchitecture",
  ]);
  assertExactKeys(value.provenance, provenanceKeys, "provenance");
  for (const key of [
    "auditEngine",
    "playwright",
    "chromium",
    "axe",
    "image",
    "action",
    "workflow",
    "repository",
    "commit",
    "runId",
    "runnerEnvironment",
    "runnerArchitecture",
  ]) {
    assertString(value.provenance[key], `provenance.${key}`, 320);
  }
  if (!IMAGE_DIGEST.test(value.provenance.image as string)) {
    throw new Error("image must use an immutable sha256 digest");
  }
  if (!SHA_REF.test(value.provenance.action as string)) {
    throw new Error("action must use an immutable commit SHA");
  }
  if (!SHA_REF.test(value.provenance.workflow as string)) {
    throw new Error("workflow must use an immutable commit SHA");
  }
  if (!SHA.test(value.provenance.commit as string)) {
    throw new Error("commit must be a full Git commit SHA");
  }
  if (
    !Number.isInteger(value.provenance.runAttempt) ||
    (value.provenance.runAttempt as number) < 1
  ) {
    throw new Error("runAttempt must be a positive integer");
  }
  if (value.provenance.runnerEnvironment !== "github-hosted") {
    throw new Error("only ephemeral GitHub-hosted runners are supported");
  }
  if (!["X64", "ARM64"].includes(value.provenance.runnerArchitecture as string)) {
    throw new Error("unsupported runner architecture");
  }

  if (!Array.isArray(value.assertions) || value.assertions.length > 50) {
    throw new Error("Evidence Bundle must contain at most 50 assertions");
  }
  const assertionKeys = new Set(["id", "status"]);
  for (const assertion of value.assertions) {
    if (!isRecord(assertion)) throw new Error("assertion must be an object");
    assertExactKeys(assertion, assertionKeys, "assertion");
    assertString(assertion.id, "assertion.id", 128);
    if (!["passed", "failed"].includes(assertion.status as string)) {
      throw new Error("invalid assertion status");
    }
  }

  if (!Array.isArray(value.findings) || value.findings.length > 50) {
    throw new Error("Evidence Bundle must contain at most 50 findings");
  }
  const findingKeys = new Set(["ruleId", "impact", "checkpoint"]);
  for (const finding of value.findings) {
    if (!isRecord(finding)) throw new Error("finding must be an object");
    assertExactKeys(finding, findingKeys, "finding");
    assertString(finding.ruleId, "finding.ruleId", 128);
    if (
      finding.impact !== null &&
      !["minor", "moderate", "serious", "critical"].includes(
        finding.impact as string,
      )
    ) {
      throw new Error("invalid finding impact");
    }
    if (
      !Number.isInteger(finding.checkpoint) ||
      (finding.checkpoint as number) < 0
    ) {
      throw new Error("finding checkpoint must be a non-negative integer");
    }
  }

  if (!isRecord(value.measurements)) {
    throw new Error("measurements must be an object");
  }
  assertExactKeys(
    value.measurements,
    new Set(["startupMs", "runtimeMs", "actionMinutes"]),
    "measurements",
  );
  assertFiniteNonNegative(value.measurements.startupMs, "measurements.startupMs");
  assertFiniteNonNegative(value.measurements.runtimeMs, "measurements.runtimeMs");
  assertFiniteNonNegative(
    value.measurements.actionMinutes,
    "measurements.actionMinutes",
  );

  return value as EvidenceBundle;
}

export function parseEvidenceBundleText(source: string): EvidenceBundle {
  if (Buffer.byteLength(source, "utf8") > MAX_SERIALIZED_BYTES) {
    throw new Error("Evidence Bundle exceeds 64 KiB");
  }

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    throw new Error("Evidence Bundle must be valid JSON");
  }
  return parseEvidenceBundle(value);
}
