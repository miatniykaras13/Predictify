import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { readAuthConfig } from './auth/config.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

export function buildApp() {
  const auth = readAuthConfig();
  const app = Fastify({
    logger: {
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
    },
    ajv: { customOptions: { removeAdditional: false } },
  });

  app.register(sensible);
  app.register(cookie);
  app.register(jwt, {
    secret: auth.accessTokenKey,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  app.register(healthRoutes, { prefix: '/api' });
  app.register(authRoutes, { ...auth, prefix: '/api/auth' });

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
