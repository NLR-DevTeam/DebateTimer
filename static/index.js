var title = "青少年更应该脚踏实地还是仰望星空？";
var stageNow = 0;//第几个阶段
var statuNow = 0;//0：准备 1：正方发言 2：反方发言 3：
var posDebater1 = "卓尔";
var posDebater2 = "卓不群";
var negDebater1 = "卓大气";
var negDebater2 = "卓天下";
var stages = ["正方立论", "反方立论", "正方驳论", "反方驳论", "自由辩论"]
var stageTimes = [180, 180, 180, 180, 150]//秒
var posSecond = 0;
var negSecond = 0;
let posClock = document.getElementById("clockp");
let negClock = document.getElementById("clockn");
let startButton = document.getElementById("start");
let pauseButton = document.getElementById("pause");
function initialize() {
    stageNow = 0;
    statuNow = 0;
    document.getElementById("mainHeader").innerHTML = title;
    document.getElementById("nameListp").innerHTML = "正方一辩 " + posDebater1 + "<br>正方二辩 " + posDebater2;
    document.getElementById("nameListn").innerHTML = negDebater1 + " 反方一辩<br>" + negDebater2 + " 反方二辩";
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
}
function refreshTimer() {
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
    document.getElementById("stage").innerHTML = "当前环节：" + stages[stageNow];
    var minutes,seconds;
    posSecond = stageTimes[stageNow];
    negSecond = stageTimes[stageNow];
    let posloop = setInterval(function () {
            posSecond--;
            refreshTimer();
            pauseButton.addEventListener('click', function () {
                clearInterval(loop);
            });
            if(posSecond<=0){
                clearInterval(loop)
            }
        }, 1000);
        /**let negloop = setInterval(function () {
            negSecond--;
            minutes = (negSecond-(negSecond%60))/60;
            seconds = (negSecond-(60*minutes));
            if(seconds<10&&seconds>=0) {seconds="0"+seconds}
            negClock.innerHTML = minutes+":"+seconds;
            console.info(negSecond);
            pauseButton.addEventListener('click', function () {
                clearInterval(loop);
            });
            if(posSecond==0){
                clearInterval(loop)
            }
        }, 1000);**/
    if (stageNow < (stages.length - 1)) { stageNow++; }
}
function start() {
    stageGo();
}
function pause() {

}