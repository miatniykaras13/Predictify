import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });

  app.register(sensible);
  app.register(healthRoutes, { prefix: '/api' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, 'unhandled request error');
    if (
      typeof error !== 'object' ||
      error === null ||
      !('statusCode' in error) ||
      typeof error.statusCode !== 'number' ||
      !Number.isInteger(error.statusCode) ||
      error.statusCode < 400 ||
      error.statusCode === 500 ||
      error.statusCode > 599
    ) {
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      });
    }

    return reply.code(error.statusCode).send({
      error: ('code' in error ? error.code : undefined) ?? 'REQUEST_ERROR',
      message: 'message' in error ? error.message : undefined,
    });
  });

  return app;
}
