import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkinApi } from '../lib/api';
import { CheckInCard } from '../components/child/CheckInCard';
import { ResponseCard } from '../components/child/ResponseCard';
import { getMoodEmoji } from '../types';
import type { CheckIn } from '../types';

export function ChildHome() {
  const { user, family, logout } = useAuth();
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [todayResult, calendarResult] = await Promise.all([
        checkinApi.getToday(),
        checkinApi.getCalendar(),
      ]);

      // 获取今天自己发的惦记（只看今天的，不看昨天的）
      const today = new Date().toDateString();
      const myCheckIn = todayResult.check_ins.find(
        (c) => c.user_id === user?.id && new Date(c.created_at).toDateString() === today
      );
      setTodayCheckIn(myCheckIn || null);
      setStreak(calendarResult.stats.streak);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 每30秒自动刷新，获取父母的回应
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-400 to-pink-500 px-5 pt-12 pb-6 safe-area-top">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-white text-2xl font-bold">惦记</h1>
              <p className="text-white/80 text-sm mt-1">今天给爸妈报个平安吧</p>
            </div>
            <button
              onClick={logout}
              className="text-white bg-white/20 text-sm py-1.5 px-4 rounded-full active-scale hover:bg-white/30 transition-colors"
            >
              退出
            </button>
          </div>

          {streak > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">🔥</span>
              <div>
                <p className="text-white font-bold text-lg">连续惦记 {streak} 天</p>
                <p className="text-white/70 text-sm">爸妈很开心！</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 -mt-3 space-y-4 max-w-lg mx-auto">
        {/* 今日惦记卡片 */}
        {!todayCheckIn ? (
          <CheckInCard onSuccess={fetchData} />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <p className="text-gray-500 text-sm mb-3">今天已经惦记过啦</p>
            <div className="text-6xl mb-3">
              {getMoodEmoji(todayCheckIn.mood)}
            </div>
            <p className="text-gray-400 text-sm">
              {new Date(todayCheckIn.created_at).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' '}发送
            </p>
          </div>
        )}

        {/* 回复通知 */}
        {todayCheckIn?.responses && todayCheckIn.responses.length > 0 && (
          <ResponseCard responses={todayCheckIn.responses} />
        )}

        {/* 家庭信息 */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-800 font-bold text-base mb-3">
            {family?.name || '我的家庭'}
          </h3>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-gray-600 text-sm mb-1">家庭邀请码</p>
            <p className="text-orange-500 font-mono font-bold text-xl tracking-wider">
              {family?.invite_code || '---'}
            </p>
          </div>
          <p className="text-gray-400 text-xs mt-3 text-center">
            分享邀请码给爸妈，让他们加入家庭
          </p>
        </div>
      </div>
    </div>
  );
}
