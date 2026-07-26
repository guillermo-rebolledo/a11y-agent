import { describe, expect, it } from "vitest";

import {
  parseEvidenceBundle,
  parseEvidenceBundleText,
  type EvidenceBundle,
} from "./evidence-bundle.js";

const validBundle: EvidenceBundle = {
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
    action:
      "guillermo-rebolledo/a11y-agent/packages/action@0123456789abcdef0123456789abcdef01234567",
    workflow:
      "guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@0123456789abcdef0123456789abcdef01234567",
    repository: "guillermo-rebolledo/a11y-demo",
    commit: "abcdef0123456789abcdef0123456789abcdef01",
    runId: "123456789",
    runAttempt: 1,
    runnerEnvironment: "github-hosted",
    runnerArchitecture: "X64",
  },
  assertions: [
    { id: "invitation-status-visible", status: "passed" },
    { id: "session-material-absent", status: "passed" },
  ],
  findings: [{ ruleId: "button-name", impact: "critical", checkpoint: 2 }],
  measurements: {
    startupMs: 725,
    runtimeMs: 1_430,
    actionMinutes: 0.04,
  },
};

describe("MEM-22 Evidence Bundle contract", () => {
  it("accepts the bounded representative bundle", () => {
    expect(parseEvidenceBundle(validBundle)).toEqual(validBundle);
  });

  it.each([
    ["cookies", [{ name: "session", value: "canary-cookie" }]],
    ["storageState", { origins: [] }],
    ["loginCredentials", { password: "canary-password" }],
    ["requestBody", "canary-request"],
    ["responseBody", "canary-response"],
  ])("rejects forbidden browser material in field %s", (key, value) => {
    expect(() =>
      parseEvidenceBundle({ ...validBundle, [key]: value }),
    ).toThrow("forbidden browser-session or content field");
  });

  it("rejects unknown executable content and oversized finding collections", () => {
    expect(() =>
      parseEvidenceBundle({ ...validBundle, script: "process.exit(0)" }),
    ).toThrow("unknown field");

    expect(() =>
      parseEvidenceBundle({
        ...validBundle,
        findings: Array.from({ length: 51 }, (_, checkpoint) => ({
          ruleId: "button-name",
          impact: "critical",
          checkpoint,
        })),
      }),
    ).toThrow("at most 50 findings");
  });

  it("rejects malformed provenance and expiration bounds", () => {
    expect(() =>
      parseEvidenceBundle({
        ...validBundle,
        provenance: { ...validBundle.provenance, action: "owner/action@main" },
      }),
    ).toThrow("action must use an immutable commit SHA");

    expect(() =>
      parseEvidenceBundle({
        ...validBundle,
        expiresAt: "2026-07-26T05:00:01.000Z",
      }),
    ).toThrow("must expire within 1 hour");
  });

  it("rejects malformed and oversized serialized artifacts before publication", () => {
    expect(() => parseEvidenceBundleText("{not-json")).toThrow(
      "must be valid JSON",
    );
    expect(() =>
      parseEvidenceBundleText(`{"padding":"${"x".repeat(65_536)}"}`),
    ).toThrow("exceeds 64 KiB");
  });
});
