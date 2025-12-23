import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { albumApi, uploadApi, type Grandchild, type Photo, type PhotoRequest } from '../lib/api';

export function AlbumPage() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';

  if (isParent) {
    return <ParentAlbumView />;
  }

  return <ChildAlbumView />;
}

function ChildAlbumView() {
  const [grandchildren, setGrandchildren] = useState<Grandchild[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [requests, setRequests] = useState<PhotoRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState<Grandchild | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [grandchildrenResult, photosResult, requestsResult] = await Promise.all([
        albumApi.getGrandchildren(),
        albumApi.getPhotos(),
        albumApi.getRequests(),
      ]);
      setGrandchildren(grandchildrenResult.grandchildren);
      setPhotos(photosResult.photos);
      // 只显示 pending 状态的请求
      setRequests(requestsResult.requests.filter((r: PhotoRequest) => r.status === 'pending'));
    } catch (error) {
      console.error('Failed to fetch album data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddChild = async (name: string, avatarKey?: string) => {
    try {
      await albumApi.addGrandchild({ name, avatar_key: avatarKey });
      setShowAddChild(false);
      fetchData();
    } catch (error) {
      console.error('Failed to add grandchild:', error);
    }
  };

  const handleEditChild = async (id: string, name: string, avatarKey?: string) => {
    try {
      await albumApi.updateGrandchild(id, { name, avatar_key: avatarKey });
      setShowEditChild(null);
      fetchData();
    } catch (error) {
      console.error('Failed to update grandchild:', error);
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm('确定要删除这张照片吗？')) return;

    setDeletingPhotoId(photo.id);
    try {
      // 删除 R2 文件
      try {
        await uploadApi.deleteFile(photo.r2_key);
        if (photo.thumbnail_key && photo.thumbnail_key !== photo.r2_key) {
          await uploadApi.deleteFile(photo.thumbnail_key);
        }
      } catch (err) {
        console.warn('删除文件失败:', err);
      }

      // 删除数据库记录
      await albumApi.deletePhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('删除失败');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 如果没有宝贝，先提示添加
    if (grandchildren.length === 0) {
      alert('请先添加宝贝');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // 保存待上传文件，显示选择宝贝的弹窗
    setPendingFiles(Array.from(files));
    setShowUploadModal(true);

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 图片压缩 - 保持比例缩放
  const resizeImage = async (file: File, maxSize: number = 300, quality: number = 0.8): Promise<Blob> => {
    // 检查文件大小
    if (file.size > 30 * 1024 * 1024) {
      throw new Error('图片太大，请选择较小的图片');
    }

    // 直接使用回退方案，因为 createImageBitmap 的 resize 选项会改变比例
    return resizeWithImage(file, maxSize, quality);
  };

  // 回退压缩方案
  const resizeWithImage = (file: File, maxSize: number, quality: number): Promise<Blob> => {
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
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('无法加载图片'));
      };

      img.src = objectUrl;
    });
  };

  const handleUploadWithChild = async (selectedChildIds: string[]) => {
    setShowUploadModal(false);

    for (const file of pendingFiles) {
      try {
        // 先压缩原图到 1600px，减少内存占用和上传大小
        const compressedBlob = await resizeImage(file, 1600, 0.85);
        const compressedFile = new File([compressedBlob], 'photo.jpg', { type: 'image/jpeg' });

        // 获取上传签名
        const { key, thumbnailKey } = await uploadApi.getSignedUrl({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          type: 'photo',
        });

        // 上传压缩后的图片
        await uploadApi.uploadFile(key, compressedFile);

        // 生成并上传缩略图
        let finalThumbnailKey = key;
        if (thumbnailKey) {
          try {
            const thumbnail = await resizeImage(file, 300, 0.7);
            const thumbnailFile = new File([thumbnail], 'thumb.jpg', { type: 'image/jpeg' });
            await uploadApi.uploadFile(thumbnailKey, thumbnailFile);
            finalThumbnailKey = thumbnailKey;
          } catch (err) {
            console.warn('缩略图生成失败，使用原图:', err);
          }
        }

        // 创建照片记录
        if (selectedChildIds.length === 0) {
          // 不关联任何宝贝
          await albumApi.addPhoto({
            r2_key: key,
            thumbnail_key: finalThumbnailKey,
          });
        } else {
          // 为每个选中的宝贝创建照片记录
          for (const childId of selectedChildIds) {
            await albumApi.addPhoto({
              r2_key: key,
              thumbnail_key: finalThumbnailKey,
              grandchild_id: childId,
            });
          }
        }
      } catch (error) {
        console.error('Failed to upload photo:', error);
        alert('上传失败，请重试');
      }
    }

    setPendingFiles([]);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-pink-500 to-rose-500 px-5 pt-12 pb-5">
        <h1 className="text-white text-2xl font-bold">宝贝相册</h1>
        <p className="text-white/80 text-sm mt-1">管理分享给父母的照片</p>
      </div>

      {/* Content */}
      <div className="px-4 py-4 -mt-2 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : (
          <>
            {/* 想看请求提示 */}
            {requests.length > 0 && (
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-4 border-2 border-amber-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📸</span>
                  <span className="text-amber-800 font-bold">爸妈想看照片啦！</span>
                </div>
                {requests.map((req) => (
                  <div key={req.id} className="bg-white/60 rounded-xl p-3 mt-2 relative">
                    <button
                      onClick={async () => {
                        try {
                          await albumApi.fulfillRequest(req.id);
                          setRequests((prev) => prev.filter((r) => r.id !== req.id));
                        } catch (error) {
                          console.error('Failed to dismiss request:', error);
                        }
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-amber-200 hover:bg-amber-300 text-amber-600 rounded-full flex items-center justify-center text-sm transition-colors"
                      title="忽略此请求"
                    >
                      ✕
                    </button>
                    <p className="text-amber-700 text-sm pr-6">
                      <span className="font-medium">{req.requester_name}</span>：{req.message}
                    </p>
                    <p className="text-amber-500 text-xs mt-1">
                      {new Date(req.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-3 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
                >
                  立即上传照片
                </button>
              </div>
            )}

            {/* 宝贝列表 */}
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-800 font-bold text-sm">👶 宝贝列表</h3>
                <button
                  onClick={() => setShowAddChild(true)}
                  className="px-3 py-1 bg-pink-100 text-pink-600 rounded-lg text-xs font-medium hover:bg-pink-200 transition-colors"
                >
                  + 添加
                </button>
              </div>
              {grandchildren.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {grandchildren.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setShowEditChild(child)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-pink-50 transition-colors"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                        {child.avatar_key ? (
                          <img
                            src={uploadApi.getFileUrl(child.avatar_key)}
                            alt={child.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          '👶'
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-gray-800 font-medium text-sm truncate">{child.name}</p>
                        <p className="text-gray-400 text-xs">
                          {photos.filter(p => p.grandchild_id === child.id).length} 张照片
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowAddChild(true)}
                  className="w-full py-3 border-2 border-dashed border-pink-200 rounded-xl text-pink-500 font-medium hover:bg-pink-50 hover:border-pink-300 transition-colors"
                >
                  + 添加宝贝
                </button>
              )}
            </div>

            {/* 上传按钮 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-xl font-bold hover:from-pink-600 hover:to-rose-600 transition-all active:scale-[0.98]"
            >
              🖼️ 上传新照片
            </button>

            {/* 照片列表 */}
            <div className="bg-white rounded-2xl shadow p-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-gray-800 font-bold text-sm">
                  已同步 ({photos.length})
                </h3>
              </div>
              {photos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  还没有照片，快上传一些吧！
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className={`aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden relative ${deletingPhotoId === photo.id ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => setPreviewPhoto(photo)}
                        className="w-full h-full"
                      >
                        <img
                          src={uploadApi.getFileUrl(photo.thumbnail_key)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="20">📷</text></svg>';
                          }}
                        />
                      </button>
                      {/* 新标签 */}
                      {photo.is_new && (
                        <div className="absolute top-0.5 left-0.5 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full font-bold">
                          新
                        </div>
                      )}
                      {/* 删除按钮 - 右上角 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo);
                        }}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 添加宝贝弹窗 */}
      {showAddChild && (
        <AddEditChildModal
          onClose={() => setShowAddChild(false)}
          onSubmit={handleAddChild}
        />
      )}

      {/* 编辑宝贝弹窗 */}
      {showEditChild && (
        <AddEditChildModal
          child={showEditChild}
          onClose={() => setShowEditChild(null)}
          onSubmit={(name, avatarKey) => handleEditChild(showEditChild.id, name, avatarKey)}
        />
      )}

      {/* 选择宝贝上传弹窗 */}
      {showUploadModal && (
        <SelectChildModal
          grandchildren={grandchildren}
          pendingFilesCount={pendingFiles.length}
          onClose={() => {
            setShowUploadModal(false);
            setPendingFiles([]);
          }}
          onSubmit={handleUploadWithChild}
        />
      )}

      {/* 照片预览弹窗 */}
      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </div>
  );
}

function ParentAlbumView() {
  const [grandchildren, setGrandchildren] = useState<Grandchild[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [memories, setMemories] = useState<{ date: string; photos: Photo[]; has_memories: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [grandchildrenResult, photosResult, memoriesResult] = await Promise.all([
        albumApi.getGrandchildren(),
        albumApi.getPhotos(),
        albumApi.getMemories(),
      ]);
      setGrandchildren(grandchildrenResult.grandchildren);
      setPhotos(photosResult.photos);
      setMemories(memoriesResult);
    } catch (error) {
      console.error('Failed to fetch album data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRequestPhotos = async () => {
    setIsRequesting(true);
    try {
      await albumApi.requestPhotos('想看最近的照片');
      showToast('已发送请求，等待孩子上传新照片');
    } catch (error) {
      console.error('Failed to request photos:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const newPhotosCount = photos.filter((p) => p.is_new).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-pink-500 to-rose-500 px-5 pt-12 pb-5 flex justify-between items-start">
        <div>
          <h1 className="text-white text-3xl font-bold">宝贝相册</h1>
          <p className="text-white/80 text-lg mt-1">
            {newPhotosCount > 0 ? `新照片 ${newPhotosCount} 张 🆕` : '查看宝贝的照片'}
          </p>
        </div>
        <button
          onClick={handleRequestPhotos}
          disabled={isRequesting}
          className="bg-white/20 px-4 py-2 rounded-full text-white font-bold text-lg mt-2 disabled:opacity-50 hover:bg-white/30 transition-colors"
        >
          📷 {isRequesting ? '发送中...' : '想看'}
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4 -mt-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400 text-xl">加载中...</div>
        ) : (
          <>
            {/* 宝贝列表 */}
            {grandchildren.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-gray-800 font-bold text-sm">👶 宝贝列表</h3>
                  {selectedChildId && (
                    <button
                      onClick={() => setSelectedChildId(null)}
                      className="text-pink-500 text-xs font-medium hover:text-pink-600 transition-colors"
                    >
                      查看全部
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {grandchildren.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(selectedChildId === child.id ? null : child.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedChildId === child.id
                          ? 'bg-pink-100 border-2 border-pink-400'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-pink-50 hover:border-pink-200'
                      }`}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                        {child.avatar_key ? (
                          <img
                            src={uploadApi.getFileUrl(child.avatar_key)}
                            alt={child.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          '👶'
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-gray-800 font-medium text-sm truncate">{child.name}</p>
                        <p className="text-gray-400 text-xs">
                          {photos.filter(p => p.grandchild_id === child.id).length} 张照片
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 照片列表 - 按日期分组 */}
            {(() => {
              const filteredPhotos = photos.filter(p => !selectedChildId || p.grandchild_id === selectedChildId);

              // 按日期分组
              const groupedPhotos = filteredPhotos.reduce((groups, photo) => {
                const date = new Date(photo.created_at);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (!groups[dateKey]) {
                  groups[dateKey] = [];
                }
                groups[dateKey].push(photo);
                return groups;
              }, {} as Record<string, Photo[]>);

              // 按日期降序排列
              const sortedDates = Object.keys(groupedPhotos).sort((a, b) => b.localeCompare(a));

              const formatDateLabel = (dateKey: string) => {
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                if (dateKey === todayKey) return '今天';
                if (dateKey === yesterdayKey) return '昨天';

                const [year, month, day] = dateKey.split('-');
                if (year === String(today.getFullYear())) {
                  return `${parseInt(month)}月${parseInt(day)}日`;
                }
                return `${year}年${parseInt(month)}月${parseInt(day)}日`;
              };

              if (filteredPhotos.length === 0) {
                return (
                  <div className="bg-white rounded-2xl shadow p-3 mb-4">
                    <h3 className="text-gray-800 font-bold text-sm mb-2">
                      {selectedChildId
                        ? `${grandchildren.find(c => c.id === selectedChildId)?.name || ''}的照片`
                        : '最近照片'}
                    </h3>
                    <div className="text-center py-8">
                      <div className="text-5xl mb-4">📷</div>
                      <p className="text-gray-400 text-lg">
                        {selectedChildId ? '暂无该宝贝的照片' : '还没有照片'}
                      </p>
                      <p className="text-gray-400">点击"想看"提醒孩子上传照片</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4 mb-4">
                  {sortedDates.map((dateKey) => (
                    <div key={dateKey} className="bg-white rounded-2xl shadow p-3">
                      <h3 className="text-gray-800 font-bold text-sm mb-2">
                        {formatDateLabel(dateKey)} ({groupedPhotos[dateKey].length})
                      </h3>
                      <div className="grid grid-cols-4 gap-1">
                        {groupedPhotos[dateKey].map((photo) => (
                          <button
                            key={photo.id}
                            onClick={async () => {
                              setPreviewPhoto(photo);
                              // 点击后移除"新"标记并调用 API
                              if (photo.is_new) {
                                setPhotos((prev) =>
                                  prev.map((p) =>
                                    p.id === photo.id ? { ...p, is_new: false } : p
                                  )
                                );
                                // 调用后端 API 记录已查看
                                try {
                                  await albumApi.viewPhoto(photo.id);
                                } catch (error) {
                                  console.error('Failed to mark photo as viewed:', error);
                                }
                              }
                            }}
                            className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden relative"
                          >
                            <img
                              src={uploadApi.getFileUrl(photo.thumbnail_key)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {photo.is_new && (
                              <div className="absolute top-0.5 left-0.5 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full font-bold">
                                新
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 一年前的今天 */}
            {memories?.has_memories && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4">
                <p className="text-gray-800 text-xl font-bold">📅 一年前的今天</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {memories.photos.slice(0, 3).map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setPreviewPhoto(photo)}
                      className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl overflow-hidden"
                    >
                      <img
                        src={uploadApi.getFileUrl(photo.thumbnail_key)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 照片预览弹窗 */}
      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// 添加/编辑宝贝弹窗
function AddEditChildModal({
  child,
  onClose,
  onSubmit,
}: {
  child?: Grandchild;
  onClose: () => void;
  onSubmit: (name: string, avatarKey?: string) => void;
}) {
  const [name, setName] = useState(child?.name || '');
  const [avatarKey, setAvatarKey] = useState<string | undefined>(child?.avatar_key || undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    child?.avatar_key ? uploadApi.getFileUrl(child.avatar_key) : null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null); // 待裁剪的图片
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置 input
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 显示裁剪界面
    const objectUrl = URL.createObjectURL(file);
    setCropImage(objectUrl);
  };

  // 处理裁剪完成
  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImage(null);
    setIsUploading(true);

    try {
      const compressedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      const { key } = await uploadApi.getSignedUrl({
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
        type: 'avatar',
      });
      await uploadApi.uploadFile(key, compressedFile);
      setAvatarKey(key);
      setAvatarPreview(URL.createObjectURL(croppedBlob));
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      const msg = error instanceof Error ? error.message : '上传失败';
      alert(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-gray-800 font-bold text-lg mb-4">
          {child ? '编辑宝贝' : '添加宝贝'}
        </h3>

        {/* 头像选择 */}
        <div className="flex justify-center mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="relative group"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-4xl overflow-hidden group-hover:from-pink-300 group-hover:to-purple-300 transition-all">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                '👶'
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-white text-xs">
              {isUploading ? '...' : '🖼️'}
            </div>
          </button>
        </div>
        <p className="text-center text-gray-400 text-xs mb-4">点击更换头像</p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="宝贝的名字"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim(), avatarKey)}
            disabled={!name.trim() || isUploading}
            className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-pink-600 transition-colors"
          >
            {child ? '保存' : '添加'}
          </button>
        </div>
      </div>

      {/* 图片裁剪弹窗 */}
      {cropImage && (
        <ImageCropper
          imageSrc={cropImage}
          onCrop={handleCropComplete}
          onCancel={() => {
            URL.revokeObjectURL(cropImage);
            setCropImage(null);
          }}
        />
      )}
    </div>
  );
}

// 照片预览弹窗
function PhotoPreviewModal({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full text-white text-xl flex items-center justify-center z-10 hover:bg-white/40 transition-colors"
      >
        ✕
      </button>
      <img
        src={uploadApi.getFileUrl(photo.r2_key)}
        alt=""
        className="object-contain"
        style={{
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// 选择宝贝上传弹窗
function SelectChildModal({
  grandchildren,
  pendingFilesCount,
  onClose,
  onSubmit,
}: {
  grandchildren: Grandchild[];
  pendingFilesCount: number;
  onClose: () => void;
  onSubmit: (selectedIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    grandchildren.length === 1 ? [grandchildren[0].id] : []
  );
  const [isUploading, setIsUploading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setIsUploading(true);
    await onSubmit(selectedIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-gray-800 font-bold text-lg mb-2">选择宝贝（可选）</h3>
        <p className="text-gray-500 text-sm mb-4">
          已选择 {pendingFilesCount} 张照片，可选择关联的宝贝
        </p>

        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {grandchildren.map((child) => (
            <button
              key={child.id}
              onClick={() => toggleSelect(child.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                selectedIds.includes(child.id)
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-pink-200'
              }`}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-xl overflow-hidden">
                {child.avatar_key ? (
                  <img
                    src={uploadApi.getFileUrl(child.avatar_key)}
                    alt={child.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  '👶'
                )}
              </div>
              <span className="flex-1 text-left text-gray-800 font-medium">
                {child.name}
              </span>
              {selectedIds.includes(child.id) && (
                <span className="text-pink-500 text-xl">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold disabled:opacity-50 hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-pink-600 transition-colors"
          >
            {isUploading ? '上传中...' : `上传 (${pendingFilesCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// 图片裁剪组件 - 正方形裁剪
function ImageCropper({
  imageSrc,
  onCrop,
  onCancel,
}: {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const cropSize = 280; // 裁剪框大小

  // 图片加载完成后计算初始位置
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;

    // 计算初始缩放，使图片填满裁剪框
    const minScale = cropSize / Math.min(naturalWidth, naturalHeight);
    const initialScale = minScale * 1.2; // 稍微放大一点

    setImageSize({ width: naturalWidth, height: naturalHeight });
    setScale(initialScale);

    // 居中
    setOffset({
      x: (cropSize - naturalWidth * initialScale) / 2,
      y: (cropSize - naturalHeight * initialScale) / 2,
    });
  };

  // 触摸/鼠标事件处理
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const scaledWidth = imageSize.width * scale;
    const scaledHeight = imageSize.height * scale;

    let newX = clientX - dragStart.x;
    let newY = clientY - dragStart.y;

    // 限制边界，确保裁剪框内始终有图片
    const minX = cropSize - scaledWidth;
    const minY = cropSize - scaledHeight;

    newX = Math.min(0, Math.max(minX, newX));
    newY = Math.min(0, Math.max(minY, newY));

    setOffset({ x: newX, y: newY });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // 缩放
  const handleZoom = (delta: number) => {
    const minScale = cropSize / Math.min(imageSize.width, imageSize.height);
    const maxScale = 3;
    const newScale = Math.min(maxScale, Math.max(minScale, scale + delta));

    // 以裁剪框中心为基准缩放
    const centerX = cropSize / 2;
    const centerY = cropSize / 2;

    const oldCenterInImageX = (centerX - offset.x) / scale;
    const oldCenterInImageY = (centerY - offset.y) / scale;

    const newOffsetX = centerX - oldCenterInImageX * newScale;
    const newOffsetY = centerY - oldCenterInImageY * newScale;

    // 限制边界
    const scaledWidth = imageSize.width * newScale;
    const scaledHeight = imageSize.height * newScale;
    const minX = cropSize - scaledWidth;
    const minY = cropSize - scaledHeight;

    setScale(newScale);
    setOffset({
      x: Math.min(0, Math.max(minX, newOffsetX)),
      y: Math.min(0, Math.max(minY, newOffsetY)),
    });
  };

  // 执行裁剪
  const handleCrop = async () => {
    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法加载图片'));
        img.src = imageSrc;
      });

      // 计算在原图中的裁剪区域
      const sourceX = -offset.x / scale;
      const sourceY = -offset.y / scale;
      const sourceSize = cropSize / scale;

      // 创建 canvas 输出 600x600
      const outputSize = 600;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 canvas');

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );

      canvas.toBlob(
        (blob) => {
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(imageSrc);

          if (blob) {
            onCrop(blob);
          } else {
            alert('裁剪失败');
            setIsProcessing(false);
          }
        },
        'image/jpeg',
        0.85
      );
    } catch (error) {
      console.error('Crop error:', error);
      alert('裁剪失败');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col">
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center p-4 bg-black/50">
        <button
          onClick={() => {
            URL.revokeObjectURL(imageSrc);
            onCancel();
          }}
          className="text-white text-lg px-4 py-2"
        >
          取消
        </button>
        <span className="text-white font-medium">移动和缩放</span>
        <button
          onClick={handleCrop}
          disabled={isProcessing}
          className="text-pink-400 text-lg font-bold px-4 py-2 disabled:opacity-50"
        >
          {isProcessing ? '处理中...' : '确定'}
        </button>
      </div>

      {/* 裁剪区域 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div
          ref={containerRef}
          className="relative"
          style={{ width: cropSize, height: cropSize }}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY);
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
          }}
          onTouchEnd={handleEnd}
        >
          {/* 图片 */}
          <img
            src={imageSrc}
            alt=""
            className="absolute select-none pointer-events-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'top left',
              maxWidth: 'none',
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* 裁剪框遮罩 - 四周半透明 */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 圆形裁剪区域 */}
            <div
              className="absolute inset-0 border-4 border-white rounded-full"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="p-6 bg-black/50 flex items-center justify-center gap-6">
        <button
          onClick={() => handleZoom(-0.1)}
          className="w-12 h-12 bg-white/20 rounded-full text-white text-2xl flex items-center justify-center"
        >
          −
        </button>
        <div className="w-32 h-1 bg-white/30 rounded-full relative">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full"
            style={{
              left: `${((scale - cropSize / Math.min(imageSize.width || 1, imageSize.height || 1)) / 2) * 100}%`,
            }}
          />
        </div>
        <button
          onClick={() => handleZoom(0.1)}
          className="w-12 h-12 bg-white/20 rounded-full text-white text-2xl flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}
