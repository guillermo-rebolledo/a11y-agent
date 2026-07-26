# Accessibility Journey Copilot

> Working title. The final product name is intentionally undecided.

## Product specification

Status: Approved for Phase 0 validation

Audience: Product, design, engineering, security, accessibility, and pilot operators

## Vision

Accessibility Journey Copilot tests accessibility across real user journeys rather
than treating each page as an isolated document.

The product's durable question is:

> Can a person using a supported interaction mode complete this task?

The MVP answers a deliberately narrower version:

> Can this recorded journey still be completed with a keyboard, and did this pull
> request introduce any high-confidence Axe violations?

The product does not claim automated WCAG conformance. It reports deterministic
checks mapped to WCAG 2.2 Level AA and clearly identifies checks that are
heuristic, inconclusive, or outside its supported capability.

## Positioning

Primary message:

> Accessibility journey testing for every pull request.

Supporting message:

> Deterministic Axe and keyboard testing, with optional evidence-grounded
> explanations and fix guidance.

AI is not the product's authority. It is an optional reviewer of deterministic
evidence.

## Beachhead customer

The first customer is a frontend team that:

- Uses GitHub pull requests.
- Deploys a stable main branch and a preview for each pull request.
- Has an internet-reachable, non-production test environment.
- Wants accessibility regression feedback before merge.
- May not have Playwright or any end-to-end testing setup.

The private pilot is invite-only and limited to 3–5 design-partner teams. Public
signup, billing, and pricing are deferred.

## MVP principles

1. Deterministic execution owns pass/fail behavior.
2. GitHub feedback is advisory and never blocks a pull request.
3. Security and privacy are release criteria, not later hardening work.
4. Findings never claim more certainty than their evidence supports.
5. The Copilot's own critical workflows must meet WCAG 2.2 Level AA.
6. Product limitations and supported patterns are public and versioned.
7. The MVP favors a small, trustworthy capability over broad but unreliable
   coverage.

## Core workflow

### 1. Connect a project

An installation administrator:

1. Signs in with GitHub.
2. Selects a repository from a GitHub App installation.
3. Configures the stable main deployment source.
4. Configures the pull-request preview deployment source and approved origin
   pattern.
5. Approves the project's browser egress allowlist.
6. Establishes an authenticated, least-privilege synthetic test session.

The GitHub App does not read repository source code.

### 2. Record a journey

The user launches a disposable hosted Chromium session from the dashboard and
performs the journey once.

The recorder:

- Captures semantic action intent rather than raw coordinates.
- Prefers accessible role and name locators.
- Falls back to stable test IDs, then CSS only as a last resort.
- Suggests success assertions based on observed state changes.
- Requires the user to confirm at least one success assertion.
- Produces a human-readable, editable journey definition.
- Exposes a semantic tree and action log alongside the visual stream.
- Does not persist raw credentials typed during interactive authentication.

Each journey has draft and immutable published versions. A published version must
pass validation against main before it can run on pull requests.

### 3. Run a pull-request audit

For every eligible pull request:

1. Wait for the configured preview deployment to become ready.
2. Verify that the deployment belongs to the exact head commit.
3. Validate its HTTPS origin, DNS results, application identity, and egress
   policy.
4. Establish a compatible main baseline.
5. Execute a normal control replay.
6. Execute a complete keyboard-only replay.
7. Run Axe after every stable user-facing step in both replays.
8. Compare normalized findings with the compatible main baseline.
9. Rerun the complete journey once when a new regression appears.
10. Publish an advisory GitHub check and linked dashboard report.
11. Attempt cleanup even when the audit fails.

Every active journey runs on every pull request. The MVP permits at most five
active journeys per project.

### 4. Review results

The GitHub check contains:

- A concise audit summary.
- New, resolved, existing, intermittent, and inconclusive counts.
- Journey-level task-completion status.
- A link to the accessible dashboard report.

The dashboard contains:

