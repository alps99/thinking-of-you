import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types';
import { generateId } from '../utils/id';
import { authMiddleware } from '../middleware/auth';

interface Grandchild {
  id: string;
  family_id: string;
  name: string;
  avatar_key: string | null;
  birth_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Photo {
  id: string;
  family_id: string;
  uploader_id: string;
  grandchild_id: string | null;
  r2_key: string;
  thumbnail_key: string;
  taken_at: string | null;
  created_at: string;
}

interface PhotoRequest {
  id: string;
  family_id: string;
  requester_id: string;
  message: string | null;
  status: 'pending' | 'fulfilled';
  created_at: string;
}

const album = new Hono<{ Bindings: Env }>();

// 使用认证中间件
album.use('/*', authMiddleware);

// ========== 宝贝管理 ==========

// 创建宝贝 Schema
const createGrandchildSchema = z.object({
  name: z.string().min(1).max(50),
  birth_date: z.string().optional(),
  avatar_key: z.string().optional(),
});

// 添加宝贝
album.post('/grandchildren', zValidator('json', createGrandchildSchema), async (c) => {
  const user = c.get('user');

  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以添加宝贝' }, 403);
  }

  const { name, birth_date, avatar_key } = c.req.valid('json');
  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO grandchildren (id, family_id, name, avatar_key, birth_date, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, user.family_id, name, avatar_key || null, birth_date || null, user.id).run();

  return c.json({
    id,
    family_id: user.family_id,
    name,
    avatar_key,
    birth_date,
    created_at: new Date().toISOString(),
  });
});

// 获取宝贝列表
album.get('/grandchildren', async (c) => {
  const user = c.get('user');

  const grandchildren = await c.env.DB.prepare(
    'SELECT * FROM grandchildren WHERE family_id = ? ORDER BY created_at'
  ).bind(user.family_id).all<Grandchild>();

  return c.json({ grandchildren: grandchildren.results });
});

// 更新宝贝信息
album.put('/grandchildren/:id', zValidator('json', createGrandchildSchema), async (c) => {
  const user = c.get('user');
  const grandchildId = c.req.param('id');

  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以修改宝贝信息' }, 403);
  }

  const { name, birth_date, avatar_key } = c.req.valid('json');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM grandchildren WHERE id = ? AND family_id = ?'
  ).bind(grandchildId, user.family_id).first<Grandchild>();

  if (!existing) {
    return c.json({ error: '宝贝不存在' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE grandchildren SET name = ?, birth_date = ?, avatar_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(name, birth_date || null, avatar_key || existing.avatar_key, grandchildId).run();

  return c.json({ success: true });
});

// ========== 照片管理 ==========

// 上传照片信息 Schema
const uploadPhotoSchema = z.object({
  r2_key: z.string(),
  thumbnail_key: z.string(),
  grandchild_id: z.string().optional(),
  taken_at: z.string().optional(),
});

// 添加照片
album.post('/photos', zValidator('json', uploadPhotoSchema), async (c) => {
  const user = c.get('user');

  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以上传照片' }, 403);
  }

  const { r2_key, thumbnail_key, grandchild_id, taken_at } = c.req.valid('json');
  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO photos (id, family_id, uploader_id, grandchild_id, r2_key, thumbnail_key, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.family_id, user.id, grandchild_id || null, r2_key, thumbnail_key, taken_at || null).run();

  return c.json({
    id,
    family_id: user.family_id,
    r2_key,
    thumbnail_key,
    grandchild_id,
    taken_at,
    created_at: new Date().toISOString(),
  });
});

// 获取照片列表
album.get('/photos', async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const grandchildId = c.req.query('grandchild_id');

  let query = `
    SELECT p.*, u.name as uploader_name
    FROM photos p
    JOIN users u ON p.uploader_id = u.id
    WHERE p.family_id = ?
  `;
  const params: (string | number)[] = [user.family_id];

  if (grandchildId) {
    query += ' AND p.grandchild_id = ?';
    params.push(grandchildId);
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const photos = await c.env.DB.prepare(query).bind(...params).all<Photo & { uploader_name: string }>();

  // 对于父母用户，检查哪些照片已查看
  if (user.role === 'parent') {
    const photoIds = photos.results.map((p) => p.id);
    if (photoIds.length > 0) {
      // 获取该用户已查看的照片
      const viewedPhotos = await c.env.DB.prepare(
        `SELECT photo_id FROM photo_views WHERE user_id = ? AND photo_id IN (${photoIds.map(() => '?').join(',')})`
      ).bind(user.id, ...photoIds).all<{ photo_id: string }>();

      const viewedSet = new Set(viewedPhotos.results.map((v) => v.photo_id));

      const photosWithNew = photos.results.map((p) => ({
        ...p,
        is_new: !viewedSet.has(p.id),
      }));

      return c.json({ photos: photosWithNew });
    }
  }

  // 子女端不需要 is_new 标记，或者没有照片时
  const photosWithNew = photos.results.map((p) => ({
    ...p,
    is_new: false,
  }));

  return c.json({ photos: photosWithNew });
});

