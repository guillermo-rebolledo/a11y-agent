# Roadmap

The roadmap is capability-led. A module ships only after it has a documented,
validated oracle for pass, fail, inconclusive, and unsupported outcomes.

## Phase 0 — Infrastructure proof

- Validate accessible semantic recording through a local Chrome extension.
- Validate a digest-pinned Playwright runner in customer-executed GitHub
  Actions.
- Validate browser-job and OIDC publisher-job separation.
- Prove browser sessions never enter the service or Evidence Bundles.
- Validate private R2 evidence handling.
- Measure setup time, runtime, concurrency, Action minutes, and control-plane
  cost.

## MVP — Keyboard plus Axe

- GitHub identity and App installation.
- Accessible Extension Recorder.
- Customer-executed GitHub Action.
- Versioned editable Journeys.
- Main and PR preview integration.
- Control and complete keyboard replays.
- Per-step Axe checks.
- Compatible Baselines and regression classification.
- One confirmation rerun.
- Advisory GitHub checks.
- Accessible operational dashboard.
- Privacy-minimized evidence.
- Optional AI Reviewer.

## First post-MVP module — Responsive reflow and zoom

Initial targets:

- Horizontal scrolling at narrow effective widths.
- Content clipping and overlap.
- Controls becoming unreachable.
- Focus becoming obscured after reflow.
- Journey completion at increased zoom.

The exact viewport and zoom matrix is defined only after runtime and oracle
validation.

## Later audit modules

Ordering depends on pilot evidence:

- Reduced motion.
- Dark mode.
- RTL.
- Localization and long-text expansion.
- Live-region and dynamic-update analysis.
- Additional browsers.
- Real assistive-technology execution.

Accessibility-tree inspection is never marketed as screen-reader testing. Real
assistive-technology support names and executes specific OS, browser, and AT
combinations.

## Later product capabilities

- Historical trends and score evolution.
- Remediation workflows.
- Team and executive reporting.
- Repository-aware component attribution.
- Storybook and design-system awareness.
- Autonomous non-blocking exploration.
- Additional customer-hosted runner platforms.
- Formal report exports with explicit scope.
- Public signup, billing, and pricing.
- GitLab, Azure DevOps, and other CI providers.

## Application foundation

The application scaffold is part of MEM-11. It creates the TypeScript monorepo,
Next.js App Router dashboard, Tailwind CSS and shadcn/ui foundation, and the
initial GitHub Project onboarding flow after the Phase 0 architecture is
qualified by MEM-10.
