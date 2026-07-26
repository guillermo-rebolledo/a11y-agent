# Accessibility Journey Recorder

This private-pilot Manifest V3 extension records a semantic Journey in the
currently selected Project tab. It does not provide a hosted browser, remote
visual stream, or browser-session export.

## Build and integrity-check the pilot artifact

Requirements:

- Node.js 24–26
- pnpm 10.29.2
- the system `zip` and `shasum` utilities

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm package:extension
cd artifacts
shasum -a 256 -c a11y-journey-recorder-0.1.0.zip.sha256
```

The package task normalizes file timestamps and archive metadata. Repeated
builds from the same source and lockfile produce the same SHA-256 digest.

For the private pilot, publish the ZIP and its `.sha256` file together in an
access-controlled GitHub release created from an immutable source commit. The
pilot administrator verifies the checksum before extracting it and uses the
extracted directory as the Chrome "Load unpacked" target. Record the source
commit, extension version, checksum, extension ID, installer, and installation
time in the pilot evidence.

Do not distribute a locally modified or checksum-mismatched directory.

## Requested permissions

| Permission | Reason |
| --- | --- |
| `activeTab` | Temporarily access only the tab selected by the user gesture |
| `scripting` | Inject the recorder into that selected tab after the origin check |
| `storage` | Keep the redacted draft and accessible recorder state across popup closure |

The manifest has no persistent `host_permissions`. It does not request
`cookies`, `proxy`, `history`, `downloads`, or `debugger`. A later change adding
one of those permissions requires a separate security decision and pilot
approval.

## Install and record with the keyboard

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `apps/extension/release` from a verified build.
2. Open the authenticated synthetic Project page.
3. Press Command+Shift+Y on macOS or Ctrl+Shift+Y elsewhere to open
   **Accessibility Journey Recorder**. Chrome administrators may replace this
   suggested shortcut at `chrome://extensions/shortcuts`.
4. Enter the exact approved HTTPS Project origin and choose **Save approved
   origin**.
5. Choose **Start in selected tab**. This click/keypress is the explicit user
   gesture that grants temporary `activeTab` access.
6. Perform the Journey. Activation actions use role/name when possible, then a
   stable test ID, then a log entry explicitly marked `last-resort selector`.
7. Text fields create only a runtime-variable fill intent. Entered content is
   never placed in extension messages, storage, or the Journey draft.
8. Confirm at least one suggested task-completion assertion.
9. Enter a Journey name and choose **Export confirmed Journey draft**.
10. Validate the JSON against `journey-draft.schema.json`.

All controls use native labels, buttons, lists, headings, focus indicators, and
the `role=status` live region. The status announces `recording`, `paused`,
`disconnected`, export success, and errors. The popup remains operable in source
order with Tab, Shift+Tab, Space, and Enter.

## Data boundary

The export is allowlisted to:

- semantic click and redacted fill intent;
- role/name, stable test ID, or marked last-resort CSS locator;
- user-confirmed bounded visible-text assertions;
- approved origin and recorder measurements.

The extension does not read or export cookies, local or session storage,
`storageState`, request bodies, response bodies, login credentials, or entered
values. Raw DOM and page screenshots are not captured.

## Pilot verification

Use synthetic content only. Record:

- installation duration;
- recording start and first-action timestamps;
- expected actions versus correctly captured actions;
- pause/navigation/reconnect outcome and reconnect count;
- recording start to exported-draft time;
- exported draft to first successful publication time from MEM-22.

Test the popup with keyboard input only and VoiceOver. Confirm every field and
button has the expected name, status changes are announced, action/assertion
lists are understandable, focus is visible, and no pointer-only path exists.

## Update, rollback, revocation, and uninstall

- Update by publishing a higher version from an immutable reviewed commit, with
  a new checksum and provenance record.
- Roll back by revoking the faulty release, rebuilding the last approved commit
  as a new version, and distributing its new checksum.
- Revoke by removing the pilot artifact from the access-controlled release and
  notifying pilot administrators to remove it.
- Uninstall from `chrome://extensions` with **Remove**. Also delete any exported
  Journey drafts that should not be retained.

Chrome's unpacked-extension ID is machine/profile dependent unless the pilot
manifest later receives an approved fixed signing key. Record the observed ID;
do not treat it as a cross-machine identity.
