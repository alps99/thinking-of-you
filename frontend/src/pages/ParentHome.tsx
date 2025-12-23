import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkinApi } from '../lib/api';
import { CheckInView } from '../components/parent/CheckInView';
import type { CheckIn } from '../types';

export function ParentHome() {
  const { user, family, logout } = useAuth();
  const [latestCheckIn, setLatestCheckIn] = useState<CheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const result = await checkinApi.getLatest();
      setLatestCheckIn(result.check_in);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 获取当前北京日期和时间
  const getBeijingDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    });
    const weekday = now.toLocaleDateString('zh-CN', {
      weekday: 'short',
      timeZone: 'Asia/Shanghai',
    });
    const time = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
    });
    return { date, weekday, time };
  };

  // 获取芝加哥日期和时间
  const getChicagoDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'America/Chicago',
    });
    const weekday = now.toLocaleDateString('zh-CN', {
      weekday: 'short',
      timeZone: 'America/Chicago',
    });
    const time = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    });
    return { date, weekday, time };
  };

  const beijing = getBeijingDateTime();
  const chicago = getChicagoDateTime();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header - 父母端用绿色 */}
      <div className="bg-gradient-to-br from-green-500 to-teal-500 px-5 pt-12 pb-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-white text-3xl font-bold">惦记</h1>
            <div className="mt-2 space-y-1">
              <p className="text-white/90 text-lg">
                北京 {beijing.date} {beijing.weekday} {beijing.time}
              </p>
              <p className="text-white/90 text-lg">
                芝加哥 {chicago.date} {chicago.weekday} {chicago.time}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-white bg-white/20 text-lg py-1.5 px-4 rounded-full active-scale hover:bg-white/30 transition-colors"
          >
            退出
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 -mt-2">
        {latestCheckIn ? (
          <CheckInView checkIn={latestCheckIn} onResponded={fetchData} />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-xl">还没有收到惦记</p>
            <p className="text-gray-400 text-lg mt-2">等待孩子发来第一条惦记吧</p>
          </div>
        )}

        {/* 家庭信息 */}
        <div className="mt-4 bg-white rounded-2xl shadow p-4">
          <h3 className="text-gray-800 font-bold text-lg mb-2">
            {family?.name || '我的家庭'}
          </h3>
          <p className="text-gray-500">
            欢迎你，{user?.name}
          </p>
        </div>
      </div>
    </div>
  );
}