- Projects and journeys.
- Recent audit runs and progress.
- Finding details and permitted evidence.
- Rerun and diagnostic controls.
- Links back to originating pull requests.

The MVP does not post speculative inline source comments and does not generate
formal PDF compliance reports.

## Journey model

A journey is a versioned, semantic description of a user task.

Illustrative shape:

```yaml
name: Invite team member

data:
  inviteEmail:
    generate: uniqueEmail

setup:
  - useSession: teamAdmin

steps:
  - open: /team
  - click:
      role: button
      name: Invite member
  - fill:
      field: Email
      valueFrom: inviteEmail
  - click:
      role: button
      name: Send invitation

expect:
  - text: Invitation sent

cleanup:
  - deleteInvitedUser:
      emailFrom: inviteEmail
```

Requirements:

- Every journey has a user-confirmed success assertion.
- User-facing actions are semantic and editable.
- Generated variables support unique synthetic test data.
- Cleanup is explicit, separately reported, and always attempted.
- Programmatic setup and cleanup may use narrow authenticated hooks.
- Arbitrary customer code never runs in the control plane.
- Publishing creates an immutable version and requires a fresh compatible main
  baseline.

## Keyboard audit

The keyboard audit replays the complete user-facing journey without pointer input.
Programmatic setup, cleanup, and authenticated-session restoration are exempt.

The executor uses a finite, public interaction library:

- Tab and Shift+Tab for sequential focus navigation.
- Enter and Space for standard activation.
- Arrow, Home, End, and Escape behavior for explicitly supported native and ARIA
  composite patterns.
- Role, state, and accessible name to confirm the intended target.
- Fixed traversal and timeout limits to identify traps.

AI never chooses keys or actions.

When a custom control does not expose enough semantics to select a known pattern,
the result is `unable to evaluate`, not pass or fail.

### Focus evidence

The MVP:

- Confirms the intended element becomes the active element.
- Captures cropped before/after evidence when permitted.
- Detects high-confidence cases where focus produces no meaningful visual change.
- Checks whether the focused element is fully obscured or outside the viewport.
- Records computed focus styles as supporting evidence.
- Sends ambiguous appearance questions to manual review.

It does not claim complete automated measurement of focus-indicator area or
contrast.

## Axe audit

Axe runs after every stable user-facing step in both control and keyboard
replays, including transient states such as:

- Open menus.
- Dialogs.
- Validation errors.
- Async results.

The runner:

- Waits for explicit expectations or bounded DOM/network stability.
- Avoids arbitrary long sleeps.
- Deduplicates identical findings across consecutive states.
- Preserves the earliest and most informative permitted evidence.
- Allows an explicitly justified non-audited step.
- Does not run Axe during programmatic setup or cleanup.

The MVP targets checks mapped to WCAG 2.2 Level AA. It never labels an automated
result as proof of WCAG conformance.

## Finding model

Each finding has three independent dimensions.

### Impact

- Critical
- Serious
- Moderate
- Minor

### Confidence

- Confirmed
- High-confidence heuristic
- Needs review
- Unable to evaluate

### Regression state

- New
- Existing
- Resolved
- Intermittent
- Suppressed
- Baseline unavailable

Deterministic evidence assigns these values. AI can explain but cannot alter
them.

### Confirmation rerun

When a newly detected regression appears:

- Rerun the complete journey once with fresh test data.
- Mark the normalized finding confirmed only when it reproduces.
- Mark it intermittent when it does not reproduce.
- Preserve both attempt summaries.
- Report journey instability separately from accessibility findings.

### Suppression

A suppression is never silent. It records:

- Exact scope.
- False-positive, accepted-risk, or planned-remediation classification.
- Required reason.
- Approver's GitHub identity.
- Creation and expiration dates.
- Audit-log entry.

A suppression is invalidated when the affected element or evidence changes
materially. Only authorized administrators or maintainers may suppress a
check-affecting regression.

## GitHub check policy

The MVP is always advisory:

