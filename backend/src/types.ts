// Cloudflare Workers 环境类型
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  APP_URL: string;
}

// 用户类型
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: 'child' | 'parent';
  family_id: string;
  timezone: string;
  email_verified: number;
  created_at: string;
}

// 数据库用户行（包含密码哈希）
export interface UserRow extends User {
  password_hash: string;
}

// 家庭类型
export interface Family {
  id: string;
  name: string;
  invite_code: string | null;
  invite_expires_at: string | null;
  created_at: string;
}

// 惦记类型
export interface CheckIn {
  id: string;
  family_id: string;
  user_id: string;
  mood: 1 | 2 | 3; // 1=好, 2=一般, 3=想家
  message: string | null;
  photo_key: string | null;
  audio_key: string | null;
  created_at: string;
}

// 惦记回应
export interface CheckInResponse {
  id: string;
  check_in_id: string;
  user_id: string;
  type: 'heart' | 'audio';
  audio_key: string | null;
  created_at: string;
}

// JWT Payload
export interface JWTPayload {
  user_id: string;
  family_id: string;
  role: 'child' | 'parent';
  exp: number;
}

// 扩展 Hono Context
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    jwtPayload: JWTPayload;
  }
}
