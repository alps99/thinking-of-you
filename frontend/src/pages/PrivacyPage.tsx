export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-5 pt-12 pb-5">
        <h1 className="text-white text-2xl font-bold">隐私政策</h1>
        <p className="text-white/80 text-sm mt-1">Privacy Policy</p>
      </div>

      <div className="px-5 py-6 space-y-6">
        <section>
          <p className="text-gray-600 text-sm">
            最后更新日期：2024年12月
          </p>
          <p className="text-gray-600 text-sm">
            Last Updated: December 2024
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">1. 信息收集 | Information We Collect</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            我们收集以下类型的信息：
          </p>
          <ul className="text-gray-600 text-sm leading-relaxed list-disc list-inside mt-2 space-y-1">
            <li>账户信息：邮箱、手机号、姓名</li>
            <li>使用数据：签到记录、分享的照片和文字</li>
            <li>设备信息：用于优化用户体验</li>
          </ul>
          <p className="text-gray-500 text-xs mt-2">
            We collect: account information (email, phone, name), usage data (check-ins, photos, text), and device information for optimization.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">2. 信息使用 | How We Use Information</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            我们使用收集的信息来：
          </p>
          <ul className="text-gray-600 text-sm leading-relaxed list-disc list-inside mt-2 space-y-1">
            <li>提供和维护服务</li>
            <li>在家庭成员之间传递消息和媒体</li>
            <li>改进用户体验</li>
          </ul>
          <p className="text-gray-500 text-xs mt-2">
            We use information to provide services, deliver messages between family members, and improve user experience.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">3. 信息共享 | Information Sharing</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            您的内容仅在您的家庭成员之间共享。我们不会向第三方出售或分享您的个人信息，除非法律要求。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Your content is only shared within your family. We do not sell or share personal information with third parties except as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">4. 数据存储 | Data Storage</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            您的数据存储在 Cloudflare 的安全服务器上。我们采用行业标准的加密和安全措施保护您的信息。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Your data is stored on Cloudflare's secure servers with industry-standard encryption and security measures.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">5. 数据删除 | Data Deletion</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            您可以随时删除您发布的内容。如需删除账户及所有相关数据，请联系我们。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            You can delete your content anytime. To delete your account and all associated data, please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">6. Cookie 政策 | Cookies</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            我们使用必要的 Cookie 来维持登录状态和提供基本功能。我们不使用追踪或广告 Cookie。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            We use essential cookies for authentication and basic functionality. We do not use tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">7. 联系我们 | Contact Us</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            如有任何隐私相关问题，请通过 GitHub 联系我们：
          </p>
          <a
            href="https://github.com/alps99/thinking-of-you"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 text-sm hover:underline"
          >
            github.com/alps99/thinking-of-you
          </a>
        </section>
      </div>
    </div>
  );
}
