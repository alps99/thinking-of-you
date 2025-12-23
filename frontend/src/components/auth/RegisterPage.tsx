import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    familyName: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    if (formData.password.length < 8) {
      setError('密码至少8位');
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password)) {
      setError('密码必须包含字母');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError('密码必须包含数字');
      return;
    }

    setIsLoading(true);

    try {
      await register(
        formData.email,
        formData.password,
        formData.name,
        formData.familyName
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">惦记</h1>
          <p className="text-white/80">创建你的家庭空间</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">注册</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">你的昵称</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                placeholder="爸妈怎么称呼你"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">家庭名称</label>
              <input
                type="text"
                name="familyName"
                value={formData.familyName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                placeholder="如：快乐一家人"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">邮箱</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                placeholder="用于登录和找回密码"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">密码</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                placeholder="至少8位，包含字母和数字"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">确认密码</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                placeholder="再次输入密码"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold rounded-xl disabled:opacity-50"
            >
              {isLoading ? '注册中...' : '注册并创建家庭'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={onSwitchToLogin} className="text-orange-500 text-sm">
              已有账号？返回登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
