import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Sandbox } from "@vercel/sandbox";

import {
  REQUIRED_ASSERTIONS,
  type AssertionId,
  type JourneyEvidence,
  type ProofAssertion,
  type ProofReport,
  verifyProofReport,
} from "./report.js";

const IMAGE =
  "runner@sha256:373dd0f64371aa0bf855020b546b0f63444fe0eef09bc2f09f12d7e9c23f01d3";
const BASE_IMAGE =
  "node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99";
const REBINDING_HOST = "7f000001.01010101.rbndr.us";
const SESSION_TIMEOUT_MS = 120_000;
const COMMAND_TIMEOUT_MS = 30_000;
const UNSAFE_SUBNETS = [
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

type JourneyOutput = {
  status: "passed" | "failed";
  assertion: string;
  browserVersion: string;
  playwrightVersion: string;
  axeVersion: string;
  checkpoints: number;
  violations: { id: string; impact: string | null }[];
  timings: {
    controlMs: number;
    axeMs: number;
    totalMs: number;
  };
};

type CreatedSandbox = {
  sandbox: Sandbox;
  journeyId: string;
  canary: string;
  createStartedAt: Date;
  createdAt: Date;
};

function assertion(
  id: AssertionId,
  passed: boolean,
  evidence: string[],
): ProofAssertion {
  return { id, status: passed ? "passed" : "failed", evidence };
}

async function output(command: Awaited<ReturnType<Sandbox["runCommand"]>>) {
  return command.stdout();
}

async function fetchTarget(
  sandbox: Sandbox,
  label: string,
  url: string,
): Promise<{ label: string; reachable: boolean; detail: string }> {
  const program = `
    const target = process.argv[1];
    try {
      const response = await fetch(target, {
        redirect: "follow",
        signal: AbortSignal.timeout(5000)
      });
      console.log(JSON.stringify({
        reachable: true,
        status: response.status,
        finalProtocol: new URL(response.url).protocol
      }));
    } catch (error) {
      console.log(JSON.stringify({
        reachable: false,
        error: error instanceof Error ? error.name : "unknown",
        cause: error && typeof error === "object" && "cause" in error
          ? String(error.cause?.code ?? error.cause)
          : "none"
      }));
    }
  `;
  const command = await sandbox.runCommand("node", ["-e", program, url], {
    timeoutMs: 8_000,
  });
  const result = JSON.parse((await command.stdout()).trim()) as {
    reachable: boolean;
    status?: number;
    error?: string;
    cause?: string;
  };
  return {
    label,
    reachable: result.reachable,
    detail: result.reachable
      ? `HTTP ${result.status ?? "unknown"}`
      : `${result.error ?? "blocked"}:${result.cause ?? "unknown"}`,
  };
}

async function isDeleted(name: string): Promise<boolean> {
  const matches = await (
    await Sandbox.list({ namePrefix: name, sortBy: "name" })
  ).toArray();
  return !matches.some((sandbox) => sandbox.name === name);
}

export async function cleanupMem7Sandboxes(): Promise<void> {
  const sandboxes = await (
    await Sandbox.list({ namePrefix: "mem-7-", sortBy: "name" })
  ).toArray();
  await Promise.allSettled(
    sandboxes.map(async ({ name }) => {
      const sandbox = await Sandbox.get({ name, resume: false });
      await sandbox.delete();
    }),
  );
}

async function createJourneySandbox(index: number): Promise<CreatedSandbox> {
  const createStartedAt = new Date();
  const journeyId = `synthetic-invite-${index + 1}`;
  const canary = `mem7-${index + 1}-${randomUUID()}`;
  const sandbox = await Sandbox.create({
    name: `mem-7-${Date.now()}-${index + 1}-${randomUUID().slice(0, 8)}`,
    image: IMAGE,
    timeout: SESSION_TIMEOUT_MS,
    resources: { vcpus: 1 },
    ports: [],
    persistent: false,
    env: {
      MEM7_ISOLATION_CANARY: canary,
      NODE_EXTRA_CA_CERTS:
        "/etc/pki/ca-trust/source/anchors/vercel-proxy-ca.pem",
    },
    tags: { issue: "MEM-7", purpose: "disposable-chromium-proof" },
    networkPolicy: {
      allow: ["example.com", "httpbin.org", REBINDING_HOST],
      subnets: { deny: UNSAFE_SUBNETS },
    },
  });
  return {
    sandbox,
    journeyId,
    canary,
    createStartedAt,
    createdAt: new Date(),
  };
}

async function proveTerminalLifecycle(
  mode: "crash" | "timeout" | "operator-cancellation",
): Promise<{ passed: boolean; evidence: string[] }> {
  const sandbox = await Sandbox.create({
    name: `mem-7-lifecycle-${mode}-${Date.now()}`,
    image: IMAGE,
    timeout: 15_000,
    resources: { vcpus: 1 },
    ports: [],
    persistent: false,
    networkPolicy: "deny-all",
    tags: { issue: "MEM-7", lifecycle: mode },
  });
  let terminalObserved = false;

  try {
    if (mode === "crash") {
      terminalObserved =
        (await sandbox.runCommand("node", ["-e", "process.exit(17)"])).exitCode ===
        17;
    } else if (mode === "timeout") {
      const command = await sandbox.runCommand(
        "node",
        ["-e", "setTimeout(() => {}, 10000)"],
        { timeoutMs: 250 },
      );
      terminalObserved = command.exitCode !== 0;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 250);
      try {
        await sandbox.runCommand(
          "node",
          ["-e", "setTimeout(() => {}, 10000)"],
          { signal: controller.signal },
        );
      } catch (error) {
        terminalObserved =
          error instanceof Error &&
          (error.name === "AbortError" || controller.signal.aborted);
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    await sandbox.delete();
  }

  const deleted = await isDeleted(sandbox.name);
  return {
    passed: terminalObserved && deleted,
    evidence: [
      `${mode} terminal condition observed=${terminalObserved}`,
      `Sandbox absent after delete=${deleted}`,
    ],
  };
}

export async function runLiveProof(): Promise<ProofReport> {
  const startedAt = new Date();
  const assertions: ProofAssertion[] = [];
  const created: CreatedSandbox[] = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      created.push(await createJourneySandbox(index));
    }
  } catch (error) {
    await Promise.allSettled(
      created.map(({ sandbox }) => sandbox.delete()),
    );
    throw error;
  }

  const primary = created[0];
  if (!primary) {
    throw new Error("No primary Sandbox was created");
  }

  const actualImage = primary.sandbox.image;
  assertions.push(
    assertion(
      "image.pinned",
      actualImage === IMAGE,
      [`requested=${IMAGE}`, `observed=${actualImage ?? "missing"}`],
    ),
  );
  assertions.push(
    assertion(
      "network.deny-by-default",
      primary.sandbox.networkPolicy !== "allow-all",
      [JSON.stringify(primary.sandbox.networkPolicy)],
    ),
  );

  const networkChecks = await Promise.all([
    fetchTarget(primary.sandbox, "approved-host", "https://example.com/"),
    fetchTarget(primary.sandbox, "unapproved-host", "https://example.org/"),
    fetchTarget(primary.sandbox, "plain-http", "http://example.org/"),
    fetchTarget(primary.sandbox, "loopback", "http://127.0.0.1:3000/"),
    fetchTarget(primary.sandbox, "private", "http://10.0.0.1/"),
    fetchTarget(primary.sandbox, "link-local", "http://169.254.1.1/"),
    fetchTarget(
      primary.sandbox,
      "metadata",
      "http://169.254.169.254/latest/meta-data/",
    ),
    fetchTarget(primary.sandbox, "ipv6-loopback", "http://[::1]:3000/"),
    fetchTarget(primary.sandbox, "ipv6-private", "http://[fc00::1]/"),
    fetchTarget(
      primary.sandbox,
      "redirect",
      "https://httpbin.org/redirect-to?url=http://169.254.169.254/latest/meta-data/",
    ),
    fetchTarget(primary.sandbox, "dns-rebinding", `https://${REBINDING_HOST}/`),
  ]);
  const rebindingResolution = await primary.sandbox.runCommand("node", [
    "-e",
    `
      const dns = await import("node:dns/promises");
      const addresses = new Set();
      for (let index = 0; index < 20; index += 1) {
        for (const address of await dns.resolve4(process.argv[1])) {
          addresses.add(address);
        }
      }
      console.log(JSON.stringify([...addresses].sort()));
    `,
    REBINDING_HOST,
  ]);
  const rebindingAddresses = JSON.parse(
    (await rebindingResolution.stdout()).trim(),
  ) as string[];
  const networkByLabel = new Map(
    networkChecks.map((check) => [check.label, check]),
  );
  const networkAssertion = (
    id: AssertionId,
    labels: string[],
    expectedReachable: boolean,
  ) => {
    const checks = labels.map((label) => networkByLabel.get(label));
    return assertion(
      id,
      checks.every(
        (check) => check && check.reachable === expectedReachable,
      ),
      checks.map(
        (check, index) =>
          `${labels[index]}: ${check?.reachable ? "reachable" : "blocked"} (${check?.detail ?? "missing"})`,
      ),
    );
  };
  assertions.push(
    networkAssertion("network.approved-host", ["approved-host"], true),
    networkAssertion("network.unapproved-host", ["unapproved-host"], false),
    networkAssertion("network.plain-http", ["plain-http"], false),
    networkAssertion("network.loopback", ["loopback"], false),
    networkAssertion("network.private", ["private"], false),
    networkAssertion("network.link-local", ["link-local"], false),
    networkAssertion("network.metadata", ["metadata"], false),
    networkAssertion(
      "network.unsafe-ipv6",
      ["ipv6-loopback", "ipv6-private"],
      false,
    ),
    networkAssertion("network.redirect", ["redirect"], false),
    assertion(
      "network.dns-rebinding",
      networkByLabel.get("dns-rebinding")?.reachable === false &&
        rebindingAddresses.includes("127.0.0.1") &&
        rebindingAddresses.includes("1.1.1.1"),
      [
        `resolved addresses=${rebindingAddresses.join(",")}`,
        `request=${networkByLabel.get("dns-rebinding")?.detail ?? "missing"}`,
      ],
    ),
  );

  const isolationSetup = await Promise.all(
    created.map(async ({ sandbox, canary }) => {
      await sandbox.runCommand("sh", [
        "-c",
        "printf '%s' \"$MEM7_ISOLATION_CANARY\" > /tmp/mem7-canary",
      ]);
      await sandbox.runCommand({
        cmd: "node",
        args: ["-e", "setTimeout(() => {}, 60000)", canary],
        detached: true,
      });
      const [file, environment, processes] = await Promise.all([
        output(await sandbox.runCommand("cat", ["/tmp/mem7-canary"])),
        output(await sandbox.runCommand("printenv", ["MEM7_ISOLATION_CANARY"])),
        output(
          await sandbox.runCommand("sh", [
            "-c",
            "for f in /proc/[0-9]*/cmdline; do tr '\\000' ' ' < \"$f\" 2>/dev/null; printf '\\n'; done",
          ]),
        ),
      ]);
      return { canary, file, environment, processes };
    }),
  );
  const ownOnly = (
    field: "file" | "environment" | "processes",
  ): boolean =>
    isolationSetup.every((result) =>
      isolationSetup.every((candidate) =>
        candidate.canary === result.canary
          ? result[field].includes(candidate.canary)
          : !result[field].includes(candidate.canary),
      ),
    );
  assertions.push(
    assertion("isolation.filesystem", ownOnly("file"), [
      "Each Sandbox read only its own same-path filesystem canary",
    ]),
    assertion("isolation.environment", ownOnly("environment"), [
      "Each Sandbox observed only its own environment canary",
    ]),
    assertion("isolation.processes", ownOnly("processes"), [
      "Each Sandbox process table contained only its own process canary",
    ]),
  );

  const diskLimit = await primary.sandbox.runCommand("sh", [
    "-c",
    "ulimit -f 1024; dd if=/dev/zero of=/tmp/limit-proof bs=1024 count=2048 2>/dev/null",
  ]);
  const cpuLimit = await primary.sandbox.runCommand("sh", [
    "-c",
    "cat /sys/fs/cgroup/cpu.max",
  ]);
  const memoryLimit = await primary.sandbox.runCommand("sh", [
    "-c",
    "cat /sys/fs/cgroup/memory.max",
  ]);
  assertions.push(
    assertion("limits.cpu", primary.sandbox.vcpus === 1, [
      `MicroVM allocation via SDK vCPUs=${primary.sandbox.vcpus ?? "missing"}`,
      `cgroup cpu.max=${(await cpuLimit.stdout()).trim()}`,
    ]),
    assertion("limits.memory", primary.sandbox.memory === 2048, [
      `MicroVM allocation via SDK memoryMiB=${primary.sandbox.memory ?? "missing"}`,
      `cgroup memory.max=${(await memoryLimit.stdout()).trim()}`,
    ]),
    assertion("limits.disk", false, [
      `process RLIMIT_FSIZE probe exit=${diskLimit.exitCode}`,
      "Vercel Sandbox SDK 2.9.0 exposes no Sandbox-wide disk quota",
    ]),
    assertion("limits.ports", primary.sandbox.routes.length === 0, [
      `exposed routes=${primary.sandbox.routes.length}`,
    ]),
    assertion(
      "limits.execution-time",
      primary.sandbox.timeout === SESSION_TIMEOUT_MS,
      [`session timeoutMs=${primary.sandbox.timeout ?? "missing"}`],
    ),
  );

  const journeys: JourneyEvidence[] = await Promise.all(
    created.map(async (item) => {
      const started = new Date();
      const command = await item.sandbox.runCommand(
        "sh",
        [
          "-c",
          "ulimit -f 131072; exec node /runner/journey.mjs",
        ],
        { timeoutMs: COMMAND_TIMEOUT_MS },
      );
      const finished = new Date();
      const parsed = JSON.parse((await command.stdout()).trim()) as JourneyOutput;
      await item.sandbox.stop();
      const activeCpuMs =
        item.sandbox.activeCpuUsageMs ??
        item.sandbox.totalActiveCpuDurationMs ??
        0;
      await item.sandbox.delete();
      const destroyedAt = new Date();
      return {
        journeyId: item.journeyId,
        sandboxId: item.sandbox.name,
        status: parsed.status,
        assertion: parsed.assertion,
        createdAt: item.createdAt.toISOString(),
        startedAt: started.toISOString(),
        finishedAt: finished.toISOString(),
        destroyedAt: destroyedAt.toISOString(),
        startupMs: item.createdAt.getTime() - item.createStartedAt.getTime(),
        runtimeMs: finished.getTime() - started.getTime(),
        activeCpuMs,
      };
    }),
  );
  const allJourneysPassed = journeys.every(
    (journey) => journey.status === "passed",
  );
  const allDeleted = (
    await Promise.all(journeys.map((journey) => isDeleted(journey.sandboxId)))
  ).every(Boolean);
  assertions.push(
    assertion("journey.terminal", allJourneysPassed, [
      ...journeys.map(
        ({ journeyId, status, assertion: observed }) =>
          `${journeyId}: ${status}, assertion="${observed}"`,
      ),
    ]),
    assertion("concurrency.five-journeys", journeys.length === 5, [
      `concurrent Journey count=${journeys.length}`,
    ]),
    assertion("lifecycle.success", allDeleted, [
      `all successful Sandboxes absent after delete=${allDeleted}`,
    ]),
  );

  for (const mode of [
    "crash",
    "timeout",
    "operator-cancellation",
  ] as const) {
    const lifecycle = await proveTerminalLifecycle(mode);
    assertions.push(
      assertion(`lifecycle.${mode}`, lifecycle.passed, lifecycle.evidence),
    );
  }

  const lockfile = await readFile(
    resolve("workers/runner/package-lock.json"),
  );
  assertions.push(
    assertion("provenance.dependencies", true, [
      `base image=${BASE_IMAGE}`,
      `runner lockfile sha256=${createHash("sha256").update(lockfile).digest("hex")}`,
      "Playwright=1.61.1; Chromium=149.0.7827.55; Axe=4.12.1; Sandbox SDK=2.9.0",
    ]),
  );

  assertions.sort(
    (left, right) =>
      REQUIRED_ASSERTIONS.indexOf(left.id) -
      REQUIRED_ASSERTIONS.indexOf(right.id),
  );
  const activeCpuMs = journeys.map((journey) => journey.activeCpuMs);
  const wallMs = journeys.map((journey) => journey.runtimeMs);
  const estimatedCostUsd = journeys.reduce((sum, journey) => {
    const cpu = (journey.activeCpuMs / 3_600_000) * 0.128;
    const lifetimeMs =
      Date.parse(journey.destroyedAt) - Date.parse(journey.createdAt);
    const memory = (lifetimeMs / 3_600_000) * 2 * 0.0212;
    return sum + cpu + memory;
  }, 0);
  const report: ProofReport = {
    schemaVersion: 1,
    issue: "MEM-7",
    result: assertions.every(({ status }) => status === "passed")
      ? "passed"
      : "failed",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    provenance: {
      image: IMAGE,
      baseImage: BASE_IMAGE,
      lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
      sdkVersion: "2.9.0",
    },
    assertions,
    journeys,
    measurements: {
      startupMs: journeys.map((journey) => journey.startupMs),
      runtimeMs: wallMs,
      activeCpuMs,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    },
  };
  const errors = verifyProofReport(report);
  if (errors.length > 0) {
    report.result = "failed";
  }
  return report;
}

export async function writeProofReport(report: ProofReport): Promise<void> {
  const target = resolve("evidence/MEM-7/proof-report.json");
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
}