// 标记照片已查看 (父母专用)
album.post('/photos/:id/view', async (c) => {
  const user = c.get('user');
  const photoId = c.req.param('id');

  if (user.role !== 'parent') {
    return c.json({ error: '只有父母可以标记照片已查看' }, 403);
  }

  // 验证照片属于该家庭
  const photo = await c.env.DB.prepare(
    'SELECT id FROM photos WHERE id = ? AND family_id = ?'
  ).bind(photoId, user.family_id).first();

  if (!photo) {
    return c.json({ error: '照片不存在' }, 404);
  }

  // 使用 INSERT OR IGNORE 避免重复插入
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO photo_views (id, photo_id, user_id) VALUES (?, ?, ?)'
  ).bind(id, photoId, user.id).run();

  return c.json({ success: true });
});

// 删除照片
album.delete('/photos/:id', async (c) => {
  const user = c.get('user');
  const photoId = c.req.param('id');

  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以删除照片' }, 403);
  }

  const photo = await c.env.DB.prepare(
    'SELECT * FROM photos WHERE id = ? AND uploader_id = ?'
  ).bind(photoId, user.id).first<Photo>();

  if (!photo) {
    return c.json({ error: '照片不存在或无权删除' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();

  return c.json({ success: true, deleted_r2_key: photo.r2_key });
});

// ========== "想看"请求 ==========

// 发送想看请求 Schema
const requestSchema = z.object({
  message: z.string().max(100).optional(),
});

// 父母发送"想看"请求
album.post('/request', zValidator('json', requestSchema), async (c) => {
  const user = c.get('user');

  if (user.role !== 'parent') {
    return c.json({ error: '只有父母可以发送想看请求' }, 403);
  }

  const { message } = c.req.valid('json');
  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO photo_requests (id, family_id, requester_id, message) VALUES (?, ?, ?, ?)'
  ).bind(id, user.family_id, user.id, message || '想看最近的照片').run();

  return c.json({
    id,
    family_id: user.family_id,
    requester_id: user.id,
    message: message || '想看最近的照片',
    status: 'pending',
    created_at: new Date().toISOString(),
  });
});

// 获取想看请求列表
album.get('/requests', async (c) => {
  const user = c.get('user');

  const requests = await c.env.DB.prepare(`
    SELECT r.*, u.name as requester_name
    FROM photo_requests r
    JOIN users u ON r.requester_id = u.id
    WHERE r.family_id = ?
    ORDER BY r.created_at DESC
    LIMIT 20
  `).bind(user.family_id).all<PhotoRequest & { requester_name: string }>();

  return c.json({ requests: requests.results });
});

// 标记请求已完成
album.put('/requests/:id/fulfill', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');

  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以标记请求已完成' }, 403);
  }

  await c.env.DB.prepare(
    'UPDATE photo_requests SET status = ? WHERE id = ? AND family_id = ?'
  ).bind('fulfilled', requestId, user.family_id).run();

  return c.json({ success: true });
});

// ========== 未读照片数量 (父母专用) ==========

album.get('/unread-count', async (c) => {
  const user = c.get('user');

  if (user.role !== 'parent') {
    return c.json({ count: 0 });
  }

  // 获取该家庭所有照片数量
  const totalPhotos = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM photos WHERE family_id = ?'
  ).bind(user.family_id).first<{ total: number }>();

  // 获取该用户已查看的照片数量
  const viewedPhotos = await c.env.DB.prepare(`
    SELECT COUNT(*) as viewed FROM photo_views pv
    JOIN photos p ON pv.photo_id = p.id
    WHERE pv.user_id = ? AND p.family_id = ?
  `).bind(user.id, user.family_id).first<{ viewed: number }>();

  const unreadCount = (totalPhotos?.total || 0) - (viewedPhotos?.viewed || 0);

  return c.json({ count: Math.max(0, unreadCount) });
});

// ========== 一年前的今天 ==========

album.get('/memories', async (c) => {
  const user = c.get('user');

  // 获取一年前的今天的照片
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const nextDay = new Date(oneYearAgo);
  nextDay.setDate(nextDay.getDate() + 1);

  const startDate = oneYearAgo.toISOString().split('T')[0];
  const endDate = nextDay.toISOString().split('T')[0];

  const photos = await c.env.DB.prepare(`
    SELECT * FROM photos
    WHERE family_id = ?
      AND DATE(created_at) >= ?
      AND DATE(created_at) < ?
    ORDER BY created_at
    LIMIT 10
  `).bind(user.family_id, startDate, endDate).all<Photo>();

  return c.json({
    date: startDate,
    photos: photos.results,
    has_memories: photos.results.length > 0,
  });
});

export default album;
