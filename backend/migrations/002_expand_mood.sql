-- 扩展 mood 字段范围从 (1,2,3) 到 (1-27)
-- SQLite 不支持直接修改 CHECK 约束，需要重建表

-- 1. 创建新表
CREATE TABLE check_ins_new (
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

-- 2. 复制数据
INSERT INTO check_ins_new SELECT * FROM check_ins;

-- 3. 删除旧表
DROP TABLE check_ins;

-- 4. 重命名新表
ALTER TABLE check_ins_new RENAME TO check_ins;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_check_ins_family_date ON check_ins(family_id, created_at);
