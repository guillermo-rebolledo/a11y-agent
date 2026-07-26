# Customer GitHub configuration

Status: scaffold-only; authenticated execution is not approved

## GitHub App

Use the non-production GitHub App and grant access only to repositories selected
for a Project. The App requests:

- read access to repository metadata, pull requests, deployments, and checks;
- write access to the product's own checks and to workflow
  dispatch/cancellation where required;
- no repository contents access;
- no organization-member access.

Confirm the installation ID and repository ID in the Project before saving.
Source files must remain inaccessible to the control plane.

## Trusted workflow

Copy the workflow shown by onboarding and replace every placeholder with a full,
reviewed commit SHA. Never use a mutable branch or tag for the reusable workflow,
Action, or runner image.

The publisher identity is bound to the expected repository, workflow, ref,
protected GitHub Environment, audience, and commit. The browser job has no
publisher identity; the publisher runs no browser or repository code.

## Synthetic login custody

Create a least-privilege synthetic account in the customer's non-production
application. Store its credentials only as secrets in the protected GitHub
Environment used by the browser job.

Never paste a password, token, cookie, `storageState`, or other login material
into the dashboard, Extension Recorder export, workflow inputs, Project
configuration, support messages, or evidence.

## Current safety state

The MEM-11 scaffold cannot start authenticated Audit Runs or provision pilot
tenants. `AUTHENTICATED_EXECUTION_ENABLED` and
`PILOT_PROVISIONING_ENABLED` are documented as false and are intentionally not
read as feature switches by the application. Enablement requires a later,
evidence-backed ADR-0005 gate decision and code change.
