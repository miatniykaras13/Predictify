import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } }
  });

  app.register(sensible);
  app.register(healthRoutes, { prefix: '/api' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, 'unhandled request error');
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : error.code ?? 'REQUEST_ERROR',
      message: statusCode === 500 ? 'Internal server error' : error.message
    });
  });

  return app;
}
