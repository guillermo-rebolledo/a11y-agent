# Deployment guide

Status: Pre-implementation operator guide

Scope: Local development, the centrally hosted control plane, the Extension
Recorder, and the approved customer GitHub Actions workflow

Out of scope: Non-GitHub CI providers, Kubernetes runners, and persistent or
shared self-hosted runners

The application has not been scaffolded. Commands that depend on application
packages are intentionally deferred to the scaffolding ticket. This guide
defines the provider resources, security boundaries, configuration contract,
deployment sequence, verification, and teardown that implementation must
satisfy.

## Provider inventory

| Provider | Purpose | Minimum environment separation |
| --- | --- | --- |
| Vercel | Next.js dashboard and Fastify control plane | preview and production |
| Neon | PostgreSQL | development and production |
| Redis Cloud | Control-plane BullMQ coordination | development and production |
| Cloudflare R2 | Redacted evidence | development and production buckets |
| GitHub | App, workflow execution, OIDC publication, and checks | development and production Apps |
| Chrome extension distribution | Extension Recorder | development and pilot release channels |
| OpenAI | Optional AI Reviewer | disabled unless explicitly configured |

The service does not provision browser compute. Playwright and Chromium execute
inside the customer's GitHub Actions workflow.

Keep provider adapters portable. Do not embed provider resource names in domain
records when an internal identifier is sufficient.

## Environment contract

Use a checked-in `.env.example` after application scaffolding. Never commit
values. Expected control-plane categories:

```text
# Application
APP_ENV
APP_BASE_URL
DATABASE_URL
REDIS_URL

# GitHub App
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_WEBHOOK_SECRET
GITHUB_PRIVATE_KEY

# GitHub Actions publication
GITHUB_OIDC_ISSUER=https://token.actions.githubusercontent.com
GITHUB_OIDC_AUDIENCE
GITHUB_OIDC_ALLOWED_ORGANIZATION_ID
GITHUB_OIDC_REPLAY_TTL_SECONDS

# R2
EVIDENCE_BUCKET
EVIDENCE_ENDPOINT
EVIDENCE_ACCESS_KEY_ID
EVIDENCE_SECRET_ACCESS_KEY

# Optional AI
AI_REVIEW_ENABLED_DEFAULT=false
```

Customer workflow authentication is configured in a protected GitHub
Environment or an approved external secret manager. The service does not define
or receive the secret values.

Restrictions:

- Browser cookies, `storageState`, and login credentials never enter
  control-plane environment variables.
- No long-lived platform upload token is stored in the customer repository.
- GitHub workflow inputs contain opaque identifiers, not credentials or page
  content.
- Redis jobs contain opaque identifiers, not credentials, page content, or
  Evidence Bundles.
- The OpenAI key is absent when AI review is disabled.

## 1. Prepare accounts and regions

1. Create or identify operator-owned accounts for all providers.
2. Enable MFA for every human administrator.
3. Use organization/team ownership rather than personal ownership.
4. Select one primary operating region close to the design partners.
5. Keep Vercel Functions, Neon, Redis Cloud, and R2 jurisdiction aligned as
   closely as provider support permits.
6. Record cross-region transfer or residency in the threat model.
7. Configure billing alerts before provisioning production resources.
8. Create a dedicated GitHub organization or repositories for development
   fixtures and OIDC testing.

Do not reuse production resources for local development.

## 2. Configure Vercel

1. Create a Vercel team for the service.
2. Require MFA and limit administrative membership.
3. Create separate Vercel projects for the future web and API deployments, or
   document why a single project is sufficient after scaffolding.
4. Configure production and preview environments separately.
5. Do not expose production secrets to preview deployments.
6. Enable spend management and alerts.
7. Verify Vercel Functions cannot receive customer CI login credentials through
   any API schema.
8. Verify no control-plane route launches Playwright or Chromium.

The Fastify API runs as a Vercel Function. It dispatches or observes trusted
GitHub workflows, verifies OIDC publication, stores normalized results, and
publishes GitHub checks.

## 3. Configure Neon PostgreSQL

1. Create separate development and production Neon projects.
2. Select the aligned region.
3. Create least-privilege application roles.
4. Reserve schema-owner credentials for migrations only.
5. Use pooled connections for Vercel Functions.
6. Require TLS.
7. Configure backups and recovery appropriate to the pilot.
8. Prevent database logs from recording sensitive values.
9. Store trusted workflow identity, approved runner class, artifact digest,
   runner provenance, and OIDC publication metadata in bounded fields.
