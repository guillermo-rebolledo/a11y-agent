import { createRequire } from "node:module";

import type {
  Ajv2020 as Ajv2020Class,
  ErrorObject,
} from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";

import evidenceBundleSchema from "../../packages/action/evidence-bundle.schema.json" with {
  type: "json",
};

const MAX_SERIALIZED_BYTES = 64 * 1_024;
const require = createRequire(import.meta.url);
const Ajv2020 = (
  require("ajv/dist/2020.js") as {
    default: typeof Ajv2020Class;
  }
).default;
const addFormats = (
  require("ajv-formats") as {
    default: FormatsPlugin;
  }
).default;

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

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});
addFormats(ajv);

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

const validateEvidenceBundle =
  ajv.compile<EvidenceBundle>(evidenceBundleSchema);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function assertIsoDate(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || new Date(value).toISOString() !== value) {
    throw new Error(`${path} must be an ISO-8601 UTC timestamp`);
  }
}

function schemaErrorMessage(error: ErrorObject): string {
  if (error.keyword === "additionalProperties") {
    const field = (error.params as { additionalProperty: string })
      .additionalProperty;
    return `Evidence Bundle contains unknown field: ${field}`;
  }
  if (error.keyword === "maxItems" && error.instancePath === "/findings") {
    return "Evidence Bundle must contain at most 50 findings";
  }
  if (error.keyword === "maxItems" && error.instancePath === "/assertions") {
    return "Evidence Bundle must contain at most 50 assertions";
  }
  if (
    error.keyword === "pattern" &&
    error.instancePath === "/provenance/action"
  ) {
    return "action must use an immutable commit SHA";
  }
  if (
    error.keyword === "pattern" &&
    error.instancePath === "/provenance/workflow"
  ) {
    return "workflow must use an immutable commit SHA";
  }

  const path = error.instancePath
    .replace(/^\/assertions\/\d+/, "assertion")
    .replace(/^\/findings\/\d+/, "finding")
    .replaceAll("/", ".")
    .replace(/^\./, "");
  return `Evidence Bundle schema rejected ${path || "root"}: ${error.message ?? error.keyword}`;
}

export function parseEvidenceBundle(value: unknown): EvidenceBundle {
  assertNoForbiddenFields(value);
  if (!validateEvidenceBundle(value)) {
    const error = validateEvidenceBundle.errors?.[0];
    throw new Error(
      error
        ? schemaErrorMessage(error)
        : "Evidence Bundle does not match its schema",
    );
  }
  assertIsoDate(value.createdAt, "createdAt");
  assertIsoDate(value.expiresAt, "expiresAt");
  const validityMs =
    Date.parse(value.expiresAt) - Date.parse(value.createdAt);
  if (validityMs <= 0 || validityMs > 60 * 60 * 1_000) {
    throw new Error("Evidence Bundle must expire within 1 hour");
  }
  return value;
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
