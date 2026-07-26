import { describe, expect, it } from "vitest";

import {
  executeJourney,
  type DisposableSandbox,
  type SandboxFactory,
} from "./orchestrator.js";

describe("disposable Journey execution", () => {
  it("returns a terminal result and destroys the Sandbox after success", async () => {
    const events: string[] = [];
    const sandbox: DisposableSandbox = {
      id: "sandbox-one",
      async runJourney() {
        events.push("journey");
        return {
          status: "passed",
          assertion: "Synthetic checkout completed",
          durationMs: 42,
        };
      },
      async destroy() {
        events.push("destroy");
      },
    };
    const factory: SandboxFactory = {
      async create() {
        events.push("create");
        return sandbox;
      },
    };

    await expect(
      executeJourney(factory, {
        journeyId: "synthetic-checkout",
        cancellation: new AbortController().signal,
      }),
    ).resolves.toEqual({
      sandboxId: "sandbox-one",
      status: "passed",
      assertion: "Synthetic checkout completed",
      durationMs: 42,
      destroyed: true,
    });
    expect(events).toEqual(["create", "journey", "destroy"]);
  });

  it.each([
    {
      name: "crash",
      error: new Error("worker exited"),
      expected: "crashed",
    },
    {
      name: "timeout",
      error: new DOMException("command timed out", "TimeoutError"),
      expected: "timed-out",
    },
    {
      name: "operator cancellation",
      error: new DOMException("operator cancelled", "AbortError"),
      expected: "cancelled",
    },
  ] as const)(
    "destroys the Sandbox and returns a terminal result after $name",
    async ({ error, expected }) => {
      let destroyed = false;
      const factory: SandboxFactory = {
        async create() {
          return {
            id: "sandbox-terminal",
            async runJourney() {
              throw error;
            },
            async destroy() {
              destroyed = true;
            },
          };
        },
      };

      await expect(
        executeJourney(factory, {
          journeyId: "synthetic-checkout",
          cancellation: new AbortController().signal,
        }),
      ).resolves.toMatchObject({
        sandboxId: "sandbox-terminal",
        status: expected,
        destroyed: true,
      });
      expect(destroyed).toBe(true);
    },
  );
});
