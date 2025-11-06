// ==UserScript==
// @name         东南大学研究生人文讲座脚本ACupofAir
// @namespace    http://nic.seu.edu.cn/
// @version      2024-04-07
// @description  东南大学研究生抢讲座
// @author       OminousBlackCat, ACupofAir, madderscientist
// @match        *://ehall.seu.edu.cn/gsapp/sys/jzxxtjapp/*
// @icon         http://pic.5tu.cn/uploads/allimg/1510/081431395820.jpg
// @match        http://ehall.seu.edu.cn/gsapp/sys/jzxxtjapp/*default/index.do?t_s=1712476611421&EMAP_LANG=zh&THEME=indigo&amp_sec_version_=1&gid_=MGRuVDdWWVRkaWkvSG5VcTBONHpjVjg2dU9BT0dNMEpQNGdiNUQ2dzQyUVJFTHFCK3V5M3BzTkdsRmdBckhxeW41Y0tGVEtiYkEyaWM1ZHBrWUY4OUE9PQ
// @icon         https://www.google.com/s2/favicons?sz=64&domain=seu.edu.cn
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @downloadURL https://update.greasyfork.org/scripts/493411/%E4%B8%9C%E5%8D%97%E5%A4%A7%E5%AD%A6%E7%A0%94%E7%A9%B6%E7%94%9F%E4%BA%BA%E6%96%87%E8%AE%B2%E5%BA%A7%E8%84%9A%E6%9C%ACACupofAir.user.js
// @updateURL https://update.greasyfork.org/scripts/493411/%E4%B8%9C%E5%8D%97%E5%A4%A7%E5%AD%A6%E7%A0%94%E7%A9%B6%E7%94%9F%E4%BA%BA%E6%96%87%E8%AE%B2%E5%BA%A7%E8%84%9A%E6%9C%ACACupofAir.meta.js
// ==/UserScript==
// tite: 东南大学研究生素质讲座预定脚本
// author: ACupofAir
// e-mail: thoughts.times@gmail.com
// madderscientist修改

console.log("SEU Lecture Book Script Loaded")
// 由于要验证码，所以不能多次尝试
// let postInterval = 300 //每次post的时间间隔 推荐100-300ms
setTimeout(function () {
    document.querySelector("body > main > article > div").style.display = "none"
    let all_wid = $("[data-x-wid]").map(function () { return $(this).attr("data-x-wid"); }).get()
    //===============myconsole===============
    let myconsole = document.createElement("span");
    myconsole.id = "myconsole";
    myconsole.style = "color:red;";

    //===============verify code===============
    let newVcode = document.createElement("img");
    newVcode.id = "tempImage";
    function getVcode() {
        let temp_data = BH_UTILS.doSyncAjax(baseUrl + '/hdyy/vcode.do' + '?_=' + new Date().getTime(), {})
        $("#tempImage").attr('src', temp_data.result);
        $("#tempInput").val("");
    }
    newVcode.addEventListener("click", getVcode);

    let verifyCode = document.createElement("input");
    verifyCode.id = "tempInput";
    verifyCode.style = "width:6em; height:1.2em;";
    verifyCode.placeholder = "请输入验证码";

    let flashBtn = document.createElement("button");
    flashBtn.textContent = "获取验证码";
    flashBtn.style = "width:6em; font-size: 1.0em; margin-right:3em";
    flashBtn.addEventListener("click", getVcode);

    $("h2").append(newVcode);
    $("h2").append(verifyCode);
    $("h2").append(flashBtn);


    //===============time setting===============
    let timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.id = "myTime";
    $("h2").append(timeInput);
    // 根据选择的讲座自动定时间
    function autoTime() {
        let lectureId = selectList.value;
        let $table = $("table");
        let $thead = $table.find("thead");
        let $ths = $thead.find("th");
        let idx = -1;
        $ths.each(function (i, th) {
            if ($(th).text().includes("预约开始时间")) {
                idx = i;
                return false;
            }
        });
        if (idx === -1) return;

        let $tbody = $table.find("tbody");
        let $trs = $tbody.find("tr");
        let $targetTr = $trs.eq(lectureId - 1);
        let timeText = $targetTr.find("td").eq(idx).text().trim();

        let match = timeText.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        if (!match) return;
        let dateStr = match[0];
        let dateObj = new Date(dateStr.replace(/-/g, "/")); // Safari兼容

        let hours = dateObj.getHours().toString().padStart(2, "0");
        let minutes = dateObj.getMinutes().toString().padStart(2, "0");
        timeInput.value = `${hours}:${minutes}`;

        return dateObj;
    }


    //===============lecture setting===============
    let selectList = document.createElement("select");
    selectList.id = "mySelect";
    for (let i = 1; i <= all_wid.length; i++) {
        let option = document.createElement("option");
        option.value = i;
        option.text = i.toString();
        selectList.appendChild(option);
    }
    $("h2").append(selectList);

    // 二分法实现高精度倒计时
    let clk = 0;
    function accurateTime(tgtTime, callback) {
        let now = Date.now();
        let target = tgtTime.getTime();
        let diff = Math.max(0, target - now);
        if (diff <= 16) {
            clk = setTimeout(callback, diff);
        } else {
            clk = setTimeout(() => {
                accurateTime(tgtTime, callback);
            }, diff / 2);
        }
    }

    function qiangke(at = new Date()) {
        let diff = at.getTime() - new Date().getTime();
        if (diff < 0) {
            alert("选择的时间已过，请重新选择！");
            return;
        }
        let verifyCode = $("#tempInput").val();
        let lectureId = selectList.value;

        let foo = { HD_WID: all_wid[lectureId - 1], vcode: verifyCode };
        console.log(foo);

        function postData() {
            BH_UTILS.doAjax(baseUrl + '/hdyy/yySave.do', { paramJson: JSON.stringify(foo) }).done((data) => {
                const msg = data.msg || "成功！";
                console.log(msg);
                myconsole.innerText = msg;
            }).fail(function (jqXHR) {
                myconsole.innerText = "请求失败：" + jqXHR.status;
            }).always(() => {
                flashBtn.disabled = false;
                submitBtn.disabled = false;
                getVcode();
            });
            myconsole.innerText = "正在等待响应...";
        }

        clearTimeout(clk);
        myconsole.innerText = `将于${at.toLocaleString()}抢第${lectureId}个课, 验证码为${verifyCode}, 请等待...`;
        flashBtn.disabled = true;
        submitBtn.disabled = true;
        accurateTime(at, postData);
    }

    let submitBtn = document.createElement("button");
    submitBtn.textContent = "定时抢课";
    submitBtn.style = "margin-right:2em";
    submitBtn.addEventListener("click", function () {
        let selectedTimeValue = timeInput.value;
        let selectedTime;
        if (!selectedTimeValue) {
            selectedTime = autoTime();
        } else {
            let [hours, minutes] = selectedTimeValue.split(":");
            selectedTime = new Date();
            selectedTime.setHours(+hours);
            selectedTime.setMinutes(+minutes);
            selectedTime.setSeconds(0);
            selectedTime.setMilliseconds(0);
        }
        qiangke(selectedTime);
    });

    let rightNowBtn = document.createElement("button");
    rightNowBtn.textContent = "立即抢课";
    rightNowBtn.style = "margin-right:2em";
    rightNowBtn.addEventListener("click", () => {
        qiangke();
    });

    $("h2").append(submitBtn);
    $("h2").append(rightNowBtn);
    $("h2").append(myconsole);

    // Enter键触发抢课
    verifyCode.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            qiangke();
        }
    });
}, 1200);
