import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types';
import { generateId, generateShortId } from '../utils/id';
import { authMiddleware } from '../middleware/auth';

interface Moment {
  id: string;
  family_id: string;
  author_id: string;
  content: string | null;
  location: string | null;
  audio_key: string | null;
  audio_duration: number | null;
  created_at: string;
}

interface MomentMedia {
  id: string;
  moment_id: string;
  media_type: 'photo' | 'video';
  r2_key: string;
  thumbnail_key: string | null;
  sort_order: number;
}

interface MomentReaction {
  id: string;
  moment_id: string;
  user_id: string;
  user_name?: string;
  type: 'heart' | 'audio';
  audio_key: string | null;
  created_at: string;
}

interface MomentComment {
  id: string;
  moment_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at: string;
}

const moments = new Hono<{ Bindings: Env }>();

// 使用认证中间件
moments.use('/*', authMiddleware);

// 获取未读新鲜事数量 (父母专用) - 必须放在 /:id 路由之前
moments.get('/unread-count', async (c) => {
  const user = c.get('user');

  // 只有父母可以获取未读数量
  if (user.role !== 'parent') {
    return c.json({ count: 0 });
  }

  // 统计未查看的新鲜事数量
  const result = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM moments m
    WHERE m.family_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM moment_views mv
        WHERE mv.moment_id = m.id AND mv.user_id = ?
      )
  `).bind(user.family_id, user.id).first<{ count: number }>();

  return c.json({ count: result?.count || 0 });
});

// 创建新鲜事 Schema
const createMomentSchema = z.object({
  content: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  media: z.array(z.object({
    media_type: z.enum(['photo', 'video']),
    r2_key: z.string(),
    thumbnail_key: z.string().optional(),
  })).max(9).optional(),
  audio_key: z.string().optional(),
  audio_duration: z.number().optional(),
});

// 发布新鲜事
moments.post('/', zValidator('json', createMomentSchema), async (c) => {
  const user = c.get('user');

  // 只有子女可以发布新鲜事
  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以发布新鲜事' }, 403);
  }

  const { content, location, media, audio_key, audio_duration } = c.req.valid('json');

  if (!content && (!media || media.length === 0) && !audio_key) {
    return c.json({ error: '请添加文字、图片或录音' }, 400);
  }

  const momentId = generateId();

  // 创建新鲜事
  await c.env.DB.prepare(
    'INSERT INTO moments (id, family_id, author_id, content, location, audio_key, audio_duration) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(momentId, user.family_id, user.id, content || null, location || null, audio_key || null, audio_duration || null).run();

  // 添加媒体
  if (media && media.length > 0) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      const mediaId = generateId();
      await c.env.DB.prepare(
        'INSERT INTO moment_media (id, moment_id, media_type, r2_key, thumbnail_key, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(mediaId, momentId, m.media_type, m.r2_key, m.thumbnail_key || null, i).run();
    }
  }

  return c.json({
    id: momentId,
    family_id: user.family_id,
    author_id: user.id,
    content,
    location,
    audio_key: audio_key || null,
    audio_duration: audio_duration || null,
    media,
    created_at: new Date().toISOString(),
  });
});

// 获取新鲜事列表
moments.get('/', async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  // 获取新鲜事
  const momentsList = await c.env.DB.prepare(`
    SELECT m.*, u.name as author_name
    FROM moments m
    JOIN users u ON m.author_id = u.id
    WHERE m.family_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(user.family_id, limit, offset).all<Moment & { author_name: string }>();

  // 获取每个新鲜事的媒体和互动
  const momentsWithDetails = await Promise.all(
    momentsList.results.map(async (moment) => {
      // 获取媒体
      const media = await c.env.DB.prepare(`
        SELECT * FROM moment_media
        WHERE moment_id = ?
        ORDER BY sort_order
      `).bind(moment.id).all<MomentMedia>();

      // 获取互动
      const reactions = await c.env.DB.prepare(`
        SELECT r.*, u.name as user_name
        FROM moment_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.moment_id = ?
        ORDER BY r.created_at
      `).bind(moment.id).all<MomentReaction>();

      // 获取评论
      const comments = await c.env.DB.prepare(`
        SELECT c.*, u.name as user_name
        FROM moment_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.moment_id = ?
        ORDER BY c.created_at
      `).bind(moment.id).all<MomentComment>();

      // 检查当前用户是否点赞
      const myHeart = reactions.results.find(
        (r) => r.user_id === user.id && r.type === 'heart'
      );

      // 统计
      const heartCount = reactions.results.filter((r) => r.type === 'heart').length;
      const audioCount = reactions.results.filter((r) => r.type === 'audio').length;

      return {
        ...moment,
        media: media.results,
        reactions: reactions.results,
        comments: comments.results,
        heart_count: heartCount,
        audio_count: audioCount,
        comment_count: comments.results.length,
        has_hearted: !!myHeart,
      };
    })
  );

  return c.json({ moments: momentsWithDetails });
});

// 获取单个新鲜事详情
moments.get('/:id', async (c) => {
  const user = c.get('user');
  const momentId = c.req.param('id');

  const moment = await c.env.DB.prepare(`
    SELECT m.*, u.name as author_name
    FROM moments m
    JOIN users u ON m.author_id = u.id
    WHERE m.id = ? AND m.family_id = ?
  `).bind(momentId, user.family_id).first<Moment & { author_name: string }>();

  if (!moment) {
    return c.json({ error: '新鲜事不存在' }, 404);
  }

  // 获取媒体
  const media = await c.env.DB.prepare(`
    SELECT * FROM moment_media
    WHERE moment_id = ?
    ORDER BY sort_order
  `).bind(momentId).all<MomentMedia>();

  // 获取互动
  const reactions = await c.env.DB.prepare(`
    SELECT r.*, u.name as user_name
    FROM moment_reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.moment_id = ?
    ORDER BY r.created_at
  `).bind(momentId).all<MomentReaction>();

  return c.json({
    moment: {
      ...moment,
      media: media.results,
      reactions: reactions.results,
    },
  });
});

