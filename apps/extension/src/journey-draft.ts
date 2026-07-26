export interface ElementDescription {
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  testId: string | null;
  cssPath: string | null;
  inputType: string | null;
}

export type JourneyLocator =
  | {
      strategy: "role";
      role: string;
      name: string;
    }
  | {
      strategy: "test-id";
      testId: string;
    }
  | {
      strategy: "css";
      selector: string;
      lastResort: true;
    };

export type JourneyAction =
  | {
      kind: "click";
      locator: JourneyLocator;
    }
  | {
      kind: "fill";
      locator: JourneyLocator;
      input: {
        source: "runtime-variable";
        inputType: string;
      };
    };

export type CapturedAction =
  | {
      kind: "click";
      element: ElementDescription;
      recordedAt: string;
    }
  | {
      kind: "fill";
      element: ElementDescription;
      value?: string;
      recordedAt: string;
    };

export type RecorderStatus = "disconnected" | "recording" | "paused" | "error";

export interface RecorderAssertion {
  id: string;
  kind: "text-visible";
  text: string;
  confirmed: boolean;
}

export interface RecorderSession {
  schemaVersion: 1;
  approvedOrigin: string;
  status: RecorderStatus;
  actions: JourneyAction[];
  assertions: RecorderAssertion[];
  errorMessage: string | null;
  measurements: {
    startedAt: string | null;
    firstActionAt: string | null;
    reconnectCount: number;
  };
}

export interface JourneyDraft {
  schemaVersion: 1;
  name: string;
  approvedOrigin: string;
  steps: JourneyAction[];
  expect: Array<{
    kind: "text-visible";
    text: string;
  }>;
  measurements: {
    firstActionLatencyMs: number | null;
    reconnectCount: number;
    recordingDurationMs: number;
  };
}

const FORBIDDEN_EXPORT_KEY =
  /cookie|storageState|localStorage|sessionStorage|password|token|credential|requestBody|responseBody/i;

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_EXPORT_KEY.test(key) || containsForbiddenKey(child),
  );
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

export function verifyJourneyDraft(draft: JourneyDraft): string[] {
  const errors: string[] = [];
  if (draft.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (!draft.name || draft.name.length > 120) errors.push("invalid Journey name");
  if (draft.steps.length === 0 || draft.steps.length > 100) {
    errors.push("Journey must contain 1 to 100 steps");
  }
  if (draft.expect.length === 0 || draft.expect.length > 20) {
    errors.push("Journey must contain 1 to 20 confirmed assertions");
  }
  if (containsForbiddenKey(draft)) {
    errors.push("Journey contains a forbidden browser-session or credential field");
  }
  draft.steps.forEach((step, index) => {
    const locator = step.locator;
    if (
      (locator.strategy === "role" &&
        (!isBoundedText(locator.role, 120) || !isBoundedText(locator.name, 120))) ||
      (locator.strategy === "test-id" && !isBoundedText(locator.testId, 120)) ||
      (locator.strategy === "css" &&
        (!isBoundedText(locator.selector, 500) || locator.lastResort !== true))
    ) {
      errors.push(`step ${index + 1} has an invalid locator`);
    }
    if (
      step.kind === "fill" &&
      (step.input.source !== "runtime-variable" ||
        !isBoundedText(step.input.inputType, 40))
    ) {
      errors.push(`step ${index + 1} has invalid redacted input intent`);
    }
  });
  draft.expect.forEach((assertion, index) => {
    if (
      assertion.kind !== "text-visible" ||
      !isBoundedText(assertion.text, 120)
    ) {
      errors.push(`assertion ${index + 1} is invalid`);
    }
  });
  try {
    normalizeOrigin(draft.approvedOrigin);
  } catch {
    errors.push("invalid approved Project origin");
  }
  return errors;
}

function normalizeOrigin(value: string): string {
  const parsed = new URL(value);

  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && parsed.hostname === "localhost")
  ) {
    throw new Error("The approved Project origin must use HTTPS");
  }

  return parsed.origin;
}

function elapsedMs(start: string, finish: string): number {
  const result = Date.parse(finish) - Date.parse(start);
  if (!Number.isFinite(result) || result < 0) {
    throw new Error("Recorder timestamps must be valid and monotonic");
  }
  return result;
}

export function createRecorderSession(approvedOrigin: string): RecorderSession {
  return {
    schemaVersion: 1,
    approvedOrigin: normalizeOrigin(approvedOrigin),
    status: "disconnected",
    actions: [],
    assertions: [],
    errorMessage: null,
    measurements: {
      startedAt: null,
      firstActionAt: null,
      reconnectCount: 0,
    },
  };
}

export function startRecorder(
  session: RecorderSession,
  input: {
    selectedOrigin: string;
    startedAt: string;
  },
): RecorderSession {
  if (normalizeOrigin(input.selectedOrigin) !== session.approvedOrigin) {
    throw new Error("Selected tab does not match the approved Project origin");
  }

  if (!Number.isFinite(Date.parse(input.startedAt))) {
    throw new Error("Recorder start time is invalid");
  }

  return {
    ...session,
    status: "recording",
    actions: [],
    assertions: [],
    errorMessage: null,
    measurements: {
      startedAt: input.startedAt,
      firstActionAt: null,
      reconnectCount: 0,
    },
  };
}

