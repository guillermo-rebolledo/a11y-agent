import { describe, expect, it } from "vitest";

import {
  captureAction,
  confirmAssertion,
  createRecorderSession,
  chooseLocator,
  exportJourneyDraft,
  pauseRecorder,
  recordAction,
  resumeRecorder,
  startRecorder,
  suggestAssertion,
  type ElementDescription,
} from "../../apps/extension/src/journey-draft.js";

const semanticButton: ElementDescription = {
  tagName: "button",
  role: "button",
  accessibleName: "Send invitation",
  testId: "send-button",
  cssPath: "#invite-form > button:nth-of-type(1)",
  inputType: null,
};

describe("Extension Recorder Journey draft", () => {
  it("prefers an accessible role and name over implementation selectors", () => {
    expect(chooseLocator(semanticButton)).toEqual({
      strategy: "role",
      role: "button",
      name: "Send invitation",
    });
  });

  it("captures text-entry intent without retaining the entered value", () => {
    const action = captureAction({
      kind: "fill",
      element: {
        tagName: "input",
        role: "textbox",
        accessibleName: "Email",
        testId: "invite-email",
        cssPath: "#invite-email",
        inputType: "email",
      },
      value: "secret-person@example.com",
      recordedAt: "2026-07-26T03:00:00.000Z",
    });

    expect(action).toEqual({
      kind: "fill",
      locator: {
        strategy: "role",
        role: "textbox",
        name: "Email",
      },
      input: {
        source: "runtime-variable",
        inputType: "email",
      },
    });
    expect(JSON.stringify(action)).not.toContain("secret-person@example.com");
  });

  it("uses stable test IDs before a clearly marked last-resort CSS selector", () => {
    expect(
      chooseLocator({
        ...semanticButton,
        role: null,
        accessibleName: null,
      }),
    ).toEqual({
      strategy: "test-id",
      testId: "send-button",
    });

    expect(
      chooseLocator({
        ...semanticButton,
        role: null,
        accessibleName: null,
        testId: null,
      }),
    ).toEqual({
      strategy: "css",
      selector: "#invite-form > button:nth-of-type(1)",
      lastResort: true,
    });
  });

  it("records only for the approved origin and exposes explicit recorder states", () => {
    const initial = createRecorderSession("https://pilot.example");

    expect(() =>
      startRecorder(initial, {
        selectedOrigin: "https://attacker.example",
        startedAt: "2026-07-26T03:00:00.000Z",
      }),
    ).toThrow("Selected tab does not match the approved Project origin");

    const recording = startRecorder(initial, {
      selectedOrigin: "https://pilot.example",
      startedAt: "2026-07-26T03:00:00.000Z",
    });
    const paused = pauseRecorder(recording);
    const resumed = resumeRecorder(paused, "2026-07-26T03:00:02.000Z");

    expect([initial.status, recording.status, paused.status, resumed.status]).toEqual([
      "disconnected",
      "recording",
      "paused",
      "recording",
    ]);
    expect(resumed.measurements.reconnectCount).toBe(1);
  });

  it("requires confirmation before exporting an editable schema-valid draft", () => {
    const recording = startRecorder(createRecorderSession("https://pilot.example"), {
      selectedOrigin: "https://pilot.example",
      startedAt: "2026-07-26T03:00:00.000Z",
    });
    const withAction = recordAction(
      recording,
      {
        kind: "click",
        element: semanticButton,
        recordedAt: "2026-07-26T03:00:01.000Z",
      },
      "2026-07-26T03:00:01.000Z",
    );
    const suggested = suggestAssertion(withAction, {
      id: "assertion-1",
      text: "Invitation sent",
    });

    expect(() =>
      exportJourneyDraft(suggested, {
        name: "Invite team member",
        exportedAt: "2026-07-26T03:00:03.000Z",
      }),
    ).toThrow("Confirm at least one task-completion assertion");

    const draft = exportJourneyDraft(confirmAssertion(suggested, "assertion-1"), {
      name: "Invite team member",
      exportedAt: "2026-07-26T03:00:03.000Z",
    });

    expect(draft).toMatchObject({
      schemaVersion: 1,
      name: "Invite team member",
      approvedOrigin: "https://pilot.example",
      steps: [{ kind: "click" }],
      expect: [{ kind: "text-visible", text: "Invitation sent" }],
      measurements: {
        firstActionLatencyMs: 1_000,
        reconnectCount: 0,
        recordingDurationMs: 3_000,
      },
    });
    expect(JSON.stringify(draft)).not.toMatch(
      /cookie|storageState|password|token|requestBody|responseBody/i,
    );
  });
});
