# Threat model

Status: Required review before authenticated pilot use

Owner: Unassigned until implementation planning

Architecture: ADR-0004 — local Extension Recorder plus customer-executed GitHub
Action

## Security objectives

1. A tenant cannot access another tenant's Journeys, Findings, or Evidence
   Bundles.
2. Browser cookies, `storageState`, and login credentials never enter the
   service.
3. Pull-request code cannot change the trusted workflow, obtain the result
   publisher identity, or compromise another customer.
4. Sensitive page content is not persisted by default.
5. AI receives only explicitly permitted redacted Finding data.
6. Operators can stop dispatch and publication, revoke trust, and delete
   evidence without a deployment.
7. Every sensitive operation is attributable to a GitHub identity, workflow
   identity, or service principal.

The customer preview is untrusted code even when it originates from the same
repository. A preview necessarily receives the synthetic account's requests and
may be malicious. The design constrains that account's privilege and prevents
the preview from reaching platform publication authority; it does not claim
that a malicious application cannot observe credentials deliberately entered
into that application.

## Trust boundaries

- User browser and Extension Recorder to the Vercel control plane.
- GitHub to the webhook endpoint.
- Control plane to Neon, Redis Cloud, and R2.
- Control plane to GitHub workflow dispatch and cancellation.
- Customer-controlled GitHub Actions browser job to the approved deployment.
- Browser job to the bounded untrusted Evidence Bundle.
- Evidence Bundle to the separate GitHub Actions publisher job.
- Publisher job to the control plane through GitHub OIDC.
- Deterministic Finding pipeline to the optional AI Reviewer.
- Dashboard to redacted evidence delivery.

## Data classification

| Class | Examples | Persistence |
| --- | --- | --- |
| Public metadata | Rule IDs, engine versions | PostgreSQL allowed |
| Tenant metadata | Project, Journey, Run identifiers | PostgreSQL allowed |
| Sensitive metadata | Full origins, approver and workflow identities | Restricted PostgreSQL fields |
| Authentication material | Cookies, storageState, login secrets | Customer local/CI environment only; prohibited from service |
| Customer content | Page text, accessible names, DOM | Suppressed by default |
| Redacted evidence | Cropped image, snippet, focus timeline | Private R2, default 30 days |
| Raw evidence | Video, trace, full DOM, network content | Browser-job ephemeral storage only |

## Mandatory controls

### Tenant isolation

- Every database query is scoped by installation and Project.
- Object keys use non-guessable tenant and Run identifiers.
- Authorization is checked before generating an evidence URL.
- R2 buckets are private.
- Presigned URLs are short-lived and single-purpose.
- Cross-tenant negative tests cover API, object storage, queue, and cache paths.

### Extension Recorder

- The extension operates only after an explicit user gesture on a selected tab.
- Host access is limited to the configured Project origin.
- Cookie, proxy, history, downloads, and debugger permissions are absent unless
  a later security decision explicitly approves them.
- Recorded steps contain semantic intent, not entered secret values.
- Cookies, local storage, `storageState`, request bodies, and response bodies
  are never exported.
- The extension, update channel, and published artifacts have verifiable
  provenance.

### GitHub Actions execution

- The workflow, reusable Action, and runner image come from immutable trusted
  refs.
- Pull-request-controlled workflow code never executes with authentication or
  publisher authority.
- One isolated browser job and digest-pinned image execute each Journey.
- GitHub-hosted runners must be ephemeral. Customer self-hosted runners must
  satisfy the separately approved ephemeral-runner contract.
- Persistent or shared self-hosted runners are unsupported.
- The browser job has minimum GitHub permissions and no platform publisher
  credential.
- CPU, memory, disk, execution-time, and concurrency behavior are measured and
  bounded by the approved runner contract.
- Raw artifacts are destroyed with the job at every terminal outcome.

### Publisher boundary

- Publication occurs in a separate job that runs no browser or pull-request
  code and receives no customer login secret.
- The browser-job artifact is untrusted input.
- The Evidence Bundle schema has bounded sizes, enumerated fields, no executable
  content, and a versioned compatibility contract.
- The publisher validates artifact schema, provenance, digest, repository,
  workflow, ref, environment, audience, commit, freshness, and replay state.
- GitHub OIDC tokens are short-lived and scoped only to result publication.
- Wrong, expired, duplicate, or replayed identities and artifacts are rejected.

### Authenticated PR gating

- No automatic authenticated execution for forked pull requests.
- First-time and otherwise untrusted contributors require recorded
  administrator approval.
- Deployment source, repository, commit SHA, HTTPS, origin, redirect
  destinations, and resolved addresses are verified before login.
