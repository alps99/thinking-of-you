import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onSwitchToJoin: () => void;
}

export function LoginPage({ onSwitchToRegister, onSwitchToJoin }: LoginPageProps) {
  const { login } = useAuth();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(account, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-orange-400 to-pink-500 flex flex-col safe-area-top">
      {/* Logo区域 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center">
          <div className="text-6xl mb-4">❤️</div>
          <h1 className="text-4xl font-bold text-white mb-2">惦记</h1>
          <p className="text-white/80 text-lg">用最轻的方式，给爸妈最重的惦记</p>
        </div>
        {/* Footer */}
        <div className="mt-8 text-center text-white/60 text-sm space-y-2">
          <p>
            <a href="/privacy" className="hover:text-white/80 underline">隐私政策</a>
            {' · '}
            <a href="/terms" className="hover:text-white/80 underline">服务条款</a>
          </p>
          <p>
            © 2025{' '}
            <a
              href="https://github.com/alps99/thinking-of-you"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/80 underline"
            >
              ThinkingOfYou
            </a>
          </p>
        </div>
      </div>

      {/* 登录表单 */}
      <div className="bg-white rounded-t-3xl shadow-xl px-6 pt-8 pb-8 safe-area-bottom">
        <div className="max-w-sm mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">登录</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">邮箱或手机号</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-base"
                placeholder="请输入邮箱或手机号"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-base"
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm text-center py-3 px-4 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-orange-400 to-pink-500 text-white text-lg font-bold rounded-2xl disabled:opacity-50 active-scale shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 hover:scale-[1.02] transition-all duration-200"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onSwitchToRegister}
              className="w-full py-3 text-orange-500 font-medium text-base active-scale hover:text-orange-600 hover:underline transition-all duration-200 cursor-pointer"
            >
              没有账号？立即注册
            </button>

            <button
              onClick={onSwitchToJoin}
              className="w-full py-3 text-gray-500 text-sm active-scale hover:text-gray-700 hover:underline transition-all duration-200 cursor-pointer"
            >
              收到邀请链接？点击加入家庭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
