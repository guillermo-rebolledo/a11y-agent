export type JourneyTerminalResult = {
  status: "passed" | "failed" | "crashed" | "timed-out" | "cancelled";
  assertion: string;
  durationMs: number;
};

export type DisposableSandbox = {
  readonly id: string;
  runJourney(input: {
    journeyId: string;
    cancellation: AbortSignal;
  }): Promise<JourneyTerminalResult>;
  destroy(): Promise<void>;
};

export type SandboxFactory = {
  create(): Promise<DisposableSandbox>;
};

export type JourneyExecutionResult = JourneyTerminalResult & {
  sandboxId: string;
  destroyed: boolean;
};

export async function executeJourney(
  factory: SandboxFactory,
  input: {
    journeyId: string;
    cancellation: AbortSignal;
  },
): Promise<JourneyExecutionResult> {
  const sandbox = await factory.create();

  try {
    const result = await sandbox.runJourney(input);
    return { sandboxId: sandbox.id, ...result, destroyed: true };
  } catch (error) {
    const status =
      error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : error instanceof DOMException && error.name === "TimeoutError"
          ? "timed-out"
          : "crashed";

    return {
      sandboxId: sandbox.id,
      status,
      assertion: error instanceof Error ? error.message : "Unknown worker error",
      durationMs: 0,
      destroyed: true,
    };
  } finally {
    await sandbox.destroy();
  }
}
