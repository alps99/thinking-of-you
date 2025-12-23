import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '../utils/jwt';
import type { Env, User } from '../types';

// JWT 认证中间件
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // 从 Authorization header 或 cookie 获取 token
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = getCookie(c, 'access_token');
  }

  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Token 无效或已过期' }, 401);
  }

  // 获取用户信息
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(payload.user_id).first<User>();

  if (!user) {
    return c.json({ error: '用户不存在' }, 401);
  }

  // 设置用户信息到 context
  c.set('user', user);
  c.set('jwtPayload', payload);

  await next();
}

// 可选认证中间件 (不强制要求登录)
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = getCookie(c, 'access_token');
  }

  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(payload.user_id).first<User>();

      if (user) {
        c.set('user', user);
        c.set('jwtPayload', payload);
      }
    }
  }

  await next();
}
