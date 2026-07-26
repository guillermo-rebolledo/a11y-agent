# MEM-8 proof evidence

## Automated evidence

- `pnpm vitest run src/mem-8/journey-draft.test.ts
  src/mem-8/extension-artifact.test.ts` verifies semantic locator priority,
  redacted fill intent, approved-origin enforcement, recorder state,
  assertion confirmation, schema checks, and the permission boundary.
- `pnpm typecheck` verifies both repository and extension TypeScript.
- `pnpm package:extension` produces a reproducible private-pilot ZIP and
  SHA-256 file under the ignored `artifacts/` directory.
- Two consecutive packages are byte-identical and the generated SHA-256 file
  verifies the archive.

## Chrome and VoiceOver evidence

The private-pilot build was installed in Chrome as version 0.1.0 with extension
ID `ccpmglapnacdcimhdfjkimemglbaidgk`. The representative synthetic Journey:

- opened through Command+Shift+Y;
- completed with keyboard input;
- captured 5 of 5 expected actions;
- demonstrated role/name, test-ID, and marked CSS fallback;
- omitted the entered synthetic email from the export;
- confirmed the suggested `Invitation sent` assertion;
- exposed named controls, status, lists, and action descriptions to VoiceOver
  and the macOS accessibility tree;
- paused and resumed successfully.

See `proof-report.json` and `journey-draft.json`.

MEM-8 remains partial until MEM-22 supplies the pinned GitHub Action replay and
time-to-first-published-Journey observation. Do not mark that criterion passed
from recorder-only evidence.
