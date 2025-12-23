import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { familyApi } from '../../lib/api';

interface JoinPageProps {
  onSwitchToLogin: () => void;
}

export function JoinPage({ onSwitchToLogin }: JoinPageProps) {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [formData, setFormData] = useState({
    inviteCode: codeFromUrl,
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // 验证邀请码
  useEffect(() => {
    if (formData.inviteCode.length === 8) {
      setIsValidating(true);
      familyApi
        .validateInvite(formData.inviteCode)
        .then((result) => {
          setFamilyName(result.family_name);
          setError('');
        })
        .catch((err) => {
          setFamilyName(null);
          setError(err.message);
        })
        .finally(() => setIsValidating(false));
    } else {
      setFamilyName(null);
    }
  }, [formData.inviteCode]);

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
      await familyApi.join({
        invite_code: formData.inviteCode,
        phone: formData.phone,
        password: formData.password,
        name: formData.name,
      });
      // 成功后会自动更新 auth 状态
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">惦记</h1>
          <p className="text-white/80 text-lg">加入家庭，接收惦记</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            加入家庭
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">邀请码</label>
              <input
                type="text"
                name="inviteCode"
                value={formData.inviteCode}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 uppercase"
                placeholder="8位邀请码"
                maxLength={8}
                required
              />
              {isValidating && (
                <p className="text-gray-400 text-sm mt-1">验证中...</p>
              )}
              {familyName && (
                <p className="text-green-600 text-sm mt-1">
                  将加入: {familyName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">您的称呼</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                placeholder="如：妈妈、爸爸"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">手机号</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                placeholder="用于登录"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">设置密码</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
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
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                placeholder="再次输入密码"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !familyName}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold rounded-xl disabled:opacity-50 text-lg"
            >
              {isLoading ? '加入中...' : '加入家庭'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={onSwitchToLogin} className="text-green-600 text-sm">
              已有账号？返回登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
