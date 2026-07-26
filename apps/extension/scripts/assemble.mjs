import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const release = new URL("release/", root);

await mkdir(release, { recursive: true });
const contentScriptSource = new URL("release/dist/content.cjs", root);
const commonJsPreamble =
  '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n';
const compiledContentScript = await readFile(contentScriptSource, "utf8");
if (!compiledContentScript.startsWith(commonJsPreamble)) {
  throw new Error("Unexpected content-script compiler output");
}
await writeFile(
  new URL("release/dist/content.js", root),
  compiledContentScript.slice(commonJsPreamble.length),
);
await rm(new URL("release/dist/content.cjs", root));
for (const file of [
  "manifest.json",
  "popup.html",
  "popup.css",
  "journey-draft.schema.json",
]) {
  await cp(new URL(file, root), new URL(file, release));
}

await rm(new URL(".DS_Store", release), { force: true });
