const timesup = new Audio("./static/timeup.mp3"); 
const minleft = new Audio("./static/1min.mp3");
var title = "青少年更应该脚踏实地还是仰望星空？";
var stageNow = 0;//第几个阶段
var statuNow = 0;//0：准备 1：正方发言 2：反方发言 3：
var posDebater1 = "卓尔";
var posDebater2 = "卓不群";
var negDebater1 = "卓大气";
var negDebater2 = "卓天下";
var stages = ["正方立论", "反方立论", "正方驳论", "反方驳论", "自由辩论"]
var stageTimes = [70, 180, 180, 180, 150]//秒
var posSecond = 0;
var negSecond = 0;
function initialize() {
    stageNow = 0;
    statuNow = 0;
    document.getElementById("mainHeader").innerHTML = title;
    document.getElementById("nameListp").innerHTML = "正方一辩 " + posDebater1 + "<br>正方二辩 " + posDebater2;
    document.getElementById("nameListn").innerHTML = negDebater1 + " 反方一辩<br>" + negDebater2 + " 反方二辩";
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
    posSecond = 0;
    negSecond = 0;
    refreshStage();
    refreshTimer();
}
function refreshStage() {
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
}
function refreshTimer() {
    let posClock = document.getElementById("clockp");
    let negClock = document.getElementById("clockn");
    var minutes,seconds;

    minutes = (posSecond-(posSecond%60))/60;
    seconds = (posSecond-(60*minutes));
    if(seconds<10&&seconds>=0) {seconds="0"+seconds}
    posClock.innerHTML = minutes+":"+seconds;

    minutes = (negSecond-(negSecond%60))/60;
    seconds = (negSecond-(60*minutes));
    if(seconds<10&&seconds>=0) {seconds="0"+seconds}
    negClock.innerHTML = minutes+":"+seconds;
}
function stageGo() {
    let startButton = document.getElementById("start");
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
    console.info(stageNow);
    posSecond = stageTimes[stageNow];
    console.info(posSecond);
    negSecond = stageTimes[stageNow];
    console.info(negSecond);
    startButton.removeEventListener("click",start);
    startButton.addEventListener("click",positiveLoop);
    refreshStage();
    if (stageNow < (stages.length - 1)) { stageNow++; }
}

function positiveLoop(){
    refreshStage;
    let startButton = document.getElementById("start");
    let pauseButton = document.getElementById("pause");
    let posloop = setInterval(function () {
        posSecond--;
        refreshTimer();
        pauseButton.addEventListener('click', function () {
            clearInterval(posloop);
        });
        if(posSecond == 60) {minleft.play()}
        if(posSecond == 0) {timesup.play()}
        if(posSecond<=0){
            statuNow=2;
            document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
            if (stageNow < (stages.length - 1)) { stageNow++; }
            startButton.removeEventListener("click",positiveLoop);
            startButton.addEventListener("click",negativeLoop);
            clearInterval(posloop)
        }
    }, 1000);
}

function negativeLoop(){
    let startButton = document.getElementById("start");
    let pauseButton = document.getElementById("pause");
    let negloop = setInterval(function () {
        negSecond--;
        refreshTimer();
        pauseButton.addEventListener('click', function () {
            clearInterval(negloop);
        });
        if(negSecond == 60) {minleft.play()}
        if(negSecond == 0) {timesup.play()}
        if(negSecond<=0){
            statuNow = 1;
            startButton.removeEventListener("click",negativeLoop);
            startButton.addEventListener("click",start);
            clearInterval(negloop)
            stageGo;
        }
    }, 1000);
}

function start() {
    statuNow = 1;
    stageGo();
}