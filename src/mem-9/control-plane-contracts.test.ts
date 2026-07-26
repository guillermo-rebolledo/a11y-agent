import { describe, expect, it } from "vitest";

import {
  parseControlPlaneQueuePayload,
  parseOperationalTelemetry,
} from "./control-plane-contracts.js";

const identifiers = {
  tenantId: "tenant-01JZ8H7EM00A1Y8TGXQW3M8KTT",
  projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
  auditRunId: "audit-01JZ8F2V6YB5FQX0MB7K2CS4RA",
};

describe("MEM-9 content-free control-plane contracts", () => {
  it("accepts identifiers-only queue payloads", () => {
    expect(
      parseControlPlaneQueuePayload({
        schemaVersion: 1,
        kind: "finalize-audit-run",
        ...identifiers,
      }),
    ).toEqual({
      schemaVersion: 1,
      kind: "finalize-audit-run",
      ...identifiers,
    });
  });

  it.each([
    ["pageText", "mem9-email-canary@example.invalid"],
    ["url", "https://example.invalid/private?token=secret"],
    ["credentials", { password: "mem9-secret-canary" }],
    ["evidenceBundle", { schemaVersion: 1 }],
    ["requestBody", "browser content"],
    ["responseBody", "browser content"],
  ])("rejects queue content field %s", (key, value) => {
    expect(() =>
      parseControlPlaneQueuePayload({
        schemaVersion: 1,
        kind: "finalize-audit-run",
        ...identifiers,
        [key]: value,
      }),
    ).toThrow(`unknown field: ${key}`);
  });

  it("accepts bounded metadata-only telemetry", () => {
    expect(
      parseOperationalTelemetry({
        schemaVersion: 1,
        event: "evidence-publication",
        ...identifiers,
        outcome: "accepted",
        durationMs: 42,
        retryCount: 0,
      }),
    ).toEqual({
      schemaVersion: 1,
      event: "evidence-publication",
      ...identifiers,
      outcome: "accepted",
      durationMs: 42,
      retryCount: 0,
    });
  });

  it("rejects telemetry content and unbounded metadata", () => {
    expect(() =>
      parseOperationalTelemetry({
        schemaVersion: 1,
        event: "evidence-publication",
        ...identifiers,
        outcome: "accepted",
        durationMs: 42,
        retryCount: 0,
        pageText: "Invite alice@example.invalid",
      }),
    ).toThrow("unknown field: pageText");
    expect(() =>
      parseOperationalTelemetry({
        schemaVersion: 1,
        event: "arbitrary-event",
        ...identifiers,
        outcome: "accepted",
        durationMs: 42,
        retryCount: 0,
      }),
    ).toThrow("unsupported event");
  });
});
