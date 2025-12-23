import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkinApi, uploadApi } from '../lib/api';
import { getMoodEmoji, getMoodLabel } from '../types';
import type { CalendarData } from '../types';

interface CalendarResponse {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  audio_key: string | null;
  created_at: string;
}

interface CalendarCheckIn {
  id: string;
  mood: number;
  user_id: string;
  message: string | null;
  photo_key: string | null;
  audio_key: string | null;
  created_at: string;
  user_name: string;
  responses?: CalendarResponse[];
}

export function CalendarPage() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';

  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CalendarCheckIn | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [playingResponseId, setPlayingResponseId] = useState<string | null>(null);

  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const data = await checkinApi.getCalendar(currentYear, currentMonth);
      setCalendarData(data);
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [currentYear, currentMonth]);

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 生成日历网格
  const generateCalendarGrid = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // 填充月初空白
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const today = new Date();
  const isToday = (day: number) =>
    currentYear === today.getFullYear() &&
    currentMonth === today.getMonth() + 1 &&
    day === today.getDate();

  const getCheckInForDay = (day: number) => {
    if (!calendarData) return null;
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarData.calendar[dateStr]?.[0];
  };

  const handleDayClick = (day: number) => {
    const checkIn = getCheckInForDay(day);
    if (checkIn) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDate(dateStr);
      setSelectedCheckIn(checkIn as CalendarCheckIn);
      setIsPlayingAudio(false);
      setShowFullImage(false);
    }
  };

  const closeDetail = () => {
    setSelectedDate(null);
    setSelectedCheckIn(null);
    setIsPlayingAudio(false);
    setShowFullImage(false);
    setPlayingResponseId(null);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const days = generateCalendarGrid();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className={`px-5 pt-12 pb-5 ${
          isParent
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
            : 'bg-gradient-to-br from-blue-400 to-purple-500'
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={goToPrevMonth}
            className="text-white/60 text-2xl hover:text-white"
          >
            ◀
          </button>
          <h1 className={`text-white font-bold ${isParent ? 'text-2xl' : 'text-xl'}`}>
            {currentYear}年{currentMonth}月
          </h1>
          <button
            onClick={goToNextMonth}
            className="text-white/60 text-2xl hover:text-white"
          >
            ▶
          </button>
        </div>

        {calendarData && (
          <div className="bg-white/20 rounded-xl p-3 flex justify-around">
            <div className="text-center">
              <p className={`text-white font-bold ${isParent ? 'text-2xl' : 'text-xl'}`}>
                {calendarData.stats.total_days}
              </p>
              <p className="text-white/70">{isParent ? '收到惦记' : '发送惦记'}</p>
            </div>
            <div className="w-px bg-white/30"></div>
            <div className="text-center">
              <p className={`text-white font-bold ${isParent ? 'text-2xl' : 'text-xl'}`}>
                {calendarData.stats.streak}
              </p>
              <p className="text-white/70">连续天数</p>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="px-3 py-3 -mt-2">
        <div className="bg-white rounded-2xl shadow-lg p-3">
          {/* Week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map((day) => (
              <span key={day} className="text-gray-400 text-sm">
                {day}
              </span>
            ))}
          </div>

          {/* Days */}
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              加载中...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={index} className="aspect-square"></div>;
                }

                const checkIn = getCheckInForDay(day);
                const hasCheckIn = !!checkIn;

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    disabled={!hasCheckIn}
                    className={`aspect-square rounded flex flex-col items-center justify-center transition-all ${
                      isToday(day)
                        ? 'bg-blue-500 text-white'
                        : hasCheckIn
                        ? 'bg-green-100 hover:bg-green-200 active:scale-95'
                        : 'bg-gray-50'
                    } ${hasCheckIn ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`font-bold ${!hasCheckIn && !isToday(day) ? 'text-gray-300' : ''}`}>
                      {day}
                    </span>
                    {hasCheckIn && (
                      <span className="text-xs">{getMoodEmoji(checkIn.mood)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 mt-3 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-100 rounded"></span>
            {isParent ? '收到' : '发送'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-100 rounded border border-gray-200"></span>
            未{isParent ? '收到' : '发送'}
          </span>
        </div>

        <p className="text-center text-gray-400 text-sm mt-2">
          点击有惦记的日期查看详情
        </p>
      </div>

      {/* 惦记详情弹窗 */}
      {selectedDate && selectedCheckIn && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={closeDetail}
        >
          <div
            className="bg-white w-[90%] max-w-md rounded-2xl shadow-xl flex flex-col"
            style={{ maxHeight: '70vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 - 固定头部 */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedDate.replace(/-/g, '/')} 的惦记
              </h3>
              <button
                onClick={closeDetail}
                className="text-gray-400 text-2xl hover:text-gray-600 w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* 惦记内容 - 可滚动 */}
            <div className="text-center p-4 overflow-y-auto flex-1">
              <p className="text-gray-500 mb-2">
                {isParent ? `${selectedCheckIn.user_name} 说：` : '我说：'}
              </p>
              <div className="text-5xl my-3">{getMoodEmoji(selectedCheckIn.mood)}</div>
              <p className="text-gray-800 text-lg font-bold mb-1">
                {getMoodLabel(selectedCheckIn.mood)}
              </p>
              <p className="text-gray-400 text-sm">
                {formatTime(selectedCheckIn.created_at)} 发送
              </p>

              {/* 文字留言 */}
              {selectedCheckIn.message && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 text-left">
                  <p className="text-gray-700">{selectedCheckIn.message}</p>
                </div>
              )}

              {/* 照片 */}
              {selectedCheckIn.photo_key && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowFullImage(true)}
                    className="w-full rounded-xl overflow-hidden active:opacity-80"
                  >
                    <img
                      src={uploadApi.getFileUrl(selectedCheckIn.photo_key)}
                      alt="照片"
                      className="w-full h-40 object-cover"
                    />
                  </button>
                  <p className="text-gray-400 text-xs mt-1">点击查看大图</p>
                </div>
              )}

              {/* 语音 */}
              {selectedCheckIn.audio_key && (
                <div className="mt-3 bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-500">🎤</span>
                    <span className="text-gray-700 text-sm font-medium">语音消息</span>
                  </div>
                  {isPlayingAudio ? (
                    <audio
                      controls
                      autoPlay
                      src={uploadApi.getFileUrl(selectedCheckIn.audio_key)}
                      className="w-full"
                      onEnded={() => setIsPlayingAudio(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setIsPlayingAudio(true)}
                      className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center justify-center gap-2"
                    >
                      <span>▶️</span> 点击播放
                    </button>
                  )}
                </div>
              )}

              {/* 父母回复 - 子女端显示 */}
              {!isParent && selectedCheckIn.responses && selectedCheckIn.responses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-500 text-sm mb-3">爸妈的回应：</p>
                  <div className="space-y-2">
                    {selectedCheckIn.responses.map((resp) => (
                      <div key={resp.id} className="bg-pink-50 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-pink-600 font-medium">{resp.user_name}</span>
                          <span className="text-gray-400 text-xs">{formatTime(resp.created_at)}</span>
                        </div>
                        {resp.type === 'heart' ? (
                          <div className="mt-2 text-2xl">❤️</div>
                        ) : resp.audio_key ? (
                          <div className="mt-2">
                            {playingResponseId === resp.id ? (
                              <audio
                                controls
                                autoPlay
                                src={uploadApi.getFileUrl(resp.audio_key)}
                                className="w-full"
                                onEnded={() => setPlayingResponseId(null)}
                              />
                            ) : (
                              <button
                                onClick={() => setPlayingResponseId(resp.id)}
                                className="w-full py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 flex items-center justify-center gap-2"
                              >
                                <span>▶️</span> 播放语音
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 子女端无回复时显示 */}
              {!isParent && (!selectedCheckIn.responses || selectedCheckIn.responses.length === 0) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-400 text-sm">爸妈还没有回应</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 照片全屏查看 */}
      {showFullImage && selectedCheckIn?.photo_key && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-6 right-6 text-white text-3xl font-bold bg-black/50 w-12 h-12 rounded-full flex items-center justify-center"
          >
            ✕
          </button>
          <img
            src={uploadApi.getFileUrl(selectedCheckIn.photo_key)}
            alt="照片"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
