# MEM-22 customer-executed GitHub Action proof

Result: **passed** on 2026-07-26.

The public `guillermo-rebolledo/a11y-demo` customer repository called the
reusable workflow at immutable commit
`c948552040b0226c7eb75795ad24f339bd25bf38`. That workflow called the Action at
immutable commit `a9ac45cc39c83eaf0d9265cf40dcd0c698eb0a18` and ran Chromium
149.0.7827.55 from the Playwright 1.61.1 image pinned by digest.

Five GitHub-hosted browser jobs overlapped. Each ran as UID 1001, received the
customer-owned synthetic login only inside the protected `a11y-synthetic`
environment, and uploaded one bounded Evidence Bundle. The separate publisher
job received no login secret, validated each untrusted bundle, requested a
fresh GitHub OIDC token, and sent both to an independent HTTP control-plane
verifier fixture. The verifier checked GitHub's signature plus repository,
owner, caller workflow, reusable workflow, ref, environment, audience, commit,
run, freshness, revocation, duplicate, and replay identity before issuing a
content-free receipt.

The final success run is
[30187062811](https://github.com/guillermo-rebolledo/a11y-demo/actions/runs/30187062811).
The six negative terminal runs are listed in `proof-report.json`.

## Measurements

- Five browser jobs: 34–38 seconds each, with distinct ephemeral runner names.
- Chromium startup: 158–179 ms.
- Journey runtime: 1.103–1.162 seconds.
- Success workflow: 135 seconds elapsed, including 70 seconds of GitHub queue
  delay.
- Allocated runner time: 3.27 minutes.
- Six uploaded proof artifacts: 8,399 bytes total.
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
durable replay store are part of MEM-9.
