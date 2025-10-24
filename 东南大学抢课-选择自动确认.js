// ==UserScript==
// @name        东南大学抢课-选择自动确认
// @namespace   http://tampermonkey.net/
// @version     1.0.0
// @description 听说你抢不到课
// @author      realhuhu
// @license     MIT
// @match       newxk.urp.seu.edu.cn/xsxk/elective/grablessons?*
// @run-at      document-loaded
// ==/UserScript==

(function() {
    'use strict';
    (function () {// 点击选择自动点击确认
    function autoConfirm() {
        document.getElementsByClassName("el-button el-button--default el-button--small el-button--primary")[0].click();
        console.log("autoClicked!");
    }
    function addAutoClick(){
        let btns = document.getElementsByClassName("el-button el-button--primary el-button--mini is-round");
        for (const i of btns) {
            i.addEventListener("click",autoConfirm);
        }
    }
    // byd这网站反应还和屏幕宽度有关，只有单列显示才能把所有按钮返回了
    window.onclick = function(){
        addAutoClick();
    }
    console.log("initialed");
})();
})();