export function pauseRecorder(session: RecorderSession): RecorderSession {
  if (session.status !== "recording") {
    throw new Error("Only an active recording can be paused");
  }
  return { ...session, status: "paused" };
}

export function resumeRecorder(
  session: RecorderSession,
  reconnectedAt: string,
): RecorderSession {
  if (session.status !== "paused" && session.status !== "disconnected") {
    throw new Error("Only a paused or disconnected recorder can resume");
  }
  if (!Number.isFinite(Date.parse(reconnectedAt))) {
    throw new Error("Recorder reconnect time is invalid");
  }
  return {
    ...session,
    status: "recording",
    errorMessage: null,
    measurements: {
      ...session.measurements,
      reconnectCount: session.measurements.reconnectCount + 1,
    },
  };
}

export function recordAction(
  session: RecorderSession,
  action: CapturedAction,
  receivedAt: string,
): RecorderSession {
  if (session.status !== "recording") {
    return session;
  }
  if (session.actions.length >= 100) {
    throw new Error("Journey action limit reached");
  }

  return {
    ...session,
    actions: [...session.actions, captureAction(action)],
    measurements: {
      ...session.measurements,
      firstActionAt: session.measurements.firstActionAt ?? receivedAt,
    },
  };
}

function sanitizeAssertionText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!normalized) {
    throw new Error("Suggested assertion text is empty");
  }
  return normalized
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b(?:bearer|token|password)\s*[:=]?\s*\S+/gi, "[redacted-secret]");
}

export function suggestAssertion(
  session: RecorderSession,
  suggestion: { id: string; text: string },
): RecorderSession {
  if (
    session.assertions.length >= 20 &&
    !session.assertions.some((assertion) => assertion.id === suggestion.id)
  ) {
    throw new Error("Journey assertion limit reached");
  }
  return {
    ...session,
    assertions: [
      ...session.assertions.filter((assertion) => assertion.id !== suggestion.id),
      {
        id: suggestion.id,
        kind: "text-visible",
        text: sanitizeAssertionText(suggestion.text),
        confirmed: false,
      },
    ],
  };
}

export function confirmAssertion(
  session: RecorderSession,
  assertionId: string,
): RecorderSession {
  if (!session.assertions.some((assertion) => assertion.id === assertionId)) {
    throw new Error("The suggested assertion no longer exists");
  }
  return {
    ...session,
    assertions: session.assertions.map((assertion) =>
      assertion.id === assertionId
        ? {
            ...assertion,
            confirmed: true,
          }
        : assertion,
    ),
  };
}

export function exportJourneyDraft(
  session: RecorderSession,
  input: { name: string; exportedAt: string },
): JourneyDraft {
  const startedAt = session.measurements.startedAt;
  if (!startedAt) {
    throw new Error("Start recording before exporting a Journey draft");
  }

  const confirmed = session.assertions.filter((assertion) => assertion.confirmed);
  if (confirmed.length === 0) {
    throw new Error("Confirm at least one task-completion assertion");
  }

  const name = input.name.trim().slice(0, 120);
  if (!name) {
    throw new Error("Journey name is required");
  }

  const draft: JourneyDraft = {
    schemaVersion: 1,
    name,
    approvedOrigin: session.approvedOrigin,
    steps: session.actions,
    expect: confirmed.map((assertion) => ({
      kind: assertion.kind,
      text: assertion.text,
    })),
    measurements: {
      firstActionLatencyMs: session.measurements.firstActionAt
        ? elapsedMs(startedAt, session.measurements.firstActionAt)
        : null,
      reconnectCount: session.measurements.reconnectCount,
      recordingDurationMs: elapsedMs(startedAt, input.exportedAt),
    },
  };

  const errors = verifyJourneyDraft(draft);
  if (errors.length > 0) {
    throw new Error(`Journey draft is invalid: ${errors.join("; ")}`);
  }
  return draft;
}

export function chooseLocator(element: ElementDescription): JourneyLocator {
  if (element.role && element.accessibleName) {
    return {
      strategy: "role",
      role: element.role,
      name: element.accessibleName,
    };
  }

  if (element.testId) {
    return {
      strategy: "test-id",
      testId: element.testId,
    };
  }

  if (element.cssPath) {
    return {
      strategy: "css",
      selector: element.cssPath,
      lastResort: true,
    };
  }

  throw new Error("The action target has no replayable locator");
}

export function captureAction(action: CapturedAction): JourneyAction {
  const locator = chooseLocator(action.element);

  if (action.kind === "fill") {
    return {
      kind: "fill",
      locator,
      input: {
        source: "runtime-variable",
        inputType: action.element.inputType ?? "text",
      },
    };
  }

  return {
    kind: "click",
    locator,
  };
}
