import { useState } from 'react';
import type { CheckInResponse } from '../../types';
import { uploadApi } from '../../lib/api';

interface ResponseCardProps {
  responses: CheckInResponse[];
}

export function ResponseCard({ responses }: ResponseCardProps) {
  const [expandedAudio, setExpandedAudio] = useState<string | null>(null);

  if (responses.length === 0) return null;

  const heartResponses = responses.filter((r) => r.type === 'heart');
  const audioResponses = responses.filter((r) => r.type === 'audio');

  return (
    <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">💕</span>
        <span className="text-gray-800 font-bold text-sm">爸妈的回应</span>
      </div>

      {/* 爱心回应 */}
      {heartResponses.length > 0 && (
        <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
          <span className="text-pink-500">❤️</span>
          <span className="text-gray-600 text-sm">
            {heartResponses.map(r => r.user_name).join('、')} 收到了
          </span>
        </div>
      )}

      {/* 语音回应 */}
      {audioResponses.map((response) => (
        <div key={response.id} className="bg-white/60 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-green-500">🎤</span>
              <span className="text-gray-700 text-sm font-medium">{response.user_name} 说了一句</span>
            </div>
            <span className="text-gray-400 text-xs">
              {new Date(response.created_at).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {response.audio_key && (
            <div>
              {expandedAudio === response.id ? (
                <audio
                  controls
                  autoPlay
                  src={uploadApi.getFileUrl(response.audio_key)}
                  className="w-full"
                  onEnded={() => setExpandedAudio(null)}
                />
              ) : (
                <button
                  onClick={() => setExpandedAudio(response.id)}
                  className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  <span>▶️</span> 点击播放
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
