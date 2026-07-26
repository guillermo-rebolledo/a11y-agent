import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  verifyJourneyDraft,
  type JourneyDraft,
} from "../../apps/extension/src/journey-draft.js";

describe("private-pilot Extension Recorder artifact", () => {
  it("uses explicit selected-tab access without sensitive browser permissions", async () => {
    const manifest = JSON.parse(
      await readFile(
        new URL("../../apps/extension/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as {
      manifest_version: number;
      permissions: string[];
      host_permissions?: string[];
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest.permissions).not.toEqual(
      expect.arrayContaining([
        "cookies",
        "proxy",
        "history",
        "downloads",
        "debugger",
      ]),
    );
  });

  it("packages the injected file as a classic JavaScript content script", async () => {
    const contentScript = await readFile(
      new URL("../../apps/extension/release/dist/content.js", import.meta.url),
      "utf8",
    );

    expect(contentScript).not.toMatch(/\b(?:export|exports)\b/);
    expect(contentScript).toContain("install();");
  });

  it("rejects forbidden browser-session fields from an otherwise valid draft", () => {
    const malformed = {
      schemaVersion: 1,
      name: "Invite team member",
      approvedOrigin: "https://pilot.example",
      steps: [
        {
          kind: "click",
          locator: {
            strategy: "role",
            role: "button",
            name: "Invite",
          },
        },
      ],
      expect: [{ kind: "text-visible", text: "Invitation sent" }],
      measurements: {
        firstActionLatencyMs: 100,
        reconnectCount: 0,
        recordingDurationMs: 1_000,
      },
      storageState: { cookies: [] },
    } as unknown as JourneyDraft;

    expect(verifyJourneyDraft(malformed)).toContain(
      "Journey contains a forbidden browser-session or credential field",
    );
  });

  it("validates the representative exported Journey without its entered value", async () => {
    const exportedSource = await readFile(
      new URL("../../evidence/MEM-8/journey-draft.json", import.meta.url),
      "utf8",
    );
    const exported = JSON.parse(exportedSource) as JourneyDraft;

    expect(verifyJourneyDraft(exported)).toEqual([]);
    expect(exportedSource).not.toContain("synthetic@example.test");
  });
});
