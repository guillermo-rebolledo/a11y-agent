import { describe, expect, it } from "vitest";

import {
  assertBrowserCanariesAbsent,
  createBrowserCanaries,
} from "../mem-22/browser-canaries.js";

describe("MEM-9 browser-job canary flow", () => {
  it("seeds email, phone, token, cookie, and secret canaries", () => {
    expect(
      createBrowserCanaries({
        loginEmail: "synthetic-login@example.invalid",
        loginSecret: "synthetic-secret",
        journeyIndex: "1",
      }),
    ).toEqual({
      email: "journey-1@example.invalid",
      phone: "+1 (415) 555-0199",
      token: "ghp_012345678901234567890123456789012345",
      cookie: "synthetic-session=browser-job-only",
      secret: "synthetic-secret",
      loginEmail: "synthetic-login@example.invalid",
    });
  });

  it("fails artifact creation when any seeded browser canary survives", () => {
    const canaries = createBrowserCanaries({
      loginEmail: "synthetic-login@example.invalid",
      loginSecret: "synthetic-secret",
      journeyIndex: "1",
    });

    for (const canary of Object.values(canaries)) {
      expect(() =>
        assertBrowserCanariesAbsent(`{"artifact":"${canary}"}`, canaries),
      ).toThrow("Sensitive browser material reached the Evidence Bundle");
    }
    expect(() =>
      assertBrowserCanariesAbsent('{"status":"passed"}', canaries),
    ).not.toThrow();
  });
});
