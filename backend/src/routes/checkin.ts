import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, CheckIn, CheckInResponse, User } from '../types';
import { generateId } from '../utils/id';
import { authMiddleware } from '../middleware/auth';

const checkin = new Hono<{ Bindings: Env }>();

// 使用认证中间件
checkin.use('/*', authMiddleware);

// 自定义 Zod 验证钩子，返回友好的错误信息
const zodValidatorWithError = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues;
      const firstError = issues && issues.length > 0 ? issues[0].message : '输入验证失败';
      return c.json({ error: firstError }, 400);
    }
  });

// 发送惦记 Schema
const createCheckInSchema = z.object({
  mood: z.number().int().min(1, '请选择心情').max(27, '心情选项无效'),
  message: z.string().max(200, '留言最多200字').optional(),
  photo_key: z.string().optional(),
  audio_key: z.string().optional(),
});

// 发送惦记
checkin.post('/', zodValidatorWithError(createCheckInSchema), async (c) => {
  const user = c.get('user');

  // 只有子女可以发送惦记
  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以发送惦记' }, 403);
  }

  const { mood, message, photo_key, audio_key } = c.req.valid('json');
  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO check_ins (id, family_id, user_id, mood, message, photo_key, audio_key) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.family_id, user.id, mood, message || null, photo_key || null, audio_key || null).run();

  return c.json({
    id,
    family_id: user.family_id,
    user_id: user.id,
    mood,
    message,
    photo_key,
    audio_key,
    created_at: new Date().toISOString(),
  });
});

// 获取今日惦记
checkin.get('/today', async (c) => {
  const user = c.get('user');

  // 使用48小时窗口来确保捕获不同时区的"今天"
  // 这样无论用户在哪个时区，都能看到最近的惦记和回应
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const todayStr = twoDaysAgo.toISOString();

  // 获取今日惦记
  const checkIns = await c.env.DB.prepare(`
    SELECT c.*, u.name as user_name
    FROM check_ins c
    JOIN users u ON c.user_id = u.id
    WHERE c.family_id = ? AND c.created_at >= ?
    ORDER BY c.created_at DESC
  `).bind(user.family_id, todayStr).all<CheckIn & { user_name: string }>();

  // 获取每个惦记的回应
  const checkInsWithResponses = await Promise.all(
    checkIns.results.map(async (checkIn) => {
      const responses = await c.env.DB.prepare(`
        SELECT r.*, u.name as user_name
        FROM check_in_responses r
        JOIN users u ON r.user_id = u.id
        WHERE r.check_in_id = ?
        ORDER BY r.created_at ASC
      `).bind(checkIn.id).all<CheckInResponse & { user_name: string }>();

      return {
        ...checkIn,
        responses: responses.results,
      };
    })
  );

  return c.json({ check_ins: checkInsWithResponses });
});

// 获取最新惦记 (父母端首页显示)
checkin.get('/latest', async (c) => {
  const user = c.get('user');

  // 获取最新的一条惦记
  const checkIn = await c.env.DB.prepare(`
    SELECT c.*, u.name as user_name
    FROM check_ins c
    JOIN users u ON c.user_id = u.id
    WHERE c.family_id = ?
    ORDER BY c.created_at DESC
    LIMIT 1
  `).bind(user.family_id).first<CheckIn & { user_name: string }>();

  if (!checkIn) {
    return c.json({ check_in: null });
  }

  // 获取回应
  const responses = await c.env.DB.prepare(`
    SELECT r.*, u.name as user_name
    FROM check_in_responses r
    JOIN users u ON r.user_id = u.id
    WHERE r.check_in_id = ?
    ORDER BY r.created_at ASC
  `).bind(checkIn.id).all<CheckInResponse & { user_name: string }>();

  // 检查当前用户是否已回应
  const myResponse = responses.results.find(r => r.user_id === user.id);

  return c.json({
    check_in: {
      ...checkIn,
      responses: responses.results,
      my_response: myResponse || null,
    },
  });
});

// 回应惦记 Schema
const respondSchema = z.object({
  type: z.enum(['heart', 'audio'], { error: '回应类型无效' }),
  audio_key: z.string().optional(),
});

