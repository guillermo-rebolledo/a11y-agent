export const REQUIRED_QUALIFICATION_GATES = [
  "clean-proof-reruns",
  "phase-0-objective-evidence",
  "extension-permissions",
  "customer-ci-credentials",
  "workflow-trust",
  "browser-job-isolation",
  "publisher-separation",
  "oidc-claims",
  "artifact-validation",
  "security-fail-closed",
  "deterministic-audit",
  "deployment-gating",
  "github-integration",
  "performance-targets",
  "version-provenance",
  "operational-controls",
  "product-accessibility",
  "session-custody",
] as const;

export type QualificationDecision = "accept" | "revise" | "reject";

export type QualificationGate = {
  id: string;
  consequence: "reject" | "review";
  status: "passed" | "failed" | "partial" | "not-evidenced";
  evidence: string[];
  finding: string;
};

export type QualificationReport = {
  schemaVersion: 1;
  issue: "MEM-10";
  capturedAt: string;
  gates: QualificationGate[];
  decision: QualificationDecision;
  decisionRationale: string;
  unblockRequirements: string[];
  productionConstraints: string[];
  replacementArchitecture: string | null;
};

export function decideArchitecture(
  gates: QualificationGate[],
): QualificationDecision {
  if (
    gates.some(
      (gate) => gate.consequence === "reject" && gate.status === "failed",
    )
  ) {
    return "reject";
  }

  if (gates.some((gate) => gate.status !== "passed")) {
    return "revise";
  }

  return "accept";
}

export function verifyQualificationReport(
  report: QualificationReport,
): string[] {
  const errors: string[] = [];
  const gateById = new Map<string, QualificationGate>();

  for (const gate of report.gates) {
    if (gateById.has(gate.id)) {
      errors.push(`duplicate gate: ${gate.id}`);
    }
    gateById.set(gate.id, gate);

    if (gate.status !== "not-evidenced" && gate.evidence.length === 0) {
      errors.push(`${gate.id} has ${gate.status} status without evidence`);
    }
    if (gate.finding.trim().length === 0) {
      errors.push(`${gate.id} has no finding`);
    }
  }

  for (const id of REQUIRED_QUALIFICATION_GATES) {
    if (!gateById.has(id)) {
      errors.push(`missing gate: ${id}`);
    }
  }

  const computedDecision = decideArchitecture(report.gates);
  if (report.decision !== computedDecision) {
    errors.push(
      `decision is ${report.decision}, but gate results require ${computedDecision}`,
    );
  }

  if (report.decision === "accept" && report.productionConstraints.length === 0) {
    errors.push("an accepted architecture must record production constraints");
  }
  if (report.decision === "revise" && report.unblockRequirements.length === 0) {
    errors.push("a revised architecture must record unblock requirements");
  }
  if (
    report.decision === "reject" &&
    (report.replacementArchitecture === null ||
      report.replacementArchitecture.trim().length === 0)
  ) {
    errors.push("a rejected architecture must name the replacement direction");
  }

  return errors;
}
