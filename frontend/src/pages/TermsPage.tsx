export function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-12 pb-5">
        <h1 className="text-white text-2xl font-bold">服务条款</h1>
        <p className="text-white/80 text-sm mt-1">Terms of Service</p>
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
          <h2 className="text-gray-800 font-bold text-lg mb-2">1. 服务说明 | Service Description</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            惦记是一款为跨国家庭设计的轻量级陪伴工具，帮助海外子女与国内父母保持联系。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Thinking of You is a lightweight companion tool designed for transnational families to help overseas children stay connected with parents back home.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">2. 用户责任 | User Responsibilities</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            使用本服务，您同意：
          </p>
          <ul className="text-gray-600 text-sm leading-relaxed list-disc list-inside mt-2 space-y-1">
            <li>提供真实准确的注册信息</li>
            <li>保护您的账户安全</li>
            <li>不发布违法、有害或侵权内容</li>
            <li>尊重其他用户的隐私</li>
          </ul>
          <p className="text-gray-500 text-xs mt-2">
            By using this service, you agree to: provide accurate information, protect your account, not post illegal or harmful content, and respect others' privacy.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">3. 内容所有权 | Content Ownership</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            您保留您上传内容的所有权。通过上传内容，您授予我们在提供服务所需范围内使用该内容的许可。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            You retain ownership of your uploaded content. By uploading, you grant us a license to use the content as needed to provide our services.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">4. 服务可用性 | Service Availability</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            我们努力保持服务稳定运行，但不保证服务不会中断。我们可能会进行维护或更新，这可能导致临时中断。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            We strive to maintain stable service but do not guarantee uninterrupted availability. Maintenance or updates may cause temporary interruptions.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">5. 免责声明 | Disclaimer</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            本服务按"现状"提供，不提供任何明示或暗示的保证。我们不对因使用服务而导致的任何损失承担责任。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            The service is provided "as is" without warranties of any kind. We are not liable for any damages resulting from use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">6. 账户终止 | Account Termination</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            如果您违反这些条款，我们保留暂停或终止您账户的权利。您也可以随时选择删除您的账户。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            We reserve the right to suspend or terminate accounts that violate these terms. You may also delete your account at any time.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">7. 条款变更 | Changes to Terms</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            我们可能会不时更新这些条款。重大变更将通过应用内通知或其他方式告知您。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            We may update these terms from time to time. Significant changes will be communicated through in-app notifications or other means.
          </p>
        </section>

        <section>
          <h2 className="text-gray-800 font-bold text-lg mb-2">8. 联系我们 | Contact Us</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            如有任何问题，请通过 GitHub 联系我们：
          </p>
          <a
            href="https://github.com/alps99/thinking-of-you"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 text-sm hover:underline"
          >
            github.com/alps99/thinking-of-you
          </a>
        </section>
      </div>
    </div>
  );
}
