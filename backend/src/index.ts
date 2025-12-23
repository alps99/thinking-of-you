import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';
import auth from './routes/auth';
import family from './routes/family';
import checkin from './routes/checkin';
import moments from './routes/moments';
import album from './routes/album';
import upload from './routes/upload';

const app = new Hono<{ Bindings: Env }>();

// 中间件
app.use('*', logger());
app.use('*', async (c, next) => {
  // 动态 CORS 配置，从环境变量获取允许的域名
  const allowedOrigins = [
    'http://localhost:5173',
    c.env.APP_URL,
  ].filter(Boolean);

  return cors({
    origin: allowedOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
  })(c, next);
});

// 健康检查
app.get('/', (c) => {
  return c.json({
    name: '惦记 API',
    version: '1.0.0',
    status: 'ok',
  });
});

// 路由
app.route('/api/auth', auth);
app.route('/api/family', family);
app.route('/api/checkin', checkin);
app.route('/api/moments', moments);
app.route('/api/album', album);
app.route('/api/upload', upload);

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err.message, err.stack);
  // 开发阶段返回更详细的错误信息
  return c.json({
    error: '服务器内部错误',
    message: err.message
  }, 500);
});

export default app;
