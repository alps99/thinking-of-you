import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import type { Env, User, UserRow, Family } from '../types';
import { generateId, generateInviteCode, generateVerificationCode } from '../utils/id';
import { signAccessToken, signRefreshToken, verifyJWT } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const auth = new Hono<{ Bindings: Env }>();

// 自定义 Zod 验证钩子，返回友好的错误信息
const zodValidatorWithError = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues;
      const firstError = issues && issues.length > 0 ? issues[0].message : '输入验证失败';
      return c.json({ error: firstError }, 400);
    }
  });

// 密码验证规则：至少8位，包含字母和数字
const passwordSchema = z.string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

// 子女注册 Schema
const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: passwordSchema,
  name: z.string().min(1, '请输入姓名'),
  familyName: z.string().min(1, '请输入家庭名称'),
});

// 子女注册 (创建家庭) - 添加速率限制
auth.post('/register', authRateLimit, zodValidatorWithError(registerSchema), async (c) => {
  const { email, password, name, familyName } = c.req.valid('json');

  // 检查邮箱是否已存在
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    return c.json({ error: '该邮箱已被注册' }, 400);
  }

  // 创建家庭
  const familyId = generateId();
  const inviteCode = generateInviteCode();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天后过期

  await c.env.DB.prepare(
    'INSERT INTO families (id, name, invite_code, invite_expires_at) VALUES (?, ?, ?, ?)'
  ).bind(familyId, familyName, inviteCode, inviteExpiresAt).run();

  // 创建用户
  const userId = generateId();
  const passwordHash = await bcrypt.hash(password, 10);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, role, family_id, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, name, 'child', familyId, 'America/Los_Angeles').run();

  // 生成 tokens
  const tokenPayload = { user_id: userId, family_id: familyId, role: 'child' as const };
  const accessToken = await signAccessToken(tokenPayload, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(tokenPayload, c.env.JWT_SECRET);

  // 设置 cookie
  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 15 * 60, // 15分钟
    path: '/',
  });
  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60, // 30天
    path: '/',
  });

  return c.json({
    user: {
      id: userId,
      email,
      name,
      role: 'child',
      family_id: familyId,
    },
    family: {
      id: familyId,
      name: familyName,
      invite_code: inviteCode,
    },
    accessToken,
  });
});

// 登录 Schema
const loginSchema = z.object({
  account: z.string().min(1, '请输入邮箱或手机号'),
  password: z.string().min(1, '请输入密码'),
});

// 登录 - 添加速率限制
auth.post('/login', authRateLimit, zodValidatorWithError(loginSchema), async (c) => {
  const { account, password } = c.req.valid('json');

  // 查找用户 (邮箱或手机号)
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? OR phone = ?'
  ).bind(account, account).first<UserRow>();

  if (!user) {
    return c.json({ error: '用户不存在' }, 401);
  }

  // 验证密码
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return c.json({ error: '密码错误' }, 401);
  }

  // 获取家庭信息
  const family = await c.env.DB.prepare(
    'SELECT * FROM families WHERE id = ?'
  ).bind(user.family_id).first<Family>();

  // 生成 tokens
  const tokenPayload = { user_id: user.id, family_id: user.family_id, role: user.role };
  const accessToken = await signAccessToken(tokenPayload, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(tokenPayload, c.env.JWT_SECRET);

  // 设置 cookie
  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 15 * 60,
    path: '/',
  });
  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      family_id: user.family_id,
    },
    family,
    accessToken,
  });
});

// 刷新 Token
auth.post('/refresh', async (c) => {
  const refreshToken = c.req.header('X-Refresh-Token') ||
    (await c.req.text().catch(() => '')); // 支持从 cookie 或 body 获取

  if (!refreshToken) {
    return c.json({ error: '缺少 Refresh Token' }, 401);
  }

  const payload = await verifyJWT(refreshToken, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Refresh Token 无效或已过期' }, 401);
  }

  // 获取用户信息
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(payload.user_id).first<User>();

  if (!user) {
    return c.json({ error: '用户不存在' }, 401);
  }

  // 生成新的 access token
  const tokenPayload = { user_id: user.id, family_id: user.family_id, role: user.role };
  const accessToken = await signAccessToken(tokenPayload, c.env.JWT_SECRET);

  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 15 * 60,
    path: '/',
  });

  return c.json({ accessToken });
});

// 登出
auth.post('/logout', async (c) => {
  deleteCookie(c, 'access_token', { path: '/' });
  deleteCookie(c, 'refresh_token', { path: '/' });
  return c.json({ success: true });
});

// 获取当前用户信息
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const family = await c.env.DB.prepare(
    'SELECT * FROM families WHERE id = ?'
  ).bind(user.family_id).first<Family>();

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      family_id: user.family_id,
      timezone: user.timezone,
    },
    family,
  });
});

export default auth;
