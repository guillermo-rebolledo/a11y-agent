# Architecture

## Decision summary

The MVP is a modular TypeScript monorepo with deterministic orchestration and
isolated browser execution. It is not a multi-agent system.

```text
GitHub webhook
      |
      v
Fastify control plane ----> Neon PostgreSQL
      |                           |
      |                           v
      +----> Redis Cloud / BullMQ job
                        |
                        v
              Vercel Sandbox microVM
              - pinned Chromium image
              - control replay
              - keyboard replay
              - Axe checkpoints
              - in-worker redaction
                        |
                        v
             redacted Evidence Bundle
                        |
                        v
                  Cloudflare R2

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
  web/        Next.js dashboard
  api/        Fastify API and GitHub webhooks
packages/
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
- `KeyManager`: Google Cloud KMS initially.
- `Queue`: BullMQ over Redis Cloud.
- `RelationalStore`: PostgreSQL via Neon.
- `Runner`: provider-neutral; MEM-7 rejected Vercel Sandbox for authenticated
  Audit Runs.
- `SourceHost`: GitHub App.
- `AIReviewProvider`: OpenAI Responses API when enabled.

Domain records store provider-neutral identifiers rather than provider URLs or
resource names wherever practical.

## Vercel deployment shape

- Next.js dashboard on Vercel.
- Fastify API deployed as Vercel Functions with Fluid Compute.
- A disposable runner is created per recorder session and audit execution.
- Runner OCI images are pinned by digest.
- Runner egress is denied by default and opened only for the approved Project
  allowlist.
- The runner is stopped and destroyed at terminal completion.

Vercel Functions do not run Playwright directly. The control plane must
orchestrate a disposable runner selected by a later ADR.

## Data ownership

PostgreSQL stores:

- Installation and repository metadata.
- Project configuration.
- Journey drafts and immutable published versions.
- Encrypted session references and wrapped key metadata.
- Audit Run state.
- Normalized Findings.
- Suppression records.
- Security audit events.
- Content-free metrics.

R2 stores only:

- Redacted Evidence Bundles explicitly allowed by project policy.

Redis stores only:

- Opaque job identifiers.
- Scheduling and retry state.
- Short-lived coordination metadata.

Redis job payloads must not contain browser sessions, page content, screenshots,
DOM, accessible names, or secrets.

## Baseline compatibility

A Baseline key includes:

- Project.
- Journey Version.
- Audit Engine version.
- Browser version.
- approved environment class.
- test-data contract version.

Changing any key component invalidates direct comparison. A fresh main audit may
establish a new compatible Baseline.

## Concurrency and time limits

- Maximum five active Journeys per Project.
- Journeys may run concurrently within a configured tenant quota.
- One Sandbox contains one isolated Journey execution.
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
- Remote visual-stream protocol and measured latency.
- Exact Redis Cloud plan and BullMQ persistence configuration.
- Neon connection pooling configuration.
- GCP KMS region aligned with production data residency.
- Detailed Finding fingerprint algorithm.
- Production observability vendor, subject to metadata-only restrictions.
