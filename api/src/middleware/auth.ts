import type { Context, Next } from 'hono';

const API_KEY = process.env.SG_API_KEY || 'sk_sg_dev_key_change_me';

/**
 * Simple API key auth middleware.
 * Checks Authorization: Bearer <key> header.
 * Only applied to write endpoints.
 */
export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = auth.slice(7);
  if (token !== API_KEY) {
    return c.json({ error: 'Invalid API key' }, 403);
  }

  await next();
}
