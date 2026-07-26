# Roadmap

The roadmap is capability-led. A module ships only after it has a documented,
validated oracle for pass, fail, inconclusive, and unsupported outcomes.

## Phase 0 — Infrastructure proof

- Validate Vercel Sandbox isolation and hosted recording.
- Validate restricted egress and SSRF defenses.
- Validate GCP KMS envelope encryption through Vercel OIDC.
- Validate private R2 evidence handling.
- Measure latency, runtime, concurrency, and cost.

## MVP — Keyboard plus Axe

- GitHub identity and App installation.
- Hosted semantic recorder.
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
- Customer-hosted runners.
- Formal report exports with explicit scope.
- Public signup, billing, and pricing.
- GitLab, Azure DevOps, and other CI providers.

## Deferred UI foundation task

The application scaffold is intentionally deferred until after this
specification. It must create a TypeScript Next.js App Router application using
Tailwind CSS and shadcn/ui, without a competing general-purpose component
library. Implementation will be tracked as a child of the MVP specification in
Linear.
