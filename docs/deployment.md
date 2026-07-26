# Deployment guide

Status: Pre-implementation operator guide

Scope: Local development and the centrally hosted SaaS

Out of scope: Customer self-hosting and customer-hosted runners

The application has not been scaffolded. Commands that depend on application
packages are intentionally deferred to the scaffolding ticket. This guide defines
the provider resources, security boundaries, configuration contract, deployment
sequence, verification, and teardown that implementation must satisfy.

## Provider inventory

| Provider | Purpose | Minimum environment separation |
| --- | --- | --- |
| Vercel | Next.js, Fastify, Sandbox orchestration | preview and production |
| Neon | PostgreSQL | development and production |
| Redis Cloud | BullMQ | development and production |
| Cloudflare R2 | redacted evidence | development and production buckets |
| Google Cloud | KMS and audit logs | non-production and production key rings |
| GitHub | App installation and checks | development and production Apps |
| OpenAI | optional AI Reviewer | disabled unless explicitly configured |

Keep provider adapters portable. Do not embed provider resource names in domain
records when an internal identifier is sufficient.

## Environment contract

Use a checked-in `.env.example` after application scaffolding. Never commit
values. Expected categories:

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

# R2
EVIDENCE_BUCKET
EVIDENCE_ENDPOINT
EVIDENCE_ACCESS_KEY_ID
EVIDENCE_SECRET_ACCESS_KEY

# GCP identity and KMS resource identifiers
GCP_PROJECT_ID
GCP_PROJECT_NUMBER
GCP_WORKLOAD_IDENTITY_POOL_ID
GCP_WORKLOAD_IDENTITY_PROVIDER_ID
GCP_KMS_LOCATION
GCP_KMS_KEY_RING

