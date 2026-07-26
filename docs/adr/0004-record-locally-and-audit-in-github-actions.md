# Record Journeys locally and execute Audit Runs in GitHub Actions

Status: Accepted

Date: 2026-07-25

## Context

ADR-0002 and MEM-7 rejected Vercel Sandbox for authenticated Audit Runs because
the required metadata, redirect, DNS-rebinding, and Sandbox-wide resource
boundaries were not proven. Continuing with a hosted browser would require a
second execution provider plus a non-bypassable egress proxy while the service
would still have to receive, encrypt, deliver, and revoke customer browser
sessions.

The product can preserve deterministic Journey auditing without operating a
browser service. Journey authors already have an authenticated browser, and
GitHub customers already have an execution boundary for pull-request
automation.

## Decision

The MVP uses two customer-side browser surfaces:

1. A Manifest V3 Chrome extension records semantic Journey actions in a
   user-selected local tab. It uploads no cookies, `storageState`, login
   credentials, entered secret values, request bodies, or response bodies.
2. A customer-executed GitHub Actions workflow runs each automated Journey in a
   digest-pinned Playwright/Chromium container.

Automated execution is split into two jobs:

- The browser job has minimum GitHub permissions, receives only the customer's
  least-privilege synthetic login, and has no platform publishing credential.
- The publisher job runs no browser or pull-request code. It validates the
  browser job's bounded Evidence Bundle and authenticates to the control plane
  with a short-lived GitHub OIDC identity bound to the expected organization,
  repository, workflow, trusted ref, environment, audience, and commit.

The service stores Journey definitions, runner provenance, Audit Run state,
normalized Findings, Baselines, security events, and permitted redacted
evidence. It never stores or transports browser authentication material.

The supported MVP runner classes are GitHub-hosted ephemeral runners and an
explicitly approved ephemeral customer self-hosted runner contract. Persistent
or shared self-hosted runners are unsupported.

## Security constraints

- Authenticated Journeys never run automatically for forks.
- First-time or otherwise untrusted contributors require recorded approval.
- Privileged workflows, Actions, and images come from immutable trusted refs,
  not pull-request-controlled code.
- Browser-job artifacts are untrusted input and must pass strict schema, size,
  provenance, replay, and identity validation before publication.
- The publisher job has no customer login secret and the browser job has no
  publisher identity.
- Raw artifacts die with the browser job. Only policy-permitted redacted
  Evidence Bundles may be uploaded.

## Consequences

- The hosted recorder, browser-streaming channel, disposable Sandbox adapter,
  browser-session KMS envelope encryption, and provider egress proof leave the
  MVP.
- Customers must install an extension and a pinned GitHub Actions workflow.
- Customer GitHub Actions capacity and configuration become part of Audit Run
  reliability and support.
- The threat model shifts from protecting session delivery into our hosted
  browser to protecting customer CI credentials, trusted workflow definitions,
  job separation, OIDC publication, and untrusted artifact parsing.
- ADR-0003 is superseded for browser sessions. Evidence encryption remains a
  separate storage concern.
- MEM-22 is the blocking proof for this architecture. Failure of its security
  boundary rejects this decision before authenticated pilot use.
