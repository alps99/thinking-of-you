import type { JWTPayload } from '../types';

// Base64 URL 编码
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Base64 URL 解码
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// 创建 HMAC 签名
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// 验证 HMAC 签名
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createSignature(data, secret);
  return signature === expectedSignature;
}

// 生成 JWT
export async function signJWT(payload: Omit<JWTPayload, 'exp'>, secret: string, expiresInSeconds: number = 900): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await createSignature(data, secret);

  return `${data}.${signature}`;
}

// 验证并解析 JWT
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const isValid = await verifySignature(data, signature, secret);
    if (!isValid) return null;

    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // 检查过期
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// 生成 Refresh Token (30天有效期)
export async function signRefreshToken(payload: Omit<JWTPayload, 'exp'>, secret: string): Promise<string> {
  return signJWT(payload, secret, 30 * 24 * 60 * 60); // 30 days
}

// 生成 Access Token (15分钟有效期)
export async function signAccessToken(payload: Omit<JWTPayload, 'exp'>, secret: string): Promise<string> {
  return signJWT(payload, secret, 15 * 60); // 15 minutes
}
