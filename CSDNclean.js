// ==UserScript==
// @name         CSDN删dom
// @namespace    http://tampermonkey.net/
// @version      2024-06-13
// @description  删除CSDN页面广告和侧边栏
// @author       madderscientist
// @match        https://blog.csdn.net/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.robotModuleJs = "";// 经过调试发现加载chat-search.js是根据这个变量保存的url加载的 在一个script内赋值的
    // 去广告
    //window.addEventListener('load',()=>{
        var ads = [
            ...document.getElementsByClassName("toolbar-advert"),
            ...document.getElementsByClassName("adsbygoogle adsbygoogle-noablate"),
            ...document.getElementsByClassName("toolbar-btn toolbar-btn-vip")
        ];
        for(const x of ads) {
            x.remove();
        }
        // 隐藏侧边栏
        var styleElement = document.createElement('style');
        styleElement.appendChild(document.createTextNode(`
            .csdn-side-toolbar { display: none; }
        `));
        document.head.appendChild(styleElement);
    //});
})();