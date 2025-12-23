import { Context, Next } from 'hono';
import type { Env } from '../types';

interface RateLimitConfig {
  // 时间窗口（秒）
  windowSeconds: number;
  // 最大请求次数
  maxRequests: number;
  // 限制类型标识
  keyPrefix: string;
}

// 获取客户端 IP
function getClientIP(c: Context): string {
  // Cloudflare 提供的真实 IP
  return c.req.header('CF-Connecting-IP') ||
         c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

// 速率限制中间件工厂
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = getClientIP(c);
    const key = `rate:${config.keyPrefix}:${ip}`;

    try {
      // 从 KV 获取当前计数
      const data = await c.env.KV.get(key, 'json') as { count: number; resetAt: number } | null;
      const now = Date.now();

      if (data && data.resetAt > now) {
        // 在时间窗口内
        if (data.count >= config.maxRequests) {
          const retryAfter = Math.ceil((data.resetAt - now) / 1000);
          return c.json(
            { error: '请求过于频繁，请稍后再试', retryAfter },
            429,
            { 'Retry-After': retryAfter.toString() }
          );
        }

        // 增加计数
        await c.env.KV.put(key, JSON.stringify({
          count: data.count + 1,
          resetAt: data.resetAt
        }), { expirationTtl: config.windowSeconds });
      } else {
        // 新的时间窗口
        await c.env.KV.put(key, JSON.stringify({
          count: 1,
          resetAt: now + config.windowSeconds * 1000
        }), { expirationTtl: config.windowSeconds });
      }
    } catch (error) {
      // KV 错误不应阻止请求，但记录日志
      console.error('Rate limit KV error:', error);
    }

    await next();
  };
}

// 预定义的速率限制配置
export const authRateLimit = rateLimit({
  keyPrefix: 'auth',
  windowSeconds: 300, // 5 分钟
  maxRequests: 20,    // 最多 20 次尝试
});

export const inviteRateLimit = rateLimit({
  keyPrefix: 'invite',
  windowSeconds: 60,  // 1 分钟
  maxRequests: 10,    // 最多 10 次查询
});

export const uploadRateLimit = rateLimit({
  keyPrefix: 'upload',
  windowSeconds: 60,  // 1 分钟
  maxRequests: 30,    // 最多 30 次上传
});
