import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../db/pool.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await checkDatabase();
      return { status: "ready", database: "up" };
    } catch (error) {
      app.log.error({ error }, "database readiness check failed");
      return reply.code(503).send({ status: "not_ready", database: "down" });
    }
  });
}
