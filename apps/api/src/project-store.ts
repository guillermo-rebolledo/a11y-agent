import postgres from "postgres";

import type { Project } from "@a11y-agent/domain";

export interface ProjectStore {
  save(project: Project): Promise<Project>;
  get(id: string): Promise<Project | undefined>;
}

export class InMemoryProjectStore implements ProjectStore {
  readonly projects = new Map<string, Project>();

  async save(project: Project) {
    this.projects.set(project.id, project);
    return project;
  }

  async get(id: string) {
    return this.projects.get(id);
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

  async get(id: string) {
    const rows = await this.#sql<
      Array<{
        id: string;
        installation_id: number;
        repository_id: number;
        repository: string;
        main_deployment: Project["mainDeployment"];
        preview_deployment: Project["previewDeployment"];
        trusted_workflow: Project["trustedWorkflow"];
        approved_runner_class: Project["approvedRunnerClass"];
        execution_state: Project["executionState"];
        pilot_state: Project["pilotState"];
      }>
    >`
      select id, installation_id, repository_id, repository, main_deployment,
        preview_deployment, trusted_workflow, approved_runner_class,
        execution_state, pilot_state
      from projects where id = ${id}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      installationId: Number(row.installation_id),
      repositoryId: Number(row.repository_id),
      repository: row.repository,
      mainDeployment: row.main_deployment,
      previewDeployment: row.preview_deployment,
      trustedWorkflow: row.trusted_workflow,
      approvedRunnerClass: row.approved_runner_class,
      executionState: row.execution_state,
      pilotState: row.pilot_state,
    };
  }
}
