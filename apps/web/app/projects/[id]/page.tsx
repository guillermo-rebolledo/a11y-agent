import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { Project } from "@a11y-agent/domain";
import { Card } from "@a11y-agent/ui/card";

import { FIXTURE_SESSION_COOKIE, fixtureAuthEnabled } from "@/lib/fixture-auth";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = (await cookies()).get(FIXTURE_SESSION_COOKIE)?.value;
  if (!fixtureAuthEnabled() || session !== "fixture-session") {
    redirect("/");
  }
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
  if (!controlPlaneUrl) notFound();

  const { id } = await params;
  const response = await fetch(
    `${controlPlaneUrl}/projects/${encodeURIComponent(id)}`,
    {
      headers: { authorization: `Bearer ${session}` },
      cache: "no-store",
    },
  );
  if (!response.ok) notFound();
  const project = (await response.json()) as Project;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-12">
      <div
        role="status"
        className="rounded-md bg-emerald-950 p-4 text-emerald-100"
      >
        Project configuration saved to the control plane.
      </div>
      <p className="mt-8 text-sm uppercase tracking-widest text-emerald-300">
        Project
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{project.repository}</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Connection</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-slate-400">GitHub installation</dt>
              <dd>{project.installationId} · test only</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Repository contents</dt>
              <dd>Inaccessible</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Preview origin</dt>
              <dd>{project.previewDeployment.originPattern}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold">Execution status</h2>
          <p className="mt-4 text-amber-200">
            Disabled pending enablement proof
          </p>
          <p className="mt-2 text-sm text-slate-400">
            No authenticated Audit Runs or pilot tenants can be started.
          </p>
        </Card>
      </div>
    </main>
  );
}