// 回应惦记
checkin.post('/:id/respond', zodValidatorWithError(respondSchema), async (c) => {
  const user = c.get('user');
  const checkInId = c.req.param('id');

  // 检查惦记是否存在且属于同一家庭
  const checkIn = await c.env.DB.prepare(
    'SELECT * FROM check_ins WHERE id = ? AND family_id = ?'
  ).bind(checkInId, user.family_id).first<CheckIn>();

  if (!checkIn) {
    return c.json({ error: '惦记不存在' }, 404);
  }

  // 不能回应自己的惦记
  if (checkIn.user_id === user.id) {
    return c.json({ error: '不能回应自己的惦记' }, 400);
  }

  const { type, audio_key } = c.req.valid('json');

  // 检查是否已经回应过 (heart 类型只能一次)
  if (type === 'heart') {
    const existingResponse = await c.env.DB.prepare(
      'SELECT id FROM check_in_responses WHERE check_in_id = ? AND user_id = ? AND type = ?'
    ).bind(checkInId, user.id, 'heart').first();

    if (existingResponse) {
      return c.json({ error: '已经回应过了' }, 400);
    }
  }

  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO check_in_responses (id, check_in_id, user_id, type, audio_key) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, checkInId, user.id, type, audio_key || null).run();

  return c.json({
    id,
    check_in_id: checkInId,
    user_id: user.id,
    type,
    audio_key,
    created_at: new Date().toISOString(),
  });
});

// 获取日历数据 (某月的惦记记录)
checkin.get('/calendar', async (c) => {
  const user = c.get('user');
  const year = parseInt(c.req.query('year') || new Date().getFullYear().toString());
  const month = parseInt(c.req.query('month') || (new Date().getMonth() + 1).toString());

  // 计算月份的开始和结束日期
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // 获取该月的所有惦记（包含详细信息）
  const checkIns = await c.env.DB.prepare(`
    SELECT c.id, DATE(c.created_at) as date, c.mood, c.user_id, c.message, c.photo_key, c.audio_key, c.created_at, u.name as user_name
    FROM check_ins c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.family_id = ? AND c.created_at >= ? AND c.created_at <= ?
    ORDER BY c.created_at
  `).bind(user.family_id, startDate, endDate).all<{
    id: string;
    date: string;
    mood: number;
    user_id: string;
    message: string | null;
    photo_key: string | null;
    audio_key: string | null;
    created_at: string;
    user_name: string;
  }>();

  // 获取所有惦记的回复
  const checkInIds = checkIns.results.map(c => c.id);
  let responsesMap: Record<string, { id: string; user_id: string; user_name: string; type: string; audio_key: string | null; created_at: string }[]> = {};

  if (checkInIds.length > 0) {
    const responses = await c.env.DB.prepare(`
      SELECT r.id, r.check_in_id, r.user_id, r.type, r.audio_key, r.created_at, u.name as user_name
      FROM check_in_responses r
      JOIN users u ON r.user_id = u.id
      WHERE r.check_in_id IN (${checkInIds.map(() => '?').join(',')})
      ORDER BY r.created_at
    `).bind(...checkInIds).all<{
      id: string;
      check_in_id: string;
      user_id: string;
      type: string;
      audio_key: string | null;
      created_at: string;
      user_name: string;
    }>();

    for (const resp of responses.results) {
      if (!responsesMap[resp.check_in_id]) {
        responsesMap[resp.check_in_id] = [];
      }
      responsesMap[resp.check_in_id].push({
        id: resp.id,
        user_id: resp.user_id,
        user_name: resp.user_name,
        type: resp.type,
        audio_key: resp.audio_key,
        created_at: resp.created_at,
      });
    }
  }

  // 按日期分组
  const calendar: Record<string, {
    id: string;
    mood: number;
    user_id: string;
    message: string | null;
    photo_key: string | null;
    audio_key: string | null;
    created_at: string;
    user_name: string;
    responses: { id: string; user_id: string; user_name: string; type: string; audio_key: string | null; created_at: string }[];
  }[]> = {};
  for (const checkIn of checkIns.results) {
    const date = checkIn.date;
    if (!calendar[date]) {
      calendar[date] = [];
    }
    calendar[date].push({
      id: checkIn.id,
      mood: checkIn.mood,
      user_id: checkIn.user_id,
      message: checkIn.message,
      photo_key: checkIn.photo_key,
      audio_key: checkIn.audio_key,
      created_at: checkIn.created_at,
      user_name: checkIn.user_name,
      responses: responsesMap[checkIn.id] || [],
    });
  }

  // 计算统计数据
  const totalDays = Object.keys(calendar).length;

  // 计算连续天数
  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today);

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (calendar[dateStr]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return c.json({
    year,
    month,
    calendar,
    stats: {
      total_days: totalDays,
      streak,
    },
  });
});

// 获取惦记历史
checkin.get('/history', async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const checkIns = await c.env.DB.prepare(`
    SELECT c.*, u.name as user_name
    FROM check_ins c
    JOIN users u ON c.user_id = u.id
    WHERE c.family_id = ?
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(user.family_id, limit, offset).all<CheckIn & { user_name: string }>();

  return c.json({ check_ins: checkIns.results });
});

export default checkin;
