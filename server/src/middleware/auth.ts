import type { Context, Next } from 'hono';
import { validateToken } from '../services/auth.service.js';

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

  if (!(await validateToken(token))) {
    return c.json({ success: false, error: 'No autorizado: token inválido, revocado o expirado.' }, 401);
  }
  await next();
}