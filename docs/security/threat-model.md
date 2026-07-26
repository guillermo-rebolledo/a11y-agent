# Threat model

Status: Required review before authenticated pilot use

Owner: Unassigned until implementation planning

## Security objectives

1. A tenant cannot access another tenant's sessions, Findings, or Evidence
   Bundles.
2. Pull-request code cannot exfiltrate authentication material.
3. A browser cannot reach private infrastructure or cloud metadata.
4. Sensitive page content is not persisted by default.
5. AI receives only explicitly permitted redacted Finding data.
6. Operators can stop execution, revoke sessions, and delete evidence without a
   deployment.
7. Every sensitive operation is attributable to a GitHub identity or service
   principal.

## Trust boundaries

- User browser to Vercel dashboard.
- GitHub to webhook endpoint.
- Vercel control plane to Neon, Redis Cloud, R2, and GCP KMS.
- Control plane to disposable Vercel Sandbox.
- Sandbox to approved customer deployment origins.
- Deterministic Finding pipeline to optional AI Reviewer.
- Dashboard to redacted evidence delivery.

The customer preview is untrusted code even when it originates from the same
repository.

## Data classification

| Class | Examples | Persistence |
| --- | --- | --- |
| Public metadata | Rule IDs, engine versions | PostgreSQL allowed |
| Tenant metadata | Project, Journey, Run identifiers | PostgreSQL allowed |
| Sensitive metadata | Full origins, approver identities | Restricted PostgreSQL fields |
| Authentication material | Cookies, local storage, login secrets | Encrypted only; ephemeral plaintext |
| Customer content | Page text, accessible names, DOM | Suppressed by default |
| Redacted evidence | Cropped image, snippet, focus timeline | Private R2, default 30 days |
| Raw evidence | Video, trace, full DOM, network content | Ephemeral only by default |

## Mandatory controls

### Tenant isolation

- Every database query is scoped by installation and Project.
- Object keys use non-guessable tenant and Run identifiers.
- Authorization is checked before generating any evidence URL.
- R2 buckets are private.
- Presigned URLs are short-lived and single-purpose.
- Cross-tenant negative tests cover API, object storage, queue, and cache paths.

### Sandbox isolation

- One fresh Firecracker microVM per recorder or Journey execution.
- Pinned OCI image by immutable digest.
- No shared browser profile or filesystem.
- No production database, Redis, R2, KMS, or control-plane credentials inside the
  Sandbox.
- Strict CPU, memory, disk, port, and time limits.
- Sandbox destruction at every terminal outcome.

### Network policy

- Deny egress by default.
- Permit only administrator-approved versioned domains.
- Deny private, loopback, link-local, multicast, and cloud-metadata ranges.
- Resolve and revalidate DNS to resist rebinding.
- Validate every redirect destination.
- Never let pull-request code expand the allowlist.
- Block wildcard public suffixes and overly broad domains.

### Authenticated PR gating

- No automatic authenticated execution for forked pull requests.
- First-time and untrusted contributors require administrator approval.
- Deployment source and commit SHA are verified.
- Only least-privilege synthetic test accounts are used.
- Approval and session access are recorded.

### Session protection

- One GCP KMS KEK per tenant and environment.
- One random DEK per Project.
- Session state encrypted before leaving the recorder Sandbox.
- Wrapped DEKs and ciphertext stored separately when practical.
- Vercel production authenticates to GCP through OIDC federation.
- No long-lived GCP service-account key in Vercel.
- Preview deployments and Sandboxes have no direct KMS access.
- Decryption occurs just in time and plaintext is delivered directly to the
  approved Sandbox.
- Rotation, revocation, and cryptographic deletion are tested.

### Evidence minimization

- No request or response bodies.
- No raw network logs.
- No raw browser console messages in operational telemetry.
- Crop screenshots to the relevant region when safe.
- Redact known secrets, emails, phones, tokens, and configured selectors before
  persistence.
- Suppress an artifact when potential PII cannot be removed confidently.
- Raw artifacts are deleted at Run completion.
- Redacted evidence defaults to 30-day retention.

### AI boundary

- AI is off by default per Project.
- Only the redacted Finding bundle crosses the boundary.
- No session state, full DOM, full screenshot, trace, network content, or raw log
  enters an AI prompt.
- Responses are stored and deleted independently from deterministic Findings.
- Prompt and response telemetry follows the same content restrictions.

### Operational telemetry

Allowed:

- Opaque identifiers.
- Rule IDs and normalized categories.
- Durations, retries, resource usage, queue depth, and exit codes.
- Browser and engine versions.

Prohibited:

- Page text and accessible names.
- Form values.
- Full URLs, query strings, and fragments.
- Cookies, headers, tokens, and session data.
- DOM, images, AI prompts, and raw console or network content.

## Threat register

| Threat | Required mitigation | Verification |
| --- | --- | --- |
| Malicious preview steals session | trusted-contributor gate, synthetic account, egress denylist/allowlist | controlled exfiltration test |
| SSRF into private network | CIDR denial, redirect validation, DNS revalidation | metadata/private-IP test suite |
| DNS rebinding | resolve and revalidate, deny unsafe resolved IPs | rebinding test service |
| Cross-tenant API access | scoped authorization and opaque IDs | negative integration tests |
| Cross-tenant R2 access | private bucket, scoped keys, short presigned URLs | object-key fuzz tests |
| Queue leaks secrets | identifiers-only job schema | schema and log inspection |
| Session ciphertext stolen | envelope encryption and KMS IAM | decrypt-without-authority test |
| KMS identity stolen | Vercel OIDC, short-lived tokens, claim restrictions | IAM policy test |
| PII persisted in evidence | synthetic-data policy, redaction, suppression | seeded canary test |
| Secrets enter logs | structured metadata schema, sink scrubbers | canary leakage test |
| Forged GitHub webhook | signature validation and replay defense | invalid/replayed webhook tests |
| Arbitrary deployment target | trusted deployment source and origin validation | malicious URL tests |
| Supply-chain compromise | pinned images and lockfiles, provenance checks | digest/provenance verification |
| Artifact retention drift | scheduled deletion and reconciliation | aged-object test |
| Runaway spend or denial of service | quotas, concurrency limits, hard timeout, kill switch | load and budget alarm drill |
| Administrator compromise | GitHub identity, least privilege, audit log, revocation | access review and incident drill |

## Emergency controls

Required before pilot:

- Global new-run kill switch.
- Tenant and Project suspension.
- Active Sandbox termination.
- Session revocation.
- Project key destruction.
- Run, Project, and tenant evidence deletion.
- Safe queue drain that does not execute authenticated jobs.
- GitHub App installation disablement.
- Key rotation.
- Security-event export.

Controls must be tested without deploying new code.

## Privacy policy boundary

The service requires synthetic data and prohibits customer PII in audited
environments. It does not claim that arbitrary customer content can never enter
transient browser processing. Defense-in-depth prevents that content from being
persisted, logged, or sent to AI whenever detection and policy operate as
designed.

## Review checklist

- [ ] Assign a security owner.
- [ ] Validate every trust boundary.
- [ ] Complete the Phase 0 exfiltration tests.
- [ ] Review GCP KMS IAM and Vercel OIDC claims.
- [ ] Review GitHub App permissions.
- [ ] Review R2 bucket and presigned URL policy.
- [ ] Review data retention jobs and reconciliation.
- [ ] Complete cross-tenant penetration tests.
- [ ] Complete canary secret and PII leakage tests.
- [ ] Run incident-response and kill-switch drill.
- [ ] Record residual risks and pilot approval.
