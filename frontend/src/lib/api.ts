import type { User, Family, CheckIn, CalendarData } from '../types';

// 在开发环境下使用代理，生产环境使用实际 API 地址
const API_BASE = import.meta.env.VITE_API_URL || '';

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 从 localStorage 获取 token
  const token = localStorage.getItem('access_token');
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    // 网络错误（CORS、离线、服务器无响应等）
    throw new Error('网络连接失败，请检查网络后重试');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('服务器响应异常');
  }

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

// 认证 API
export const authApi = {
  // 子女注册
  register: async (data: {
    email: string;
    password: string;
    name: string;
    familyName: string;
  }) => {
    const result = await request<{
      user: User;
      family: Family;
      accessToken: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('access_token', result.accessToken);
    return result;
  },

  // 登录
  login: async (data: { account: string; password: string }) => {
    const result = await request<{
      user: User;
      family: Family;
      accessToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('access_token', result.accessToken);
    return result;
  },

  // 登出
  logout: async () => {
    await request('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('access_token');
  },

  // 获取当前用户
  me: async () => {
    return request<{ user: User; family: Family }>('/api/auth/me');
  },
};

// 家庭 API
export const familyApi = {
  // 获取家庭信息
  get: async () => {
    return request<{ family: Family; members: User[] }>('/api/family');
  },

  // 获取邀请链接
  getInvite: async () => {
    return request<{
      invite_code: string;
      invite_url: string;
      expires_at: string;
    }>('/api/family/invite');
  },

  // 验证邀请码
  validateInvite: async (code: string) => {
    return request<{ valid: boolean; family_name: string }>(
      `/api/family/invite/${code}`
    );
  },

  // 父母加入家庭
  join: async (data: {
    invite_code: string;
    phone: string;
    password: string;
    name: string;
  }) => {
    const result = await request<{
      user: User;
      family: Family;
      accessToken: string;
    }>('/api/family/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('access_token', result.accessToken);
    return result;
  },
};

// 惦记 API
export const checkinApi = {
  // 发送惦记
  create: async (data: {
    mood: number;
    message?: string;
    photo_key?: string;
    audio_key?: string;
  }) => {
    return request<CheckIn>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取今日惦记
  getToday: async () => {
    return request<{ check_ins: CheckIn[] }>('/api/checkin/today');
  },

  // 获取最新惦记
  getLatest: async () => {
    return request<{ check_in: CheckIn | null }>('/api/checkin/latest');
  },

  // 回应惦记
  respond: async (
    id: string,
    data: { type: 'heart' | 'audio'; audio_key?: string }
  ) => {
    return request<CheckIn>(`/api/checkin/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取日历数据
  getCalendar: async (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year.toString());
    if (month) params.set('month', month.toString());
    return request<CalendarData>(`/api/checkin/calendar?${params}`);
  },

  // 获取历史记录
  getHistory: async (limit = 20, offset = 0) => {
    return request<{ check_ins: CheckIn[] }>(
      `/api/checkin/history?limit=${limit}&offset=${offset}`
    );
  },
};

// 新鲜事类型
export interface Moment {
  id: string;
  family_id: string;
  author_id: string;
  author_name: string;
  content: string | null;
  location: string | null;
  audio_key: string | null;
  audio_duration: number | null;
  created_at: string;
  media: MomentMedia[];
  reactions: MomentReaction[];
  comments: MomentComment[];
  heart_count: number;
  audio_count: number;
  comment_count: number;
  has_hearted: boolean;
}

export interface MomentMedia {
  id: string;
  moment_id: string;
  media_type: 'photo' | 'video';
  r2_key: string;
  thumbnail_key: string | null;
  sort_order: number;
}

export interface MomentReaction {
  id: string;
  moment_id: string;
  user_id: string;
  user_name: string;
  type: 'heart' | 'audio';
  audio_key: string | null;
  created_at: string;
}

export interface MomentComment {
  id: string;
  moment_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

// 新鲜事 API
export const momentsApi = {
  // 获取新鲜事列表
  getList: async (limit = 20, offset = 0) => {
    return request<{ moments: Moment[] }>(
      `/api/moments?limit=${limit}&offset=${offset}`
    );
  },

  // 获取单个新鲜事
  getOne: async (id: string) => {
    return request<{ moment: Moment }>(`/api/moments/${id}`);
  },

  // 发布新鲜事
  create: async (data: {
    content?: string;
    location?: string;
    media?: { media_type: 'photo' | 'video'; r2_key: string; thumbnail_key?: string }[];
    audio_key?: string;
    audio_duration?: number;
  }) => {
    return request<Moment>('/api/moments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 互动 (点赞/语音回复)
  react: async (id: string, data: { type: 'heart' | 'audio'; audio_key?: string }) => {
    return request<{
      id: string;
      moment_id: string;
      user_id: string;
      type: 'heart' | 'audio';
      audio_key?: string;
      action: string;
      created_at: string;
    }>(`/api/moments/${id}/react`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 删除新鲜事
  delete: async (id: string) => {
    return request<{ success: boolean }>(`/api/moments/${id}`, {
      method: 'DELETE',
    });
  },

  // 添加评论
  addComment: async (id: string, content: string) => {
    return request<MomentComment>(`/api/moments/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  // 删除评论
  deleteComment: async (momentId: string, commentId: string) => {
    return request<{ success: boolean }>(`/api/moments/${momentId}/comment/${commentId}`, {
      method: 'DELETE',
    });
  },

  // 获取未读新鲜事数量 (父母专用)
  getUnreadCount: async () => {
    return request<{ count: number }>('/api/moments/unread-count');
  },

  // 标记新鲜事已读 (父母专用)
  viewMoment: async (id: string) => {
    return request<{ success: boolean }>(`/api/moments/${id}/view`, {
      method: 'POST',
    });
  },
};

// 宝贝类型
export interface Grandchild {
  id: string;
  family_id: string;
  name: string;
  avatar_key: string | null;
  birth_date: string | null;
  created_at: string;
}

// 照片类型
export interface Photo {
  id: string;
  family_id: string;
  uploader_id: string;
  uploader_name?: string;
  grandchild_id: string | null;
  r2_key: string;
  thumbnail_key: string;
  taken_at: string | null;
  created_at: string;
  is_new?: boolean;
}

// 照片请求类型
export interface PhotoRequest {
  id: string;
  family_id: string;
  requester_id: string;
  requester_name?: string;
  message: string | null;
  status: 'pending' | 'fulfilled';
  created_at: string;
}

// 相册 API
export const albumApi = {
  // 获取宝贝列表
  getGrandchildren: async () => {
    return request<{ grandchildren: Grandchild[] }>('/api/album/grandchildren');
  },

  // 添加宝贝
  addGrandchild: async (data: { name: string; birth_date?: string; avatar_key?: string }) => {
    return request<Grandchild>('/api/album/grandchildren', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 更新宝贝
  updateGrandchild: async (
    id: string,
    data: { name: string; birth_date?: string; avatar_key?: string }
  ) => {
    return request<{ success: boolean }>(`/api/album/grandchildren/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 获取照片列表
  getPhotos: async (limit = 50, offset = 0, grandchildId?: string) => {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (grandchildId) params.set('grandchild_id', grandchildId);
    return request<{ photos: Photo[] }>(`/api/album/photos?${params}`);
  },

  // 添加照片
  addPhoto: async (data: {
    r2_key: string;
    thumbnail_key: string;
    grandchild_id?: string;
    taken_at?: string;
  }) => {
    return request<Photo>('/api/album/photos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 删除照片
  deletePhoto: async (id: string) => {
    return request<{ success: boolean; deleted_r2_key: string }>(`/api/album/photos/${id}`, {
      method: 'DELETE',
    });
  },

  // 标记照片已查看 (父母专用)
  viewPhoto: async (id: string) => {
    return request<{ success: boolean }>(`/api/album/photos/${id}/view`, {
      method: 'POST',
    });
  },

  // 发送"想看"请求
  requestPhotos: async (message?: string) => {
    return request<PhotoRequest>('/api/album/request', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // 获取请求列表
  getRequests: async () => {
    return request<{ requests: PhotoRequest[] }>('/api/album/requests');
  },

  // 标记请求已完成
  fulfillRequest: async (id: string) => {
    return request<{ success: boolean }>(`/api/album/requests/${id}/fulfill`, {
      method: 'PUT',
    });
  },

  // 获取一年前的今天
  getMemories: async () => {
    return request<{ date: string; photos: Photo[]; has_memories: boolean }>(
      '/api/album/memories'
    );
  },

  // 获取未读照片数量 (父母专用)
  getUnreadCount: async () => {
    return request<{ count: number }>('/api/album/unread-count');
  },
};

// 上传 API
export const uploadApi = {
  // 获取上传签名
  getSignedUrl: async (data: {
    filename: string;
    contentType: string;
    type: 'photo' | 'video' | 'audio' | 'avatar';
  }) => {
    return request<{
      key: string;
      thumbnailKey?: string;
      uploadUrl: string;
      maxSize: number;
    }>('/api/upload/sign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 上传文件
  uploadFile: async (key: string, file: File) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE}/api/upload/put/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        Authorization: `Bearer ${token}`,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error('上传失败');
    }

    return response.json();
  },

  // 获取文件 URL (使用公开端点，无需认证)
  getFileUrl: (key: string) => {
    return `${API_BASE}/api/upload/file/${key}`;
  },

  // 删除文件
  deleteFile: async (key: string) => {
    return request<{ success: boolean }>(`/api/upload/delete/${key}`, {
      method: 'DELETE',
    });
  },
};
