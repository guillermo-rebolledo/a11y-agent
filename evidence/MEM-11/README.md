# MEM-11 onboarding scaffold evidence

Captured on 2026-07-26.

The scaffold is deployed to projects classified
`construction-nonproduction`:

- dashboard: <https://a11y-agent-azure.vercel.app>
  (`dpl_8wMwvHa4v1Jccsqx25ph1Lxmjq8v`);
- control plane: <https://a11y-agent-api.vercel.app>
  (`dpl_8haDDMp34SMDBPz5qW3KxZwLuDNy`);
- persistence: Vercel Marketplace Neon resource `a11y-agent-neon`
  (`wild-recipe-95077595`), free plan.

Vercel's `production` and `preview` labels are routing/deployment targets inside
these separately classified scaffold projects; neither is a product production
environment. The Neon resource is attached to those two targets, contains only
the scaffold schema, and is prohibited from customer data or credentials. The
`projects` migration was applied and verified through
`information_schema.tables`. No database credentials are stored in this
evidence or in the repository.

The classification is enforced by the deployed capability contract
(`environmentClass: "construction-nonproduction"`), absent customer
authentication, disabled fixture authentication on the stable public route,
and hard-disabled authenticated execution and pilot provisioning. Promotion
requires separate provider resources plus a later ADR-0005 gate decision and
code change.

## Live checks

- dashboard `/`: HTTP 200;
- control-plane `/health`: `{"status":"ok"}`;
- control-plane `/capabilities`: repository contents are inaccessible,
  the environment is `construction-nonproduction`, authenticated execution is
  false, and pilot provisioning is false;
- dashboard `/auth/github`: HTTP 503 with fixture authentication disabled.

## Local checks

`pnpm check` passed:

- Prettier and Oxlint;
- TypeScript checks;
- 17 Vitest files and 103 tests;
- extension, API, and dashboard production builds;
- two Playwright keyboard/Axe onboarding journeys.

The evidence demonstrates the scaffold only. It does not approve authenticated
customer Audit Runs, production execution, or pilot provisioning.
