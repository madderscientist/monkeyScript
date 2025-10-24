// ==UserScript==
// @name         智慧树自动刷题
// @namespace    http://tampermonkey.net/
// @version      2025-10-22
// @description  没实现自动答题，只实现自动播放视频、自动下一个功能。仅适配了一种UI
// @author       madderscientist
// @match        *://*.zhihuishu.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';
    console.log('智慧树刷课脚本启动');
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
    }
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 获取当前大章节的进度 current表示已经完成了多少
     * @returns {current: number, total: number} or null
     */
    function getCurrentStepUnderChapter() {
        // 当前大章节 由于右侧的有bug所以根据左侧的来
        // x[1].innerHTML.indexOf('已完成')
        const x = document.querySelectorAll('.video-wrap');
        let i = 0;
        for (; i < x.length; i++) {
            const item = x[i];
            if (item.innerHTML.indexOf('已完成') === -1) {
                break;
            }
        }
        return { current: i, total: x.length };
    }
    /**
     * 获取当前页面的视频元素
     * @returns video
     */
    function getVideo() {
        return document.querySelector('video');
    }
    /**
     * 视频播放完毕的处理
     */
    function videoEndedHandler() {
        myconsolelog(`${new Date().toLocaleString()} 视频播放完毕，准备播放下一个`);
        run();
    }
    /**
     * 获取当前位置、播放下一个视频
     */
    async function run() {
        await delay(2000);
        let currentPosition = getCurrentStepUnderChapter();
        myconsolelog(`当前章节进度：${currentPosition.current} / ${currentPosition.total}`);
        if (currentPosition.current < currentPosition.total) {
            // 继续播放当前章节的下一个视频
            const x = document.querySelectorAll('.video-wrap');
            const next = x[currentPosition.current];
            if (next == null) {
                alert("无法获取下一个子章节，请检查页面结构是否变化");
                return;
            }
            next.click();
            await delay(2000);
            let liuchang = document.querySelector('.line1bq.switchLine');  // 流畅
            if (liuchang) {
                liuchang.click();
                await delay(2000);
            }
            const v = getVideo();
            if (v) {
                v.playbackRate = 16;
                // 防止播放完成后从头开始
                if (!v.ended && v.paused) {
                    v.play();
                }
                // 监听播放完毕事件
                v.removeEventListener('ended', videoEndedHandler);
                v.addEventListener('ended', videoEndedHandler, { once: true });
            } else {    // 不是视频，会立即完成，直接下一个
                run();
            }
        } else {
            // 选择下一个大章节
            // 右侧正在播放的class：clearfix video activeNode
            // 使用 nextElementSibling 获取下一章节
            const currentChapter = document.querySelector('.clearfix.video.activeNode');
            let nextChapter = currentChapter.nextElementSibling;
            if (nextChapter == null) {
                // 如果没有下一个兄弟节点，从头开始找.clearfix.video
                const chapters = Array.from(document.querySelectorAll('.clearfix.video'));
                const currentIndex = chapters.indexOf(currentChapter);
                for (let i = currentIndex + 1; i < chapters.length; i++) {
                    // 没有其他类的才是可以点击的
                    if (chapters[i].className.trim() === 'clearfix video') {
                        nextChapter = chapters[i];
                        break;
                    }
                }
                if (!nextChapter) {
                    myconsolelog('没有更多章节了');
                    return;
                }
            }
            if (nextChapter) {
                nextChapter.click();
                run();
            } else {
                myconsolelog('没有更多章节了');
            }
        }
    }
    window.addEventListener('load', () => {
        myconsolelog('页面加载完成，脚本准备就绪');
        run();
    });
})();