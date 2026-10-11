// Resolve script directory dynamically to prevent path issues across different URL routing
const SCRIPT_BASE = (function () {
    let scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        let src = scripts[i].src || '';
        if (src.indexOf('index.js') !== -1) {
            return src.substring(0, src.lastIndexOf('/') + 1);
        }
    }
    return './static/';
})();

const timesup = new Audio(SCRIPT_BASE + "timeup.mp3");
const minleft = new Audio(SCRIPT_BASE + "1min.mp3");

// Unlock audio playback within user gesture context
function unlockAudio() {
    try {
        timesup.load();
        minleft.load();
    } catch (e) {
        console.warn("Audio preload error:", e);
    }
}

// Safely play audio resetting current play position
function playAudio(audio) {
    if (!audio) return;
    try {
        audio.pause();
        audio.currentTime = 0;
        let p = audio.play();
        if (p && p.catch) {
            p.catch(function (err) {
                console.warn("Audio play blocked/failed:", err);
            });
        }
    } catch (e) {
        console.warn("Audio play exception:", e);
    }
}

var motion = "";
var propStance = "";
var oppStance = "";
var posDebater1 = ""; // PM
var posDebater2 = ""; // DPM
var negDebater1 = ""; // LO
var negDebater2 = ""; // DLO

// Format: 2 teams, PM -> LO -> DPM -> DLO, 3 minutes per speech, no free debate
var stages = [
    { role: "PM", name: "PM Speech", team: "prop", time: 180 },
    { role: "LO", name: "LO Speech", team: "opp", time: 180 },
    { role: "DPM", name: "DPM Speech", team: "prop", time: 180 },
    { role: "DLO", name: "DLO Speech", team: "opp", time: 180 }
];

var stageNow = 0;
var currentSeconds = 180;
var isRunning = false;
var timerLoop = null;

// Format motion hint into "This house supports/opposes that <content>."
function formatMotionText(baseText, content) {
    if (!content || content.trim() === "") {
        return baseText + "...";
    }
    let trimmed = content.trim();
    if (!/[.!?。！？]$/.test(trimmed)) {
        trimmed += ".";
    }
    return baseText + " " + trimmed;
}

// Refresh motion hints on page (below fixed Proposition and Opposition titles)
function refreshMotionHints() {
    let propHint = document.getElementById("motionProp");
    let oppHint = document.getElementById("motionOpp");

    let propContent = propStance && propStance.trim() !== "" ? propStance.trim() : motion;
    let oppContent = oppStance && oppStance.trim() !== "" ? oppStance.trim() : motion;

    if (propHint) {
        propHint.innerHTML = formatMotionText("This house supports that", propContent);
    }
    if (oppHint) {
        oppHint.innerHTML = formatMotionText("This house agrees that", oppContent);
    }
}

// Helper to render debaters: role left-aligned, name right-aligned
function renderDebaterList(role1, name1, role2, name2) {
    return (
        '<div class="debater-row">' +
            '<span class="debater-role">' + role1 + '</span>' +
            '<span class="debater-name">' + (name1 ? name1 : '') + '</span>' +
        '</div>' +
        '<div class="debater-row">' +
            '<span class="debater-role">' + role2 + '</span>' +
            '<span class="debater-name">' + (name2 ? name2 : '') + '</span>' +
        '</div>'
    );
}

// Initialize and reset
function initialize() {
    if (timerLoop) {
        clearInterval(timerLoop);
        timerLoop = null;
    }
    isRunning = false;
    stageNow = 0;
    currentSeconds = stages[0].time;

    // Header title: show motion if provided, else "Debate Timer"
    let headerText = motion && motion.trim() !== "" ? motion.trim() : "Debate Timer";
    let spanEl = document.getElementById("mainHeaderText");
    let headerEl = document.getElementById("mainHeader");
    if (spanEl) {
        spanEl.innerHTML = headerText;
    } else if (headerEl) {
        headerEl.innerHTML = headerText;
    }
    adjustHeaderWidth();

    // Debater lists: role left-aligned, name right-aligned
    document.getElementById("nameListp").innerHTML = renderDebaterList("PM", posDebater1, "DPM", posDebater2);
    document.getElementById("nameListn").innerHTML = renderDebaterList("LO", negDebater1, "DLO", negDebater2);

    refreshMotionHints();
    refreshStage();
    refreshTimer();
}

