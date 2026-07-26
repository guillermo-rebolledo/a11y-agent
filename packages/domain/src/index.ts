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
  for (const deployment of [input.mainDeployment, input.previewDeployment]) {
    if (
      !deployment.originPattern.startsWith("https://") ||
      deployment.originPattern === "https://*"
    ) {
      throw new Error("deployment requires a bounded approved HTTPS origin");
    }
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
