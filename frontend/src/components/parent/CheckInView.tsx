import { useState, useRef } from 'react';
import { checkinApi, uploadApi } from '../../lib/api';
import { getMoodEmoji, getMoodLabel } from '../../types';
import type { CheckIn } from '../../types';

interface CheckInViewProps {
  checkIn: CheckIn;
  onResponded: () => void;
}

export function CheckInView({ checkIn, onResponded }: CheckInViewProps) {
  const [isResponding, setIsResponding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isPlayingChildAudio, setIsPlayingChildAudio] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasResponded = checkIn.my_response?.type === 'heart';

  const handleHeartResponse = async () => {
    if (hasResponded || isResponding) return;
    setIsResponding(true);

    try {
      await checkinApi.respond(checkIn.id, { type: 'heart' });
      onResponded();
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setIsResponding(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setShowAudioPreview(true);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 计时器
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelAudio = () => {
    setAudioBlob(null);
    setShowAudioPreview(false);
    setRecordingTime(0);
  };

  const sendAudio = async () => {
    if (!audioBlob) return;
    setIsSendingAudio(true);

    try {
      // 上传音频文件
      const signResult = await uploadApi.getSignedUrl({
        filename: 'voice.webm',
        contentType: 'audio/webm',
        type: 'audio',
      });

      const audioFile = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
      await uploadApi.uploadFile(signResult.key, audioFile);

      // 发送语音回应
      await checkinApi.respond(checkIn.id, {
        type: 'audio',
        audio_key: signResult.key
      });

      setAudioBlob(null);
      setShowAudioPreview(false);
      setRecordingTime(0);
      onResponded();
    } catch (error) {
      console.error('Failed to send audio:', error);
      alert('发送失败，请重试');
    } finally {
      setIsSendingAudio(false);
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 text-center">
      <p className="text-gray-500 text-xl mb-2">{checkIn.user_name}今天说：</p>

      <div className="text-7xl my-4">{getMoodEmoji(checkIn.mood)}</div>

      <p className="text-gray-800 text-2xl font-bold mb-1">
        {getMoodLabel(checkIn.mood)}
      </p>
      <p className="text-gray-400 text-lg">{formatTime(checkIn.created_at)} 发来</p>

      {/* 子女发送的文字留言 */}
      {checkIn.message && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4">
          <p className="text-gray-700 text-lg">{checkIn.message}</p>
        </div>
      )}

      {/* 子女发送的照片 - 缩略图 */}
      {checkIn.photo_key && (
        <div className="mt-4">
          <button
            onClick={() => setShowFullImage(true)}
            className="w-full rounded-xl overflow-hidden active:opacity-80 transition-opacity"
          >
            <img
              src={uploadApi.getFileUrl(checkIn.photo_key)}
              alt="照片"
              className="w-full h-48 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="14">📷</text></svg>';
              }}
            />
          </button>
          <p className="text-gray-400 text-sm mt-2">点击查看大图</p>
        </div>
      )}

      {/* 照片全屏查看 */}
      {showFullImage && checkIn.photo_key && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-6 right-6 text-white text-3xl font-bold bg-black/50 w-12 h-12 rounded-full flex items-center justify-center"
          >
            ✕
          </button>
          <img
            src={uploadApi.getFileUrl(checkIn.photo_key)}
            alt="照片"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 子女发送的语音 */}
      {checkIn.audio_key && (
        <div className="mt-4 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-blue-500 text-xl">🎤</span>
            <span className="text-gray-700 font-medium">语音消息</span>
          </div>
          {isPlayingChildAudio ? (
            <audio
              controls
              autoPlay
              src={uploadApi.getFileUrl(checkIn.audio_key)}
              className="w-full"
              onEnded={() => setIsPlayingChildAudio(false)}
            />
          ) : (
            <button
              onClick={() => setIsPlayingChildAudio(true)}
              className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
            >
              <span>▶️</span> 点击播放
            </button>
          )}
        </div>
      )}

      {/* 录音中显示 */}
      {isRecording && (
        <div className="mt-6 bg-red-50 rounded-2xl p-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-600 font-bold text-lg">录音中 {formatRecordingTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="mt-4 w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600"
          >
            停止录音
          </button>
        </div>
      )}

      {/* 音频预览 */}
      {showAudioPreview && audioBlob && (
        <div className="mt-6 bg-green-50 rounded-2xl p-4">
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="w-full mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={cancelAudio}
              disabled={isSendingAudio}
              className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={sendAudio}
              disabled={isSendingAudio}
              className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-50"
            >
              {isSendingAudio ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      )}

      {/* 正常按钮 */}
      {!isRecording && !showAudioPreview && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleHeartResponse}
            disabled={hasResponded || isResponding}
            className={`flex-1 py-4 text-xl font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${
              hasResponded
                ? 'bg-pink-200 text-pink-600'
                : 'bg-pink-500 text-white hover:bg-pink-600'
            }`}
          >
            ❤️ {hasResponded ? '已收到' : '收到啦'}
          </button>
          <button
            onClick={startRecording}
            className="flex-1 py-4 bg-gray-100 text-gray-700 text-xl font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200"
          >
            🎤 说一句
          </button>
        </div>
      )}

      {checkIn.responses && checkIn.responses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-gray-400 text-sm">
            已有 {checkIn.responses.length} 人回应
          </p>
        </div>
      )}
    </div>
  );
}