# Optional AI
AI_REVIEW_ENABLED_DEFAULT=false
```

Restrictions:

- Browser sessions are never environment variables.
- Project DEKs are never environment variables.
- Redis jobs contain identifiers, not secrets or page content.
- The OpenAI key is absent when AI review is disabled.
- Vercel uses OIDC to reach GCP; no GCP service-account JSON key is stored.

## 1. Prepare accounts and regions

1. Create or identify operator-owned accounts for all providers.
2. Enable MFA for every human administrator.
3. Use organization/team ownership rather than personal ownership.
4. Select one primary operating region close to the design partners.
5. Keep Vercel Functions, Neon, Redis Cloud, R2 jurisdiction, and GCP KMS region
   aligned as closely as provider support permits.
6. Record any cross-region transfer or residency in the threat model.
7. Configure billing alerts before provisioning production resources.

Do not reuse production resources for local development.

## 2. Configure Vercel

1. Create a Vercel team for the service.
2. Require MFA and limit administrative membership.
3. Create separate Vercel projects for the future web and API deployments, or
   document why a single project is sufficient after scaffolding.
4. Enable team-scoped OIDC issuer mode.
5. Configure production and preview environments separately.
6. Do not expose production secrets to preview deployments.
7. Enable spend management and alerts.
8. Verify Vercel Sandbox availability and concurrency for the selected plan.
9. Configure Sandbox network policy as deny-by-default.
10. Permit Sandbox ports only for the authenticated recorder/control channel.

The Fastify API runs as a Vercel Function. Playwright runs only in Vercel
Sandbox, never inside a Function.

### Vercel Sandbox image

During Phase 0:

1. Build a Playwright OCI image from a pinned browser base.
2. Pin OS packages, Node, Playwright, Chromium, and Axe versions.
3. Remove package managers and build tooling from the final runtime layer where
   practical.
4. Run as a non-root process inside the Sandbox even though the microVM offers
   stronger isolation.
5. Push to the approved registry.
6. Record and deploy by immutable digest.
7. Verify the image contains no credentials or test sessions.

## 3. Configure Neon PostgreSQL

1. Create separate development and production Neon projects.
2. Select the aligned region.
3. Create least-privilege application roles.
4. Reserve schema-owner credentials for migrations only.
5. Use pooled connections for Vercel Functions.
6. Require TLS.
7. Configure backups and recovery appropriate to the pilot.
8. Prevent database logs from recording sensitive values.
9. Confirm encrypted session ciphertext and wrapped DEK metadata are stored in
   separate logical fields.
10. Test restore without exposing plaintext session data.

Expected role separation:

- Migration role: schema changes only during controlled deployment.
- Runtime role: application CRUD within the service schema.
- Read-only operator role: metadata diagnostics without session ciphertext
  access when practical.

## 4. Configure Redis Cloud and BullMQ

1. Provision separate development and production databases.
2. Require TLS.
3. Restrict network access as supported by the selected plan.
4. Configure persistence appropriate for a job queue.
5. Configure BullMQ prefixes per environment.
6. Set bounded retry, backoff, and completed-job retention.
7. Enforce a job schema that permits opaque identifiers only.
8. Configure queue depth and stalled-job alerts.
9. Test safe drain behavior.

Never place sessions, page text, accessible names, DOM, screenshots, or AI
prompts in Redis.

## 5. Configure private Cloudflare R2

1. Create separate private development and production buckets.
2. Disable public development URLs.
3. Create service credentials restricted to the required bucket.
4. Keep bucket credentials only in the production control plane.
5. Use opaque tenant/Project/Run object keys.
6. Serve evidence only through authorization-checked short-lived presigned URLs.
7. Apply application-enforced 30-day deletion.
8. Run a reconciliation job that deletes overdue objects and reports drift.
9. Test immediate deletion by Run, Project, and tenant.
10. Configure storage and operation budget alerts.

R2 contains only permitted redacted Evidence Bundles. Raw artifacts remain inside
the Sandbox and are destroyed.

## 6. Configure Google Cloud KMS

### 6.1 Create the GCP projects

1. Create separate non-production and production GCP projects.
2. Attach billing.
3. Enable Cloud KMS, IAM, Security Token Service, and Cloud Audit Logs as
   required.
4. Restrict project administration to a small operator group.
5. Configure budget alerts.

### 6.2 Create key rings

1. Select the approved KMS region.
2. Create one key ring per environment.
3. Do not share production and non-production key rings.
4. Configure software-protected symmetric AES-256 keys unless the threat model
   later requires HSM protection.
5. Create one KEK per pilot tenant.
6. Set a documented rotation schedule.
7. Configure a destruction waiting period that supports emergency recovery
   without defeating cryptographic deletion policy.

Each Project receives a random application-generated DEK. The tenant KEK wraps
the Project DEK; the Project DEK encrypts session state.

### 6.3 Configure Vercel OIDC federation

1. In Vercel, use team-scoped OIDC issuer mode.
2. In GCP, create one Workload Identity Pool for the Vercel production
   environment.
3. Add an OIDC provider using the Vercel team issuer.
4. Map only the claims required to identify the Vercel team, project, and
   environment.
5. Add attribute conditions that allow the production API project only.
6. Do not authorize preview deployments.
7. Grant the federated production principal only the minimal encrypt/decrypt
   permissions for the applicable tenant keys.
8. Prefer direct resource access or tightly scoped service-account impersonation;
   do not create a service-account key.
9. Verify token audience and issuer.
10. Test that development, preview, and an unrelated Vercel project are denied.

### 6.4 Configure KMS monitoring

1. Enable data-access audit logs for KMS.
2. Alert on IAM changes.
3. Alert on key disablement or destruction scheduling.
4. Alert on abnormal decrypt volume.
5. Ensure logs contain resource metadata but never plaintext or DEKs.
6. Exercise rotation, rewrap, revocation, and destruction.

### Local development

Developers use their own short-lived Google identity through Application Default
Credentials or a dedicated non-production federation path. Do not download a
production service-account key.

## 7. Configure the GitHub Apps

Create separate development and production GitHub Apps.

Requested access is limited to:

- Installation and repository metadata.
- Pull-request metadata.
- Deployment/check metadata needed to discover main and preview deployments.
- Write access to the Copilot's own check runs.

Do not request:

- Repository contents.
- Issues.
- Workflows.
- Repository secrets.
- Administration unrelated to installation management.

Required webhook handling:

1. Validate the signature before parsing trusted fields.
2. Record delivery IDs and reject replay.
3. Bind deployments to repository, commit, and trusted provider.
4. Complete checks using `success` or `neutral` only.
5. Handle installation suspension and deletion immediately.

## 8. Optional OpenAI configuration

AI review remains off by default.

When enabled:

1. Store the API credential only in the production control plane.
2. Do not expose it to preview deployments or Sandboxes.
3. Send only minimized redacted Finding bundles.
4. Record model and prompt-template versions.
5. Set request timeouts and cost limits.
6. Treat AI failure as explanation unavailable, never audit failure.
7. Support deleting generated explanations independently.

## 9. Deployment sequence

After the application scaffold exists:

1. Run formatting, linting, type checks, unit tests, and security schema tests.
2. Build the pinned runner image.
3. Verify its digest and provenance.
4. Apply database migrations with the migration role.
5. Deploy the Fastify control plane.
6. Deploy the Next.js dashboard.
7. Register the runner image digest in production configuration.
8. Run provider connectivity checks without customer data.
9. Run the Phase 0 smoke Journey using synthetic fixtures.
10. Verify GitHub check completion.
11. Verify evidence deletion.
12. Enable pilot tenant access manually.

Production enablement is a separate explicit action after deployment.

## 10. Smoke test

The deployment smoke test must:

1. Receive a signed GitHub test event.
2. Resolve a trusted synthetic main and preview deployment.
3. Create a BullMQ job containing identifiers only.
4. Launch a Vercel Sandbox.
5. Apply a restrictive egress allowlist.
6. Decrypt a synthetic session through GCP KMS using Vercel OIDC.
7. Deliver it directly to the Sandbox.
8. Run a small control and keyboard Journey.
9. Produce one seeded Axe Finding.
10. Redact the Evidence Bundle.
11. Persist it to private R2.
12. Publish a `neutral` check.
13. Delete raw artifacts and destroy the Sandbox.
14. Delete the persisted test evidence.

## 11. Rollback

1. Activate the global new-run kill switch.
2. Drain queued jobs without execution.
3. Terminate active Sandboxes if the release affects isolation or secrets.
4. Roll back Vercel web and API deployments.
5. Roll back the runner digest separately.
6. Do not reverse a database migration until compatibility is understood.
7. Revoke sessions or rotate keys if exposure is suspected.
8. Verify GitHub checks reach a terminal neutral state.
9. Record the incident or deployment failure.

## 12. Teardown

For a complete environment teardown:

1. Disable new Runs.
2. Terminate Sandboxes.
3. Drain queues.
4. Remove GitHub App installations.
5. Revoke sessions.
6. Delete R2 objects and verify deletion.
7. Destroy tenant KMS keys according to the approved waiting period.
8. Delete Redis and Neon resources after required metadata export.
9. Remove Vercel projects and OIDC trust.
10. Confirm billing resources no longer accrue cost.
11. Preserve only the security audit records required by policy.

## 13. Operator verification checklist

- [ ] Provider ownership and MFA verified.
- [ ] Region and residency recorded.
- [ ] Production secrets absent from preview.
- [ ] GitHub App has no contents permission.
- [ ] Vercel OIDC reaches GCP without persistent keys.
- [ ] KMS denies preview and Sandbox identities.
- [ ] R2 is private and evidence access is authorized.
- [ ] Redis contains identifiers only.
- [ ] Sandbox egress and destruction tests pass.
- [ ] Retention reconciliation passes.
- [ ] Kill switch and rollback drill pass.
- [ ] Product accessibility smoke test passes.
- [ ] Phase 0 decision record is approved.
