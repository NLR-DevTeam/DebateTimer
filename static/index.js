const timesup = new Audio("./static/timeup.mp3");
const minleft = new Audio("./static/1min.mp3");
var title = "辩论计时器";
var stageNow = 0;//第几个阶段
var statuNow = 0;//0：准备 1：正方发言 2：反方发言
var posTimerGoing = false;
var negTimerGoing = false;
var posDebater1 = "";
var posDebater2 = "";
var negDebater1 = "";
var negDebater2 = "";
var stages = ["正方立论", "反方立论", "正方驳论", "反方驳论", "自由辩论", "自由辩论", "结辩陈词", "结辩陈词"]
var stageTimes = [180, 180, 180, 180, 150, 150, 120, 0, 0]//秒
var posSecond = 0;
var negSecond = 0;
var intervals = [];
let negloop = null;
let posloop = null;
//初始化
function initialize() {
    //读取数据，刷新界面
    stageNow = 0;
    statuNow = 0;
    document.getElementById("mainHeader").innerHTML = title;
    document.getElementById("nameListp").innerHTML = "正方一辩 " + posDebater1 + "<br>正方二辩 " + posDebater2;
    document.getElementById("nameListn").innerHTML = negDebater1 + " 反方一辩<br>" + negDebater2 + " 反方二辩";
    refreshStage();
    for (var i = 0;i<20;i++) {
        clearInterval(i);
    }
    negTimerGoing = false;
    posTimerGoing = false;
    posSecond = 0;
    negSecond = 0;
    refreshStage();
    refreshTimer();
    //交换按钮
    let exchangeButton = document.getElementById("exchange");
    exchangeButton.onclick = function () {
        console.info("exchange activate");
        if (statuNow == 1 && negSecond > 0) {
            statuNow = 2;
            console.info("status edited" + statuNow);
            negativeLoopStart();
            console.info("Negative Loop Start");
            posTimerGoing = false;
            clearInterval(posloop);
        } else if (statuNow == 2 && posSecond > 0) {
            statuNow = 1;
            console.info("status edited" + statuNow);
            positiveLoopStart();
            console.info("Positive Loop Start");
            negTimerGoing = false;
            clearInterval(negloop);
        }
    }
    //暂停按钮
    let pauseButton = document.getElementById("pause");
    pauseButton.addEventListener('click', function () {
        let startButton = document.getElementById("start"); ``
        if (statuNow == 1) {
            startButton.addEventListener("click", positiveLoopStart);
        }
        else if (statuNow == 2) {
            startButton.addEventListener("click", negativeLoopStart);
        }
        negTimerGoing = false;
        posTimerGoing = false;
        for (var i = 0; i < 20; i++) {
            clearInterval(i);
        }
    });
    //绑定键盘
    document.getElementById("start").addEventListener('click', start);
    $(document).keydown(function (event) {
        if (event.keyCode == 32) {
            document.getElementById("exchange").click();
        }
    });
    $(document).keydown(function (event) {
        if (event.keyCode == 13) {
            document.getElementById("start").click();
        }
    });
}

function start() {
    if (posTimerGoing || negTimerGoing) {
        return false;
    }
    statuNow = 1;
    let startButton = document.getElementById("start");
    refreshStage();
    posSecond = stageTimes[stageNow];
    negSecond = stageTimes[stageNow];
    refreshTimer();
    if(stages[stageNow]=="结辩陈词"){
        startButton.removeEventListener("click", start);
        startButton.addEventListener("click", negativeLoopStart); 
        statuNow = 2;
    }else{
        startButton.removeEventListener("click", start);
        startButton.addEventListener("click", positiveLoopStart);   
    }
    refreshStage();
    if (stageNow < (stages.length - 1)) { stageNow++; }
}

function positiveLoopStart() {
    let startButton = document.getElementById("start");
    console.info("Positive Loop");
    startButton.removeEventListener("click", positiveLoopStart);
    posTimerGoing = true;
    posloop = setInterval(function () {
        posSecond--;
        refreshTimer();
        if (posSecond == 30) { minleft.play() }
        if (posSecond == 0) { timesup.play() }
        if (posSecond <= 0) {
            if (negSecond > 0) {
                statuNow = 2;
                refreshStage();
                if (stageNow < (stages.length - 1)) { stageNow++; }
                startButton.addEventListener("click", negativeLoopStart);
                posTimerGoing = false;
                clearInterval(posloop);
            } else {
                statuNow = 1;
                if (stageNow < (stages.length - 1)) { stageNow++; }
                startButton.addEventListener("click", start);
                posTimerGoing = false;
                start();
                clearInterval(posloop);
            }
        }
    }, 1000);
}

function negativeLoopStart() {
    let startButton = document.getElementById("start");
    console.info("Negative Loop");
    startButton.removeEventListener("click", negativeLoopStart);
    negTimerGoing = true;
    negloop = setInterval(function () {
        negSecond--;
        refreshTimer();
        if (negSecond == 30) { minleft.play() }
        if (negSecond == 0) { timesup.play() }
        if (negSecond <= 0) {
            if (posSecond > 0) {
                statuNow = 1;
                startButton.addEventListener("click", positiveLoopStart);
                negTimerGoing = false;
                positiveLoopStart();
                clearInterval(negloop);
            } else {
                statuNow = 1;
                startButton.addEventListener("click", start);
                negTimerGoing = false;
                start();
                clearInterval(negloop);
            }
        }
    }, 1000);
}
//跳过该阶段
function skipStage() {
    if (statuNow == 1 && posSecond > 1) {
        posSecond = 1;
    } else if (statuNow == 2 && negSecond > 1) {
        negSecond = 1;
    }
    refreshTimer();
}
//读取信息
function readInformation() {
    title = document.getElementById("title").value;
    posDebater1 = document.getElementById("pos1").value;
    posDebater2 = document.getElementById("pos2").value;
    negDebater1 = document.getElementById("neg1").value;
    negDebater2 = document.getElementById("neg2").value;
    initialize();
}
//刷新阶段
function refreshStage() {
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
}
//刷新计时器
function refreshTimer() {
    let posClock = document.getElementById("clockp");
    let negClock = document.getElementById("clockn");
    var minutes, seconds;
    if (posSecond >= 0) {
        minutes = (posSecond - (posSecond % 60)) / 60;
        seconds = (posSecond - (60 * minutes));
        if (seconds < 10 && seconds >= 0) { seconds = "0" + seconds }
        posClock.innerHTML = minutes + ":" + seconds;
    }
    if (negSecond >= 0) {
        minutes = (negSecond - (negSecond % 60)) / 60;
        seconds = (negSecond - (60 * minutes));
        if (seconds < 10 && seconds >= 0) { seconds = "0" + seconds }
        negClock.innerHTML = minutes + ":" + seconds;
    }
}