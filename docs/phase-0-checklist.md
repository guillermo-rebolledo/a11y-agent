# Phase 0 infrastructure and security checklist

Status: Blocking prerequisite to MVP feature construction

Architecture: ADR-0004 — local Extension Recorder plus customer-executed GitHub
Action

Qualification result on 2026-07-26: **revise**. The evidence-backed decision
and the itemized gaps are in
[`evidence/MEM-10/proof-report.json`](../evidence/MEM-10/proof-report.json).
Unchecked items remain blocking for the gate assigned below; they are not
silently waived. ADR-0005 permits MEM-11 scaffold construction while
authenticated customer execution and the private pilot remain stopped.

## Qualification stages

| Gate | What it permits | Checklist ownership |
| --- | --- | --- |
| Construction | Application and Audit Engine construction with fixtures, synthetic data, and non-production providers | Sections 1–4 architecture contracts |
| Authenticated enablement | Customer-controlled authentication only after the implemented trust boundary passes | Remaining items in sections 1–4, plus sections 6–8 |
| Private pilot | Invite-only customer use after complete end-to-end approval | Sections 5 and 9–12, plus every incomplete earlier item |

Construction never implies enablement. Before the authenticated-enablement gate
passes, code must not receive customer login credentials, start authenticated
customer Audit Runs, provision pilot tenants, or enable production execution.
MEM-21 owns the final cumulative private-pilot decision.

Phase 0 validates the replacement architecture selected after MEM-7 rejected
Vercel Sandbox for authenticated Audit Runs. Documentation and provider claims
are not proof: every item below requires captured output, measurement, or
review.

## Exit rule

- A failed security, identity, provenance, isolation, or session-custody item
  rejects the architecture.
- A recorder setup, runtime, concurrency, reliability, or customer-effort
  failure triggers an explicit architecture review.
- No authenticated customer pilot starts until all blocking items pass.

## 1. Pinned Action runner

- [ ] Build the minimal Playwright/Chromium OCI image.
- [ ] Pin the base and final image by immutable digest.
- [ ] Record the Audit Engine, Node, Playwright, Chromium, Axe, OS package,
  Action, and workflow provenance.
- [ ] Verify Chromium starts without downloading mutable runtime dependencies.
- [ ] Run the image through the trusted reusable GitHub Actions workflow.
- [ ] Prove pull-request code cannot replace the workflow, Action, or image.
- [ ] Verify the browser job has minimum GitHub permissions and no publisher
  identity.
- [ ] Verify the approved runner class is ephemeral and clean after success,
  failure, timeout, and cancellation.

Evidence:

- Source commit and lockfile digests
- Workflow and Action immutable refs
- Base and final image digests
- Startup logs without secrets
- GitHub job permissions and runner identity
- Terminal job and cleanup records

## 2. Extension Recorder

- [ ] Install the Manifest V3 extension through the proposed pilot distribution
  path.
- [ ] Require an explicit user gesture and selected tab before recording.
- [ ] Restrict host access to the configured Project origin.
- [ ] Record semantic role/name actions.
- [ ] Demonstrate documented test-ID and last-resort selector fallbacks.
- [ ] Do not record password, token, or other configured secret values.
- [ ] Export a schema-valid Journey draft without cookies, local storage,
  `storageState`, request bodies, or response bodies.
- [ ] Edit and replay the captured Journey through the trusted Action.
- [ ] Suggest and confirm a success assertion.
- [ ] Complete recorder operation using keyboard only.
- [ ] Test the extension and Journey editor with a screen reader.
- [ ] Measure installation, first-action latency, capture accuracy, reconnect
  behavior, and time to first published Journey.

Target:

- A representative Journey can be recorded and published in under 30 minutes.

## 3. Authentication custody

- [ ] Establish a synthetic least-privilege login only inside the browser job.
- [ ] Prove login credentials are not workflow inputs, command-line arguments,
  artifacts, caches, or logs.
- [ ] Prove cookies and `storageState` do not enter the extension export,
  Evidence Bundle, publisher job, PostgreSQL, Redis, R2, logs, or AI.
- [ ] Prove another Journey job cannot read the login or browser profile.
- [ ] Verify main and preview login compatibility detection.
- [ ] Verify expired-credential diagnosis.
- [ ] Document customer credential rotation and revocation.
- [ ] Run a malicious-preview attempt to read or exfiltrate all runner and
  publication credentials.

## 4. Browser and publisher job separation

- [ ] Run the browser and publisher as separate jobs.
- [ ] Give the browser job no `id-token: write` or platform upload credential.
- [ ] Give the publisher no customer login and execute no browser,
  pull-request, or repository scripts.
- [ ] Treat the browser artifact as untrusted input.
- [ ] Enforce a bounded versioned Evidence Bundle schema with no executable
  content.
- [ ] Reject malformed, oversized, unsupported, duplicate, and replayed
  artifacts.
- [ ] Request a short-lived GitHub OIDC token only in the publisher.
- [ ] Bind publication to the expected organization, repository, workflow,
  trusted ref, environment, audience, commit, and freshness window.
