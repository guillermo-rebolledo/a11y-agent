# Validate Vercel Sandbox before adopting it as the runner

Vercel is the preferred control plane and Vercel Sandbox appears to provide the
Firecracker isolation, OCI support, ports, runtime, and egress controls required
for hosted recording and auditing. Because streaming latency and the exact
security boundary are empirical, Phase 0 must pass the documented isolation,
exfiltration, concurrency, runtime, and cost checklist before the architecture is
accepted.

## Validation result — 2026-07-25

Rejected for authenticated Audit Runs.

MEM-7 launched a digest-pinned Chromium runner and completed five isolated
Journeys concurrently, but the required network boundary did not hold:

- The cloud metadata address returned HTTP 401 despite an exact
  `169.254.169.254/32` deny.
- A redirect from an approved host reached that metadata address.
- The selected public DNS-rebinding fixture did not produce a conclusive,
  certificate-valid rebinding test.

The machine-verifiable evidence is in
`evidence/MEM-7/proof-report.json`. Per the Phase 0 exit rule, Vercel Sandbox
must not receive authenticated customer sessions unless a later decision
documents and proves a provider-side or proxy-based boundary that closes these
failures.
