# Architecture

## Decision summary

The MVP is a modular TypeScript monorepo with deterministic orchestration,
local semantic recording, and customer-executed browser automation. It is not a
multi-agent system.

```text
Local Chrome tab
      |
      v
Extension Recorder ----> Journey draft/version ----> Fastify control plane
                                                       |
GitHub event -------------------------------------------+
      |
      v
Customer GitHub Actions workflow
      |
      +----> unprivileged browser job
      |      - digest-pinned Chromium image
      |      - customer-controlled synthetic login
      |      - control + keyboard replay
      |      - Axe + in-job redaction
      |      - no platform publisher identity
      |
      +----> untrusted bounded Evidence Bundle
      |
      +----> publisher job
             - no browser or PR code
             - schema/provenance validation
             - short-lived GitHub OIDC
                        |
                        v
Fastify control plane ----> Neon PostgreSQL
      |                           |
      +----> Cloudflare R2        +----> Redis Cloud / BullMQ
             redacted evidence          control-plane coordination only

Deterministic Finding ----> optional AI Reviewer
                        |
                        v
              GitHub check + dashboard
```

## Planned monorepo boundaries

No application is scaffolded yet. The implementation ticket will create the
initial structure.

```text
apps/
  extension/  Manifest V3 semantic Journey recorder
  web/        Next.js dashboard
  api/        Fastify API and GitHub webhooks
packages/
  action/     GitHub Action and workflow integration
  domain/     Journey, Audit Run, Finding, and Baseline types
  schemas/    Runtime validation and serialized contracts
  engine/     Deterministic audit orchestration
  github/     GitHub App integration
  evidence/   Redaction and object-storage abstraction
  security/   Encryption, authorization, and audit logging
  ui/         shadcn/ui components and product-level compositions
workers/
  runner/     Pinned Playwright OCI image and audit process
```

Boundaries may be refined during implementation, but domain logic must not live
inside UI components, GitHub handlers, or provider adapters.

## Audit state machine

```text
queued
  -> validating-deployment
  -> preparing-baseline
  -> control-replay
  -> keyboard-replay
  -> collecting
  -> comparing
  -> confirming-regressions
  -> cleaning-up
  -> reporting
  -> completed
```

Terminal alternatives:

- `inconclusive`
- `cancelled`
- `timed-out`
- `infrastructure-error`

An infrastructure terminal state must never be converted into an accessibility
Finding.

## Deterministic boundary

The Audit Engine owns:

- Journey execution.
- Keyboard-pattern selection.
- Axe collection.
- Focus observation.
- Finding normalization and fingerprinting.
- Baseline compatibility.
- Regression state.
- Impact and confidence policy.
- GitHub conclusion category.

The AI Reviewer receives a minimized redacted representation after the Finding
exists. It cannot invoke the runner, update a Finding's deterministic fields, or
write a GitHub conclusion.

## Provider boundaries

Provider access lives behind narrow adapters:

- `ObjectStore`: Cloudflare R2 initially; S3-compatible alternatives remain
  possible.
- `Queue`: BullMQ over Redis Cloud.
- `RelationalStore`: PostgreSQL via Neon.
- `RunPublisher`: verifies GitHub OIDC identity, provenance, replay protection,
  and the bounded Evidence Bundle.
- `SourceHost`: GitHub App.
- `AIReviewProvider`: OpenAI Responses API when enabled.

Domain records store provider-neutral identifiers rather than provider URLs or
resource names wherever practical.

## Execution shape

- Next.js dashboard on Vercel.
- Fastify API deployed as Vercel Functions with Fluid Compute.
- Recording occurs in a user-selected local Chrome tab through the extension.
- Automated execution occurs in customer GitHub Actions.
- A fresh isolated browser job and digest-pinned OCI image are used per Journey.
- The browser job receives customer-controlled synthetic authentication but no
  platform publishing identity.
- A separate publisher job validates and uploads the redacted result using
  GitHub OIDC.

Vercel Functions do not run Playwright and the service does not store or
transport browser cookies, `storageState`, or login credentials.

## Data ownership

PostgreSQL stores:

- Installation and repository metadata.
- Project configuration.
- Journey drafts and immutable published versions.
- Trusted workflow identity and runner provenance.
- Audit Run state.
- Normalized Findings.
- Suppression records.
- Security audit events.
- Content-free metrics.

R2 stores only:

- Redacted Evidence Bundles explicitly allowed by project policy.

Redis stores only:

- Opaque job identifiers.
- Control-plane scheduling and retry state.
- Short-lived coordination metadata.

Redis does not schedule browser execution. Queue payloads must not contain
browser sessions, page content, screenshots, DOM, accessible names, credentials,
or Evidence Bundles.

## Baseline compatibility

A Baseline key includes:

- Project.
- Journey Version.
- Audit Engine version.
- Browser version.
- Runner image digest.
- Approved runner class.
- approved environment class.
- test-data contract version.

Changing any key component invalidates direct comparison. A fresh main audit may
establish a new compatible Baseline.

## Concurrency and time limits

- Maximum five active Journeys per Project.
- Journeys run through a bounded GitHub Actions matrix.
- One isolated browser job contains one Journey execution.
- Median project target: less than 10 minutes.
- Project hard stop: 20 minutes.
- Failed confirmation reruns do not erase the original attempt.

## UI architecture constraint

The future UI must use Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.
Standard interactions must start from shadcn/ui components. A competing
general-purpose component system is prohibited without an explicit architecture
decision.

Shared UI tokens use CSS variables surfaced through Tailwind. Component
composition must preserve semantic HTML, accessible naming, focus behavior, and
keyboard interaction.

## Open architecture questions

These are Phase 0 or implementation questions, not unresolved product scope:

- Exact Playwright OCI image and snapshot strategy.
- Extension distribution, update, and permission-review process.
- Exact reusable-workflow and Action pinning strategy.
- GitHub OIDC claim contract and replay store.
- Ephemeral self-hosted runner support decision.
- Exact Redis Cloud plan and BullMQ persistence configuration.
- Neon connection pooling configuration.
- Detailed Finding fingerprint algorithm.
- Production observability vendor, subject to metadata-only restrictions.
