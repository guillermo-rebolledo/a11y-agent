import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  cleanupMem7Sandboxes,
  runLiveProof,
  writeProofReport,
} from "./live-proof.js";
import { type ProofReport, verifyProofReport } from "./report.js";

const command = process.argv[2];
const reportPath = resolve("evidence/MEM-7/proof-report.json");

if (command === "run") {
  try {
    const report = await runLiveProof();
    await writeProofReport(report);
    process.stdout.write(
      `${JSON.stringify({
        result: report.result,
        reportPath,
        measurements: report.measurements,
      })}\n`,
    );
    process.exitCode = report.result === "passed" ? 0 : 1;
  } catch (error) {
    await cleanupMem7Sandboxes();
    throw error;
  }
} else if (command === "verify") {
  const report = JSON.parse(await readFile(reportPath, "utf8")) as ProofReport;
  const errors = verifyProofReport(report);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Verified passing MEM-7 evidence: ${reportPath}\n`);
  }
} else {
  process.stderr.write("Usage: cli.ts <run|verify>\n");
  process.exitCode = 2;
}