- Only least-privilege synthetic test accounts and synthetic data are used.
- CI credentials are customer-controlled and are never workflow inputs,
  artifacts, logs, or platform records.
- Authentication failure or expiration produces an infrastructure outcome, not
  an accessibility Finding.

### Evidence minimization

- No request or response bodies.
- No raw network logs.
- No raw browser console messages in operational telemetry.
- Crop screenshots to the relevant region when safe.
- Redact known secrets, emails, phones, tokens, and configured selectors before
  persistence.
- Suppress an artifact when potential PII cannot be removed confidently.
- Raw artifacts are deleted when the browser job ends.
- Redacted evidence defaults to 30-day retention.

### AI boundary

- AI is off by default per Project.
- Only the redacted Finding bundle crosses the boundary.
- No authentication material, full DOM, full screenshot, trace, network
  content, or raw log enters an AI prompt.
- Responses are stored and deleted independently from deterministic Findings.
- Prompt and response telemetry follows the same content restrictions.

### Operational telemetry

Allowed:

- Opaque identifiers.
- Rule IDs and normalized categories.
- Durations, retries, Action queue delay, resource usage, and exit codes.
- Extension, workflow, Action, image, browser, and engine versions.

Prohibited:

- Page text and accessible names.
- Form values.
- Full URLs, query strings, and fragments.
- Cookies, headers, tokens, login credentials, and `storageState`.
- DOM, images, AI prompts, and raw console or network content.

## Threat register

| Threat | Required mitigation | Verification |
| --- | --- | --- |
| Malicious preview steals synthetic login | trusted-contributor gate, least-privilege account, synthetic data, explicit residual-risk acceptance | malicious preview drill |
| PR changes privileged workflow | trusted default-branch workflow and immutable Action refs | altered-workflow rejection test |
| Browser obtains publisher identity | separate jobs, no OIDC permission in browser job | token-request denial test |
| Forged Evidence Bundle | strict schema, provenance, OIDC identity binding, replay store | malformed and replayed bundle tests |
| Compromised self-hosted runner persists | ephemeral approved runner contract; no shared runner | persistence and cleanup test |
| Arbitrary deployment target | trusted deployment source, commit and origin validation | malicious URL and redirect tests |
| Cross-tenant API access | scoped authorization and opaque IDs | negative integration tests |
| Cross-tenant R2 access | private bucket, scoped keys, short presigned URLs | object-key fuzz tests |
| Queue leaks secrets | identifiers-only schema | schema and log inspection |
| PII persisted in evidence | synthetic-data policy, redaction, suppression | seeded canary test |
| Secrets enter logs or artifacts | bounded schemas and sink scrubbers | canary leakage test |
| Forged GitHub webhook | signature validation and replay defense | invalid and replayed webhook tests |
| Supply-chain compromise | pinned Actions, images, lockfiles, and provenance | digest and provenance verification |
| Artifact retention drift | scheduled deletion and reconciliation | aged-object test |
| Runaway customer compute | concurrency limits, hard timeout, dispatch kill switch | load and cancellation drill |
| Administrator compromise | GitHub identity, least privilege, audit log, revocation | access review and incident drill |

## Emergency controls

Required before pilot:

- Global new-dispatch kill switch.
- Tenant and Project suspension.
- Platform-dispatched workflow cancellation.
- Result-intake suspension.
- GitHub OIDC trust revocation.
- Customer CI credential-rotation runbook.
- Run, Project, and tenant evidence deletion.
- Safe control-plane queue drain.
- GitHub App installation disablement.
- Security-event export.

Controls must be tested without deploying new code. The service cannot cancel a
customer-started workflow unless the installed GitHub App has an explicitly
approved permission and API path; result-intake suspension remains the
service-side containment boundary.

## Privacy policy boundary

The service requires synthetic data and prohibits customer PII in audited
environments. It does not claim that arbitrary customer content can never enter
transient processing inside the customer-controlled browser job. Defense in
depth prevents that content from being persisted, logged, published, or sent to
AI whenever detection and policy operate as designed.

## Review checklist

- [ ] Assign a security owner.
- [ ] Validate every trust boundary.
- [ ] Complete MEM-8, MEM-9, and MEM-22.
- [ ] Review extension permissions and distribution.
- [ ] Review trusted workflow, Action, image, and self-hosted runner policy.
- [ ] Review GitHub OIDC claims and replay protection.
- [ ] Review GitHub App permissions.
- [ ] Review R2 bucket and presigned URL policy.
- [ ] Review data retention jobs and reconciliation.
- [ ] Complete cross-tenant and artifact-parser penetration tests.
- [ ] Complete canary secret and PII leakage tests.
- [ ] Run incident-response and kill-switch drill.
- [ ] Record residual risks and pilot approval.
