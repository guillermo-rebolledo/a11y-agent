import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

const repository = new URL("../../../", import.meta.url);
const release = new URL("apps/extension/release/", repository);
const artifacts = new URL("artifacts/", repository);
const archive = new URL("a11y-journey-recorder-0.1.0.zip", artifacts);
const releasePath = fileURLToPath(release);

await mkdir(artifacts, { recursive: true });
await rm(archive, { force: true });
const files = (
  await readdir(release, { recursive: true, withFileTypes: true })
)
  .filter((entry) => entry.isFile())
  .map((entry) => relative(releasePath, join(entry.parentPath, entry.name)))
  .sort();
const reproducibleTime = new Date("2026-07-26T00:00:00.000Z");
await Promise.all(
  files.map((file) => utimes(new URL(file, release), reproducibleTime, reproducibleTime)),
);
const zip = spawnSync(
  "zip",
  ["-X", "-q", archive.pathname, ...files],
  { cwd: release, encoding: "utf8" },
);
if (zip.status !== 0) {
  throw new Error(zip.stderr || "Could not package the extension");
}

const digest = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
await writeFile(
  `${archive.pathname}.sha256`,
  `${digest}  ${archive.pathname.split("/").at(-1)}\n`,
);
process.stdout.write(`${digest}\n`);