10. Prohibit columns for browser cookies, `storageState`, and customer login
    credentials.

Expected role separation:

- Migration role: schema changes only during controlled deployment.
- Runtime role: application CRUD within the service schema.
- Read-only operator role: metadata diagnostics without Evidence Bundle object
  access when practical.

## 4. Configure Redis Cloud and BullMQ

1. Provision separate development and production databases.
2. Require TLS.
3. Restrict network access as supported by the selected plan.
4. Configure persistence appropriate for control-plane coordination.
5. Configure BullMQ prefixes per environment.
6. Set bounded retry, backoff, and completed-job retention.
7. Enforce a job schema that permits opaque identifiers only.
8. Configure queue depth and stalled-job alerts.
9. Test safe drain behavior.

BullMQ does not execute or schedule browser work directly. Never place
credentials, page text, accessible names, DOM, screenshots, Evidence Bundles,
or AI prompts in Redis.

## 5. Configure private Cloudflare R2

1. Create separate private development and production buckets.
2. Disable public development URLs.
3. Create service credentials restricted to the required bucket.
4. Keep bucket credentials only in the production control plane.
5. Use opaque tenant, Project, and Run object keys.
6. Serve evidence only through authorization-checked short-lived presigned
   URLs.
7. Apply application-enforced 30-day deletion.
8. Run a reconciliation job that deletes overdue objects and reports drift.
9. Test immediate deletion by Run, Project, and tenant.
10. Configure storage and operation budget alerts.

R2 contains only permitted redacted Evidence Bundles. Raw artifacts remain in
the customer browser job and are destroyed when the job ends.

## 6. Configure the Extension Recorder

1. Create separate development and private-pilot extension identities.
2. Use Manifest V3 and a restrictive Content Security Policy.
3. Require an explicit user gesture before attaching to a selected tab.
4. Request only the minimum host access for the selected configured Project
   origin.
5. Do not request cookie, proxy, history, downloads, or debugger permissions
   unless a later ADR approves a demonstrated need.
6. Capture semantic actions without entered secret values.
7. Sign release artifacts and record source commit, build provenance, extension
   ID, and version.
8. Document update, rollback, revocation, and uninstall procedures.
9. Test keyboard-only and screen-reader use of the recorder controls.

The extension sends Journey drafts through an authenticated control-plane API.
The schema rejects browser state, credential, network-body, raw DOM, and
unbounded text fields.

## 7. Configure the GitHub App and Actions workflow

Create separate development and production GitHub Apps.

Base GitHub App access is limited to:

- Installation and repository metadata.
- Pull-request metadata.
- Deployment/check metadata needed to discover main and preview deployments.
- Write access to the product's own check runs.

Workflow dispatch and cancellation permissions are requested only if the pilot
uses platform-triggered Actions. Customer-triggered mode must remain usable
without those permissions.

Do not request:

- Repository contents for the control plane.
- Repository or organization secrets.
- Administration unrelated to installation management.

### Trusted workflow

1. Trigger authenticated auditing from a workflow definition on a trusted
   default-branch ref.
2. Do not use `pull_request_target` to check out or execute pull-request code.
3. Pin reusable workflows and third-party Actions to immutable commit SHAs.
4. Pin the Playwright runner image by digest.
5. Pass only opaque Project, Journey Version, Audit Run, deployment, and commit
   identifiers as inputs.
6. Never accept credentials or arbitrary target URLs as workflow-dispatch
   inputs.
7. Use a protected GitHub Environment for authenticated execution and required
   approvals.
8. Deny automatic authenticated execution for forks.

### Browser job

1. Set minimum GitHub permissions and omit `id-token: write`.
2. Do not check out or execute pull-request repository code.
3. Resolve the approved deployment through trusted metadata.
4. Establish the synthetic login from customer-controlled protected secrets.
5. Run one Journey in the digest-pinned container.
6. Produce only the bounded redacted Evidence Bundle.
7. Upload the artifact with short retention and a content-free name.
8. Delete working files and close Chromium on every terminal path.

### Publisher job

1. Run after the browser job and do not receive its login secret.
2. Do not launch a browser or execute repository, pull-request, or artifact
   code.
3. Parse the artifact only through the bounded schema validator.
4. Verify the expected artifact and runner provenance.
5. Request `id-token: write` only in this job.
6. Request a GitHub OIDC token with the configured audience.
7. Upload the validated result to the control plane.
8. Delete the workflow artifact after confirmed publication when supported.

