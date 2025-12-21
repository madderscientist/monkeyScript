// ==UserScript==
// @name         智慧树统计题目
// @namespace    http://tampermonkey.net/
// @version      2025-12-21
// @description  try to take over the world!
// @author       You
// @match        https://fusioncourseh5.zhihuishu.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==

const cloudBackendURL = 'https://gg.jc1.top:22222';

class Question {
    constructor(id, type, content, options, answer, history) {
        this.id = id; // 题目ID
        this.type = type;
        this.content = content; // 题目内容
        this.options = options; // 选项 每个选项 {id, content}
        this.answer = answer; // 正确答案
        this.history = history; // 历史错误答案
    }
    exportCSV() {
        // 建立A B C D选项 和 options的映射
        const optionMap = {};
        this.options.forEach((opt, index) => {
            optionMap[opt.id] = String.fromCharCode(65 + index);
        });
        // 构建选项字符串
        const optionsStr = this.options.map((opt, index) => {
            return `${optionMap[opt.id]}. ${opt.content}`;
        }).join('\n');
        // 构建答案字符串
        const answerStr = this.answer ? this.answer.map(ansId => optionMap[ansId]).join('') : '无';
        // 构建历史错误字符串
        const historyStr = this.history ? this.history.map(histAns => histAns.map(ansId => optionMap[ansId]).join('')).join(' | ') : '无';
        // 构建csv行
        return `${this.id},${this.type},"${this.content.replace(/"/g, '""')}","${optionsStr.replace(/"/g, '""')}",${answerStr},${historyStr}`;
    }
    getAnswerStr(sep = '<br>') {
        if (!this.answer) {
            // 获取历史
            if (this.history && this.history.length > 0) {
                const historyStr = this.history.map(ansArr => {
                    return ansArr.map(ansId => {
                        const opt = this.options.find(o => o.id === ansId);
                        return opt ? ("▪" + opt.content) : ansId;
                    }).join(sep);
                }).join(`${sep}=========${sep}`);
                return "暂无答案，错误答案为:" + sep + historyStr;
            }
        } else {
            const answerStr = this.answer.map(ansId => {
                const opt = this.options.find(o => o.id === ansId);
                return opt ? ("▪" + opt.content) : ansId;
            }).join(sep);
            return "正确答案为:" + sep + answerStr;
        }
        return "暂无答案";
    }
}

