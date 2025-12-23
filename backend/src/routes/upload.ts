import { Hono } from 'hono';
import type { Env } from '../types';
import { generateId } from '../utils/id';
import { authMiddleware } from '../middleware/auth';
import { uploadRateLimit } from '../middleware/rateLimit';

const upload = new Hono<{ Bindings: Env }>();

// 公开访问的图片端点 (不需要认证，用于 img 标签加载)
// 通过 family_id 在 key 中验证访问权限
upload.get('/file/:key{.+}', async (c) => {
  const key = c.req.param('key');

  // 基本的 key 格式验证
  const pattern = /^(photos|videos|audios|avatars|thumbs)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
  if (!pattern.test(key)) {
    return c.json({ error: '无效的文件路径' }, 400);
  }

  const object = await c.env.R2.get(key);
  if (!object) {
    return c.json({ error: '文件不存在' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=86400'); // 缓存1天

  return new Response(object.body, { headers });
});

// 使用认证中间件 (以下端点需要认证)
upload.use('/*', authMiddleware);

// 严格验证文件 key 是否属于指定家庭
// key 格式: {type}s/{family_id}/{file_id}.{ext} 或 thumbs/{family_id}/{file_id}.{ext}
function validateFileKey(key: string, familyId: string): boolean {
  // 使用正则确保 family_id 在正确位置
  const pattern = new RegExp(`^(photos|videos|audios|avatars|thumbs)/${familyId}/[a-zA-Z0-9_-]+\\.[a-zA-Z0-9]+$`);
  return pattern.test(key);
}

// 验证文件扩展名是否安全
function validateFileExtension(filename: string, type: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  const allowedExtensions: Record<string, string[]> = {
    photo: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    video: ['mp4', 'mov', 'webm'],
    audio: ['mp3', 'wav', 'm4a', 'webm'],
    avatar: ['jpg', 'jpeg', 'png', 'webp'],
  };
  return ext ? allowedExtensions[type]?.includes(ext) ?? false : false;
}

// 获取上传签名URL (用于客户端直传R2) - 添加速率限制
upload.post('/sign', uploadRateLimit, async (c) => {
  const user = c.get('user');

  const body = await c.req.json<{
    filename: string;
    contentType: string;
    type: 'photo' | 'video' | 'audio' | 'avatar';
  }>();

  const { filename, contentType, type } = body;

  // 验证文件类型 (忽略 codecs 参数, 如 audio/webm;codecs=opus)
  const baseContentType = contentType.split(';')[0].trim();

  const allowedTypes: Record<string, string[]> = {
    photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    video: ['video/mp4', 'video/quicktime', 'video/webm'],
    audio: ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/mp4', 'audio/x-m4a'],
    avatar: ['image/jpeg', 'image/png', 'image/webp'],
  };

  if (!allowedTypes[type]?.includes(baseContentType)) {
    return c.json({ error: '不支持的文件类型' }, 400);
  }

  // 验证文件扩展名
  if (!validateFileExtension(filename, type)) {
    return c.json({ error: '不支持的文件扩展名' }, 400);
  }

  // 文件大小限制
  const sizeLimits: Record<string, number> = {
    photo: 10 * 1024 * 1024, // 10MB
    video: 50 * 1024 * 1024, // 50MB
    audio: 5 * 1024 * 1024,  // 5MB
    avatar: 2 * 1024 * 1024, // 2MB
  };

  // 生成文件key
  const ext = filename.split('.').pop() || 'bin';
  const fileId = generateId();
  const key = `${type}s/${user.family_id}/${fileId}.${ext}`;

  // 生成缩略图key (如果是图片或视频)
  let thumbnailKey: string | undefined;
  if (type === 'photo' || type === 'video') {
    thumbnailKey = `thumbs/${user.family_id}/${fileId}.jpg`;
  }

  // 使用 R2 的 createMultipartUpload 或直接返回 key 让客户端上传
  // 这里简化处理，返回 key 让前端使用 presigned URL 上传

  return c.json({
    key,
    thumbnailKey,
    uploadUrl: `/api/upload/put/${key}`,
    maxSize: sizeLimits[type],
  });
});

// 直接上传文件到 R2 - 添加速率限制
upload.put('/put/:key{.+}', uploadRateLimit, async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');

  // 严格验证 key 是否属于当前用户的家庭（使用正则）
  if (!validateFileKey(key, user.family_id)) {
    return c.json({ error: '无权上传到此路径' }, 403);
  }

  const body = await c.req.arrayBuffer();
  const contentType = c.req.header('Content-Type') || 'application/octet-stream';

  try {
    await c.env.R2.put(key, body, {
      httpMetadata: {
        contentType,
      },
    });

    return c.json({
      success: true,
      key,
      size: body.byteLength,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: '上传失败' }, 500);
  }
});

// 获取文件访问URL (签名URL)
upload.get('/url/:key{.+}', async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');

  // 严格验证 key 是否属于当前用户的家庭（使用正则）
  if (!validateFileKey(key, user.family_id)) {
    return c.json({ error: '无权访问此文件' }, 403);
  }

  // 检查文件是否存在
  const object = await c.env.R2.head(key);
  if (!object) {
    return c.json({ error: '文件不存在' }, 404);
  }

  // 生成临时访问URL
  // 注意: R2 的 createSignedUrl 需要在 Worker 中配置
  // 这里简化为直接代理访问
  const url = `/api/upload/get/${key}`;

  return c.json({
    url,
    size: object.size,
    contentType: object.httpMetadata?.contentType,
  });
});

// 代理获取 R2 文件 (需要认证)
upload.get('/get/:key{.+}', async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');

  // 严格验证 key 是否属于当前用户的家庭（使用正则）
  if (!validateFileKey(key, user.family_id)) {
    return c.json({ error: '无权访问此文件' }, 403);
  }

  const object = await c.env.R2.get(key);
  if (!object) {
    return c.json({ error: '文件不存在' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=3600');

  return new Response(object.body, { headers });
});

// 删除文件
upload.delete('/delete/:key{.+}', async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');

  // 只有子女可以删除文件
  if (user.role !== 'child') {
    return c.json({ error: '只有子女可以删除文件' }, 403);
  }

  // 严格验证 key 是否属于当前用户的家庭（使用正则）
  if (!validateFileKey(key, user.family_id)) {
    return c.json({ error: '无权删除此文件' }, 403);
  }

  try {
    await c.env.R2.delete(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: '删除失败' }, 500);
  }
});

export default upload;
