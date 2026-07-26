# MEM-22 customer-executed GitHub Action proof

Result: **passed** on 2026-07-26.

The public `guillermo-rebolledo/a11y-demo` customer repository called the
reusable workflow at immutable commit
`0f1968a9a72e52ab1c1abdb1d23c4f4a6b0cdd52`. That workflow called the Action at
immutable commit `76a12cdfbcea4ab5eb1cf1d4d7763f4449c14d76` and ran Chromium
149.0.7827.55 from the Playwright 1.61.1 image pinned by digest.

Five GitHub-hosted browser jobs overlapped. Each ran as UID 1001, received the
customer-owned synthetic login only inside the protected `a11y-synthetic`
environment, proved that invalid authentication was rejected before the valid
synthetic login was accepted, and uploaded one bounded Evidence Bundle. The
separate publisher job received no login secret, validated each untrusted
bundle against the published JSON Schema, requested a fresh GitHub OIDC token,
and sent both to an independent HTTP control-plane verifier fixture. The
verifier used an independently configured allowlist from the protected
publication environment and checked GitHub's signature plus repository, owner,
caller workflow, reusable workflow, ref, environment, audience, commit, run,
freshness, revocation, duplicate, and replay identity before issuing a
content-free receipt. Its atomic replay markers survive a verifier-process
restart within the proof fixture.

The final success run is
[30187979088](https://github.com/guillermo-rebolledo/a11y-demo/actions/runs/30187979088).
The six negative terminal runs are listed in `proof-report.json`.

## Measurements

- Five browser jobs: 33–40 seconds each, with distinct ephemeral runner names.
- Chromium startup: 142–169 ms.
- Journey runtime: 1.155–1.284 seconds.
- Success workflow: 73 seconds elapsed, including 12 seconds before the browser
  jobs started.
- Allocated runner time: 3.32 minutes.
- Six uploaded proof artifacts: 8,827 bytes total.
- Customer setup: approximately 2 minutes for two environments, two synthetic
  secrets, and the pinned caller workflow.

## Verify

```sh
shasum -a 256 -c evidence/MEM-22/CHECKSUMS.sha256
pnpm vitest run src/mem-22
pnpm typecheck
```

`raw/` contains downloaded bundles, publication receipts, run/job metadata,
artifact digests, environment protection configuration, the exact customer
workflow, and selected GitHub logs. Known email, password, and cookie canaries
were checked before serialization and are absent from the committed evidence.

The proof intentionally excludes persistent and shared self-hosted runners from
the MVP. The HTTP verifier is a proof fixture; production deployment and a
shared replay store across workflow runs are part of MEM-9.
