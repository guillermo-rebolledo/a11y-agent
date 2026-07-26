import type { JourneyDraft, RecorderSession } from "./journey-draft.js";

type Response<T> = { ok: true; result: T } | { ok: false; error: string };

const required = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element as T;
};

const statusElement = required<HTMLParagraphElement>("status");
const originInput = required<HTMLInputElement>("approved-origin");
const actionList = required<HTMLOListElement>("actions");
const assertionList = required<HTMLUListElement>("assertions");
const emptyActions = required<HTMLParagraphElement>("empty-actions");
const emptyAssertions = required<HTMLParagraphElement>("empty-assertions");

async function send<T>(message: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as Response<T>;
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

function locatorLabel(session: RecorderSession, index: number): string {
  const locator = session.actions[index]?.locator;
  if (!locator) return "Unknown action";
  if (locator.strategy === "role") return `${locator.role} “${locator.name}”`;
  if (locator.strategy === "test-id") return `test ID “${locator.testId}”`;
  return `last-resort selector “${locator.selector}”`;
}

function render(session: RecorderSession | null): void {
  const status = session?.status ?? "disconnected";
  const statusLabels: Record<RecorderSession["status"], string> = {
    recording: "Recording selected tab",
    paused: "Recorder paused",
    disconnected: "Recorder disconnected",
    error: `Recorder error: ${session?.errorMessage ?? "Unknown error"}`,
  };
  statusElement.textContent = statusLabels[status];

  if (!session) return;
  originInput.value = session.approvedOrigin;

  actionList.replaceChildren(
    ...session.actions.map((action, index) => {
      const item = document.createElement("li");
      item.textContent = `${action.kind === "fill" ? "Enter runtime value in" : "Activate"} ${locatorLabel(session, index)}`;
      return item;
    }),
  );
  emptyActions.hidden = session.actions.length > 0;

  assertionList.replaceChildren(
    ...session.assertions.map((assertion) => {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = `${assertion.text}${assertion.confirmed ? " — confirmed" : ""}`;
      item.append(text);
      if (!assertion.confirmed) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Confirm assertion";
        button.addEventListener("click", () => {
          void run(async () =>
            send<RecorderSession>({
              type: "confirm-assertion",
              assertionId: assertion.id,
            }),
          );
        });
        item.append(button);
      }
      return item;
    }),
  );
  emptyAssertions.hidden = session.assertions.length > 0;

  required<HTMLButtonElement>("start").disabled = status === "recording";
  required<HTMLButtonElement>("pause").disabled = status !== "recording";
  required<HTMLButtonElement>("resume").disabled =
    status !== "paused" && status !== "disconnected";
  required<HTMLButtonElement>("disconnect").disabled = status === "disconnected";
}

async function run(action: () => Promise<RecorderSession>): Promise<void> {
  try {
    render(await action());
  } catch (error) {
    statusElement.textContent = `Recorder error: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}

required<HTMLFormElement>("origin-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void run(async () =>
    send<RecorderSession>({
      type: "configure-origin",
      approvedOrigin: originInput.value,
    }),
  );
});

for (const type of ["start", "pause", "resume", "disconnect"] as const) {
  required<HTMLButtonElement>(type).addEventListener("click", () => {
    void run(async () => send<RecorderSession>({ type }));
  });
}

function downloadDraft(draft: JourneyDraft): void {
  const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "journey"}.journey.json`;
  link.click();
  URL.revokeObjectURL(url);
}

required<HTMLFormElement>("export-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = required<HTMLInputElement>("journey-name").value;
  void (async () => {
    try {
      downloadDraft(await send<JourneyDraft>({ type: "export", name }));
      statusElement.textContent = "Journey draft exported";
    } catch (error) {
      statusElement.textContent = `Recorder error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  })();
});

void run(async () => send<RecorderSession | null>({ type: "get-state" }).then((s) => {
  if (!s) {
    return {
      schemaVersion: 1,
      approvedOrigin: "",
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
  return s;
}));