// 题库管理类，使用 IndexedDB 存储题目
class QuestionBank {
    constructor(dbName = "QuestionBankDB", storeName = "questions") {
        this.dbName = dbName;
        this.storeName = storeName;
        this.dbPromise = this._openDB();
    }
    _openDB() {
        return new Promise((resolve, reject) => {
            const openReq = indexedDB.open(this.dbName, 1);
            openReq.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            openReq.onsuccess = () => {
                resolve(openReq.result);
            };
            openReq.onerror = (event) => {
                reject(event);
            };
        });
    }
    saveQuestionToDB(questionObj) {
        this.dbPromise.then(db => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.put(questionObj);
        });
    }
    getQuestionFromDB(id) {
        return this.dbPromise.then(db => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const getReq = store.get(id);
                getReq.onsuccess = () => {
                    resolve(getReq.result); // 为 undefined 表示不存在
                };
                getReq.onerror = (event) => {
                    reject(event);
                };
            });
        });
    }
    walkDB(callback) {
        return this.dbPromise.then(db => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        callback(cursor.value);
                        cursor.continue();
                    } else {
                        // 遍历结束
                        resolve();
                    }
                };
                request.onerror = (event) => {
                    reject(event);
                };
            });
        });
    }
    export(file = 'questions.csv') {
        const allQuestions = [];
        return this.walkDB((question) => {
            Object.setPrototypeOf(question, Question.prototype);
            allQuestions.push(question.exportCSV());
        }).then(() => {
            const header = '题目ID,题目类型,题目内容,选项,正确答案,历史错误答案';
            const txt = [header, ...allQuestions].join('\n');
            if (!file) return txt;
            const blob = new Blob([txt], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", file);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }
}

const originConsolelog = console.log;
window.questionBank = new QuestionBank();

class AnsParser {
    // 可以直接传入questions数组
    static async parse(txt, questions = undefined) {
        if (questions === undefined) {
            const data = JSON.parse(txt).data;
            originConsolelog(data);
            questions = data.questions;
        }
        const precessedQuestions = [];
        for (const q of questions) {
            const myAnswer = q.userAnswerVo;
            if (!myAnswer) continue;
            const id = String(q.questionId);
            const existingQ = await window.questionBank.getQuestionFromDB(id);
            const qustionObj = existingQ || {
                id: id,
                type: q.questionType,
                content: q.questionName,
                options: q.optionVos.map(opt => ({ id: String(opt.id), content: opt.name })),
                // 以下是用户答案部分
                answer: undefined,
                history: undefined,
            };
            precessedQuestions.push(qustionObj);
            // 判断是否需要记录
            if (qustionObj.answer !== undefined) {
                continue; // 已有正确答案，不再记录
            }
            // 记录作答情况
            const ans = myAnswer.answer.split(',');
            if (myAnswer.isCorrect === 1) {
                // 正确
                qustionObj.answer = ans;
                qustionObj.history = undefined; // 清空历史错误
            } else {
                // 错误，记录历史答案，去重
                let newHistory = Array.isArray(qustionObj.history) ? qustionObj.history.slice() : [];
                newHistory.push(ans);
                // 对每个元素排序
                newHistory = newHistory.map(arr => Array.isArray(arr) ? arr.slice().sort() : arr);
                // 用字符串化去重
                const seen = new Set();
                newHistory = newHistory.filter(arr => {
                    const key = JSON.stringify(arr);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                qustionObj.history = newHistory;
            }
            await window.questionBank.saveQuestionToDB(qustionObj);
            originConsolelog('$记录题目', qustionObj.content);
        }
        if (precessedQuestions.length === 0) return;
        // 网络请求 同步到云端
        fetch(cloudBackendURL + '/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(precessedQuestions)
        }).then(response => {
            if (response.status === 200) {
                return response.json();
            } else if (response.status === 500) {
                throw new Error('后端失败:' + response.json().error);
            } else {
                throw new Error('请求失败:' + response.status);
            }
        }).then(data => {
            originConsolelog('$同步到云端结果', data);
            if (data.updated + data.appended == 0) return;
            alert(`同步到云端结果：update: ${data.updated}, skipped: ${data.skipped}, appended: ${data.appended}`);
        }).catch(error => {
            originConsolelog('$同步到云端失败', error);
            alert('同步到云端失败：' + error.message);
        });
    }
    static targetStr = 'getUserAnswers';
}

class QuesParser {
    static targetStr = 'exam/start?';
    static ans = null;
    static currentPage = -1;
    static async parse(txt) {
        const data = JSON.parse(txt).data;
        originConsolelog(data);
        const questions = data.questions;
        const ans = QuesParser.ans = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const id = String(q.questionId);
            const existingQ = await window.questionBank.getQuestionFromDB(id);
            if (existingQ === undefined) {
                // 数据库没有 查询网络
                fetch(cloudBackendURL + '/question/' + id).then(res => {
                    if (res.status === 200) {
                        return res.json();
                    } else {
                        return undefined; // 404 或其他错误
                    }
                }).then(question => {
                    if (question) {
                        // 解析为 Question 对象
                        Object.setPrototypeOf(question, Question.prototype);
                        ans[i] = question;
                    } else {
                        ans[i] = undefined;
                    }
                    if (i === QuesParser.currentPage) {
                        putText(ans[QuesParser.currentPage].getAnswerStr(), true);
                    }
                }).catch(err => { });
            } else {
                Object.setPrototypeOf(existingQ, Question.prototype);
                ans[i] = existingQ;
            }
        }
        QuesParser.clickHandler();
    }
    static bindEvents() {
        let div = document.querySelector('.right-box');
        if (!div) {
            // 考虑到页面还没加载完成，等待加载，轮询
            function getDiv() {
                setTimeout(() => {
                    div = document.querySelector('.right-box');
                    if (div) {
                        QuesParser.clickHandler();
                        div.addEventListener('click', QuesParser.clickHandler);
                    } else {
                        getDiv();
                    }
                }, 500);
            }
            getDiv();
        } else {
            QuesParser.clickHandler();
            div.addEventListener('click', QuesParser.clickHandler);
        }
    }
    static clickHandler() {
        QuesParser.currentPage = QuesParser.getCurrentPage();
        if (QuesParser.currentPage < 0) return;
        if (QuesParser.ans && QuesParser.ans[QuesParser.currentPage]) {
            const q = QuesParser.ans[QuesParser.currentPage];
            putText(q.getAnswerStr(), true);
            const examContainer = Array.from(document.querySelectorAll('.left-box .exam-item'))
                .find(div => div.style.display !== 'none');
        }
        else putText('题库无此题答案', true);
    };
    static getCurrentPage() {
        const item = document.querySelector('.right-box .list .item.active');
        if (!item) return -1;
        const siblings = Array.from(item.parentNode.children);
        return siblings.indexOf(item);
    }
    // 应用样式，标记答案
    static async applyStyle() {
        let exams = document.querySelectorAll('.left-box .exam-item');
        while (exams.length != QuesParser.ans.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
            exams = document.querySelectorAll('.left-box .exam-item');
        }
        for (let i = 0; i < QuesParser.ans.length; i++) {
            const q = QuesParser.ans[i];
            const exam = exams[i];
            if (!q || !exam) continue;
            if (q.answer === undefined) continue;
            // 有答案
            const labels = exam.querySelectorAll('label');
            const answers = q.answer.map(ansId => {
                const opt = q.options.find(o => o.id === ansId);
                return opt ? opt.content : ansId;
            });
            for (const label of labels) {
                const labelText = label.textContent || label.innerText || '';
                for (const ansText of answers) {
                    if (labelText.includes(ansText)) {
                        label.style.borderColor = '#28a745'; // 绿色边框
                        label.click();
                        await new Promise(resolve => setTimeout(resolve, 0));
                        break;
                    }
                }
            }
        }
    }
}

class ErrorRecommendParser {
    static targetStr = "getErrorQuestionRecommend";
    static parse(txt) {
        const data = JSON.parse(txt).data;
        const answers = [];
        for (const op of data.optionVos) {
            if (op.isCorrect == 1) answers.push(op.id);
        }
        data.userAnswerVo = {
            answer: answers.join(','),
            isCorrect: 1
        }
        originConsolelog(data);
        AnsParser.parse('', [data]);
    }
}

function myconsolelog(msg) {
    let div = document.getElementById('myconsole');
    if (!div) {
        div = document.createElement('div');
        div.id = 'myconsole';
        div.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#fff;padding:8px;border:1px solid #ccc;max-width:300px;max-height:200px;overflow:auto;font-size:12px;';
        document.body.prepend(div);
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        div.addEventListener('mousedown', function (e) {
            isDragging = true;
            offsetX = e.clientX - div.offsetLeft;
            offsetY = e.clientY - div.offsetTop;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function (e) {
            if (isDragging) {
                div.style.left = (e.clientX - offsetX) + 'px';
                div.style.top = (e.clientY - offsetY) + 'px';
                div.style.right = 'auto';
            }
        });
        document.addEventListener('mouseup', function () {
            isDragging = false;
            document.body.style.userSelect = '';
        });
        div.style.cursor = 'move';
    }
    const p = document.createElement('div');
    p.textContent = msg;
    div.appendChild(p);
    return div;
}

function putText(msg, clear = false) {
    let div = document.getElementById('rightbox-console');
    if (!div) {
        let container = document.querySelector('.right-box');
        if (!container) return myconsolelog(msg);
        div = document.createElement('div');
        div.id = 'rightbox-console';
        div.style.cssText = 'color: white;';
        container.append(div);
    }
    if (clear) div.innerHTML = '';
    const p = document.createElement('div');
    p.innerHTML = msg;
    div.appendChild(p);
    return div;
}

(function () {
    'use strict';
    //===== 拦截 XHR =====//
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        const xhr = new OriginalXHR();
        let url = '';
        // 重写 open 方法，获取请求的 url
        const originalOpen = xhr.open;
        xhr.open = function (method, requestUrl, ...args) {
            url = requestUrl;
            originalOpen.apply(xhr, [method, requestUrl, ...args]);
        };
        // 监听 readyState 变化
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === 4) {
                if (url.includes(AnsParser.targetStr)) {
                    AnsParser.parse(xhr.responseText);
                } else if (url.includes(QuesParser.targetStr)) {
                    QuesParser.parse(xhr.responseText).then(() => {
                        return QuesParser.applyStyle();
                    });
                    QuesParser.bindEvents();
                }
                if (url.includes(ErrorRecommendParser.targetStr)) {
                    ErrorRecommendParser.parse(xhr.responseText);
                }
            }
        });
        return xhr;
    };

    originConsolelog('智慧树统计题目脚本启动');
})();