export type DeploymentSource = {
  source: "vercel";
  environment: "main" | "preview";
  originPattern: string;
};

export type TrustedWorkflowIdentity = {
  repository: string;
  workflow: string;
  ref: string;
  environment: string;
  audience: string;
  commit: string;
};

export type ProjectInput = {
  installationId: number;
  repositoryId: number;
  repository: string;
  mainDeployment: DeploymentSource;
  previewDeployment: DeploymentSource;
  trustedWorkflow: TrustedWorkflowIdentity;
  approvedRunnerClass: "github-hosted-ephemeral";
};

export type Project = ProjectInput & {
  id: string;
  executionState: "disabled-pending-authenticated-enablement";
  pilotState: "not-provisioned";
};

export type PublisherIdentity = {
  repository: string;
  workflow: string;
  ref: string;
  environment: string;
  audience: string;
  commit: string;
};

export const GITHUB_APP_PERMISSIONS = {
  repository: {
    metadata: "read",
    pullRequests: "read",
    deployments: "read",
    checks: "write",
    actions: "write",
    contents: "none",
  },
  organization: { members: "none" },
} as const;

export function runtimeGate() {
  return {
    authenticatedExecution: false,
    pilotProvisioning: false,
    reason: "ADR-0005 authenticated-enablement gate has not passed",
  } as const;
}

export function createProject(input: ProjectInput): Project {
  if (input.mainDeployment.environment !== "main") {
    throw new Error("main deployment must use the main environment");
  }
  if (input.previewDeployment.environment !== "preview") {
    throw new Error("preview deployment must use the preview environment");
  }
  for (const deployment of [input.mainDeployment, input.previewDeployment]) {
    validateOriginPattern(deployment.originPattern);
  }

  if (!/^[\w.-]+\/[\w.-]+$/u.test(input.repository)) {
    throw new Error("repository must be an owner/name identity");
  }
  if (input.trustedWorkflow.repository !== input.repository) {
    throw new Error("trusted workflow repository must match the Project");
  }
  if (
    !/^\.github\/workflows\/[\w.-]+\.ya?ml$/u.test(
      input.trustedWorkflow.workflow,
    )
  ) {
    throw new Error("trusted workflow must be a GitHub Actions workflow path");
  }
  if (!/^refs\/heads\/[\w./-]+$/u.test(input.trustedWorkflow.ref)) {
    throw new Error("trusted workflow ref must be a branch ref");
  }
  if (!/^[\w.-]+$/u.test(input.trustedWorkflow.environment)) {
    throw new Error("trusted workflow environment is invalid");
  }
  validateHttpsUrl(input.trustedWorkflow.audience, "OIDC audience");

  if (input.approvedRunnerClass !== "github-hosted-ephemeral") {
    throw new Error("runner class is not approved");
  }

  if (!/^[a-f0-9]{40}$/u.test(input.trustedWorkflow.commit)) {
    throw new Error("trusted workflow commit must be a full SHA");
  }

  return {
    ...input,
    id: `project-${input.repositoryId}`,
    executionState: "disabled-pending-authenticated-enablement",
    pilotState: "not-provisioned",
  };
}

export function validatePublisherIdentity(
  identity: PublisherIdentity,
  project: Project,
) {
  const expected = project.trustedWorkflow;
  const mismatches = (
    [
      "repository",
      "workflow",
      "ref",
      "environment",
      "audience",
      "commit",
    ] as const
  ).filter((claim) => identity[claim] !== expected[claim]);

  if (mismatches.length > 0) {
    throw new Error(`publisher identity mismatch: ${mismatches.join(", ")}`);
  }

  return true;
}

function validateOriginPattern(originPattern: string) {
  if ((originPattern.match(/\*/gu) ?? []).length > 1) {
    throw new Error("deployment requires a bounded approved HTTPS origin");
  }

  const normalized = originPattern.replace("*", "fixture-preview");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("deployment requires a bounded approved HTTPS origin");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.includes(".") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (originPattern.includes("*") && !originPattern.includes("*."))
  ) {
    throw new Error("deployment requires a bounded approved HTTPS origin");
  }
}

function validateHttpsUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }
}
