import type {
  GitHubOidcClaims,
  PublicationPolicy,
} from "./publication.js";

const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const PROOF_REPOSITORY = "guillermo-rebolledo/a11y-demo";
const PROOF_REPOSITORY_ID = "757824645";
const PROOF_REPOSITORY_OWNER = "guillermo-rebolledo";
const PROOF_REPOSITORY_OWNER_ID = "47798232";
const PROOF_CALLER_WORKFLOW_REF =
  "guillermo-rebolledo/a11y-demo/.github/workflows/a11y-audit.yml@refs/heads/main";
const PROOF_TRUSTED_WORKFLOW_PATH =
  "guillermo-rebolledo/a11y-agent/.github/workflows/customer-audit.yml";
const PROOF_REF = "refs/heads/main";
const PROOF_ENVIRONMENT = "a11y-publication";

export type ProofPublicationTrust = {
  trustedWorkflowSha: string;
  commit: string;
};

export function createProofPublicationPolicy(
  claims: GitHubOidcClaims,
  trust: ProofPublicationTrust,
  revoked: boolean,
): PublicationPolicy {
  if (!/^[0-9a-f]{40}$/.test(trust.trustedWorkflowSha)) {
    throw new Error("Verifier trust policy requires an immutable workflow SHA");
  }
  if (!/^[0-9a-f]{40}$/.test(trust.commit)) {
    throw new Error("Verifier trust policy requires an immutable commit SHA");
  }

  const trustedWorkflowRef =
    `${PROOF_TRUSTED_WORKFLOW_PATH}@${trust.trustedWorkflowSha}`;
  if (
    claims.job_workflow_ref !== trustedWorkflowRef ||
    claims.job_workflow_sha !== trust.trustedWorkflowSha
  ) {
    throw new Error("OIDC identity uses an untrusted reusable workflow");
  }
  if (claims.sha !== trust.commit || claims.workflow_sha !== trust.commit) {
    throw new Error("OIDC identity uses an untrusted customer commit");
  }

  return {
    issuer: OIDC_ISSUER,
    audience: "https://api.a11y-agent.example/publications",
    subject: `repo:${PROOF_REPOSITORY}:environment:${PROOF_ENVIRONMENT}`,
    repository: PROOF_REPOSITORY,
    repositoryId: PROOF_REPOSITORY_ID,
    repositoryOwner: PROOF_REPOSITORY_OWNER,
    repositoryOwnerId: PROOF_REPOSITORY_OWNER_ID,
    callerWorkflowRef: PROOF_CALLER_WORKFLOW_REF,
    trustedWorkflowRef,
    trustedWorkflowSha: trust.trustedWorkflowSha,
    ref: PROOF_REF,
    environment: PROOF_ENVIRONMENT,
    commit: trust.commit,
    maxTokenAgeSeconds: 300,
    revoked,
  };
}