- `success`: no new confirmed regressions.
- `neutral — regressions found`: confirmed accessibility regressions exist.
- `neutral — review recommended`: lower-confidence or intermittent findings.
- `neutral — audit inconclusive`: missing baseline, expired session, deployment
  failure, or runner failure.

The product never emits `failure` or `action_required` during the MVP and always
completes its check so a stuck audit cannot block a pull request.

## Baselines

A compatible baseline uses:

- The same published journey version.
- The same audit-engine version.
- The same browser version.
- A compatible approved environment.
- The same test-data assumptions.

The normal baseline is the latest compatible successful main-branch audit. If it
is stale or incompatible, the system audits the current main deployment with the
same configuration before comparing it with the pull-request preview.

If a trustworthy main deployment is unavailable, the result is initial or
inconclusive and must not claim a regression.

## Deployment requirements for customer applications

Automated PR regression reporting requires:

- A stable main deployment.
- A PR-specific preview deployment.
- Both deployments to be internet reachable.
- An approved non-production origin pattern.
- Authentication that is portable or deterministically re-established on both
  deployments.

Without a preview deployment, teams may run manual or scheduled audits against a
fixed staging URL, but the product must not attribute findings to a pull request.

Deployment URLs are accepted only from an administrator-selected provider or
check source, associated with the exact commit, validated against approved origin
patterns, and verified before authentication material is injected.

## Authentication

Default onboarding uses a user-established browser session captured during
recording.

- Session state is encrypted before leaving the recorder sandbox.
- Sessions are manually reconnected when they expire.
- Standard secret-backed login steps are supported when explicitly configured.
- Automatic SSO, MFA, CAPTCHA, and token rewriting are not supported.
- Session portability is tested during onboarding.
- Unsupported authentication is disclosed rather than bypassed heuristically.

Authenticated audits:

- Never auto-run for forked pull requests.
- Require approval for first-time or otherwise untrusted contributors.
- Use dedicated least-privilege synthetic accounts.
- Record the approver.

## Privacy and security

Security requirements are detailed in
[the threat model](docs/security/threat-model.md).

Core policies:

- Synthetic test data only.
- Non-production environments only.
- No request or response body capture.
- Privacy-minimized evidence by default.
- Potential PII causes artifact suppression rather than risky persistence.
- Raw artifacts are ephemeral and deleted when the run ends.
- Redacted failure evidence defaults to 30-day retention.
- Content-free finding metadata may be retained for project history.
- Immediate deletion is available by run and project.
- Operational telemetry is metadata-only.
- Every run executes in a fresh isolated microVM with restricted egress.

The product does not promise that transient processing can never encounter PII.
It requires synthetic data and uses defense-in-depth to prevent persistence or
downstream disclosure.

## Evidence

Default persisted evidence is limited to:

- Failing step and deterministic rule output.
- Relevant redacted element snippet.
- Focus timeline around the failure.
- Redacted accessibility-tree fragment.
- Cropped screenshot when useful and safe.
- Replay metadata and relevant sanitized console category.

Full-page screenshots, video, full DOM, Playwright traces, and raw console or
network content are disabled by default. Diagnostic reruns require explicit
project-level opt-in and remain subject to redaction and retention policy.

Raw browser artifacts never enter ordinary logs.

## AI reviewer

AI is project-level opt-in.

It may:

- Explain why a finding matters.
- Describe affected users.
- Summarize evidence-backed reproduction.
- Suggest likely fix patterns.
- Cluster related occurrences.
- Estimate a likely shared root cause with explicit uncertainty.

It may not:

- Decide audit outcomes.
- Invent missing evidence.
- Silently dismiss deterministic failures.
- Guess source-code locations.
- Choose keyboard actions.
- Change impact, confidence, or regression state.

When evidence is missing, the AI must state that the answer is unknown.

## Product accessibility

The dashboard, onboarding, recorder controls, journey editor, and audit reports
must meet WCAG 2.2 Level AA as an MVP release criterion.

