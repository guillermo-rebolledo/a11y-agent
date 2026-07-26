# Trusted customer audit Action

This composite Action is invoked only by the immutable reusable workflow in
`.github/workflows/customer-audit.yml`.

- `browser` runs Chromium inside the digest-pinned Playwright container. Login
  secrets are environment-only and the job has no GitHub OIDC permission.
- `publisher` runs in a separate non-container job. It receives no login secret,
  verifies GitHub's signed OIDC token and the bounded Evidence Bundle, then
  applies identity, freshness, revocation, duplicate, and replay policy.

Persistent or shared self-hosted runners are outside the MVP. The supported
contract is an ephemeral GitHub-hosted runner for every job.
