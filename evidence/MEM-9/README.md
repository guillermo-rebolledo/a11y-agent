# MEM-9 trusted publication and redacted evidence proof

Result: **passed** on 2026-07-26.

This proof extends the completed MEM-22 customer-executed workflow boundary.
The separate publisher accepts the browser artifact as bounded untrusted JSON,
binds it to GitHub's short-lived OIDC identity, suppresses the whole artifact
when a known or structurally detected sensitive value survives, and writes one
canonical Evidence Bundle through the private Cloudflare R2 adapter.

The R2 adapter exposes only service-side writes, deletes, and authorization-
checked signed reads. Object keys are opaque, responses are marked
`private, no-store`, and read grants cannot exceed five minutes. The lifecycle
contract proves immediate Audit Run deletion, Project deletion, scheduled
30-day expiry, and reconciliation of overdue catalog records.

Queue and telemetry parsers accept fixed, versioned, metadata-only shapes.
Publication, access, deletion, and reconciliation audit events contain
identifiers and enumerated outcomes, never page content or credentials.

## Verify

```sh
pnpm proof:mem-9:verify
pnpm typecheck
shasum -a 256 -c evidence/MEM-9/CHECKSUMS.sha256
```

`proof-report.json` maps every MEM-9 acceptance criterion to its executable or
configuration evidence. The provider adapter is tested against the Cloudflare
R2 binding contract; production bucket creation and credentials remain
deployment configuration and must follow `docs/deployment.md`.
