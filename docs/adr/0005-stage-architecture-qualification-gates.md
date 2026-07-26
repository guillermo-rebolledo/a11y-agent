# Stage architecture qualification before construction, authenticated enablement, and pilot

Status: Accepted

Date: 2026-07-26

## Context

MEM-10 correctly produced a `revise` decision because several blocking Phase 0
checks lacked objective evidence. Its first interpretation stopped MEM-11 and
all later work until every checklist item passed.

That interpretation creates a dependency cycle. Deterministic auditing,
deployment gating, operational controls, product accessibility, representative
runtime, and end-to-end onboarding cannot be proven before the application and
Audit Engine exist. Treating their proof as a prerequisite to constructing
those capabilities makes the proof impossible to obtain.

The narrow architecture proofs did establish enough to construct the product
without enabling authenticated customer use: local recording, customer custody
of browser authentication, immutable customer-executed Actions, separate OIDC
publication, bounded artifact validation, and exclusion of browser session
material from service contracts.

## Decision

Phase 0 uses three cumulative gates.

### 1. Construction gate

Passing this gate permits application and Audit Engine construction with local
fixtures, synthetic data, and non-production provider environments.

It does not permit customer login credentials, authenticated customer Audit
Runs, pilot tenants, or production enablement.

MEM-8, MEM-9, MEM-22, and the MEM-10 qualification report satisfy this gate for
MEM-11 scaffold work.

### 2. Authenticated-enablement gate

This gate is evaluated after the relevant vertical slices exist and before any
customer credential or authenticated preview is enabled. It requires objective
evidence for deployment trust, contributor gating, credential custody,
browser/publisher separation, OIDC policy, artifact handling, deletion, and
fail-closed security outcomes.

Implementation may proceed to create the evidence seam. Enablement may not.

### 3. Private-pilot gate

MEM-21 owns the final end-to-end qualification. It requires deterministic
Control, Keyboard, and Axe execution; Baseline comparison; representative
runtime and cost; operational drills; product accessibility; exact provenance;
clean-state onboarding; and explicit product, security, accessibility, and
operator approval.

No authenticated pilot begins until this gate passes.

## Consequences

- MEM-11 is unblocked for scaffold-only construction.
- The MEM-10 `revise` result remains valid; missing evidence is not waived.
- Code completion and security enablement are separate state transitions.
- Any demonstrated identity, provenance, session-custody, artifact, or
  isolation failure still rejects authenticated use.
- The two missing cross-cutting proofs are tracked as focused children of
  MEM-21 rather than duplicating deterministic-audit delivery issues.
