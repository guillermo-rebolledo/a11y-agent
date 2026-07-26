# MEM-7 disposable Chromium proof

Run the hosted proof from the linked Vercel project:

```sh
vercel env pull .env.local
pnpm proof:mem-7
pnpm proof:mem-7:verify
```

The proof boots five non-persistent Vercel Sandboxes from the digest-pinned
`runner` image, executes the synthetic Journey concurrently, verifies the
network and resource boundary, deletes every Sandbox, and writes the
machine-verifiable result to `proof-report.json`.

## Result

The 2026-07-25 run rejected Vercel Sandbox for authenticated Audit Runs:

- `169.254.169.254` returned HTTP 401 despite an exact `/32` deny.
- An allowed `httpbin.org` redirect reached the same metadata endpoint.
- The public DNS-rebinding fixture did not yield a valid two-address proof and
  failed TLS hostname validation, so that assertion remains failed.

All five concurrent Journeys passed and every success, crash, timeout, and
operator-cancellation Sandbox was deleted. `pnpm proof:mem-7:verify` exits
non-zero intentionally while the blocking network assertions fail.

Decision record:

- Date: 2026-07-25 (America/Mexico_City).
- Participants: Guillermo Ortiz and the Codex implementation agent.
- Provider plan: Vercel Hobby. The provider selected the Sandbox region;
  Vercel documented `iad1` as its only available region at validation time.
- Runner: Playwright 1.61.1, Chromium 149.0.7827.55, Axe 4.12.1, Sandbox SDK
  2.9.0, and the image digest recorded in `proof-report.json`.
- Measurements: five Journey startup, runtime, active-CPU, and estimated-cost
  values are recorded in `proof-report.json`.
- Residual risks: Vercel exposes no Sandbox-wide disk quota in SDK 2.9.0;
  IPv6 CIDR policy was rejected by the API; multicast CIDR policy caused an
  internal provider error; the selected public rebinding fixture was
  inconclusive; raw provider transcripts are not retained.
- Decision: reject Vercel Sandbox for authenticated Audit Runs.

The cost estimate uses the Vercel Pro rates observed on 2026-07-25:
$0.128 per active vCPU-hour and $0.0212 per provisioned GB-hour. It excludes
plan fees and network transfer.
