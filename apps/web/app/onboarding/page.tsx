import { Card } from "@a11y-agent/ui/card";

const workflow = `name: Accessibility audit
on:
  workflow_dispatch:
permissions: {}
jobs:
  audit:
    uses: guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@<FULL_COMMIT_SHA>
    secrets: inherit`;

export default function Onboarding() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-12">
      <div
        role="status"
        aria-label="Signed in as fixture-admin"
        className="mb-8 rounded-md bg-emerald-950 p-4 text-emerald-100"
      >
        Signed in as fixture-admin through GitHub fixture authentication.
      </div>
      <h1 className="text-4xl font-semibold">Connect your first Project</h1>
      <p className="mt-4 text-slate-300">
        Repository metadata comes from GitHub App installation 24680. Repository
        source contents are inaccessible to this service.
      </p>

      <form
        className="mt-10 space-y-8"
        action="/onboarding/complete"
        method="post"
      >
        <Card>
          <fieldset>
            <legend className="text-xl font-semibold">
              1. GitHub repository
            </legend>
            <label htmlFor="repository" className="mt-5 block font-medium">
              Repository
            </label>
            <select
              id="repository"
              name="repository"
              className="mt-2 min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <option>memoji-inc/example</option>
            </select>
            <a
              className="mt-4 inline-block text-emerald-300 underline"
              href="#permissions"
            >
              Review requested permissions
            </a>
          </fieldset>
        </Card>

        <Card>
          <fieldset>
            <legend className="text-xl font-semibold">
              2. Deployment trust
            </legend>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="font-medium">
                Main origin
                <input
                  name="mainOrigin"
                  type="url"
                  required
                  defaultValue="https://example.test"
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                />
              </label>
              <label className="font-medium">
                Preview origin pattern
                <input
                  name="previewOrigin"
                  required
                  defaultValue="https://example-git-*.vercel.app"
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                />
              </label>
              <label className="font-medium">
                Environment identity
                <input
                  name="environment"
                  required
                  defaultValue="a11y-publication"
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                />
              </label>
            </div>
          </fieldset>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">3. Recorder and workflow</h2>
          <ol className="mt-5 list-decimal space-y-4 pl-5">
            <li>
              Build and verify the Extension Recorder artifact, then load the
              unpacked extension. It has no persistent host permissions.
            </li>
            <li>
              Add this pinned workflow in the selected repository:
              <pre
                tabIndex={0}
                className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-slate-200 focus-visible:outline-3 focus-visible:outline-emerald-300"
              >
                <code>{workflow}</code>
              </pre>
            </li>
            <li>
              Configure synthetic credentials only in the protected customer
              GitHub Environment. Never paste credentials here.
            </li>
          </ol>
        </Card>

        <section id="permissions" aria-labelledby="permissions-heading">
          <h2 id="permissions-heading" className="text-xl font-semibold">
            Least-privilege GitHub App permissions
          </h2>
          <p className="mt-3 text-slate-300">
            Read: metadata, pull requests, deployments, and checks. Write: the
            product’s own checks and required workflow dispatch/cancellation.
            Repository contents: none.
          </p>
        </section>

        <button
          type="submit"
          className="min-h-11 rounded-md bg-emerald-300 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-200 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-emerald-300"
        >
          Save disabled Project
        </button>
      </form>
    </main>
  );
}