- [ ] Reject wrong, expired, replayed, or revoked identities.
- [ ] Record content-free publication audit events.

Any failure in this section rejects authenticated Action execution.

## 5. Deterministic audit

- [ ] Replay one representative Journey normally.
- [ ] Replay every user-facing step with keyboard input only.
- [ ] Run Axe after every stable user-facing step.
- [ ] Detect a seeded unreachable control.
- [ ] Detect a seeded keyboard trap.
- [ ] Detect a seeded Axe Regression in a transient dialog state.
- [ ] Confirm the Journey success assertion.
- [ ] Run cleanup after success and failure.
- [ ] Normalize and compare Findings against main.
- [ ] Perform one confirmation rerun.

## 6. Deployment and untrusted-PR gating

- [ ] Discover main and PR deployments from the configured trusted source.
- [ ] Bind the preview to the exact repository and head commit.
- [ ] Validate HTTPS, approved origin patterns, application identity, redirect
  destinations, and resolved addresses before authentication.
- [ ] Reject arbitrary URLs in comments, status descriptions, artifacts, or
  workflow inputs.
- [ ] Never auto-run an authenticated Journey for a fork.
- [ ] Require recorded approval for first-time or otherwise untrusted
  contributors.
- [ ] Prove PR code cannot change the privileged workflow or publisher policy.
- [ ] Run malicious-preview tests for workflow manipulation, artifact forgery,
  unexpected navigation, credential exfiltration, and publisher impersonation.
- [ ] Record the residual risk that the untrusted preview necessarily handles
  the synthetic account's application traffic.

## 7. Evidence and redaction

- [ ] Create the minimum Evidence Bundle.
- [ ] Seed known email, phone, token, cookie, and synthetic secret canaries.
- [ ] Prove canaries do not enter published or persisted evidence.
- [ ] Suppress an artifact whose potential PII cannot be safely redacted.
- [ ] Upload permitted evidence to private R2.
- [ ] Verify tenant authorization before evidence access.
- [ ] Verify short-lived presigned access.
- [ ] Delete raw browser-job artifacts at job completion.
- [ ] Delete redacted evidence immediately on request.
- [ ] Verify scheduled 30-day deletion and reconciliation.

## 8. GitHub integration

- [ ] Validate webhook signatures.
- [ ] Reject replayed webhook deliveries.
- [ ] Verify least-privilege GitHub App permissions.
- [ ] Confirm repository contents are inaccessible to the control plane.
- [ ] Verify the exact workflow dispatch and cancellation permissions needed.
- [ ] Verify OIDC claims for manual, main, and approved PR execution.
- [ ] Complete every GitHub check with `success` or `neutral`.
- [ ] Verify the check cannot block a protected branch.
- [ ] Verify a customer-started workflow is clearly distinguished from a
  platform-dispatched workflow.
- [ ] Test installation suspension and deletion.

## 9. Concurrency, runtime, and cost

- [ ] Run five isolated Journey browser jobs concurrently.
- [ ] Measure GitHub queue delay and container startup time.
- [ ] Measure control, keyboard, Axe, redaction, artifact transfer, validation,
  and publication time separately.
- [ ] Complete a representative five-Journey Project under 10 minutes median.
- [ ] Enforce the 20-minute Project timeout.
- [ ] Preserve completed results when one Journey times out.
- [ ] Measure Action minutes per Journey, Project audit, confirmation rerun, and
  fresh main Baseline.
- [ ] Measure control-plane and storage cost separately from customer-funded
  Action compute.
- [ ] Configure dispatch limits and the global operational kill switch.

## 10. Operational controls

- [ ] Stop all new platform dispatches globally.
- [ ] Suspend one tenant and one Project.
- [ ] Cancel an active platform-dispatched workflow.
- [ ] Suspend result intake.
- [ ] Drain control-plane queues without dispatch or publication.
- [ ] Revoke one Project's OIDC publication trust.
- [ ] Exercise the customer CI credential-rotation runbook.
- [ ] Delete evidence by Run, Project, and tenant.
- [ ] Disable a GitHub installation.
- [ ] Exercise the incident-response procedure.

## 11. Product accessibility

- [ ] Complete onboarding using keyboard only.
- [ ] Record and edit a Journey using keyboard only.
- [ ] Inspect Action progress, a Finding, and evidence using keyboard only.
- [ ] Validate accessible live progress and terminal status.
- [ ] Test critical workflows with at least one screen reader.
- [ ] Verify the extension does not create a pointer-only recording path.
- [ ] Dogfood the Audit Engine against the product.

## 12. Phase 0 decision record

Record:

- Date and participants.
- Exact Chrome extension, workflow, Action, runner class, GitHub plan, image,
  Audit Engine, browser, Playwright, and Axe versions.
- Test evidence links.
- Measured setup time, runtime, queue delay, concurrency, Action minutes,
  artifact size, and control-plane cost.
- Failed checks. Security failures cannot be waived into authenticated pilot
  use.
- Residual risks, including malicious-preview access to its synthetic account.
- Final decision: accept, revise, or reject the Extension Recorder and GitHub
  Action architecture.
