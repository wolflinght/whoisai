const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库连接
const db = new sqlite3.Database(path.join(__dirname, '../data/players.db'), (err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to the SQLite database.');
        // 删除旧表
        db.run('DROP TABLE IF EXISTS players', (err) => {
            if (err) {
                console.error('Error dropping players table:', err);
            } else {
                console.log('Old players table dropped');
                // 创建新的玩家表，添加昵称唯一约束和最高分字段
                db.run(`CREATE TABLE players (
                    id TEXT PRIMARY KEY,
                    nickname TEXT NOT NULL UNIQUE,
                    total_score INTEGER DEFAULT 0,
                    highest_score INTEGER DEFAULT 0,
                    games_played INTEGER DEFAULT 0,
                    avg_score REAL DEFAULT 0,
                    last_played DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        console.error('Error creating players table:', err);
                    } else {
                        console.log('New players table created with unique nickname constraint');
                    }
                });
            }
        });
    }
});

// 通过昵称查找玩家
function findPlayerByNickname(nickname) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM players WHERE nickname = ?', [nickname], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// 添加或更新玩家
async function upsertPlayer(id, nickname) {
    try {
        // 先查找是否存在相同昵称的玩家
        const existingPlayer = await findPlayerByNickname(nickname);
        
        if (existingPlayer) {
            // 如果找到相同昵称的玩家，返回该玩家的信息
            return {
                id: existingPlayer.id,
                isExisting: true,
                player: existingPlayer
            };
        }
        
        // 如果没有找到相同昵称的玩家，创建新玩家
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO players (id, nickname) 
                    VALUES (?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                    nickname = excluded.nickname,
                    last_played = CURRENT_TIMESTAMP`,
                [id, nickname],
                function(err) {
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT') {
                            reject(new Error('Nickname already exists'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({
                            id,
                            isExisting: false,
                            player: null
                        });
                    }
                });
        });
    } catch (err) {
        throw err;
    }
}

// 更新玩家分数
function updatePlayerScore(id, score) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE players 
                SET total_score = total_score + ?,
                    games_played = games_played + 1,
                    highest_score = CASE WHEN ? > highest_score THEN ? ELSE highest_score END,
                    avg_score = ROUND(CAST((total_score + ?) AS FLOAT) / (games_played + 1), 2),
                    last_played = CURRENT_TIMESTAMP
                WHERE id = ?`,
            [score, score, score, score, id],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
    });
}

// 获取玩家信息
function getPlayer(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM players WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// 获取排行榜
function getLeaderboard(limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT nickname, total_score, highest_score 
                FROM players 
                ORDER BY total_score DESC 
                LIMIT ?`,
            [limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
    });
}

module.exports = {
    db,
    upsertPlayer,
    updatePlayerScore,
    getPlayer,
    getLeaderboard,
    findPlayerByNickname
};