// Automatically shrinkwrap header box around multiline text
function adjustHeaderWidth() {
    let header = document.getElementById("mainHeader");
    let textSpan = document.getElementById("mainHeaderText") || header;
    if (!header || !textSpan) return;

    // Reset width to fit-content first so browser lays out naturally up to max-width
    header.style.width = "fit-content";
    header.style.maxWidth = "88%";

    requestAnimationFrame(function () {
        try {
            let range = document.createRange();
            range.selectNodeContents(textSpan);
            let rects = range.getClientRects();

            if (rects && rects.length > 0) {
                let maxLineWidth = 0;
                for (let i = 0; i < rects.length; i++) {
                    if (rects[i].width > maxLineWidth) {
                        maxLineWidth = rects[i].width;
                    }
                }
                if (maxLineWidth > 0) {
                    let style = window.getComputedStyle(header);
                    let pl = parseFloat(style.paddingLeft) || 20;
                    let pr = parseFloat(style.paddingRight) || 20;
                    // Add 4px buffer to prevent rounding issues from re-triggering wrap
                    let idealWidth = Math.ceil(maxLineWidth + pl + pr + 4);
                    header.style.width = idealWidth + "px";
                }
            }
        } catch (e) {
            console.warn("adjustHeaderWidth error:", e);
        }
    });
}

// Start timer
function start() {
    unlockAudio();
    if (stageNow >= stages.length) {
        return;
    }
    if (isRunning) {
        return;
    }
    isRunning = true;
    timerLoop = setInterval(function () {
        currentSeconds--;
        refreshTimer();
        if (currentSeconds === 30) {
            playAudio(minleft);
        }
        if (currentSeconds === 0) {
            playAudio(timesup);
        }
        if (currentSeconds <= 0) {
            clearInterval(timerLoop);
            timerLoop = null;
            isRunning = false;
            stageNow++;
            if (stageNow < stages.length) {
                currentSeconds = stages[stageNow].time;
                refreshStage();
                refreshTimer();
            } else {
                document.getElementById("stage").innerHTML = "Stage: Finished";
                refreshTimer();
            }
        }
    }, 1000);
}

// Pause timer
function pause() {
    if (isRunning) {
        clearInterval(timerLoop);
        timerLoop = null;
        isRunning = false;
    }
}

// Skip current stage
function skipStage() {
    unlockAudio();
    if (stageNow >= stages.length) {
        return;
    }
    if (timerLoop) {
        clearInterval(timerLoop);
        timerLoop = null;
    }
    isRunning = false;
    playAudio(timesup); // Sound chime to signal stage skipped
    stageNow++;
    if (stageNow < stages.length) {
        currentSeconds = stages[stageNow].time;
        refreshStage();
        refreshTimer();
    } else {
        document.getElementById("stage").innerHTML = "Stage: Finished";
        refreshTimer();
    }
}

// Read settings from modal inputs
function readInformation() {
    syncStateFromInputs();
    $('.ui.modal').modal('hide');
    initialize();
}

// Synchronize state variables from modal input elements
function syncStateFromInputs() {
    let tEl = document.getElementById("title");
    let psEl = document.getElementById("propStance");
    let osEl = document.getElementById("oppStance");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");

    if (tEl) motion = tEl.value.trim();
    if (psEl) propStance = psEl.value.trim();
    if (osEl) oppStance = osEl.value.trim();
    if (p1El) posDebater1 = p1El.value.trim();
    if (p2El) posDebater2 = p2El.value.trim();
    if (n1El) negDebater1 = n1El.value.trim();
    if (n2El) negDebater2 = n2El.value.trim();
}

// Synchronize modal input elements from state variables
function syncInputsFromState() {
    let tEl = document.getElementById("title");
    let psEl = document.getElementById("propStance");
    let osEl = document.getElementById("oppStance");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");

    if (tEl) tEl.value = motion || "";
    if (psEl) psEl.value = propStance || "";
    if (osEl) osEl.value = oppStance || "";
    if (p1El) p1El.value = posDebater1 || "";
    if (p2El) p2El.value = posDebater2 || "";
    if (n1El) n1El.value = negDebater1 || "";
    if (n2El) n2El.value = negDebater2 || "";
}

// Parse configuration text
function parseConfigText(rawText) {
    if (!rawText) return {};
    let lines = rawText.split(/\r?\n/);
    let result = {};
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        let sepIdx = line.search(/[:=]/);
        if (sepIdx === -1) continue;
        let key = line.substring(0, sepIdx).trim().toLowerCase();
        let val = line.substring(sepIdx + 1).trim();

        if (key.indexOf('motion') !== -1 || key.indexOf('topic') !== -1 || key === '辩题') {
            result.motion = val;
        } else if (key.indexOf('prop stance') !== -1 || key === 'proposition' || key === 'prop' || key === '正方') {
            result.propStance = val;
        } else if (key.indexOf('opp stance') !== -1 || key === 'opposition' || key === 'opp' || key === '反方') {
            result.oppStance = val;
        } else if (key === 'pm' || key.indexOf('prime minister') !== -1 || key.indexOf('prop 1') !== -1 || key.indexOf('prop1') !== -1 || key === '正方一辩') {
            result.posDebater1 = val;
        } else if (key === 'dpm' || key.indexOf('deputy prime minister') !== -1 || key.indexOf('prop 2') !== -1 || key.indexOf('prop2') !== -1 || key === '正方二辩') {
            result.posDebater2 = val;
        } else if (key === 'lo' || key.indexOf('leader of opposition') !== -1 || key.indexOf('opp 1') !== -1 || key.indexOf('opp1') !== -1 || key === '反方一辩') {
            result.negDebater1 = val;
        } else if (key === 'dlo' || key.indexOf('deputy leader of opposition') !== -1 || key.indexOf('opp 2') !== -1 || key.indexOf('opp2') !== -1 || key === '反方二辩') {
            result.negDebater2 = val;
        }
    }
    return result;
}

