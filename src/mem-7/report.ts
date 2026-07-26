export const REQUIRED_ASSERTIONS = [
  "image.pinned",
  "journey.terminal",
  "network.deny-by-default",
  "network.approved-host",
  "network.unapproved-host",
  "network.plain-http",
  "network.loopback",
  "network.private",
  "network.link-local",
  "network.metadata",
  "network.unsafe-ipv6",
  "network.redirect",
  "network.dns-rebinding",
  "limits.cpu",
  "limits.memory",
  "limits.disk",
  "limits.ports",
  "limits.execution-time",
  "lifecycle.success",
  "lifecycle.crash",
  "lifecycle.timeout",
  "lifecycle.operator-cancellation",
  "isolation.filesystem",
  "isolation.processes",
  "isolation.environment",
  "concurrency.five-journeys",
  "provenance.dependencies",
] as const;

export type AssertionId = (typeof REQUIRED_ASSERTIONS)[number];

export type ProofAssertion = {
  id: AssertionId;
  status: "passed" | "failed" | "inconclusive";
  evidence: string[];
};

export type JourneyEvidence = {
  journeyId: string;
  sandboxId: string;
  status: "passed" | "failed";
  assertion: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
  destroyedAt: string;
  startupMs: number;
  runtimeMs: number;
  activeCpuMs: number;
};

export type ProofReport = {
  schemaVersion: 1;
  issue: "MEM-7";
  result: "passed" | "failed" | "inconclusive";
  startedAt: string;
  finishedAt: string;
  provenance: {
    image: string;
    baseImage: string;
    lockfileSha256: string;
    sdkVersion: string;
  };
  assertions: ProofAssertion[];
  journeys: JourneyEvidence[];
  measurements: {
    startupMs: number[];
    runtimeMs: number[];
    activeCpuMs: number[];
    estimatedCostUsd: number;
  };
};

export function verifyProofReport(report: ProofReport): string[] {
  const errors: string[] = [];
  const assertionById = new Map(
    report.assertions.map((assertion) => [assertion.id, assertion]),
  );

  for (const id of REQUIRED_ASSERTIONS) {
    const assertion = assertionById.get(id);
    if (!assertion) {
      errors.push(`missing assertion: ${id}`);
    } else if (assertion.status !== "passed") {
      errors.push(`${id} is ${assertion.status}`);
    } else if (assertion.evidence.length === 0) {
      errors.push(`${id} has no evidence`);
    }
  }

  if (report.journeys.length !== 5) {
    errors.push(`expected 5 Journeys, received ${report.journeys.length}`);
  }
  if (
    new Set(report.journeys.map((journey) => journey.sandboxId)).size !==
    report.journeys.length
  ) {
    errors.push("Journeys did not use distinct Sandboxes");
  }
  if (report.journeys.length > 0) {
    const latestStart = Math.max(
      ...report.journeys.map((journey) => Date.parse(journey.startedAt)),
    );
    const earliestFinish = Math.min(
      ...report.journeys.map((journey) => Date.parse(journey.finishedAt)),
    );
    if (latestStart >= earliestFinish) {
      errors.push("the five Journey execution windows did not overlap");
    }
  }

  for (const journey of report.journeys) {
    if (journey.status !== "passed") {
      errors.push(`${journey.journeyId} did not pass`);
    }
    if (Date.parse(journey.destroyedAt) < Date.parse(journey.finishedAt)) {
      errors.push(`${journey.journeyId} has an invalid destruction timestamp`);
    }
  }

  if (!report.provenance.image.includes("@sha256:")) {
    errors.push("runner image is not digest-pinned");
  }
  if (report.result !== "passed") {
    errors.push(`report result is ${report.result}`);
  }

  return errors;
}
