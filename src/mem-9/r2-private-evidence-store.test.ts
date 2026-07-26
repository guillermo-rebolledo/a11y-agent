import { describe, expect, it, vi } from "vitest";

import { R2PrivateEvidenceStore } from "./r2-private-evidence-store.js";

describe("MEM-9 Cloudflare R2 adapter", () => {
  it("writes private no-store evidence and signs only short reads", async () => {
    const bucket = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const signReadUrl = vi
      .fn()
      .mockResolvedValue("https://r2.example.invalid/signed");
    const store = new R2PrivateEvidenceStore(bucket, signReadUrl);

    await store.put({
      key: `evidence/${"a".repeat(64)}.json`,
      body: "{}\n",
      contentType: "application/json",
      cacheControl: "private, no-store",
      customMetadata: {
        auditRunId: "audit-01JZ8F2V6YB5FQX0MB7K2CS4RA",
        projectId: "project-01JZ8H8Y04R5RXW8YE1T0J5DVQ",
        contentSha256: "b".repeat(64),
      },
    });
    await store.delete(`evidence/${"a".repeat(64)}.json`);
    await expect(
      store.issueReadUrl(`evidence/${"a".repeat(64)}.json`, 300),
    ).resolves.toBe("https://r2.example.invalid/signed");

    expect(bucket.put).toHaveBeenCalledWith(
      `evidence/${"a".repeat(64)}.json`,
      "{}\n",
      {
        httpMetadata: {
          contentType: "application/json",
          cacheControl: "private, no-store",
        },
        customMetadata: expect.objectContaining({
          auditRunId: "audit-01JZ8F2V6YB5FQX0MB7K2CS4RA",
        }),
      },
    );
    expect(signReadUrl).toHaveBeenCalledWith(
      `evidence/${"a".repeat(64)}.json`,
      300,
    );
  });

  it("refuses a signer request longer than five minutes", async () => {
    const store = new R2PrivateEvidenceStore(
      {
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      vi.fn(),
    );

    await expect(
      store.issueReadUrl(`evidence/${"a".repeat(64)}.json`, 301),
    ).rejects.toThrow("at most 300 seconds");
  });
});