// Load configuration from textarea
function loadConfig() {
    let textarea = document.getElementById("configInput");
    if (!textarea) return;
    let text = textarea.value.trim();
    if (!text) {
        alert("Please enter configuration text first.");
        return;
    }
    let parsed = parseConfigText(text);

    if (parsed.motion !== undefined) motion = parsed.motion;
    if (parsed.propStance !== undefined) propStance = parsed.propStance;
    if (parsed.oppStance !== undefined) oppStance = parsed.oppStance;
    if (parsed.posDebater1 !== undefined) posDebater1 = parsed.posDebater1;
    if (parsed.posDebater2 !== undefined) posDebater2 = parsed.posDebater2;
    if (parsed.negDebater1 !== undefined) negDebater1 = parsed.negDebater1;
    if (parsed.negDebater2 !== undefined) negDebater2 = parsed.negDebater2;

    syncInputsFromState();
    initialize();

    let btn = document.getElementById("btnLoadConfig");
    if (btn) {
        let originalText = btn.innerText;
        btn.innerText = "Loaded!";
        btn.classList.add("green");
        btn.classList.remove("primary");
        setTimeout(function () {
            btn.innerText = originalText;
            btn.classList.remove("green");
            btn.classList.add("primary");
        }, 1500);
    }
}

// Export current configuration into textarea
function exportConfig() {
    syncStateFromInputs();
    let lines = [];
    lines.push("Motion: " + (motion || ""));
    if (propStance && propStance !== motion) {
        lines.push("Proposition: " + propStance);
    }
    if (oppStance && oppStance !== motion) {
        lines.push("Opposition: " + oppStance);
    }
    lines.push("PM: " + (posDebater1 || ""));
    lines.push("DPM: " + (posDebater2 || ""));
    lines.push("LO: " + (negDebater1 || ""));
    lines.push("DLO: " + (negDebater2 || ""));
    let text = lines.join("\n");
    let textarea = document.getElementById("configInput");
    if (textarea) {
        textarea.value = text;
        textarea.select();
    }
}

// Refresh stage text
function refreshStage() {
    if (stageNow < stages.length) {
        document.getElementById("stage").innerHTML = "Stage: " + stages[stageNow].name;
    } else {
        document.getElementById("stage").innerHTML = "Stage: Finished";
    }
}

// Format seconds into M:SS
function formatTime(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    return minutes + ":" + seconds;
}

// Refresh clock displays
function refreshTimer() {
    let posClock = document.getElementById("clockp");
    let negClock = document.getElementById("clockn");
    if (stageNow >= stages.length) {
        posClock.innerHTML = "0:00";
        negClock.innerHTML = "0:00";
        return;
    }
    let currentTeam = stages[stageNow].team;
    if (currentTeam === "prop") {
        posClock.innerHTML = formatTime(currentSeconds);
        negClock.innerHTML = "0:00";
    } else {
        posClock.innerHTML = "0:00";
        negClock.innerHTML = formatTime(currentSeconds);
    }
}

// Background setting
function setBackground() {
    let body = document.getElementById("body");
    let input = document.getElementById("bgSetting").value.trim();
    if (/#[\da-f]{6}/i.test(input)) {
        body.style.backgroundImage = "none";
        body.style.backgroundColor = input;
    } else if (input !== "") {
        body.style.backgroundImage = "url(" + input + ")";
        body.style.backgroundColor = "";
    }
}

// Event listeners
$(document).ready(function () {
    // Populate modal inputs initially
    syncInputsFromState();

    $("#start").click(function () {
        start();
    });
    $("#pause").click(function () {
        pause();
    });
    $(document).keydown(function (event) {
        if (event.keyCode === 13) {
            start();
        } else if (event.keyCode === 32) {
            var target = event.target;
            var tag = target && target.tagName ? target.tagName.toUpperCase() : "";
            if (tag !== "INPUT" && tag !== "TEXTAREA") {
                event.preventDefault();
                if (isRunning) {
                    pause();
                } else {
                    start();
                }
            }
        }
    });

    // Unlock audio on any click in body
    document.addEventListener("click", function () {
        unlockAudio();
    }, { once: true });

    // Ensure header width shrinkwraps properly on resize and font load
    $(window).on("resize", function () {
        adjustHeaderWidth();
    });

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
            adjustHeaderWidth();
        });
    }

    setTimeout(function () {
        adjustHeaderWidth();
    }, 100);
});