// ==UserScript==
// @name         KIMI、豆包、DeepSeek清空历史
// @namespace    http://tampermonkey.net/
// @version      2024-06-14
// @description  一个一个手动清太麻烦啦！
// @author       madderscientist
// @match        https://www.kimi.com/*
// @match        https://chat.deepseek.com/*
// @match        https://www.doubao.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    async function asyncDelay(time) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    }

    let config;
    if (window.location.host.includes("kimi"))
        config = {
            // "清空历史"按钮容器
            "btn_container_class": ".sidebar",
            // 存放历史记录的容器（防止找到别的不该删的）
            "more_btn_container_class": ".history-part",
            // 更多按钮，点击后会弹出删除按钮
            "more_btn_class": ".more-btn",
            // 删除按钮，点击后会弹出确认删除的弹窗
            "delete_btn_class": ".opt-item.delete",
            // 确认删除按钮，点击后会删除历史记录
            "confirm_btn_class": ".kimi-button.danger"
        };
    else if (window.location.host.includes("deepseek"))
        config = {
            "btn_container_class": ".b8812f16.a2f3d50e",
            "more_btn_container_class": "._77cdc67._8a693f3",
            "more_btn_class": ".ds-icon",
            "delete_btn_class": ".ds-dropdown-menu-option--error",
            "confirm_btn_class": ".ds-atom-button.ds-basic-button.ds-basic-button--danger"
        };
    else if(window.location.host.includes("doubao"))
        config = {
            "btn_container_class": ".flex.flex-col.h-full.select-none",
            "more_btn_container_class": ".collapse-content-uFEpZ8",
            "more_btn_class": ".semi-icon.semi-icon-default.text-s-color-text-quaternary",
            "delete_btn_class": ".remove-btn-TOaQi0.select-none.semi-dropdown-item",
            "confirm_btn_class": ".semi-button.semi-button-primary.samantha-button-Gqjh9l.danger-primary-XKkX_5.medium-MN8t8q"
        };
    const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0      // 左键
    });

    async function deleteAllChats() {
        let morebtns = document.querySelector(config["more_btn_container_class"]);
        if (morebtns != null) morebtns = morebtns.querySelectorAll(config["more_btn_class"]);
        else morebtns = document.querySelectorAll(config["more_btn_class"]);
        if (morebtns.length == 0) return;
        let hasAvailable = false;   // 防止有无效按钮导致死循环
        for (const btn of morebtns) {
            btn.dispatchEvent(mousedownEvent);
            btn.click();
            await asyncDelay(300);
            // 豆包没有click事件，观察发现按下鼠标就响应，于是发现模拟按下事件就可以
            const deleteBtn = document.querySelector(config["delete_btn_class"]);
            if (!deleteBtn) continue;
            deleteBtn.dispatchEvent(mousedownEvent);
            deleteBtn.click();
            await asyncDelay(300);
            const confirmBtn = document.querySelector(config["confirm_btn_class"]);
            if (!confirmBtn) continue;
            confirmBtn.dispatchEvent(mousedownEvent);
            confirmBtn.click();
            await asyncDelay(300);
            hasAvailable = true;
        }
        if (hasAvailable) deleteAllChats();
    }

    window.addEventListener('load', async function() {
        let divContainer = null;
        while(!divContainer) {
            await asyncDelay(512);
            divContainer = document.querySelector(config["btn_container_class"]);
        }
        let btn = document.createElement("button");
        btn.innerHTML = "清空历史";
        btn.onclick = deleteAllChats;
        btn.style.background = "transparent";
        btn.style.border = "none";
        btn.style.color = "red";
        btn.style.cursor = "pointer";
        divContainer.appendChild(btn);
    });
})();