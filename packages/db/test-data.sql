-- 插入测试艺术家数据
INSERT INTO Artist (name, type) VALUES 
('测试艺术家1', 'MUSIC'),
('测试艺术家2', 'MUSIC');

-- 插入测试专辑数据
INSERT INTO Album (name, artist, type, year) VALUES 
('测试专辑1', '测试艺术家1', 'MUSIC', '2024'),
('测试专辑2', '测试艺术家2', 'MUSIC', '2024');

-- 插入测试音乐数据
INSERT INTO Track (name, path, artist, album, type, duration, createdAt) VALUES 
('测试歌曲1', './music/music/test-song-1.mp3', '测试艺术家1', '测试专辑1', 'MUSIC', 180, datetime('now')),
('测试歌曲2', './music/music/test-song-2.mp3', '测试艺术家2', '测试专辑2', 'MUSIC', 210, datetime('now'));

-- 插入测试用户数据
INSERT INTO User (id, name, email) VALUES 
(1, '测试用户', 'test@example.com');