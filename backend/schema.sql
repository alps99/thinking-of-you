-- 惦记 App 数据库 Schema
-- Cloudflare D1 (SQLite)

-- 家庭
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  invite_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('child', 'parent')),
  family_id TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Shanghai',
  email_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 邮箱验证码
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 宝贝
CREATE TABLE IF NOT EXISTS grandchildren (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_key TEXT,
  birth_date DATE,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 惦记
CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mood INTEGER NOT NULL CHECK (mood >= 1 AND mood <= 27),
  message TEXT,
  photo_key TEXT,
  audio_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 惦记回应
CREATE TABLE IF NOT EXISTS check_in_responses (
  id TEXT PRIMARY KEY,
  check_in_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('heart', 'audio')),
  audio_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (check_in_id) REFERENCES check_ins(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 新鲜事
CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT,
  location TEXT,
  audio_key TEXT,
  audio_duration INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 新鲜事媒体
CREATE TABLE IF NOT EXISTS moment_media (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE
);

-- 新鲜事互动
CREATE TABLE IF NOT EXISTS moment_reactions (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('heart', 'audio')),
  audio_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 新鲜事评论
CREATE TABLE IF NOT EXISTS moment_comments (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 照片
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  grandchild_id TEXT,
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL,
  taken_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  FOREIGN KEY (grandchild_id) REFERENCES grandchildren(id)
);

-- 照片请求
CREATE TABLE IF NOT EXISTS photo_requests (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id),
  FOREIGN KEY (requester_id) REFERENCES users(id)
);

-- 照片查看记录 (父母查看过的照片)
CREATE TABLE IF NOT EXISTS photo_views (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(photo_id, user_id)
);

-- 新鲜事查看记录 (父母查看过的新鲜事)
CREATE TABLE IF NOT EXISTS moment_views (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(moment_id, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_moment_views_user ON moment_views(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_user ON photo_views(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_family_date ON check_ins(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moments_family_date ON moments(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_photos_family_date ON photos(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);
