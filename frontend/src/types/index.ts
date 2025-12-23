// 用户类型
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: 'child' | 'parent';
  family_id: string;
  timezone?: string;
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
  user_name: string;
  mood: 1 | 2 | 3; // 1=好, 2=一般, 3=想家
  message: string | null;
  photo_key: string | null;
  audio_key: string | null;
  created_at: string;
  responses?: CheckInResponse[];
  my_response?: CheckInResponse | null;
}

// 惦记回应
export interface CheckInResponse {
  id: string;
  check_in_id: string;
  user_id: string;
  user_name: string;
  type: 'heart' | 'audio';
  audio_key: string | null;
  created_at: string;
}

// 心情选项 - 27个emoji供选择
export const MOOD_OPTIONS = [
  // 开心系列
  { value: 1, emoji: '😄', label: '超开心' },
  { value: 2, emoji: '😊', label: '心情好' },
  { value: 3, emoji: '🥰', label: '幸福' },
  { value: 4, emoji: '😎', label: '酷炫' },
  { value: 5, emoji: '🤩', label: '兴奋' },
  { value: 6, emoji: '😁', label: '很棒' },
  { value: 7, emoji: '☀️', label: '阳光' },
  // 平静系列
  { value: 8, emoji: '😌', label: '平静' },
  { value: 9, emoji: '🙂', label: '还好' },
  { value: 10, emoji: '😇', label: '满足' },
  { value: 11, emoji: '🧘', label: '放松' },
  { value: 12, emoji: '☕', label: '休闲' },
  // 一般系列
  { value: 13, emoji: '😐', label: '一般' },
  { value: 14, emoji: '🤔', label: '思考' },
  { value: 15, emoji: '😶', label: '无语' },
  { value: 16, emoji: '🙄', label: '无聊' },
  // 忙碌系列
  { value: 17, emoji: '💪', label: '努力' },
  { value: 18, emoji: '📚', label: '学习' },
  { value: 19, emoji: '💼', label: '忙碌' },
  { value: 20, emoji: '🏃', label: '奔波' },
  // 疲惫系列
  { value: 21, emoji: '😴', label: '想睡' },
  { value: 22, emoji: '😩', label: '累了' },
  { value: 23, emoji: '🥱', label: '困倦' },
  { value: 24, emoji: '😓', label: '辛苦' },
  // 想家系列
  { value: 25, emoji: '🫂', label: '想家' },
  { value: 26, emoji: '💕', label: '想你们' },
  { value: 27, emoji: '🏠', label: '想回家' },
] as const;

// 获取心情 emoji
export function getMoodEmoji(mood: number): string {
  return MOOD_OPTIONS.find((m) => m.value === mood)?.emoji || '☀️';
}

// 获取心情标签
export function getMoodLabel(mood: number): string {
  return MOOD_OPTIONS.find((m) => m.value === mood)?.label || '今天不错';
}

// 日历数据
export interface CalendarData {
  year: number;
  month: number;
  calendar: Record<string, { mood: number; user_id: string }[]>;
  stats: {
    total_days: number;
    streak: number;
  };
}
