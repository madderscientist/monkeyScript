const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('./questions.db');

// 参考 Question 的 CSV 导出格式
function exportQuestionsToCSV(file = 'questions.csv') {
	const header = '题目ID,题目类型,题目内容,选项,正确答案,历史错误答案';
	const rows = [header];
	const stmt = db.prepare('SELECT * FROM questions');
	for (const row of stmt.iterate()) {
		// 解析 options, answer, history
		const options = row.options ? JSON.parse(row.options) : [];
		const answer = row.answer ? JSON.parse(row.answer) : undefined;
		const history = row.history ? JSON.parse(row.history) : undefined;
		// 构建选项映射
		const optionMap = {};
		options.forEach((opt, idx) => {
			optionMap[opt.id] = String.fromCharCode(65 + idx);
		});
		// 选项字符串
		const optionsStr = options.map((opt, idx) => {
			return `${optionMap[opt.id]}. ${opt.content}`;
		}).join('\n');
		// 答案字符串
		const answerStr = Array.isArray(answer) ? answer.map(ansId => optionMap[ansId]).join('') : '无';
		// 历史错误字符串
		const historyStr = Array.isArray(history) ? history.map(histAns => histAns.map(ansId => optionMap[ansId]).join('')).join(' | ') : '无';
		// 构建csv行，注意转义
		const csvLine = `${row.id},${row.type},"${row.content.replace(/"/g, '""')}","${optionsStr.replace(/"/g, '""')}",${answerStr},${historyStr}`;
		rows.push(csvLine);
	}
	fs.writeFileSync(file, rows.join('\n'), { encoding: 'utf-8' });
	console.log(`导出完成: ${file}`);
}

// 允许命令行调用
if (require.main === module) {
	const file = process.argv[2] || 'questions.csv';
	exportQuestionsToCSV(file);
}
