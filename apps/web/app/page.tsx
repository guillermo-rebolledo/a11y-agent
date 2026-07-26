import { Card } from "@a11y-agent/ui/card";

const steps = [
  "Sign in with a non-production GitHub test account",
  "Install the least-privilege GitHub App",
  "Configure trusted deployment sources",
  "Connect the Extension Recorder",
  "Pin the trusted GitHub Action workflow",
];

export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="mb-4 font-mono text-sm uppercase tracking-[0.2em] text-emerald-300">
          Project onboarding
        </p>
        <h1 className="text-balance text-5xl font-semibold leading-tight">
          Test complete user journeys, accessibly.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Connect a GitHub Project to deterministic keyboard and Axe auditing.
          Customer credentials never enter the control plane.
        </p>
        <a
          href="/auth/github"
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-emerald-300 px-5 py-3 font-semibold text-slate-950 no-underline hover:bg-emerald-200 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-emerald-300"
        >
          Continue with GitHub test account
        </a>
      </div>

      <section aria-labelledby="setup-heading" className="mt-16">
        <h2 id="setup-heading" className="text-2xl font-semibold">
          What you’ll configure
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step}>
              <Card className="h-full">
                <span aria-hidden="true" className="text-emerald-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-4 text-lg">{step}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <aside
        aria-labelledby="safety-heading"
        className="mt-12 rounded-xl border border-amber-500/40 bg-amber-950/20 p-6"
      >
        <h2 id="safety-heading" className="font-semibold text-amber-200">
          Authenticated execution is off
        </h2>
        <p className="mt-2 text-slate-300">
          This deployed scaffold uses synthetic fixtures only. Audit Runs and
          pilot provisioning remain disabled until the authenticated-enablement
          gate passes.
        </p>
      </aside>
    </main>
  );
}
