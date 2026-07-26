import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  decideArchitecture,
  verifyQualificationReport,
  type QualificationGate,
  type QualificationReport,
} from "./qualification.js";

const passedGate = (
  id: string,
  consequence: QualificationGate["consequence"] = "review",
): QualificationGate => ({
  id,
  consequence,
  status: "passed",
  evidence: ["evidence/example.json"],
  finding: "Observed in the qualification run.",
});

describe("MEM-10 architecture qualification", () => {
  it("rejects a demonstrated security failure instead of allowing a waiver", () => {
    expect(
      decideArchitecture([
        passedGate("workflow-trust", "reject"),
        {
          ...passedGate("session-custody", "reject"),
          status: "failed",
          finding: "A cookie entered a published artifact.",
        },
      ]),
    ).toBe("reject");
  });

  it("requires revision when a blocking item lacks objective evidence", () => {
    expect(
      decideArchitecture([
        passedGate("workflow-trust", "reject"),
        {
          ...passedGate("operational-controls"),
          status: "not-evidenced",
          evidence: [],
          finding: "The global dispatch stop was not exercised.",
        },
      ]),
    ).toBe("revise");
  });

  it("accepts only when every blocking gate has passing evidence", () => {
    expect(
      decideArchitecture([
        passedGate("workflow-trust", "reject"),
        passedGate("operational-controls"),
      ]),
    ).toBe("accept");
  });

  it("verifies the checked-in decision against the objective gate results", async () => {
    const report = JSON.parse(
      await readFile(
        new URL("../../evidence/MEM-10/proof-report.json", import.meta.url),
        "utf8",
      ),
    ) as QualificationReport;

    expect(verifyQualificationReport(report)).toEqual([]);
    expect(report.decision).toBe("revise");
    expect(report.gates.some((gate) => gate.status === "not-evidenced")).toBe(
      true,
    );
  });
});
