import { describe, expect, it } from "vitest";

import {
  REQUIRED_ASSERTIONS,
  verifyProofReport,
  type ProofReport,
} from "./report.js";

describe("MEM-7 evidence verification", () => {
  it("rejects missing assertions and an incomplete concurrency run", () => {
    const report: ProofReport = {
      schemaVersion: 1,
      issue: "MEM-7",
      result: "failed",
      startedAt: "2026-07-26T00:00:00.000Z",
      finishedAt: "2026-07-26T00:00:01.000Z",
      provenance: {
        image: "runner@sha256:abc",
        baseImage: "node@sha256:def",
        lockfileSha256: "123",
        sdkVersion: "2.9.0",
      },
      assertions: [],
      journeys: [],
      measurements: {
        startupMs: [],
        runtimeMs: [],
        activeCpuMs: [],
        estimatedCostUsd: 0,
      },
    };

    const errors = verifyProofReport(report);

    expect(errors).toContain(`missing assertion: ${REQUIRED_ASSERTIONS[0]}`);
    expect(errors).toContain("expected 5 Journeys, received 0");
  });

  it("accepts a complete passing report", () => {
    const report: ProofReport = {
      schemaVersion: 1,
      issue: "MEM-7",
      result: "passed",
      startedAt: "2026-07-26T00:00:00.000Z",
      finishedAt: "2026-07-26T00:00:10.000Z",
      provenance: {
        image: "runner@sha256:abc",
        baseImage: "node@sha256:def",
        lockfileSha256: "123",
        sdkVersion: "2.9.0",
      },
      assertions: REQUIRED_ASSERTIONS.map((id) => ({
        id,
        status: "passed",
        evidence: ["observed"],
      })),
      journeys: Array.from({ length: 5 }, (_, index) => ({
        journeyId: `journey-${index + 1}`,
        sandboxId: `sandbox-${index + 1}`,
        status: "passed",
        assertion: "Invitation sent",
        createdAt: "2026-07-26T00:00:00.000Z",
        startedAt: "2026-07-26T00:00:03.000Z",
        finishedAt: "2026-07-26T00:00:09.000Z",
        destroyedAt: "2026-07-26T00:00:10.000Z",
        startupMs: 3_000,
        runtimeMs: 6_000,
        activeCpuMs: 2_000,
      })),
      measurements: {
        startupMs: [3_000, 3_000, 3_000, 3_000, 3_000],
        runtimeMs: [6_000, 6_000, 6_000, 6_000, 6_000],
        activeCpuMs: [2_000, 2_000, 2_000, 2_000, 2_000],
        estimatedCostUsd: 0.01,
      },
    };

    expect(verifyProofReport(report)).toEqual([]);
  });
});
