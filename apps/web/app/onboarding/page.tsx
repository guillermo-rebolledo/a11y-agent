import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@a11y-agent/ui/button";
import { Card } from "@a11y-agent/ui/card";

import {
  FIXTURE_INSTALLATION_COOKIE,
  FIXTURE_SESSION_COOKIE,
  fixtureAuthEnabled,
} from "@/lib/fixture-auth";

const workflow = `name: Accessibility audit
on:
  workflow_dispatch:
permissions: {}
jobs:
  audit:
    permissions:
      id-token: write
    uses: guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml@<FULL_COMMIT_SHA>`;

type OnboardingProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Onboarding({ searchParams }: OnboardingProps) {
  const cookieStore = await cookies();
  if (
    !fixtureAuthEnabled() ||
    cookieStore.get(FIXTURE_SESSION_COOKIE)?.value !== "fixture-session" ||
    cookieStore.get(FIXTURE_INSTALLATION_COOKIE)?.value !== "24680"
  ) {
    redirect("/");
  }
  const { error } = await searchParams;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-12">
      <div
        role="status"
        aria-label="Signed in as fixture-admin"
        className="mb-8 rounded-md bg-emerald-950 p-4 text-emerald-100"
      >
        Signed in as fixture-admin. GitHub App test installation 24680 is
        connected.
      </div>
      {error ? (
        <div
          role="alert"
          className="mb-8 rounded-md bg-red-950 p-4 text-red-100"
        >
          Project could not be saved: {error}
        </div>
      ) : null}
      <h1 className="text-4xl font-semibold">Connect your first Project</h1>
      <p className="mt-4 text-slate-300">
        Repository metadata comes from the selected test installation.
        Repository source contents are inaccessible to this service.
      </p>

      <form
        className="mt-10 space-y-8"
        action="/onboarding/complete"
        method="post"
      >
        <input type="hidden" name="installationId" value="24680" />
        <input type="hidden" name="repositoryId" value="13579" />
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
              2. Deployment and publisher trust
            </legend>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <ConfigurationField
                label="Main origin"
                name="mainOrigin"
                defaultValue="https://example.test"
                type="url"
              />
              <ConfigurationField
                label="Preview origin pattern"
                name="previewOrigin"
                defaultValue="https://example-git-*.vercel.app"
              />
              <ConfigurationField
                label="Workflow path"
                name="workflow"
                defaultValue=".github/workflows/a11y-audit.yml"
              />
              <ConfigurationField
                label="Trusted ref"
                name="ref"
                defaultValue="refs/heads/main"
              />
              <ConfigurationField
                label="Environment identity"
                name="environment"
                defaultValue="a11y-publication"
              />
              <ConfigurationField
                label="OIDC audience"
                name="audience"
                defaultValue="https://api.a11y-agent.example/publications"
                type="url"
              />
              <ConfigurationField
                label="Pinned workflow commit"
                name="commit"
                defaultValue="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                pattern="[a-f0-9]{40}"
              />
            </div>
          </fieldset>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">3. Recorder and workflow</h2>
          <ol className="mt-5 list-decimal space-y-4 pl-5">
            <li>
              Build <code>artifacts/a11y-journey-recorder-0.1.0.zip</code>,
              verify its checked-in SHA-256 file, and load the unpacked
              extension. It requests no persistent host permissions.
            </li>
            <li>
              Open the recorder with the keyboard, enter the approved Project
              origin, and choose <strong>Save approved origin</strong>. Do not
              enter customer credentials into the extension or dashboard.
            </li>
            <li>
              Add this immutable workflow in the selected repository:
              <pre
                tabIndex={0}
                className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-slate-200 focus-visible:outline-3 focus-visible:outline-emerald-300"
              >
                <code>{workflow}</code>
              </pre>
            </li>
            <li>
              Configure the two synthetic-login secrets directly in the
              <code> a11y-synthetic</code> GitHub Environment used only by the
              browser job. Do not pass them into the reusable workflow.
              Publication uses a separate environment and short-lived OIDC.
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

        <Button type="submit">Save disabled Project</Button>
      </form>
    </main>
  );
}

type ConfigurationFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "url";
  pattern?: string;
};

function ConfigurationField({
  label,
  name,
  defaultValue,
  type = "text",
  pattern,
}: ConfigurationFieldProps) {
  return (
    <label className="font-medium">
      {label}
      <input
        name={name}
        type={type}
        pattern={pattern}
        required
        defaultValue={defaultValue}
        className="mt-2 min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
      />
    </label>
  );
}
