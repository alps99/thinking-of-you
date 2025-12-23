import { useState, useRef } from 'react';
import { checkinApi, uploadApi } from '../../lib/api';
import { MOOD_OPTIONS } from '../../types';

interface CheckInCardProps {
  onSuccess: () => void;
}

export function CheckInCard({ onSuccess }: CheckInCardProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('照片大小不能超过10MB');
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');

      // 最长录制30秒
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 30000);
    } catch {
      setError('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
  };

  const handleSubmit = async (mood: number) => {
    if (isSubmitting) return;
    setSelectedMood(mood);
    setIsSubmitting(true);
    setError('');

    try {
      let photoKey: string | undefined;
      let audioKey: string | undefined;

      // 上传照片
      if (photo) {
        const signResult = await uploadApi.getSignedUrl({
          filename: photo.name,
          contentType: photo.type,
          type: 'photo',
        });
        await uploadApi.uploadFile(signResult.key, photo);
        photoKey = signResult.key;
      }

      // 上传语音
      if (audioBlob) {
        const audioFile = new File([audioBlob], 'voice.webm', {
          type: 'audio/webm',
        });
        const signResult = await uploadApi.getSignedUrl({
          filename: 'voice.webm',
          contentType: 'audio/webm',
          type: 'audio',
        });
        await uploadApi.uploadFile(signResult.key, audioFile);
        audioKey = signResult.key;
      }

      await checkinApi.create({
        mood,
        message: message || undefined,
        photo_key: photoKey,
        audio_key: audioKey,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedMood(null);
        setMessage('');
        removePhoto();
        removeAudio();
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Failed to send check-in:', err);
      setError(err instanceof Error ? err.message : '发送失败，请重试');
      setSelectedMood(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-7xl mb-4">
          {MOOD_OPTIONS.find((m) => m.value === selectedMood)?.emoji}
        </div>
        <p className="text-gray-800 font-bold text-xl mb-2">惦记已送达!</p>
        <p className="text-gray-500">爸妈会收到你的惦记</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5">
      <h2 className="text-gray-800 font-bold text-lg text-center mb-4">
        今天怎么样？
      </h2>

      {/* 心情选择 - 滚动网格显示31个emoji */}
      <div className="max-h-64 overflow-y-auto mb-4 pr-1">
        <div className="grid grid-cols-5 gap-2">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => handleSubmit(mood.value)}
              disabled={isSubmitting}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all active-scale ${
                selectedMood === mood.value
                  ? 'border-orange-400 bg-orange-50 scale-105'
                  : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/50'
              } ${isSubmitting ? 'opacity-50' : ''}`}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-gray-700 text-[10px] font-medium truncate w-full text-center">
                {mood.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 附加内容区 */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-gray-400 text-sm text-center mb-3">想多说一句？</p>

        {/* 文字输入 */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="写点什么..."
          className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-orange-300 mb-3"
          rows={2}
          maxLength={200}
        />

        {/* 照片预览 */}
        {photoPreview && (
          <div className="relative mb-3">
            <img
              src={photoPreview}
              alt="预览"
              className="w-full h-32 object-cover rounded-xl"
            />
            <button
              onClick={removePhoto}
              className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full text-white text-sm flex items-center justify-center"
            >
              x
            </button>
          </div>
        )}

        {/* 语音预览 */}
        {audioBlob && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-xl">
            <audio
              src={URL.createObjectURL(audioBlob)}
              controls
              className="flex-1 h-8"
            />
            <button
              onClick={removeAudio}
              className="w-6 h-6 bg-gray-300 rounded-full text-white text-sm flex items-center justify-center"
            >
              x
            </button>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-gray-600 text-sm font-medium active-scale hover:bg-gray-100 transition-colors"
          >
            <span className="text-lg">📷</span> 照片
          </button>

          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 rounded-xl text-white text-sm font-medium active-scale animate-pulse"
            >
              <span className="text-lg">🔴</span> 停止
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={isSubmitting || !!audioBlob}
              className={`flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-gray-600 text-sm font-medium active-scale hover:bg-gray-100 transition-colors ${
                audioBlob ? 'opacity-50' : ''
              }`}
            >
              <span className="text-lg">🎤</span> 语音
            </button>
          )}
        </div>

        {/* 发送按钮 - 当有文字、照片或语音时显示 */}
        {(message.trim() || photo || audioBlob) && (
          <div className="mt-4">
            <button
              onClick={() => {
                // 使用默认心情(1=超开心)发送，不需要选择emoji
                handleSubmit(selectedMood || 1);
              }}
              disabled={isSubmitting}
              className={`w-full py-3 rounded-xl text-white font-medium transition-all active-scale bg-orange-500 hover:bg-orange-600 ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? '发送中...' : '发送惦记'}
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="text-red-500 text-sm text-center mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
