import {
  confirmAssertion,
  createRecorderSession,
  exportJourneyDraft,
  pauseRecorder,
  recordAction,
  resumeRecorder,
  startRecorder,
  suggestAssertion,
  type CapturedAction,
  type RecorderSession,
} from "./journey-draft.js";

const SESSION_KEY = "recorderSession";
const ACTIVE_TAB_KEY = "activeRecorderTabId";
let requestQueue: Promise<void> = Promise.resolve();

type RecorderMessage =
  | { type: "get-state" }
  | { type: "configure-origin"; approvedOrigin: string }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "disconnect" }
  | { type: "captured-action"; action: CapturedAction }
  | { type: "assertion-suggested"; suggestion: { id: string; text: string } }
  | { type: "recorder-disconnected" }
  | { type: "confirm-assertion"; assertionId: string }
  | { type: "export"; name: string };

async function readSession(): Promise<RecorderSession | null> {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return (stored[SESSION_KEY] as RecorderSession | undefined) ?? null;
}

async function writeSession(session: RecorderSession): Promise<RecorderSession> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const browserWindow = await chrome.windows.getLastFocused({
    populate: true,
    windowTypes: ["normal"],
  });
  const tab = browserWindow.tabs?.find((candidate) => candidate.active);
  if (!tab?.id || !tab.url) {
    throw new Error("Select a normal browser tab before starting");
  }
  return tab;
}

async function setContentEnabled(tabId: number, enabled: boolean): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (nextEnabled: boolean) => {
      const targetWindow = window as Window & {
        __a11yJourneyRecorderEnabled?: boolean;
      };
      targetWindow.__a11yJourneyRecorderEnabled = nextEnabled;
    },
    args: [enabled],
  });
}

async function start(): Promise<RecorderSession> {
  const session = await readSession();
  if (!session) throw new Error("Save an approved Project origin first");

  const tab = await activeTab();
  const next = startRecorder(session, {
    selectedOrigin: new URL(tab.url!).origin,
    startedAt: new Date().toISOString(),
  });

  const previous = await chrome.storage.local.get(ACTIVE_TAB_KEY);
  const previousTabId = previous[ACTIVE_TAB_KEY];
  if (typeof previousTabId === "number" && previousTabId !== tab.id) {
    try {
      await setContentEnabled(previousTabId, false);
    } catch {
      // Sender validation below still rejects the previous tab.
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    files: ["dist/content.js"],
  });
  await chrome.storage.local.set({ [ACTIVE_TAB_KEY]: tab.id });
  await writeSession(next);
  try {
    await setContentEnabled(tab.id!, true);
    return next;
  } catch (error) {
    await writeSession({
      ...next,
      status: "error",
      errorMessage:
        error instanceof Error ? error.message : "Could not connect to selected tab",
    });
    throw error;
  }
}

async function updateContent(enabled: boolean): Promise<void> {
  const stored = await chrome.storage.local.get(ACTIVE_TAB_KEY);
  const tabId = stored[ACTIVE_TAB_KEY];
  if (typeof tabId === "number") {
    try {
      await setContentEnabled(tabId, enabled);
    } catch {
      // The selected tab navigated or closed; the visible state still updates.
    }
  }
}

async function reconnectContent(session: RecorderSession): Promise<void> {
  const stored = await chrome.storage.local.get(ACTIVE_TAB_KEY);
  const tabId = stored[ACTIVE_TAB_KEY];
  if (typeof tabId !== "number") {
    throw new Error("The selected tab is no longer connected; start again");
  }
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== session.approvedOrigin) {
    throw new Error("The selected tab left the approved Project origin");
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["dist/content.js"],
  });
  await setContentEnabled(tabId, true);
}

async function handle(
  message: RecorderMessage,
  senderTabId: number | undefined,
): Promise<unknown> {
  if (message.type === "get-state") return readSession();

  if (message.type === "configure-origin") {
    return writeSession(createRecorderSession(message.approvedOrigin));
  }

  if (message.type === "start") return start();

  const session = await readSession();
  if (!session) throw new Error("Save an approved Project origin first");

  if (
    message.type === "captured-action" ||
    message.type === "assertion-suggested" ||
    message.type === "recorder-disconnected"
  ) {
    const stored = await chrome.storage.local.get(ACTIVE_TAB_KEY);
    if (
      typeof senderTabId !== "number" ||
      stored[ACTIVE_TAB_KEY] !== senderTabId
    ) {
      return session;
    }
  }

  switch (message.type) {
    case "pause": {
      await updateContent(false);
      return writeSession(pauseRecorder(session));
    }
    case "resume": {
      await reconnectContent(session);
      return writeSession(resumeRecorder(session, new Date().toISOString()));
    }
    case "disconnect": {
      await updateContent(false);
      await chrome.storage.local.remove(ACTIVE_TAB_KEY);
      return writeSession({ ...session, status: "disconnected" });
    }
    case "captured-action":
      return writeSession(
        recordAction(session, message.action, new Date().toISOString()),
      );
    case "assertion-suggested":
      return writeSession(suggestAssertion(session, message.suggestion));
    case "recorder-disconnected":
      return writeSession({ ...session, status: "disconnected" });
    case "confirm-assertion":
      return writeSession(confirmAssertion(session, message.assertionId));
    case "export":
      return exportJourneyDraft(session, {
        name: message.name,
        exportedAt: new Date().toISOString(),
      });
  }
}

chrome.runtime.onMessage.addListener(
  (message: RecorderMessage, sender, sendResponse) => {
    const response = requestQueue.then(() => handle(message, sender.tab?.id));
    requestQueue = response.then(
      () => undefined,
      () => undefined,
    );
    void response
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Recorder error",
        }),
      );
    return true;
  },
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.local.get(ACTIVE_TAB_KEY).then(async (stored) => {
    if (stored[ACTIVE_TAB_KEY] !== tabId) return;
    const session = await readSession();
    if (session) {
      await writeSession({ ...session, status: "disconnected" });
    }
    await chrome.storage.local.remove(ACTIVE_TAB_KEY);
  });
});
