# Capability matrix

Status: MVP target; publish before pilot

Compliance claim: None

This document states what the product can and cannot evaluate. Exact pinned
versions are filled in by Phase 0 and updated with every Audit Engine release.

## Platform coverage

| Capability | MVP status | Notes |
| --- | --- | --- |
| Chromium | Supported | Exact version pinned per engine release |
| Firefox | Not supported | Roadmap |
| WebKit/Safari | Not supported | Roadmap |
| Desktop viewport | Supported | One configured desktop viewport |
| Responsive reflow | Not supported | First post-MVP module |
| Zoom | Not supported | First post-MVP module |
| Dark mode | Not supported | Roadmap |
| Reduced motion | Not supported | Roadmap |
| RTL | Not supported | Roadmap |
| Localization expansion | Not supported | Roadmap |

## Audit coverage

| Capability | MVP status | Confidence boundary |
| --- | --- | --- |
| Axe rules mapped to WCAG 2.2 AA | Supported | Automated subset only |
| Per-step transient-state Axe checks | Supported | Stable states only |
| Full keyboard Journey completion | Supported | Published pattern library |
| Sequential focus reachability | Supported | Bounded traversal |
| Keyboard trap detection | Supported | Deterministic traversal limit |
| Focus restoration | Supported | Known Journey targets |
| Active-element verification | Supported | DOM focus only |
| Fully obscured focus | Heuristic | High-confidence geometry cases |
| Visible focus change | Heuristic | Ambiguous cases require review |
| Focus indicator area/contrast | Not supported | Future validated oracle |
| Live-region announcement quality | Not supported | Future module |
| Screen-reader task completion | Not supported | Requires real AT execution |
| Accessibility-tree inspection | Evidence only | Never called screen-reader testing |

## Keyboard pattern library

Phase 0 must define exact expected keys and state transitions for each supported
pattern.

| Pattern | MVP target |
| --- | --- |
| Native links and buttons | Supported |
| Native text inputs and textareas | Supported |
| Native checkbox and radio controls | Supported |
| Native select | Supported |
| Dialog | Supported |
| Disclosure | Supported |
| Tabs | Supported |
| Menu button and menu | Supported |
| Listbox | Supported |
| Combobox | Supported |
| Tree | Evaluate during Phase 0 |
| Grid | Evaluate during Phase 0 |
| Custom control without usable semantics | Unable to evaluate |

Support means deterministic operation according to the published native or ARIA
interaction pattern. It does not mean every implementation of that role is
accessible.

## Authentication coverage

| Method | MVP status |
| --- | --- |
| User-established `storageState` | Supported |
| Shared-domain session across previews | Supported after compatibility test |
| Secret-backed deterministic login | Supported with explicit configuration |
| Session expiration detection | Supported |
| Automatic session refresh | Not supported |
| SSO automation | Not supported |
| MFA automation | Not supported |
| CAPTCHA bypass | Not supported |
| Heuristic token rewriting across origins | Prohibited |

## Deployment coverage

| Environment | MVP status |
| --- | --- |
| Stable public main deployment | Required for regression attribution |
| Public PR preview deployment | Required for automated PR attribution |
| Fixed public staging URL | Manual/scheduled audit only |
| Private network or VPN | Not supported |
| Production environment | Prohibited |
| Forked authenticated PR | Prohibited automatically |

## Reporting coverage

| Output | MVP status |
| --- | --- |
| Advisory GitHub check | Supported |
| Accessible dashboard | Supported |
| JSON export | Supported |
| Inline source comments | Not supported |
| PDF compliance report | Not supported |
| WCAG conformance certificate | Prohibited |
| AI explanation | Optional |

## Evidence defaults

| Artifact | Default |
| --- | --- |
| Deterministic rule output | Persisted |
| Redacted element snippet | Persisted when safe |
| Focus timeline | Persisted when safe |
| Redacted accessibility-tree fragment | Persisted when safe |
| Cropped screenshot | Persisted when useful and safe |
| Full-page screenshot | Disabled |
| Video | Disabled |
| Full DOM | Disabled |
| Playwright trace | Disabled |
| Request/response bodies | Prohibited |

## Terminology guardrail

Use:

- "Automated checks mapped to WCAG 2.2 AA."
- "Keyboard Journey completed" or "could not be completed."
- "Needs manual review."

Do not use:

- "WCAG compliant."
- "Fully accessible."
- "Screen-reader tested" when only the accessibility tree was inspected.
- "No PII can ever be processed."
