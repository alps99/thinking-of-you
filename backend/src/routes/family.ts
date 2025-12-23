import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z, ZodError } from 'zod';
import { setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import type { Env, User, Family } from '../types';
import { generateId, generateInviteCode } from '../utils/id';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { authRateLimit, inviteRateLimit } from '../middleware/rateLimit';

const family = new Hono<{ Bindings: Env }>();

// 自定义 Zod 验证钩子，返回友好的错误信息
const zodValidatorWithError = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues;
      const firstError = issues && issues.length > 0 ? issues[0].message : '输入验证失败';
      return c.json({ error: firstError }, 400);
    }
  });

// 获取家庭信息
family.get('/', authMiddleware, async (c) => {
  const user = c.get('user');

  const familyInfo = await c.env.DB.prepare(
    'SELECT * FROM families WHERE id = ?'
  ).bind(user.family_id).first<Family>();

  if (!familyInfo) {
    return c.json({ error: '家庭不存在' }, 404);
  }

  // 获取家庭成员
  const members = await c.env.DB.prepare(
    'SELECT id, name, role, created_at FROM users WHERE family_id = ?'
  ).bind(user.family_id).all();

  return c.json({
    family: familyInfo,
    members: members.results,
  });
});

// 获取/刷新邀请链接
family.get('/invite', authMiddleware, async (c) => {
  const user = c.get('user');

  // 只有子女可以生成邀请链接
  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以邀请家人' }, 403);
  }

  const familyInfo = await c.env.DB.prepare(
    'SELECT * FROM families WHERE id = ?'
  ).bind(user.family_id).first<Family>();

  if (!familyInfo) {
    return c.json({ error: '家庭不存在' }, 404);
  }

  // 检查邀请码是否过期，如果过期则生成新的
  let inviteCode = familyInfo.invite_code;
  let inviteExpiresAt = familyInfo.invite_expires_at;

  if (!inviteCode || !inviteExpiresAt || new Date(inviteExpiresAt) < new Date()) {
    inviteCode = generateInviteCode();
    inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.prepare(
      'UPDATE families SET invite_code = ?, invite_expires_at = ? WHERE id = ?'
    ).bind(inviteCode, inviteExpiresAt, user.family_id).run();
  }

  const inviteUrl = `${c.env.APP_URL}/join/${inviteCode}`;

  return c.json({
    invite_code: inviteCode,
    invite_url: inviteUrl,
    expires_at: inviteExpiresAt,
  });
});

// 密码验证规则：至少8位，包含字母和数字
const passwordSchema = z.string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

// 父母通过邀请码加入家庭 Schema
const joinSchema = z.object({
  invite_code: z.string().length(8, '邀请码格式不正确'),
  phone: z.string().min(10, '请输入有效的手机号'),
  password: passwordSchema,
  name: z.string().min(1, '请输入姓名'),
});

// 父母通过邀请码加入家庭 - 添加速率限制
family.post('/join', authRateLimit, zodValidatorWithError(joinSchema), async (c) => {
  const { invite_code, phone, password, name } = c.req.valid('json');

  // 查找家庭
  const familyInfo = await c.env.DB.prepare(
    'SELECT * FROM families WHERE invite_code = ?'
  ).bind(invite_code).first<Family>();

  if (!familyInfo) {
    return c.json({ error: '邀请码无效' }, 400);
  }

  // 检查邀请码是否过期
  if (familyInfo.invite_expires_at && new Date(familyInfo.invite_expires_at) < new Date()) {
    return c.json({ error: '邀请码已过期，请联系子女获取新的邀请链接' }, 400);
  }

  // 检查手机号是否已存在
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE phone = ?'
  ).bind(phone).first();

  if (existingUser) {
    return c.json({ error: '该手机号已被注册' }, 400);
  }

  // 检查家庭人数 (最多10人)
  const memberCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE family_id = ?'
  ).bind(familyInfo.id).first<{ count: number }>();

  if (memberCount && memberCount.count >= 10) {
    return c.json({ error: '家庭成员已达上限(10人)' }, 400);
  }

  // 创建用户
  const userId = generateId();
  const passwordHash = await bcrypt.hash(password, 10);

  await c.env.DB.prepare(
    'INSERT INTO users (id, phone, password_hash, name, role, family_id, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, phone, passwordHash, name, 'parent', familyInfo.id, 'Asia/Shanghai').run();

  // 生成 tokens
  const tokenPayload = { user_id: userId, family_id: familyInfo.id, role: 'parent' as const };
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
      id: userId,
      phone,
      name,
      role: 'parent',
      family_id: familyInfo.id,
    },
    family: familyInfo,
    accessToken,
  });
});

// 验证邀请码是否有效 - 添加速率限制防止暴力枚举
family.get('/invite/:code', inviteRateLimit, async (c) => {
  const code = c.req.param('code');

  const familyInfo = await c.env.DB.prepare(
    'SELECT id, name, invite_expires_at FROM families WHERE invite_code = ?'
  ).bind(code).first<Family>();

  if (!familyInfo) {
    return c.json({ error: '邀请码无效', valid: false }, 400);
  }

  if (familyInfo.invite_expires_at && new Date(familyInfo.invite_expires_at) < new Date()) {
    return c.json({ error: '邀请码已过期', valid: false }, 400);
  }

  return c.json({
    valid: true,
    family_name: familyInfo.name,
  });
});

export default family;