### Control-plane OIDC verification

1. Verify issuer, audience, signature, and time claims.
2. Bind organization, repository, workflow, trusted ref, environment, and
   commit claims to the Project and Audit Run.
3. Require a one-time Audit Run publication nonce or equivalent replay key.
4. Reject wrong, expired, duplicate, replayed, or revoked identities.
5. Record content-free publication security events.

## 8. Optional OpenAI configuration

AI review remains off by default.

When enabled:

1. Store the API credential only in the production control plane.
2. Do not expose it to preview deployments, extensions, or Actions jobs.
3. Send only minimized redacted Finding bundles.
4. Record model and prompt-template versions.
5. Set request timeouts and cost limits.
6. Treat AI failure as explanation unavailable, never Audit Run failure.
7. Support deleting generated explanations independently.

## 9. Deployment sequence

After the application scaffold exists:

1. Run formatting, linting, type checks, unit tests, and security schema tests.
2. Build and sign the Extension Recorder.
3. Build the pinned runner image and verify its digest and provenance.
4. Pin the reusable workflow and Action release.
5. Apply database migrations with the migration role.
6. Deploy the Fastify control plane.
7. Deploy the Next.js dashboard.
8. Register allowed extension, workflow, Action, image, runner, and OIDC
   identities in production configuration.
9. Run provider connectivity checks without customer data.
10. Run the Phase 0 smoke Journey using synthetic fixtures.
11. Verify GitHub check completion and evidence deletion.
12. Enable pilot tenant access manually.

Production enablement is a separate explicit action after deployment.

## 10. Smoke test

The deployment smoke test must:

1. Record one semantic Journey in the development extension without exporting
   browser session material.
2. Receive a signed GitHub test event.
3. Resolve a trusted synthetic main and preview deployment.
4. Dispatch or start the trusted workflow from its approved ref.
5. Launch the digest-pinned image in an unprivileged browser job.
6. Establish the synthetic login inside that job.
7. Run a small Control Replay and Keyboard Replay.
8. Produce one seeded Axe Finding and a bounded redacted Evidence Bundle.
9. Prove the browser job cannot request the publisher identity.
10. Validate the artifact in the separate publisher job.
11. Publish through short-lived GitHub OIDC.
12. Persist permitted evidence to private R2.
13. Publish a `neutral` GitHub check.
14. Delete raw and persisted test artifacts.

## 11. Rollback

1. Activate the global new-dispatch kill switch.
2. Suspend result intake if identity or artifact validation is affected.
3. Drain control-plane queues without dispatch or publication.
4. Cancel active platform-dispatched workflows.
5. Revoke the affected workflow, Action, image, extension, or OIDC trust.
6. Roll back Vercel web and API deployments.
7. Do not reverse a database migration until compatibility is understood.
8. Ask affected customers to rotate CI credentials if exposure is suspected.
9. Verify GitHub checks reach a terminal neutral state.
10. Record the incident or deployment failure.

## 12. Teardown

For a complete environment teardown:

1. Disable new dispatch and result intake.
2. Cancel platform-dispatched workflows.
3. Drain control-plane queues.
4. Revoke Extension Recorder and GitHub OIDC trust.
5. Remove GitHub App installations.
6. Delete R2 objects and verify deletion.
7. Delete Redis and Neon resources after required metadata export.
8. Remove Vercel projects.
9. Confirm billing resources no longer accrue cost.
10. Preserve only the security audit records required by policy.
11. Provide customers with Action removal and CI credential-rotation steps.

## 13. Operator verification checklist

- [ ] Provider ownership and MFA verified.
- [ ] Region and residency recorded.
- [ ] Production secrets absent from Vercel previews.
- [ ] GitHub App has no repository contents or secrets permission.
- [ ] Extension permissions and release provenance pass review.
- [ ] Workflow, Action, image, and runner identities are immutable and approved.
- [ ] Browser job has no publisher identity.
- [ ] OIDC claims, freshness, revocation, and replay protection pass.
- [ ] Browser sessions and CI credentials never enter the service.
- [ ] R2 is private and evidence access is authorized.
- [ ] Redis contains identifiers only.
- [ ] Artifact validation and retention reconciliation pass.
- [ ] Kill switch, cancellation, result-intake suspension, and rollback drills
  pass.
- [ ] Product accessibility smoke test passes.
- [ ] Phase 0 decision record is approved.
