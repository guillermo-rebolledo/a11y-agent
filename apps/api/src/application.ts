import Fastify from "fastify";

import {
  createProject,
  GITHUB_APP_PERMISSIONS,
  runtimeGate,
} from "@a11y-agent/domain";

import { InMemoryProjectStore, type ProjectStore } from "./project-store.js";

type FixtureSession = {
  token: string;
  repositories: Array<{
    installationId: number;
    repositoryId: number;
    repository: string;
  }>;
};

type BuildAppOptions = {
  store?: ProjectStore;
  fixtureSession?: FixtureSession;
};

export function buildApp(
  options: BuildAppOptions = {},
  app = Fastify({ logger: process.env.NODE_ENV !== "test" }),
) {
  const store = options.store ?? new InMemoryProjectStore();

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/capabilities", async () => ({
    repositoryContents: "inaccessible",
    githubPermissions: GITHUB_APP_PERMISSIONS,
    ...runtimeGate(),
  }));

  app.post("/projects", async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer /u, "");
    const session = options.fixtureSession;
    if (!session || token !== session.token) {
      return reply.code(401).send({ error: "GitHub authentication required" });
    }

    try {
      const project = createProject(
        request.body as Parameters<typeof createProject>[0],
      );
      if (!sessionCanAccessProject(session, project)) {
        return reply.code(403).send({
          error: "repository is outside the approved GitHub App installation",
        });
      }

      return reply.code(201).send(await store.save(project));
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error
            ? error.message
            : "invalid Project configuration",
      });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/projects/:id",
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer /u, "");
      const session = options.fixtureSession;
      if (!session || token !== session.token) {
        return reply
          .code(401)
          .send({ error: "GitHub authentication required" });
      }

      const project = await store.get(request.params.id);
      if (!project || !sessionCanAccessProject(session, project)) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return project;
    },
  );

  return app;
}

function sessionCanAccessProject(
  session: FixtureSession,
  project: {
    installationId: number;
    repositoryId: number;
    repository: string;
  },
) {
  return session.repositories.some(
    (allowed) =>
      allowed.installationId === project.installationId &&
      allowed.repositoryId === project.repositoryId &&
      allowed.repository === project.repository,
  );
}
