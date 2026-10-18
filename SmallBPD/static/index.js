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
var propTeam = ""; // Team <number> for Proposition
var oppTeam = "";  // Team <number> for Opposition
var posDebater1 = ""; // PM
var posDebater2 = ""; // DPM
var negDebater1 = ""; // LO
var negDebater2 = ""; // DLO

// Multi-group debate storage
var matches = [
    {
        motion: "",
        propTeam: "",
        oppTeam: "",
        posDebater1: "",
        posDebater2: "",
        negDebater1: "",
        negDebater2: ""
    }
];
var currentMatchIndex = 0;

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

// Format team title: e.g. "1" -> "Team 1", "Team 1" -> "Team 1"
function formatTeamTitle(val) {
    if (!val || !val.trim()) return "";
    let trimmed = val.trim();
    if (/^team\b/i.test(trimmed)) {
        return "Team" + trimmed.substring(4);
    }
    return "Team " + trimmed;
}

// Helper to render debaters: team header centered at top (if set), role left-aligned, name right-aligned
function renderDebaterList(role1, name1, role2, name2, team) {
    let html = "";
    if (team && team.trim()) {
        html += '<div class="team-header">' + formatTeamTitle(team) + '</div>';
    }
    html +=
        '<div class="debater-row">' +
            '<span class="debater-role">' + role1 + '</span>' +
            '<span class="debater-name">' + (name1 ? name1 : '') + '</span>' +
        '</div>' +
        '<div class="debater-row">' +
            '<span class="debater-role">' + role2 + '</span>' +
            '<span class="debater-name">' + (name2 ? name2 : '') + '</span>' +
        '</div>';
    return html;
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

    // Debater lists: role left-aligned, name right-aligned; both boxes include centered Team <number>
    document.getElementById("nameListp").innerHTML = renderDebaterList("PM", posDebater1, "DPM", posDebater2, propTeam);
    document.getElementById("nameListn").innerHTML = renderDebaterList("LO", negDebater1, "DLO", negDebater2, oppTeam);

    refreshStage();
    refreshTimer();
    updateMatchUI();
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

// Swap PM and DPM positions
function swapPropDebaters() {
    let temp = posDebater1;
    posDebater1 = posDebater2;
    posDebater2 = temp;

    document.getElementById("nameListp").innerHTML = renderDebaterList("PM", posDebater1, "DPM", posDebater2, propTeam);
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap LO and DLO positions
function swapOppDebaters() {
    let temp = negDebater1;
    negDebater1 = negDebater2;
    negDebater2 = temp;

    document.getElementById("nameListn").innerHTML = renderDebaterList("LO", negDebater1, "DLO", negDebater2, oppTeam);
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Exchange sides: swap debaters and teams between Prop and Oppo
function exchangeSides() {
    let temp1 = posDebater1;
    let temp2 = posDebater2;
    let tempTeam = propTeam;

    posDebater1 = negDebater1;
    posDebater2 = negDebater2;
    propTeam = oppTeam;

    negDebater1 = temp1;
    negDebater2 = temp2;
    oppTeam = tempTeam;

    document.getElementById("nameListp").innerHTML = renderDebaterList("PM", posDebater1, "DPM", posDebater2, propTeam);
    document.getElementById("nameListn").innerHTML = renderDebaterList("LO", negDebater1, "DLO", negDebater2, oppTeam);

    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Read settings from modal inputs
function readInformation() {
    syncStateFromInputs();
    saveCurrentMatchFromState();
    $('.ui.modal').modal('hide');
    initialize();
}

// Synchronize state variables from modal input elements
function syncStateFromInputs() {
    let tEl = document.getElementById("title");
    let propTeamEl = document.getElementById("propTeam");
    let oppTeamEl = document.getElementById("oppTeam");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");

    if (tEl) motion = tEl.value.trim();
    if (propTeamEl) propTeam = propTeamEl.value.trim();
    if (oppTeamEl) oppTeam = oppTeamEl.value.trim();
    if (p1El) posDebater1 = p1El.value.trim();
    if (p2El) posDebater2 = p2El.value.trim();
    if (n1El) negDebater1 = n1El.value.trim();
    if (n2El) negDebater2 = n2El.value.trim();
}

// Synchronize modal input elements from state variables
function syncInputsFromState() {
    let tEl = document.getElementById("title");
    let propTeamEl = document.getElementById("propTeam");
    let oppTeamEl = document.getElementById("oppTeam");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");

    if (tEl) tEl.value = motion || "";
    if (propTeamEl) propTeamEl.value = propTeam || "";
    if (oppTeamEl) oppTeamEl.value = oppTeam || "";
    if (p1El) p1El.value = posDebater1 || "";
    if (p2El) p2El.value = posDebater2 || "";
    if (n1El) n1El.value = negDebater1 || "";
    if (n2El) n2El.value = negDebater2 || "";
}

// Synchronize state variables to current match in matches array
function saveCurrentMatchFromState() {
    if (!matches || matches.length === 0) {
        matches = [{ motion: "", propTeam: "", oppTeam: "", posDebater1: "", posDebater2: "", negDebater1: "", negDebater2: "" }];
        currentMatchIndex = 0;
    }
    if (!matches[currentMatchIndex]) {
        matches[currentMatchIndex] = { motion: "", propTeam: "", oppTeam: "", posDebater1: "", posDebater2: "", negDebater1: "", negDebater2: "" };
    }
    matches[currentMatchIndex].motion = motion;
    matches[currentMatchIndex].propTeam = propTeam;
    matches[currentMatchIndex].oppTeam = oppTeam;
    matches[currentMatchIndex].posDebater1 = posDebater1;
    matches[currentMatchIndex].posDebater2 = posDebater2;
    matches[currentMatchIndex].negDebater1 = negDebater1;
    matches[currentMatchIndex].negDebater2 = negDebater2;
}

// Load a specific match from matches array into state variables and modal inputs
function applyMatchToState(idx) {
    if (!matches || matches.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= matches.length) idx = matches.length - 1;
    currentMatchIndex = idx;
    let m = matches[idx];
    motion = m.motion || "";
    propTeam = m.propTeam || "";
    oppTeam = m.oppTeam || "";
    posDebater1 = m.posDebater1 || "";
    posDebater2 = m.posDebater2 || "";
    negDebater1 = m.negDebater1 || "";
    negDebater2 = m.negDebater2 || "";
    syncInputsFromState();
    updateMatchUI();
}

// Update match indicator in UI and button titles
function updateMatchUI() {
    let total = matches && matches.length ? matches.length : 1;
    let current = currentMatchIndex + 1;
    let indicator = document.getElementById("matchIndicator");
    if (indicator) {
        indicator.innerText = "(Group " + current + "/" + total + ")";
    }
    let nextBtn = document.getElementById("nextMatch");
    if (nextBtn) {
        nextBtn.title = "Next Group (" + current + "/" + total + ")";
    }
    let nextModalBtn = document.getElementById("btnNextMatchModal");
    if (nextModalBtn) {
        nextModalBtn.title = "Next Group (" + current + "/" + total + ")";
    }
    let prevBtn = document.getElementById("btnPrevMatch");
    if (prevBtn) {
        prevBtn.title = "Previous Group (" + current + "/" + total + ")";
    }
}

// Switch directly to a selected match
function switchMatch(idx) {
    if (isNaN(idx) || idx === currentMatchIndex) return;
    syncStateFromInputs();
    saveCurrentMatchFromState();
    applyMatchToState(idx);
    initialize();
}

// Add a new blank group in Debate Info
function addNewGroup() {
    syncStateFromInputs();
    saveCurrentMatchFromState();

    let newGroup = {
        motion: "",
        propTeam: "",
        oppTeam: "",
        posDebater1: "",
        posDebater2: "",
        negDebater1: "",
        negDebater2: ""
    };
    matches.push(newGroup);
    applyMatchToState(matches.length - 1);
    initialize();
}

// Delete current group in Debate Info
function deleteCurrentGroup() {
    if (matches.length <= 1) {
        matches = [{
            motion: "",
            propTeam: "",
            oppTeam: "",
            posDebater1: "",
            posDebater2: "",
            negDebater1: "",
            negDebater2: ""
        }];
        applyMatchToState(0);
        initialize();
        return;
    }

    matches.splice(currentMatchIndex, 1);
    if (currentMatchIndex >= matches.length) {
        currentMatchIndex = matches.length - 1;
    }
    applyMatchToState(currentMatchIndex);
    initialize();
}

// Switch to next debate group
function nextMatch() {
    syncStateFromInputs();
    saveCurrentMatchFromState();

    if (currentMatchIndex < matches.length - 1) {
        applyMatchToState(currentMatchIndex + 1);
        initialize();
    }
}

// Switch to previous debate group (in Settings)
function prevMatch() {
    syncStateFromInputs();
    saveCurrentMatchFromState();

    if (currentMatchIndex > 0) {
        applyMatchToState(currentMatchIndex - 1);
        initialize();
    }
}

// Reset timer for current match from Settings modal
function resetCurrentMatch() {
    initialize();
    let btn = document.getElementById("reset");
    if (btn) {
        let origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="check icon"></i>';
        btn.classList.add("green");
        btn.title = "Timer Reset!";
        setTimeout(function () {
            btn.innerHTML = origHtml;
            btn.classList.remove("green");
            btn.title = "Reset Timer";
        }, 1200);
    }
}

function isMatchHeader(line) {
    let clean = line.replace(/^[#\*\-=\[\]\s]+|[#\*\-=\[\]\s:]+$/g, "").trim();
    return /^(?:match|group|round|game|set)\b/i.test(clean) ||
           /^第\s*[0-9一二三四五六七八九十]+\s*[组轮场次]/i.test(clean);
}

function isSeparator(line) {
    return /^[-=_*]{3,}$/.test(line.trim());
}

// Parse configuration text supporting multiple matches/groups
function parseMultiConfig(rawText) {
    if (!rawText) return [];
    let lines = rawText.split(/\r?\n/);
    let result = [];
    let cur = { motion: "", propTeam: "", oppTeam: "", posDebater1: "", posDebater2: "", negDebater1: "", negDebater2: "" };
    let curHasData = false;

    function pushCurrent() {
        if (curHasData || cur.motion || cur.propTeam || cur.oppTeam || cur.posDebater1 || cur.posDebater2 || cur.negDebater1 || cur.negDebater2) {
            result.push(cur);
            cur = { motion: "", propTeam: "", oppTeam: "", posDebater1: "", posDebater2: "", negDebater1: "", negDebater2: "" };
            curHasData = false;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (isSeparator(line) || isMatchHeader(line)) {
            pushCurrent();
            continue;
        }

        let sepIdx = line.search(/[:=：]/);
        if (sepIdx === -1) continue;
        let key = line.substring(0, sepIdx).trim().toLowerCase();
        let val = line.substring(sepIdx + 1).trim();

        let field = null;
        if (key.indexOf("motion") !== -1 || key.indexOf("topic") !== -1 || key === "辩题" || key === "辩题名称" || key === "title") {
            field = "motion";
        } else if (key.indexOf("opp team") !== -1 || key.indexOf("oppo team") !== -1 || key.indexOf("oppteam") !== -1 || key.indexOf("oppoteam") !== -1 || key.indexOf("team opp") !== -1 || key === "反方队伍" || key === "反方队号") {
            field = "oppTeam";
        } else if (key.indexOf("prop team") !== -1 || key.indexOf("propteam") !== -1 || key.indexOf("team prop") !== -1 || key === "正方队伍" || key === "正方队号") {
            field = "propTeam";
        } else if (key === "team" || key.indexOf("team") !== -1 || key === "队伍" || key === "队号") {
            if (cur.propTeam || cur.posDebater1) {
                field = "oppTeam";
            } else {
                field = "propTeam";
            }
        } else if (key === "pm" || key.indexOf("prime minister") !== -1 || key.indexOf("prop 1") !== -1 || key.indexOf("prop1") !== -1 || key === "正方一辩" || key === "正一") {
            field = "posDebater1";
        } else if (key === "dpm" || key.indexOf("deputy prime minister") !== -1 || key.indexOf("prop 2") !== -1 || key.indexOf("prop2") !== -1 || key === "正方二辩" || key === "正二") {
            field = "posDebater2";
        } else if (key === "lo" || key.indexOf("leader of opposition") !== -1 || key.indexOf("opp 1") !== -1 || key.indexOf("opp1") !== -1 || key === "反方一辩" || key === "反一") {
            field = "negDebater1";
        } else if (key === "dlo" || key.indexOf("deputy leader of opposition") !== -1 || key.indexOf("opp 2") !== -1 || key.indexOf("opp2") !== -1 || key === "反方二辩" || key === "反二") {
            field = "negDebater2";
        }

        if (field) {
            if (cur[field] && cur[field] !== "") {
                pushCurrent();
            }
            cur[field] = val;
            curHasData = true;
        }
    }
    pushCurrent();
    return result;
}

// Load configuration from textarea (supports single and multiple groups)
function loadConfig() {
    let textarea = document.getElementById("configInput");
    if (!textarea) return;
    let text = textarea.value.trim();
    if (!text) {
        let btn = document.getElementById("btnLoadConfig");
        if (btn) {
            btn.classList.add("red");
            btn.classList.remove("primary");
            setTimeout(function () {
                btn.classList.remove("red");
                btn.classList.add("primary");
            }, 1000);
        }
        return;
    }
    let parsedMatches = parseMultiConfig(text);
    if (!parsedMatches || parsedMatches.length === 0) {
        let btn = document.getElementById("btnLoadConfig");
        if (btn) {
            btn.classList.add("red");
            btn.classList.remove("primary");
            setTimeout(function () {
                btn.classList.remove("red");
                btn.classList.add("primary");
            }, 1000);
        }
        return;
    }

    matches = parsedMatches;
    currentMatchIndex = 0;
    applyMatchToState(0);
    initialize();

    let btn = document.getElementById("btnLoadConfig");
    if (btn) {
        let origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="check icon"></i>';
        btn.classList.add("green");
        btn.classList.remove("primary");
        btn.title = "Loaded (" + matches.length + " " + (matches.length > 1 ? "groups" : "group") + ")!";
        setTimeout(function () {
            btn.innerHTML = origHtml;
            btn.classList.remove("green");
            btn.classList.add("primary");
            btn.title = "Load Config";
        }, 1500);
    }
}

// Export all configurations into textarea
function exportConfig() {
    syncStateFromInputs();
    saveCurrentMatchFromState();

    let chunks = [];
    for (let i = 0; i < matches.length; i++) {
        let m = matches[i];
        let lines = [];
        if (matches.length > 1) {
            lines.push("Group " + (i + 1) + ":");
        }
        lines.push("Motion: " + (m.motion || ""));
        if (m.propTeam) {
            lines.push("Prop Team: " + m.propTeam);
        }
        lines.push("PM: " + (m.posDebater1 || ""));
        lines.push("DPM: " + (m.posDebater2 || ""));
        if (m.oppTeam) {
            lines.push("Opp Team: " + m.oppTeam);
        }
        lines.push("LO: " + (m.negDebater1 || ""));
        lines.push("DLO: " + (m.negDebater2 || ""));
        chunks.push(lines.join("\n"));
    }
    let text = chunks.join("\n\n");
    let textarea = document.getElementById("configInput");
    if (textarea) {
        textarea.value = text;
        textarea.select();
    }

    let btn = document.getElementById("btnExportConfig");
    if (btn) {
        let origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="check icon"></i>';
        btn.classList.add("green");
        btn.classList.remove("secondary");
        btn.title = "Exported to text box!";
        setTimeout(function () {
            btn.innerHTML = origHtml;
            btn.classList.remove("green");
            btn.classList.add("secondary");
            btn.title = "Export Current";
        }, 1200);
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
    // Populate modal inputs and match state initially
    saveCurrentMatchFromState();
    syncInputsFromState();
    updateMatchUI();

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