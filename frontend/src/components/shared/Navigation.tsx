import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';
import { albumApi, momentsApi } from '../../lib/api';

const tabs = [
  { path: '/', icon: '❤️', label: '惦记' },
  { path: '/moments', icon: '✨', label: '新鲜事' },
  { path: '/album', icon: '🖼️', label: '相册' },
  { path: '/calendar', icon: '📅', label: '日历' },
];

export function Navigation() {
  const { user } = useAuth();
  const location = useLocation();
  const isParent = user?.role === 'parent';
  const [albumUnreadCount, setAlbumUnreadCount] = useState(0);
  const [momentsUnreadCount, setMomentsUnreadCount] = useState(0);

  // 父母端获取未读照片和新鲜事数量
  useEffect(() => {
    if (!isParent) return;

    const fetchUnreadCounts = async () => {
      try {
        const [albumResult, momentsResult] = await Promise.all([
          albumApi.getUnreadCount(),
          momentsApi.getUnreadCount(),
        ]);
        setAlbumUnreadCount(albumResult.count);
        setMomentsUnreadCount(momentsResult.count);
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };

    fetchUnreadCounts();

    // 每30秒刷新一次
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [isParent]);

  // 当进入相册页面时，延迟刷新未读数量（给用户时间查看照片）
  useEffect(() => {
    if (!isParent || location.pathname !== '/album') return;

    // 离开相册页面时刷新未读数量
    return () => {
      albumApi.getUnreadCount().then((result) => {
        setAlbumUnreadCount(result.count);
      }).catch(() => {});
    };
  }, [isParent, location.pathname]);

  // 当进入新鲜事页面时，延迟刷新未读数量
  useEffect(() => {
    if (!isParent || location.pathname !== '/moments') return;

    // 离开新鲜事页面时刷新未读数量
    return () => {
      momentsApi.getUnreadCount().then((result) => {
        setMomentsUnreadCount(result.count);
      }).catch(() => {});
    };
  }, [isParent, location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 nav-safe-area z-50">
      <div className="flex justify-around items-center px-2 py-2 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-1 rounded-xl transition-all active-scale ${
                isActive
                  ? isParent
                    ? 'text-green-600 bg-green-50'
                    : 'text-orange-500 bg-orange-50'
                  : 'text-gray-400 hover:bg-gray-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`${isParent ? 'text-2xl' : 'text-xl'} relative`}>
                  {tab.icon}
                  {/* 新鲜事未读提示 */}
                  {tab.path === '/moments' && isParent && momentsUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {momentsUnreadCount > 99 ? '99+' : momentsUnreadCount}
                    </span>
                  )}
                  {/* 相册未读提示 */}
                  {tab.path === '/album' && isParent && albumUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {albumUnreadCount > 99 ? '99+' : albumUnreadCount}
                    </span>
                  )}
                </span>
                <span
                  className={`${isParent ? 'text-sm' : 'text-xs'} mt-0.5 ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
