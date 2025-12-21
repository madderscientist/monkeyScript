const https = require('https');
const url = require('url');
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('./questions.db');

// 初始化表
// 后面三个都是 JSON 字符串，answer 为 null 表示无正确答案
db.prepare(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    type INTEGER,
    content TEXT,
    options TEXT,
    answer TEXT,
    history TEXT
)`).run();

const selectStmt = db.prepare('SELECT * FROM questions WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO questions (id, type, content, options, answer, history) VALUES (?, ?, ?, ?, ?, ?)');
const updateAnsStmt = db.prepare('UPDATE questions SET answer = ?, history = ? WHERE id = ?');
const updateHistStmt = db.prepare('UPDATE questions SET history = ? WHERE id = ?');

/* 
接收到的数据: [
{
    id: "1011322311",
    type: 2,
    content: "关于马斯诺需求层次理论与技术创新的关系，下列哪些说法是正确的？（ ）。",
    options: [
        { id: "407983777", content: "技术创新主要是为了满足人类的基本生存需求。" },
        ...
    ],
    answer: ["407983777","407983779","407983780"],
    history: [["407983778","407983780"], ["407983779"]]
},
...
]
*/
// 服务器
function getQuestions(body) {
    const questions = JSON.parse(body);
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let appended = 0;
    for (const q of questions) {
        processed++;
        const row = selectStmt.get(q.id);
        if (!row) {
            // 不存在，直接插入
            insertStmt.run(
                q.id, q.type, q.content,
                q.options ? JSON.stringify(q.options) : null,
                q.answer !== undefined ? JSON.stringify(q.answer) : null,
                q.history !== undefined ? JSON.stringify(q.history) : null
            );
            updated++;
        } else {
            // 已存在
            const dbAnswer = row.answer ? JSON.parse(row.answer) : null;
            const dbHistory = row.history ? JSON.parse(row.history) : [];
            if (dbAnswer === null) {    // 还没有正确答案
                if (q.answer !== undefined && q.answer !== null) {
                    // answer为NULL，且当前q.answer不是NULL，说明有正确答案，覆盖
                    updateAnsStmt.run(
                        JSON.stringify(q.answer),
                        null,   // 有正确答案，不需要历史记录
                        q.id
                    );
                    updated++;
                } else {
                    // answer为NULL，且q.answer也是NULL，追加history
                    let newHistory = Array.isArray(dbHistory) ? dbHistory.slice() : [];
                    const len_bef = newHistory.length;
                    if (Array.isArray(q.history)) {
                        // 合并
                        let allHistory = newHistory.concat(q.history);
                        // 对每个元素排序
                        allHistory = allHistory.map(arr => Array.isArray(arr) ? arr.slice().sort() : arr);
                        // 用字符串化去重
                        const seen = new Set();
                        newHistory = allHistory.filter(arr => {
                            const key = JSON.stringify(arr);
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });
                    }
                    if (newHistory.length <= len_bef) continue;
                    updateHistStmt.run(
                        JSON.stringify(newHistory),
                        q.id
                    );
                    appended++;
                }
            } else {
                // answer不是NULL，跳过
                skipped++;
            }
        }
    }
    return { count: processed, updated, skipped, appended };
}

const options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./fullchain.pem')
};
const server = https.createServer(options, (req, res) => {
    // CORS 处理
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204);
        res.end();
        return;
    }
    const parsedUrl = url.parse(req.url, true);
    if (req.method === 'POST' && parsedUrl.pathname === '/questions') {
        // 批量导入
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const result = getQuestions(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                if (result.count == result.skipped) return;
                console.log(`[${new Date().toISOString()}] ${JSON.stringify(result)}`);
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else if (req.method === 'GET' && parsedUrl.pathname.startsWith('/question/')) {
        // 查询单题
        const id = parsedUrl.pathname.split('/').pop();
        try {
            const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
            if (!row) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            } else {
                // 返回结构与 Question 类一致
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: row.id,
                    type: row.type,
                    content: row.content,
                    options: JSON.parse(row.options),
                    answer: row.answer ? JSON.parse(row.answer) : undefined,
                    history: row.history ? JSON.parse(row.history) : undefined
                }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid endpoint' }));
    }
});

server.listen(22222, () => {
    console.log('Server running at http://localhost:22222/');
});