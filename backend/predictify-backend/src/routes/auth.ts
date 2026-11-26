import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthConfig } from '../auth/config.js';
import { AuthError } from '../auth/errors.js';
import { readLogin, readRegistration } from '../auth/input.js';
import {
  issueAccessToken,
  registerAccount,
  revokeSession,
  rotateSession,
  startSession,
} from '../auth/sessions.js';

const refreshCookie = 'predictify_refresh';

export async function authRoutes(app: FastifyInstance, config: AuthConfig) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookie,
    path: '/api/auth',
  } as const;

  const requireOrigin = async (request: FastifyRequest) => {
    if (request.headers.origin !== config.appOrigin) {
      throw new AuthError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed');
    }
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply
        .code(error.statusCode)
        .send({ error: error.code, message: error.message });
    }
    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode < 500 &&
      error.statusCode >= 400
    ) {
      return reply.code(error.statusCode).send({
        error: 'INVALID_REQUEST',
        message: 'Invalid authentication request',
      });
    }
    request.log.error('authentication request failed');
    return reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  async function sendCredentials(
    reply: FastifyReply,
    credentials: Awaited<ReturnType<typeof startSession>>,
  ) {
    const result = await issueAccessToken(reply, credentials.session);
    reply.setCookie(refreshCookie, credentials.refreshToken, {
      ...cookieOptions,
      expires: credentials.session.expires_at,
    });
    return result;
  }

  app.post('/register', { bodyLimit: 4096 }, async (request, reply) => {
    reply.code(201);
    return registerAccount(readRegistration(request.body));
  });

  app.post(
    '/login',
    { bodyLimit: 4096, onRequest: requireOrigin },
    async (request, reply) => {
      const { email, password } = readLogin(request.body);
      return sendCredentials(reply, await startSession(email, password));
    },
  );

  app.post(
    '/refresh',
    { bodyLimit: 4096, onRequest: requireOrigin },
    async (request, reply) =>
      sendCredentials(
        reply,
        await rotateSession(request.cookies[refreshCookie]),
      ),
  );

  app.post(
    '/logout',
    { bodyLimit: 4096, onRequest: requireOrigin },
    async (request, reply) => {
      await revokeSession(request.cookies[refreshCookie]);
      return reply.clearCookie(refreshCookie, cookieOptions).code(204).send();
    },
  );
}