// 互动 Schema
const reactSchema = z.object({
  type: z.enum(['heart', 'audio']),
  audio_key: z.string().optional(),
});

// 对新鲜事互动 (点赞/语音回复)
moments.post('/:id/react', zValidator('json', reactSchema), async (c) => {
  const user = c.get('user');
  const momentId = c.req.param('id');
  const { type, audio_key } = c.req.valid('json');

  // 检查新鲜事是否存在
  const moment = await c.env.DB.prepare(
    'SELECT * FROM moments WHERE id = ? AND family_id = ?'
  ).bind(momentId, user.family_id).first<Moment>();

  if (!moment) {
    return c.json({ error: '新鲜事不存在' }, 404);
  }

  // 如果是点赞，检查是否已点赞
  if (type === 'heart') {
    const existingHeart = await c.env.DB.prepare(
      'SELECT id FROM moment_reactions WHERE moment_id = ? AND user_id = ? AND type = ?'
    ).bind(momentId, user.id, 'heart').first();

    if (existingHeart) {
      // 取消点赞
      await c.env.DB.prepare(
        'DELETE FROM moment_reactions WHERE moment_id = ? AND user_id = ? AND type = ?'
      ).bind(momentId, user.id, 'heart').run();

      return c.json({ action: 'unliked' });
    }
  }

  // 添加互动
  const reactionId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO moment_reactions (id, moment_id, user_id, type, audio_key) VALUES (?, ?, ?, ?, ?)'
  ).bind(reactionId, momentId, user.id, type, audio_key || null).run();

  return c.json({
    id: reactionId,
    moment_id: momentId,
    user_id: user.id,
    type,
    audio_key,
    action: type === 'heart' ? 'liked' : 'replied',
    created_at: new Date().toISOString(),
  });
});

// 评论 Schema
const commentSchema = z.object({
  content: z.string().min(1).max(200),
});

// 添加评论
moments.post('/:id/comment', zValidator('json', commentSchema), async (c) => {
  const user = c.get('user');
  const momentId = c.req.param('id');
  const { content } = c.req.valid('json');

  // 检查新鲜事是否存在
  const moment = await c.env.DB.prepare(
    'SELECT * FROM moments WHERE id = ? AND family_id = ?'
  ).bind(momentId, user.family_id).first<Moment>();

  if (!moment) {
    return c.json({ error: '新鲜事不存在' }, 404);
  }

  // 添加评论
  const commentId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO moment_comments (id, moment_id, user_id, content) VALUES (?, ?, ?, ?)'
  ).bind(commentId, momentId, user.id, content).run();

  // 获取用户名
  const userInfo = await c.env.DB.prepare(
    'SELECT name FROM users WHERE id = ?'
  ).bind(user.id).first<{ name: string }>();

  return c.json({
    id: commentId,
    moment_id: momentId,
    user_id: user.id,
    user_name: userInfo?.name,
    content,
    created_at: new Date().toISOString(),
  });
});

// 删除评论
moments.delete('/:id/comment/:commentId', async (c) => {
  const user = c.get('user');
  const commentId = c.req.param('commentId');

  // 检查评论是否存在且属于当前用户
  const comment = await c.env.DB.prepare(
    'SELECT * FROM moment_comments WHERE id = ? AND user_id = ?'
  ).bind(commentId, user.id).first();

  if (!comment) {
    return c.json({ error: '评论不存在或无权删除' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM moment_comments WHERE id = ?').bind(commentId).run();

  return c.json({ success: true });
});

// 标记新鲜事已读 (父母专用)
moments.post('/:id/view', async (c) => {
  const user = c.get('user');
  const momentId = c.req.param('id');

  // 只有父母可以标记已读
  if (user.role !== 'parent') {
    return c.json({ success: true });
  }

  // 检查新鲜事是否存在
  const moment = await c.env.DB.prepare(
    'SELECT id FROM moments WHERE id = ? AND family_id = ?'
  ).bind(momentId, user.family_id).first();

  if (!moment) {
    return c.json({ error: '新鲜事不存在' }, 404);
  }

  // 插入查看记录（如果已存在则忽略）
  try {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO moment_views (id, moment_id, user_id) VALUES (?, ?, ?)'
    ).bind(generateShortId(), momentId, user.id).run();
  } catch {
    // 忽略重复插入错误
  }

  return c.json({ success: true });
});

// 删除新鲜事
moments.delete('/:id', async (c) => {
  const user = c.get('user');
  const momentId = c.req.param('id');

  // 检查新鲜事是否存在且属于当前用户
  const moment = await c.env.DB.prepare(
    'SELECT * FROM moments WHERE id = ? AND author_id = ?'
  ).bind(momentId, user.id).first<Moment>();

  if (!moment) {
    return c.json({ error: '新鲜事不存在或无权删除' }, 404);
  }

  // 删除相关媒体和互动 (CASCADE 应该会自动删除)
  await c.env.DB.prepare('DELETE FROM moments WHERE id = ?').bind(momentId).run();

  return c.json({ success: true });
});

export default moments;