Required validation includes:

- Keyboard-only completion of critical workflows.
- Manual screen-reader testing.
- Semantic alternative to the remote browser's visual stream.
- Accessible status updates and progress.
- Accessible finding and evidence presentation.
- Dogfooding the product against its own critical journeys.

shadcn/ui is a component foundation, not proof of accessibility. Composed
interfaces remain subject to semantic, keyboard, focus, and assistive-technology
testing.

## UI implementation constraint

The future application scaffold must use:

- Next.js App Router.
- TypeScript.
- Tailwind CSS for styling.
- shadcn/ui as the standard component foundation.
- Shared CSS-variable and Tailwind design tokens.

Do not add a competing general-purpose component library. Custom interactive
components require an explicit reason and accessibility tests. Application
scaffolding is a separate implementation ticket and is not part of this
specification change.

## System architecture

The planned TypeScript monorepo contains:

- Next.js dashboard.
- Fastify API and GitHub webhook service.
- Deterministic audit orchestrator.
- Shared journey, finding, and evidence schemas.
- Playwright runner image.

Preferred hosted providers:

| Concern | Provider |
| --- | --- |
| Web, API, and control plane | Vercel |
| Isolated browser execution | Vercel Sandbox |
| Relational storage | Neon PostgreSQL |
| Job queue | Redis Cloud with BullMQ |
| Redacted evidence | Cloudflare R2 |
| Key management | Google Cloud KMS |
| Source integration | GitHub App |
| Optional AI review | OpenAI Responses API |

Vercel Sandbox is conditional on the Phase 0 infrastructure spike. Failure of a
security or isolation criterion rejects the architecture.

See [architecture](docs/architecture.md),
[Phase 0 checklist](docs/phase-0-checklist.md), and
[deployment guide](docs/deployment.md).

## Reliability and limits

- Chromium only.
- Maximum five active journeys per project.
- All active journeys run on every eligible pull request.
- Median target under 10 minutes.
- Hard project-level timeout at 20 minutes.
- Bounded journey parallelism.
- A timed-out journey does not discard completed results.
- Timeouts and runner failures are infrastructure outcomes, not accessibility
  findings.

## MVP validation

The invite-only pilot succeeds when:

- The first authenticated journey is published in under 30 minutes.
- At least 90% of eligible PR audits reach a conclusive result.
- Median audit time is under 10 minutes.
- At least 90% of confirmed regressions are judged actionable.
- At least three real regressions are fixed before merge across the pilot.
- Teams continue using the check after four weeks.
- No cross-tenant, secret, or retained-PII incident occurs.
- Every inconclusive result has an explicit measurable cause.

An independent accessibility-specialist review is strongly preferred before the
private pilot and mandatory before public launch.

## Operational prerequisites

Before the pilot:

- Complete the Phase 0 infrastructure spike.
- Review the written threat model.
- Test emergency kill switches and deletion controls.
- Validate session encryption, rotation, and revocation.
- Publish the capability matrix and limitations.
- Complete product accessibility testing.
- Establish incident-response ownership.
- Measure expected infrastructure cost.

## Explicitly deferred

- Public signup, billing, and pricing.
- Final product name.
- Source-code access and inline code annotations.
- Repository-aware component attribution.
- Autonomous journey generation and exploration.
- WebKit/Safari and Firefox.
- Customer-hosted runner and full self-hosting.
- Formal PDF or compliance reports.
- Historical scores and trend dashboards.
- Executive and team benchmarking.
- Remediation workflow management.
- Storybook and design-system awareness.
- Reduced motion, dark mode, RTL, and localization audit modules.
- Real screen-reader task execution.
- Performance, UX, visual-regression, and design-system agents.

## Post-MVP sequence

The first post-MVP audit module is responsive reflow and zoom. Subsequent modules
remain roadmap items whose order depends on pilot evidence. See
[roadmap](docs/roadmap.md).
