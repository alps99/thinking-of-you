import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { momentsApi, uploadApi, type Moment } from '../lib/api';

export function MomentsPage() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMoments = async () => {
    try {
      const { moments } = await momentsApi.getList();
      setMoments(moments);

      // 父母端：标记所有新鲜事为已读
      if (isParent && moments.length > 0) {
        // 异步标记已读，不阻塞 UI
        Promise.all(
          moments.map((m) => momentsApi.viewMoment(m.id).catch(() => {}))
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to fetch moments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, [isParent]);

  const handleReact = async (momentId: string, hasHearted: boolean) => {
    try {
      await momentsApi.react(momentId, { type: 'heart' });
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId
            ? {
                ...m,
                has_hearted: !hasHearted,
                heart_count: hasHearted ? m.heart_count - 1 : m.heart_count + 1,
              }
            : m
        )
      );
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  const handleDelete = async (moment: Moment) => {
    if (!confirm('确定要删除这条新鲜事吗？')) return;

    setDeletingId(moment.id);
    try {
      // 删除关联的媒体文件（照片/视频）
      for (const media of moment.media) {
        try {
          await uploadApi.deleteFile(media.r2_key);
          if (media.thumbnail_key && media.thumbnail_key !== media.r2_key) {
            await uploadApi.deleteFile(media.thumbnail_key);
          }
        } catch (err) {
          console.warn('删除媒体文件失败:', err);
        }
      }

      // 删除新鲜事本身的录音
      if (moment.audio_key) {
        try {
          await uploadApi.deleteFile(moment.audio_key);
        } catch (err) {
          console.warn('删除录音失败:', err);
        }
      }

      // 删除父母的语音留言
      const audioReplies = moment.reactions?.filter((r) => r.type === 'audio' && r.audio_key) || [];
      for (const reply of audioReplies) {
        try {
          await uploadApi.deleteFile(reply.audio_key!);
        } catch (err) {
          console.warn('删除语音留言失败:', err);
        }
      }

      // 删除新鲜事
      await momentsApi.delete(moment.id);
      setMoments((prev) => prev.filter((m) => m.id !== moment.id));
    } catch (error) {
      console.error('Failed to delete moment:', error);
      alert('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const handleAddComment = async (momentId: string, content: string) => {
    try {
      const newComment = await momentsApi.addComment(momentId, content);
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId
            ? {
                ...m,
                comments: [...(m.comments || []), newComment],
                comment_count: (m.comment_count || 0) + 1,
              }
            : m
        )
      );
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  };

  const handleDeleteComment = async (momentId: string, commentId: string) => {
    try {
      await momentsApi.deleteComment(momentId, commentId);
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId
            ? {
                ...m,
                comments: (m.comments || []).filter((c) => c.id !== commentId),
                comment_count: Math.max(0, (m.comment_count || 0) - 1),
              }
            : m
        )
      );
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleAudioReply = async (momentId: string, audioKey: string) => {
    try {
      const result = await momentsApi.react(momentId, { type: 'audio', audio_key: audioKey });
      // 更新 moments 列表，添加新的语音回复
      setMoments((prev) =>
        prev.map((m) =>
          m.id === momentId
            ? {
                ...m,
                reactions: [
                  ...(m.reactions || []),
                  {
                    id: result.id,
                    moment_id: momentId,
                    user_id: result.user_id,
                    user_name: user?.name || '家人',
                    type: 'audio' as const,
                    audio_key: audioKey,
                    created_at: result.created_at,
                  },
                ],
              }
            : m
        )
      );
    } catch (error) {
      console.error('Failed to send audio reply:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-12 pb-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-white font-bold ${isParent ? 'text-3xl' : 'text-2xl'}`}>
              新鲜事儿
            </h1>
            <p className={`text-white/80 mt-1 ${isParent ? 'text-lg' : 'text-sm'}`}>
              {isParent ? '孩子的生活动态' : '分享生活点滴给爸妈'}
            </p>
          </div>
          {!isParent && (
            <button
              onClick={() => setShowEditor(true)}
              className="bg-white text-purple-600 px-4 py-2 rounded-full font-bold text-sm hover:bg-purple-50 transition-colors"
            >
              + 发布
            </button>
          )}
        </div>
      </div>

      {/* Content - 父母端单列，子女端2列 */}
      <div className="px-3 py-4 -mt-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : moments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-gray-400">
              {isParent ? '等待孩子分享新鲜事...' : '分享一些新鲜事给爸妈吧！'}
            </p>
          </div>
        ) : (
          <div className={isParent ? 'space-y-4' : 'grid grid-cols-2 gap-3'}>
            {moments.map((moment) => (
              <MomentCard
                key={moment.id}
                moment={moment}
                isParent={isParent}
                isOwner={moment.author_id === user?.id}
                currentUserId={user?.id}
                isDeleting={deletingId === moment.id}
                onReact={handleReact}
                onDelete={handleDelete}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onAudioReply={handleAudioReply}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>

      {/* 发布编辑器 */}
      {showEditor && (
        <MomentEditor
          onClose={() => setShowEditor(false)}
          onSuccess={() => {
            setShowEditor(false);
            fetchMoments();
          }}
        />
      )}
    </div>
  );
}

// 新鲜事卡片组件 - 紧凑卡片样式
function MomentCard({
  moment,
  isParent,
  isOwner,
  currentUserId,
  isDeleting,
  onReact,
  onDelete,
  onAddComment,
  onDeleteComment,
  onAudioReply,
  formatTime,
}: {
  moment: Moment;
  isParent: boolean;
  isOwner: boolean;
  currentUserId?: string;
  isDeleting: boolean;
  onReact: (id: string, hasHearted: boolean) => void;
  onDelete: (moment: Moment) => void;
  onAddComment: (momentId: string, content: string) => Promise<void>;
  onDeleteComment: (momentId: string, commentId: string) => void;
  onAudioReply: (momentId: string, audioKey: string) => Promise<void>;
  formatTime: (date: string) => string;
}) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const hasMedia = moment.media.length > 0;
  const firstMedia = moment.media[0];
  const comments = moment.comments || [];
  const audioReplies = moment.reactions?.filter((r) => r.type === 'audio') || [];

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddComment(moment.id, commentText.trim());
      setCommentText('');
      setShowCommentInput(false);
    } catch {
      alert('评论失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('录音失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // 取消录音
  const cancelRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  // 发送语音回复
  const sendAudioReply = async () => {
    if (!audioBlob || isUploadingAudio) return;
    setIsUploadingAudio(true);
    try {
      const ext = audioBlob.type.includes('webm') ? 'webm' : 'm4a';
      const signResult = await uploadApi.getSignedUrl({
        filename: `audio.${ext}`,
        contentType: audioBlob.type,
        type: 'audio',
      });

      const audioFile = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type });
      await uploadApi.uploadFile(signResult.key, audioFile);
      await onAudioReply(moment.id, signResult.key);
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (error) {
      console.error('发送语音失败:', error);
      alert('发送语音失败');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden relative ${isDeleting ? 'opacity-50' : ''}`}>
      {/* 删除按钮 - 统一样式 */}
      {isOwner && !isParent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(moment);
          }}
          disabled={isDeleting}
          className="absolute top-2 right-2 z-10 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs transition-colors"
        >
          ✕
        </button>
      )}

      {/* 图片区域 - 父母端横向比例，子女端正方形 */}
      {hasMedia && (
        <button
          onClick={() => setPreviewIndex(0)}
          className={`relative w-full ${isParent ? 'aspect-video' : 'aspect-square'}`}
        >
          <img
            src={uploadApi.getFileUrl(firstMedia.thumbnail_key || firstMedia.r2_key)}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="14">📷</text></svg>';
            }}
          />
          {/* 多图标识 */}
          {moment.media.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              +{moment.media.length - 1}
            </div>
          )}
        </button>
      )}

      {/* 内容区域 */}
      <div className="p-3">

        {/* 文字内容 */}
        {moment.content && (
          <p className={`text-gray-700 line-clamp-2 ${isParent ? 'text-sm' : 'text-xs'} ${hasMedia ? '' : 'min-h-[2.5rem]'}`}>
            {moment.content}
          </p>
        )}

        {/* 录音 */}
        {moment.audio_key && (
          <div className={`mt-2 flex items-center gap-2 bg-orange-50 rounded-lg ${isParent ? 'px-4 py-3' : 'px-3 py-2'}`}>
            <span className={isParent ? 'text-2xl' : 'text-lg'}>🎤</span>
            <audio
              src={uploadApi.getFileUrl(moment.audio_key)}
              controls
              className={`flex-1 ${isParent ? 'h-10' : 'h-8'}`}
            />
            {moment.audio_duration != null && moment.audio_duration > 0 && (
              <span className={`text-orange-600 ${isParent ? 'text-sm' : 'text-xs'}`}>
                {Math.floor(moment.audio_duration / 60)}:{(moment.audio_duration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        {/* 位置 */}
        {moment.location && (
          <p className="text-gray-400 text-xs mt-1 truncate">📍 {moment.location}</p>
        )}

        {/* 评论区 */}
        {comments.length > 0 && (
          <div className="mt-2 space-y-1">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-1 text-xs bg-gray-50 rounded px-2 py-1">
                <span className="text-purple-600 font-medium flex-shrink-0">{comment.user_name}:</span>
                <span className="text-gray-600 flex-1 break-all">{comment.content}</span>
                {comment.user_id === currentUserId && (
                  <button
                    onClick={() => onDeleteComment(moment.id, comment.id)}
                    className="text-gray-300 hover:text-red-400 flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 评论输入框 - 父母专用 */}
        {showCommentInput && isParent && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写评论..."
              maxLength={200}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              autoFocus
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
              className="text-xs bg-purple-500 text-white px-2 py-1 rounded disabled:opacity-50"
            >
              发送
            </button>
          </div>
        )}

        {/* 语音留言显示 - 子女端和父母端都能看到 */}
        {audioReplies.length > 0 && (
          <div className="mt-2 space-y-2">
            {audioReplies.map((reply) => (
              <div key={reply.id} className={`flex items-center gap-2 bg-green-50 rounded-lg ${isParent ? 'px-4 py-3' : 'px-3 py-2'}`}>
                <span className={isParent ? 'text-xl' : 'text-base'}>💚</span>
                <span className={`text-green-700 font-medium ${isParent ? 'text-sm' : 'text-xs'}`}>{reply.user_name}:</span>
                <audio
                  src={uploadApi.getFileUrl(reply.audio_key!)}
                  controls
                  className={`flex-1 ${isParent ? 'h-9' : 'h-7'}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* 录音区域 - 父母专用 */}
        {isParent && (isRecording || audioBlob) && (
          <div className="mt-2 flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-600 font-medium text-sm flex-1">
                  录音中 {formatRecordingTime(recordingTime)}
                </span>
                <button
                  onClick={stopRecording}
                  className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium"
                >
                  停止
                </button>
              </>
            ) : audioBlob ? (
              <>
                <audio
                  src={URL.createObjectURL(audioBlob)}
                  controls
                  className="flex-1 h-8"
                />
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 hover:text-red-500 text-lg"
                >
                  ×
                </button>
                <button
                  onClick={sendAudioReply}
                  disabled={isUploadingAudio}
                  className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium disabled:opacity-50"
                >
                  {isUploadingAudio ? '发送中...' : '发送'}
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <span className="text-gray-400 text-xs">{formatTime(moment.created_at)}</span>

          {isParent ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCommentInput(!showCommentInput)}
                className={`text-xl px-2 py-1 rounded-lg ${showCommentInput ? 'text-purple-500 bg-purple-50' : 'text-gray-500'}`}
              >
                💬 {(moment.comment_count || 0) > 0 && <span className="text-base ml-1">{moment.comment_count}</span>}
              </button>
              <button
                onClick={startRecording}
                disabled={isRecording || !!audioBlob}
                className={`text-xl px-2 py-1 rounded-lg ${isRecording || audioBlob ? 'text-green-500 bg-green-50' : 'text-gray-500'}`}
              >
                🎤 {audioReplies.length > 0 && <span className="text-base ml-1">{audioReplies.length}</span>}
              </button>
              <button
                onClick={() => onReact(moment.id, moment.has_hearted)}
                className={`text-xl px-2 py-1 rounded-lg ${moment.has_hearted ? 'text-pink-500 bg-pink-50' : 'text-gray-500'}`}
              >
                {moment.has_hearted ? '❤️' : '🤍'} {moment.heart_count > 0 && <span className="text-base ml-1">{moment.heart_count}</span>}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {(moment.comment_count || 0) > 0 && <span>💬 {moment.comment_count}</span>}
              {moment.heart_count > 0 && <span>❤️ {moment.heart_count}</span>}
            </div>
          )}
        </div>
      </div>

      {/* 照片预览弹窗 */}
      {previewIndex !== null && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setPreviewIndex(null)}
        >
          {/* 关闭按钮 */}
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full text-white text-xl flex items-center justify-center z-10 hover:bg-white/40 transition-colors"
          >
            ✕
          </button>

          {/* 图片计数 */}
          {moment.media.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {previewIndex + 1} / {moment.media.length}
            </div>
          )}

          {/* 主图片 */}
          <img
            src={uploadApi.getFileUrl(moment.media[previewIndex].r2_key)}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 左右切换按钮 */}
          {moment.media.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((prev) =>
                    prev !== null ? (prev - 1 + moment.media.length) % moment.media.length : 0
                  );
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-full text-white text-2xl flex items-center justify-center hover:bg-white/40 transition-colors"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((prev) =>
                    prev !== null ? (prev + 1) % moment.media.length : 0
                  );
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-full text-white text-2xl flex items-center justify-center hover:bg-white/40 transition-colors"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 发布新鲜事编辑器
function MomentEditor({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [location, setLocation] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  // 从相册选择照片
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    const remainingSlots = 9 - photos.length;
    const newFiles = files.slice(0, remainingSlots);

    for (const file of newFiles) {
      if (file.size > 30 * 1024 * 1024) {
        alert('图片太大（超过30MB），请选择较小的图片');
        continue;
      }

      setPhotos((prev) => [...prev, file]);
      // 使用占位符，不解码图片
      const placeholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#e5e7eb" width="100" height="100"/><text x="50" y="45" text-anchor="middle" fill="#9ca3af" font-size="24">📷</text><text x="50" y="65" text-anchor="middle" fill="#6b7280" font-size="8">${(file.size / 1024 / 1024).toFixed(1)}MB</text></svg>`)}`;
      setPhotoPreviews((prev) => [...prev, placeholder]);
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        setAudioBlob(audioBlob);
        setAudioDuration(recordingTime);

        // 停止所有轨道
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            // 最长60秒
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('录音失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // 删除录音
  const removeAudio = () => {
    setAudioBlob(null);
    setAudioDuration(0);
  };

  // 格式化录音时间
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 回退压缩方案（用于不支持 Worker 和 createImageBitmap resize 的浏览器）
  const compressWithImage = (file: File, maxSize: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        // 安全像素限制
        const maxPixels = 4 * 1024 * 1024;
        const currentPixels = width * height;

        if (currentPixels > maxPixels) {
          const scale = Math.sqrt(maxPixels / currentPixels);
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);
        }

        if (width > height) {
          if (width > maxSize) {
            height = Math.floor((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.floor((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            canvas.width = 0;
            canvas.height = 0;
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('无法压缩图片'));
            }
          },
          'image/jpeg',
          0.8
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('无法加载图片'));
      };

      img.src = objectUrl;
    });
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGetLocation = () => {
    if (location) {
      setLocation('');
      return;
    }

    if (!navigator.geolocation) {
      alert('您的浏览器不支持定位功能');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
            { headers: { 'Accept-Language': 'zh-CN' } }
          );
          const data = await response.json();
          if (data.display_name) {
            const address = data.address;
            const shortAddress = address.city || address.town || address.county || '';
            const detail = address.road || address.neighbourhood || address.suburb || '';
            setLocation(detail ? `${shortAddress} ${detail}` : shortAddress || data.display_name.split(',')[0]);
          } else {
            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('请允许访问您的位置');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('无法获取位置信息');
            break;
          case error.TIMEOUT:
            alert('获取位置超时');
            break;
          default:
            alert('获取位置失败');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 压缩图片用于上传（使用与 AlbumPage 相同的方法）
  const compressForUpload = async (file: File): Promise<Blob> => {
    const maxSize = 1200;
    const quality = 0.85;

    // 尝试 createImageBitmap with resize
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: maxSize,
        resizeHeight: maxSize,
        resizeQuality: 'high',
      });

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('无法创建 canvas');
      }

      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            canvas.width = 0;
            canvas.height = 0;
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('无法压缩图片'));
            }
          },
          'image/jpeg',
          quality
        );
      });
    } catch {
      // 回退方案
      return compressWithImage(file, maxSize);
    }
  };

  // 图片压缩（使用 createImageBitmap）
  const resizeImage = async (file: File, maxSize: number = 300, quality: number = 0.8): Promise<Blob> => {
    // 使用 createImageBitmap 加载图片
    const bitmap = await createImageBitmap(file);

    // 计算目标尺寸
    let { width, height } = bitmap;
    if (width > height) {
      if (width > maxSize) {
        height = Math.floor((height * maxSize) / width);
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = Math.floor((width * maxSize) / height);
        height = maxSize;
      }
    }

    // 创建 canvas 并绘制
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('无法创建 canvas');
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close(); // 释放 bitmap 内存

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          canvas.width = 0;
          canvas.height = 0;

          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法压缩图片'));
          }
        },
        'image/jpeg',
        quality
      );
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() && photos.length === 0 && !audioBlob) {
      return;
    }

    setIsSubmitting(true);
    try {
      const mediaData: { media_type: 'photo'; r2_key: string; thumbnail_key: string }[] = [];

      // 处理图片
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        // 在发布时压缩图片（逐张处理，避免内存峰值）
        let compressedFile: File;
        try {
          const compressed = await compressForUpload(photo);
          compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
        } catch (err) {
          console.error('压缩失败:', err);
          alert(`第 ${i + 1} 张图片处理失败，请重试`);
          continue;
        }

        const signResult = await uploadApi.getSignedUrl({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          type: 'photo',
        });

        // 上传压缩后的图片
        await uploadApi.uploadFile(signResult.key, compressedFile);

        let thumbnailKey = signResult.key;
        if (signResult.thumbnailKey) {
          try {
            // 从已压缩的图片生成缩略图（更小的内存占用）
            const thumbnail = await resizeImage(compressedFile, 300, 0.7);
            const thumbnailFile = new File([thumbnail], 'thumb.jpg', { type: 'image/jpeg' });
            await uploadApi.uploadFile(signResult.thumbnailKey, thumbnailFile);
            thumbnailKey = signResult.thumbnailKey;
          } catch (err) {
            console.warn('缩略图生成失败，使用原图:', err);
          }
        }

        mediaData.push({
          media_type: 'photo' as const,
          r2_key: signResult.key,
          thumbnail_key: thumbnailKey,
        });

        // 处理完一张后给浏览器喘息时间
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 处理录音 - 作为新鲜事的语音附件
      let audioKey: string | undefined;
      if (audioBlob) {
        const ext = audioBlob.type.includes('webm') ? 'webm' : 'm4a';
        const signResult = await uploadApi.getSignedUrl({
          filename: `audio.${ext}`,
          contentType: audioBlob.type,
          type: 'audio',
        });

        const audioFile = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type });
        await uploadApi.uploadFile(signResult.key, audioFile);
        audioKey = signResult.key;
      }

      if (mediaData.length === 0 && !content.trim() && !audioKey) {
        alert('没有成功处理的内容');
        return;
      }

      await momentsApi.create({
        content: content.trim() || undefined,
        location: location || undefined,
        media: mediaData,
        audio_key: audioKey,
        audio_duration: audioKey ? audioDuration : undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to create moment:', error);
      alert('发布失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const canSubmit = content.trim() || photos.length > 0 || audioBlob;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onClose} className="text-gray-400 text-sm hover:text-gray-600 transition-colors">
            取消
          </button>
          <h3 className="text-gray-800 font-bold">发布新鲜事</h3>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="bg-purple-500 text-white px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-purple-600 transition-colors"
          >
            {isSubmitting ? '发布中...' : '发布'}
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-purple-300"
          placeholder="分享点什么给爸妈..."
          maxLength={200}
          autoFocus
        />

        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {photoPreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square">
                <img
                  src={preview}
                  alt={`照片 ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 录音预览 */}
        {(audioBlob || isRecording) && (
          <div className="mt-3 flex items-center gap-3 bg-orange-50 px-4 py-3 rounded-xl">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-600 font-medium flex-1">
                  录音中 {formatRecordingTime(recordingTime)}
                </span>
                <button
                  onClick={stopRecording}
                  className="px-4 py-1.5 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  停止
                </button>
              </>
            ) : audioBlob ? (
              <>
                <span className="text-2xl">🎤</span>
                <div className="flex-1">
                  <audio
                    src={URL.createObjectURL(audioBlob)}
                    controls
                    className="w-full h-8"
                  />
                </div>
                <button
                  onClick={removeAudio}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  ×
                </button>
              </>
            ) : null}
          </div>
        )}

        {location && (
          <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
            <span>📍</span>
            <span className="flex-1 truncate">{location}</span>
            <button onClick={() => setLocation('')} className="text-purple-400 hover:text-purple-600">×</button>
          </div>
        )}

        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            {/* 相册选择 input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= 9}
              className={`flex items-center gap-1 px-3 py-2 bg-gray-50 rounded-lg text-sm transition-colors ${
                photos.length >= 9 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🖼️ 照片 {photos.length > 0 && `(${photos.length}/9)`}
            </button>
            <button
              onClick={isRecording ? stopRecording : (audioBlob ? removeAudio : startRecording)}
              disabled={isRecording}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                audioBlob ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              🎤 {audioBlob ? `${formatRecordingTime(audioDuration)}` : '录音'}
            </button>
            <button
              onClick={handleGetLocation}
              disabled={isGettingLocation}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                location ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              📍 {isGettingLocation ? '定位中...' : location || '位置'}
            </button>
          </div>
          <span className="text-gray-400 text-xs">{content.length}/200</span>
        </div>
      </div>
    </div>
  );
}

