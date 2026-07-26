# MEM-10 architecture qualification

Decision: **revise** on 2026-07-26.

The Extension Recorder and customer-executed GitHub Action architecture has no
demonstrated reject-class security failure. The current proof does establish
the narrow permission boundary, customer custody of synthetic authentication,
immutable workflow and image trust, ephemeral browser-job isolation, separate
OIDC publication, strict artifact validation, fail-closed negative outcomes,
and exclusion of browser session material from service contracts.

The Phase 0 exit rule is not satisfied. MEM-8 remains partial, deterministic
Journey auditing has no run evidence, and several deployment, GitHub
integration, operational-control, cost, provenance, and product-accessibility
checks are partial or unevidenced. These gaps require revision and new
objective evidence; they are not waivers. MEM-11 and authenticated pilot use
remain blocked.

## Subsequent gate staging

ADR-0005 resolves the circular dependency discovered after this decision.
MEM-11 may construct the scaffold with fixtures, synthetic data, and
non-production providers. This does not change the MEM-10 `revise` result:
customer credentials, authenticated customer Audit Runs, production execution,
and pilot tenants remain blocked until their later gates pass.

`proof-report.json` contains:

- one machine-evaluated gate for every MEM-10 qualification concern;
- an assessment of all twelve Phase 0 checklist sections;
- exact versions and measurements where the source proofs captured them;
- explicit missing provenance, measurements, and operational drills;
- the requirements for a later `accept` decision.

The report deliberately leaves `productionConstraints` empty because those are
required only after acceptance. It leaves `replacementArchitecture` null
because no reject-class failure currently requires abandoning ADR-0004.

## Reproduce

From a clean checkout at the report commit:

```sh
corepack pnpm install --frozen-lockfile
pnpm proof:mem-9:verify
shasum -a 256 -c evidence/MEM-22/CHECKSUMS.sha256
pnpm proof:mem-10:verify
pnpm typecheck
```

The checks reproduce the repository evidence and the decision rule. They do
not substitute for the missing clean Chrome-profile, GitHub organization,
provider, or operational drills listed in `proof-report.json`.
