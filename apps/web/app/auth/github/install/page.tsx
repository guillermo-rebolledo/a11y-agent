import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@a11y-agent/ui/card";

import { FIXTURE_SESSION_COOKIE, fixtureAuthEnabled } from "@/lib/fixture-auth";

export default async function InstallGitHubApp() {
  const session = (await cookies()).get(FIXTURE_SESSION_COOKIE);
  if (!fixtureAuthEnabled() || session?.value !== "fixture-session") {
    redirect("/");
  }

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest text-emerald-300">
        GitHub test provider
      </p>
      <h1 className="mt-2 text-4xl font-semibold">
        Install the least-privilege GitHub App
      </h1>
      <Card className="mt-8">
        <h2 className="text-xl font-semibold">
          Requested repository permissions
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
          <li>Read metadata, pull requests, deployments, and checks</li>
          <li>
            Write only the product’s checks and workflow dispatch/cancellation
          </li>
          <li>Repository contents: none</li>
        </ul>
        <form action="/auth/github/install/complete" method="post">
          <button
            className="mt-6 min-h-11 rounded-md bg-emerald-300 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-200 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-emerald-300"
            type="submit"
          >
            Install GitHub App fixture
          </button>
        </form>
      </Card>
    </main>
  );
}
