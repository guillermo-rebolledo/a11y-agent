type ElementDescription = {
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  testId: string | null;
  cssPath: string | null;
  inputType: string | null;
};

(() => {
const recorderWindow = window as Window & {
  __a11yJourneyRecorderInstalled?: boolean;
  __a11yJourneyRecorderEnabled?: boolean;
};
const NATIVE_ROLES: Readonly<Record<string, string>> = {
  a: "link",
  button: "button",
  select: "combobox",
  textarea: "textbox",
};

function normalizeText(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, 120);
  return normalized || null;
}

function accessibleName(element: HTMLElement): string | null {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    const normalized = normalizeText(label);
    if (normalized) return normalized;
  }

  const ariaLabel = normalizeText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const label = element.labels?.[0];
    const normalized = normalizeText(label?.textContent ?? null);
    if (normalized) return normalized;
  }

  if (element instanceof HTMLImageElement) {
    return normalizeText(element.alt);
  }

  return normalizeText(element.textContent);
}

function roleFor(element: HTMLElement): string | null {
  const explicit = normalizeText(element.getAttribute("role"));
  if (explicit) return explicit;
  if (element instanceof HTMLInputElement) {
    if (["button", "submit", "reset"].includes(element.type)) return "button";
    if (element.type === "checkbox") return "checkbox";
    if (element.type === "radio") return "radio";
    return "textbox";
  }
  return NATIVE_ROLES[element.tagName.toLowerCase()] ?? null;
}

function cssPath(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;

  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (sibling) => sibling.tagName === current?.tagName,
        )
      : [];
    const suffix =
      siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
    parts.unshift(`${tag}${suffix}`);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function describe(element: HTMLElement): ElementDescription {
  return {
    tagName: element.tagName.toLowerCase(),
    role: roleFor(element),
    accessibleName: accessibleName(element),
    testId:
      normalizeText(element.getAttribute("data-testid")) ??
      normalizeText(element.getAttribute("data-test-id")),
    cssPath: cssPath(element),
    inputType:
      element instanceof HTMLInputElement
        ? element.type || "text"
        : element instanceof HTMLTextAreaElement
          ? "textarea"
          : null,
  };
}

function sendAction(kind: "click" | "fill", element: HTMLElement): void {
  if (!recorderWindow.__a11yJourneyRecorderEnabled) return;
  void chrome.runtime.sendMessage({
    type: "captured-action",
    action: {
      kind,
      element: describe(element),
      recordedAt: new Date().toISOString(),
    },
  });
}

function install(): void {
  if (recorderWindow.__a11yJourneyRecorderInstalled) return;
  recorderWindow.__a11yJourneyRecorderInstalled = true;

  document.addEventListener(
    "click",
    (event) => {
      const element =
        event.target instanceof HTMLElement
          ? event.target
          : event.target instanceof Element
            ? event.target.parentElement
            : null;
      if (element) sendAction("click", element);
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      const element =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
          ? event.target
          : null;
      if (element) sendAction("fill", element);
    },
    true,
  );

  const observer = new MutationObserver((records) => {
    if (!recorderWindow.__a11yJourneyRecorderEnabled) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const liveElement = node.matches("[role='status'], [role='alert'], [aria-live]")
          ? node
          : node.querySelector<HTMLElement>("[role='status'], [role='alert'], [aria-live]");
        const text = liveElement ? normalizeText(liveElement.textContent) : null;
        if (text) {
          void chrome.runtime.sendMessage({
            type: "assertion-suggested",
            suggestion: {
              id: crypto.randomUUID(),
              text,
            },
          });
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => {
    if (recorderWindow.__a11yJourneyRecorderEnabled) {
      void chrome.runtime.sendMessage({ type: "recorder-disconnected" });
    }
  });

}

install();
})();
