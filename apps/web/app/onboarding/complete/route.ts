import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  FIXTURE_INSTALLATION_COOKIE,
  FIXTURE_SESSION_COOKIE,
  fixtureAuthEnabled,
} from "@/lib/fixture-auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get(FIXTURE_SESSION_COOKIE)?.value;
  const installationId = cookieStore.get(FIXTURE_INSTALLATION_COOKIE)?.value;
  if (
    !fixtureAuthEnabled() ||
    session !== "fixture-session" ||
    installationId !== "24680"
  ) {
    return NextResponse.json(
      { error: "GitHub installation required" },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const repository = required(form, "repository");
  const projectInput = {
    installationId: Number(required(form, "installationId")),
    repositoryId: Number(required(form, "repositoryId")),
    repository,
    mainDeployment: {
      source: "vercel",
      environment: "main",
      originPattern: required(form, "mainOrigin"),
    },
    previewDeployment: {
      source: "vercel",
      environment: "preview",
      originPattern: required(form, "previewOrigin"),
    },
    trustedWorkflow: {
      repository,
      workflow: required(form, "workflow"),
      ref: required(form, "ref"),
      environment: required(form, "environment"),
      audience: required(form, "audience"),
      commit: required(form, "commit"),
    },
    approvedRunnerClass: "github-hosted-ephemeral",
  };

  const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
  if (!controlPlaneUrl) {
    return redirectWithError(request.url, "control plane is not configured");
  }
  const response = await fetch(`${controlPlaneUrl}/projects`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(projectInput),
  });
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    return redirectWithError(
      request.url,
      body.error ?? "control plane rejected Project",
    );
  }
  const project = (await response.json()) as { id: string };
  return NextResponse.redirect(
    new URL(`/projects/${encodeURIComponent(project.id)}`, request.url),
    303,
  );
}

function required(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function redirectWithError(requestUrl: string, error: string) {
  const target = new URL("/onboarding", requestUrl);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target, 303);
}
