const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 创建logs目录（如果不存在）
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// 创建日志写入流
const logStream = fs.createWriteStream(path.join(logsDir, 'database.log'), { flags: 'a' });

// 日志函数
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// 数据库连接
const dbDir = path.join(__dirname, '../data');
// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(path.join(dbDir, 'players.db'), (err) => {
    if (err) {
        log('Database connection error:', err);
    } else {
        log('Connected to the players database');
        // 只在表不存在时创建新表
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='players'", (err, row) => {
            if (err) {
                log('Error checking table existence:', err);
            } else if (!row) {
                // 表不存在，创建新表
                db.run(`CREATE TABLE IF NOT EXISTS players (
                    nickname TEXT PRIMARY KEY,
                    total_score INTEGER DEFAULT 0,
                    highest_score INTEGER DEFAULT 0,
                    games_played INTEGER DEFAULT 0,
                    avg_score REAL DEFAULT 0,
                    last_played DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        log('Error creating players table:', err);
                    } else {
                        log('Players table created successfully');
                    }
                });
            } else {
                log('Players table already exists');
            }
        });
    }
});

// 通过昵称查找玩家
function findPlayerByNickname(nickname) {
    log('Attempting to find player by nickname:', { nickname });
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM players WHERE nickname = ?', [nickname], (err, row) => {
            if (err) {
                log('Error finding player by nickname:', err);
                reject(err);
            } else {
                log('Found player by nickname:', { nickname, player: row });
                resolve(row);
            }
        });
    });
}

// 添加或更新玩家
async function upsertPlayer(id, nickname) {
    log('Attempting to upsert player:', { id, nickname });
    try {
        // 先查找是否存在相同昵称的玩家
        const existingPlayer = await findPlayerByNickname(nickname);
        
        if (existingPlayer) {
            // 如果找到相同昵称的玩家，返回该玩家的信息
            log('Found existing player:', { nickname, player: existingPlayer });
            return {
                nickname: existingPlayer.nickname,
                isExisting: true,
                player: existingPlayer
            };
        }
        
        // 如果没有找到相同昵称的玩家，创建新玩家
        log('Creating new player:', { nickname });
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO players (nickname) 
                    VALUES (?)
                    ON CONFLICT(nickname) DO UPDATE SET 
                    last_played = CURRENT_TIMESTAMP`,
                [nickname],
                function(err) {
                    if (err) {
                        log('Error upserting player:', err);
                        reject(err);
                    } else {
                        log('Upserted player:', { nickname });
                        resolve({
                            nickname,
                            isExisting: false,
                            player: null
                        });
                    }
                });
        });
    } catch (err) {
        log('Error upserting player:', err);
        throw err;
    }
}

// 更新玩家分数
function updatePlayerScore(id, score, nickname) {
    log('Attempting to update player score:', { id, nickname, score });
    return new Promise((resolve, reject) => {
        // 首先获取当前分数
        db.get('SELECT total_score FROM players WHERE nickname = ?', [nickname], (err, row) => {
            if (err) {
                log('Error getting current score:', err);
                reject(err);
                return;
            }
            
            log('Current player score before update:', {
                nickname,
                currentScore: row ? row.total_score : 0,
                scoreToAdd: score
            });

            // 然后更新分数
            const updateQuery = `UPDATE players 
                    SET total_score = total_score + ?,
                        games_played = games_played + 1,
                        highest_score = CASE WHEN ? > highest_score THEN ? ELSE highest_score END,
                        avg_score = ROUND(CAST((total_score + ?) AS FLOAT) / (games_played + 1), 2),
                        last_played = CURRENT_TIMESTAMP
                    WHERE nickname = ?`;
            
            log('Executing update query:', {
                query: updateQuery,
                params: [score, score, score, score, nickname]
            });

            db.run(updateQuery, [score, score, score, score, nickname], function(err) {
                if (err) {
                    log('Error updating score:', err);
                    reject(err);
                } else {
                    // 获取更新后的分数
                    db.get('SELECT total_score FROM players WHERE nickname = ?', [nickname], (err, updatedRow) => {
                        if (err) {
                            log('Error getting updated score:', err);
                            reject(err);
                            return;
                        }
                        log('Player score after update:', {
                            nickname,
                            oldScore: row ? row.total_score : 0,
                            newScore: updatedRow ? updatedRow.total_score : 0,
                            scoreAdded: score,
                            changes: this.changes
                        });
                        resolve(this.changes);
                    });
                }
            });
        });
    });
}

// 获取玩家信息
function getPlayer(id) {
    log('Attempting to get player:', { id });
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM players WHERE nickname = ?', [id], (err, row) => {
            if (err) {
                log('Error getting player:', err);
                reject(err);
            } else {
                log('Got player:', { id, player: row });
                resolve(row);
            }
        });
    });
}

// 获取排行榜
function getLeaderboard(limit = 10) {
    log('Attempting to get leaderboard:', { limit });
    return new Promise((resolve, reject) => {
        db.all(`SELECT nickname, total_score, highest_score 
                FROM players 
                ORDER BY total_score DESC 
                LIMIT ?`,
            [limit],
            (err, rows) => {
                if (err) {
                    log('Error getting leaderboard:', err);
                    reject(err);
                } else {
                    log('Got leaderboard:', { limit, leaderboard: rows });
                    resolve(rows);
                }
            });
    });
}

// 查询玩家分数
function getPlayerScore(id) {
    log('Attempting to get player score:', { id });
    return new Promise((resolve, reject) => {
        db.get('SELECT nickname, total_score, highest_score FROM players WHERE nickname = ?', [id], (err, row) => {
            if (err) {
                log('Error getting player score:', err);
                reject(err);
            } else {
                log('Got player score:', { id, score: row });
                resolve(row);
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
    findPlayerByNickname,
    getPlayerScore
};
