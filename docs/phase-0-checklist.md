# Phase 0 infrastructure and security checklist

Status: Blocking prerequisite to MVP feature construction

Phase 0 validates the proposed Vercel Sandbox architecture. Documentation is not
proof: every item below requires captured test output, measurement, or review.

## Exit rule

- A failed security or isolation item rejects the architecture.
- A recorder latency, runtime, concurrency, or cost failure triggers an explicit
  architecture review.
- No authenticated customer pilot starts until all blocking items pass.

## 1. Sandbox image

- [ ] Build a minimal pinned Playwright OCI image.
- [ ] Record the image digest and dependency provenance.
- [ ] Launch the image through the Vercel Sandbox SDK.
- [ ] Verify Chromium starts without downloading mutable runtime dependencies.
- [ ] Verify the Sandbox has no inherited Vercel production environment secrets.
- [ ] Verify filesystem and process isolation between two concurrent Sandboxes.
- [ ] Verify automatic stop and destruction after normal completion.
- [ ] Verify destruction after timeout, crash, and operator cancellation.

Evidence:

- Image digest
- Startup logs without secrets
- Cross-Sandbox isolation test
- Destruction timestamps

## 2. Hosted recorder

- [ ] Expose a visual browser stream through an authenticated Sandbox port.
- [ ] Send pointer, keyboard, and text input from the dashboard.
- [ ] Expose a synchronized semantic tree and action log.
- [ ] Record semantic role/name actions.
- [ ] Edit and replay the captured Journey.
- [ ] Suggest and confirm a success assertion.
- [ ] Measure input latency and stream responsiveness.
- [ ] Complete recorder operation using keyboard only.
- [ ] Test the recorder with a screen reader.

Target:

- A representative Journey can be recorded and published in under 30 minutes.

## 3. Authentication

- [ ] Establish an interactive synthetic test session.
- [ ] Encrypt `storageState` before it leaves the recorder Sandbox.
- [ ] Prove plaintext does not enter PostgreSQL, Redis, R2, logs, or AI.
- [ ] Deliver plaintext just in time to one approved audit Sandbox.
- [ ] Prove another Sandbox cannot read it.
- [ ] Verify main/preview session portability detection.
- [ ] Verify expired-session diagnosis and manual reconnect.
- [ ] Verify session revocation.

## 4. Deterministic audit

- [ ] Replay one representative Journey normally.
- [ ] Replay every user-facing step with keyboard input only.
- [ ] Run Axe after every stable user-facing step.
- [ ] Detect a seeded unreachable control.
- [ ] Detect a seeded keyboard trap.
- [ ] Detect a seeded Axe regression in a transient dialog state.
- [ ] Confirm the Journey success assertion.
- [ ] Run cleanup after success and failure.
- [ ] Normalize and compare Findings against main.
- [ ] Perform one confirmation rerun.

## 5. Network isolation

- [ ] Start with deny-all egress.
- [ ] Permit only the approved application and resource hosts.
- [ ] Block an unapproved HTTPS exfiltration host.
- [ ] Block plain HTTP exfiltration.
- [ ] Block loopback.
- [ ] Block RFC 1918 private ranges.
- [ ] Block link-local and cloud metadata endpoints.
- [ ] Block IPv6 local and private ranges.
- [ ] Validate redirect destinations.
- [ ] Demonstrate DNS rebinding resistance.
- [ ] Demonstrate that PR content cannot modify network policy.
- [ ] Verify wildcard and public-suffix validation.

Any failure in this section rejects Vercel Sandbox for authenticated audits.

## 6. Evidence and redaction

- [ ] Create the minimum Evidence Bundle.
- [ ] Seed known email, phone, token, cookie, and synthetic secret canaries.
- [ ] Prove canaries do not enter persisted evidence.
- [ ] Suppress an artifact whose potential PII cannot be safely redacted.
- [ ] Upload permitted evidence to private R2.
- [ ] Verify tenant authorization before evidence access.
- [ ] Verify short-lived presigned access.
- [ ] Delete raw Sandbox artifacts at Run completion.
- [ ] Delete redacted evidence immediately on request.
- [ ] Verify scheduled 30-day deletion and reconciliation.

## 7. Google Cloud KMS

- [ ] Create separate non-production and production key rings.
- [ ] Configure one tenant KEK and one Project DEK.
- [ ] Configure Vercel team-scoped OIDC federation.
- [ ] Restrict access to the production project and environment claims.
- [ ] Prove preview deployments cannot decrypt.
- [ ] Prove Sandboxes cannot call KMS.
- [ ] Rotate a KEK and rewrap the Project DEK.
- [ ] Revoke Project access.
- [ ] Destroy a tenant KEK and verify ciphertext is unrecoverable.
- [ ] Verify Cloud Audit Logs contain KMS operations without plaintext.
- [ ] Configure alerts for anomalous decrypt volume and IAM changes.

## 8. GitHub integration

- [ ] Validate webhook signatures.
- [ ] Reject replayed webhook deliveries.
- [ ] Verify least-privilege App permissions.
- [ ] Confirm repository contents are inaccessible.
- [ ] Discover a main and PR deployment from the configured trusted source.
- [ ] Bind the preview to the exact head commit.
- [ ] Reject an arbitrary URL in a comment or status description.
- [ ] Complete every check with `success` or `neutral`.
- [ ] Verify the check cannot block a protected branch.
- [ ] Require approval for an untrusted authenticated PR.
- [ ] Reject automatic authenticated execution for a fork.

## 9. Concurrency, runtime, and cost

- [ ] Run five isolated Journeys concurrently.
- [ ] Measure Sandbox startup time.
- [ ] Measure control, keyboard, Axe, redaction, and upload time separately.
- [ ] Complete a representative five-Journey Project under 10 minutes median.
- [ ] Enforce the 20-minute project timeout.
- [ ] Preserve completed results when one Journey times out.
- [ ] Calculate cost per Journey, Project audit, confirmation rerun, and fresh
  main Baseline.
- [ ] Configure spend alerts and a hard operational kill switch.

## 10. Operational controls

- [ ] Stop all new runs globally.
- [ ] Suspend one tenant and one Project.
- [ ] Terminate an active Sandbox.
- [ ] Drain pending jobs without running authenticated work.
- [ ] Revoke all sessions for a Project.
- [ ] Delete evidence by Run, Project, and tenant.
- [ ] Disable a GitHub installation.
- [ ] Rotate keys.
- [ ] Exercise the incident-response procedure.

## 11. Product accessibility

- [ ] Complete onboarding using keyboard only.
- [ ] Record and edit a Journey using keyboard only.
- [ ] Inspect a Finding and evidence using keyboard only.
- [ ] Validate accessible live progress and terminal status.
- [ ] Test critical workflows with at least one screen reader.
- [ ] Verify the semantic recorder alternative is usable.
- [ ] Dogfood the Audit Engine against the product.

## 12. Phase 0 decision record

Record:

- Date.
- Participants.
- Exact provider plans and regions.
- Exact browser, Playwright, Axe, and image versions.
- Test evidence links.
- Measured latency, runtime, concurrency, and cost.
- Failed or waived checks.
- Residual risks.
- Final decision: accept Vercel Sandbox, revise, or reject.

