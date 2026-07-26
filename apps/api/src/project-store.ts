import postgres from "postgres";

import type { Project } from "@a11y-agent/domain";

export interface ProjectStore {
  save(project: Project): Promise<Project>;
}

export class InMemoryProjectStore implements ProjectStore {
  readonly projects = new Map<string, Project>();

  async save(project: Project) {
    this.projects.set(project.id, project);
    return project;
  }
}

export class NeonProjectStore implements ProjectStore {
  readonly #sql;

  constructor(databaseUrl: string) {
    this.#sql = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      ssl: "require",
    });
  }

  async save(project: Project) {
    await this.#sql`
      insert into projects (
        id, installation_id, repository_id, repository,
        main_deployment, preview_deployment, trusted_workflow,
        approved_runner_class, authorization_model,
        execution_state, pilot_state
      ) values (
        ${project.id}, ${project.installationId}, ${project.repositoryId},
        ${project.repository}, ${this.#sql.json(project.mainDeployment)},
        ${this.#sql.json(project.previewDeployment)},
        ${this.#sql.json(project.trustedWorkflow)},
        ${project.approvedRunnerClass},
        ${this.#sql.json({ administrator: "github-installation-admin" })},
        ${project.executionState}, ${project.pilotState}
      )
      on conflict (id) do update set
        main_deployment = excluded.main_deployment,
        preview_deployment = excluded.preview_deployment,
        trusted_workflow = excluded.trusted_workflow,
        updated_at = now()
    `;
    return project;
  }
}
