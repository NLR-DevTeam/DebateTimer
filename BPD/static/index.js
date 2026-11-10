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
var ogTeam = ""; // Team <number> for Opening Government
var cgTeam = ""; // Team <number> for Closing Government
var ooTeam = ""; // Team <number> for Opening Opposition
var coTeam = ""; // Team <number> for Closing Opposition
var pmDebater = "";  // PM
var dpmDebater = ""; // DPM
var gmDebater = "";  // GM
var gwDebater = "";  // GW
var loDebater = "";  // LO
var dloDebater = ""; // DLO
var omDebater = "";  // OM
var owDebater = "";  // OW

function createEmptyMatch() {
    return {
        motion: "",
        ogTeam: "",
        cgTeam: "",
        ooTeam: "",
        coTeam: "",
        pmDebater: "",
        dpmDebater: "",
        gmDebater: "",
        gwDebater: "",
        loDebater: "",
        dloDebater: "",
        omDebater: "",
        owDebater: ""
    };
}

// Multi-group debate storage
var matches = [createEmptyMatch()];
var currentMatchIndex = 0;

// Format: 4 teams, 8 speakers (PM -> LO -> DPM -> DLO -> GM -> OM -> GW -> OW), 5 minutes per speech
var stages = [
    { role: "PM", name: "PM Speech", team: "prop", time: 300 },
    { role: "LO", name: "LO Speech", team: "opp", time: 300 },
    { role: "DPM", name: "DPM Speech", team: "prop", time: 300 },
    { role: "DLO", name: "DLO Speech", team: "opp", time: 300 },
    { role: "GM", name: "GM Speech", team: "prop", time: 300 },
    { role: "OM", name: "OM Speech", team: "opp", time: 300 },
    { role: "GW", name: "GW Speech", team: "prop", time: 300 },
    { role: "OW", name: "OW Speech", team: "opp", time: 300 }
];

var stageNow = 0;
var currentSeconds = 300;
var isRunning = false;
var timerLoop = null;

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Format team title: "1" -> "Team 1", "Team 1" -> "Team 1"
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
        html += '<div class="team-header">' + escapeHtml(formatTeamTitle(team)) + '</div>';
    }
    html +=
        '<div class="debater-row">' +
            '<span class="debater-role">' + escapeHtml(role1) + '</span>' +
            '<span class="debater-name">' + escapeHtml(name1 || '') + '</span>' +
        '</div>' +
        '<div class="debater-row">' +
            '<span class="debater-role">' + escapeHtml(role2) + '</span>' +
            '<span class="debater-name">' + escapeHtml(name2 || '') + '</span>' +
        '</div>';
    return html;
}

function renderAllDebaterBoxes() {
    let ogEl = document.getElementById("nameListOG");
    let cgEl = document.getElementById("nameListCG");
    let ooEl = document.getElementById("nameListOO");
    let coEl = document.getElementById("nameListCO");

    if (ogEl) ogEl.innerHTML = renderDebaterList("PM", pmDebater, "DPM", dpmDebater, ogTeam);
    if (cgEl) cgEl.innerHTML = renderDebaterList("GM", gmDebater, "GW", gwDebater, cgTeam);
    if (ooEl) ooEl.innerHTML = renderDebaterList("LO", loDebater, "DLO", dloDebater, ooTeam);
    if (coEl) coEl.innerHTML = renderDebaterList("OM", omDebater, "OW", owDebater, coTeam);
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
        spanEl.textContent = headerText;
    } else if (headerEl) {
        headerEl.textContent = headerText;
    }
    adjustHeaderWidth();

    // Debater lists: 4 teams across Prop (OG, CG) and Oppo (OO, CO)
    renderAllDebaterBoxes();

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
function swapOGDebaters() {
    let temp = pmDebater;
    pmDebater = dpmDebater;
    dpmDebater = temp;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap GM and GW positions
function swapCGDebaters() {
    let temp = gmDebater;
    gmDebater = gwDebater;
    gwDebater = temp;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap LO and DLO positions
function swapOODebaters() {
    let temp = loDebater;
    loDebater = dloDebater;
    dloDebater = temp;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap OM and OW positions
function swapCODebaters() {
    let temp = omDebater;
    omDebater = owDebater;
    owDebater = temp;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap Opening Government (PM/DPM) and Closing Government (GM/GW) teams
function swapPropTeams() {
    let tmpTeam = ogTeam;
    let tmpFirst = pmDebater;
    let tmpSecond = dpmDebater;

    ogTeam = cgTeam;
    pmDebater = gmDebater;
    dpmDebater = gwDebater;

    cgTeam = tmpTeam;
    gmDebater = tmpFirst;
    gwDebater = tmpSecond;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Swap Opening Opposition (LO/DLO) and Closing Opposition (OM/OW) teams
function swapOppTeams() {
    let tmpTeam = ooTeam;
    let tmpFirst = loDebater;
    let tmpSecond = dloDebater;

    ooTeam = coTeam;
    loDebater = omDebater;
    dloDebater = owDebater;

    coTeam = tmpTeam;
    omDebater = tmpFirst;
    owDebater = tmpSecond;

    renderAllDebaterBoxes();
    syncInputsFromState();
    saveCurrentMatchFromState();
}

// Exchange sides: swap Proposition (OG & CG) and Opposition (OO & CO) teams and debaters
function exchangeSides() {
    let tmpOgTeam = ogTeam;
    let tmpCgTeam = cgTeam;
    let tmpPm = pmDebater;
    let tmpDpm = dpmDebater;
    let tmpGm = gmDebater;
    let tmpGw = gwDebater;

    ogTeam = ooTeam;
    cgTeam = coTeam;
    pmDebater = loDebater;
    dpmDebater = dloDebater;
    gmDebater = omDebater;
    gwDebater = owDebater;

    ooTeam = tmpOgTeam;
    coTeam = tmpCgTeam;
    loDebater = tmpPm;
    dloDebater = tmpDpm;
    omDebater = tmpGm;
    owDebater = tmpGw;

    renderAllDebaterBoxes();
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
    let ogTeamEl = document.getElementById("ogTeam");
    let cgTeamEl = document.getElementById("cgTeam");
    let ooTeamEl = document.getElementById("ooTeam");
    let coTeamEl = document.getElementById("coTeam");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let p3El = document.getElementById("pos3");
    let p4El = document.getElementById("pos4");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");
    let n3El = document.getElementById("neg3");
    let n4El = document.getElementById("neg4");

    if (tEl) motion = tEl.value.trim();
    if (ogTeamEl) ogTeam = ogTeamEl.value.trim();
    if (cgTeamEl) cgTeam = cgTeamEl.value.trim();
    if (ooTeamEl) ooTeam = ooTeamEl.value.trim();
    if (coTeamEl) coTeam = coTeamEl.value.trim();
    if (p1El) pmDebater = p1El.value.trim();
    if (p2El) dpmDebater = p2El.value.trim();
    if (p3El) gmDebater = p3El.value.trim();
    if (p4El) gwDebater = p4El.value.trim();
    if (n1El) loDebater = n1El.value.trim();
    if (n2El) dloDebater = n2El.value.trim();
    if (n3El) omDebater = n3El.value.trim();
    if (n4El) owDebater = n4El.value.trim();
}

// Synchronize modal input elements from state variables
function syncInputsFromState() {
    let tEl = document.getElementById("title");
    let ogTeamEl = document.getElementById("ogTeam");
    let cgTeamEl = document.getElementById("cgTeam");
    let ooTeamEl = document.getElementById("ooTeam");
    let coTeamEl = document.getElementById("coTeam");
    let p1El = document.getElementById("pos1");
    let p2El = document.getElementById("pos2");
    let p3El = document.getElementById("pos3");
    let p4El = document.getElementById("pos4");
    let n1El = document.getElementById("neg1");
    let n2El = document.getElementById("neg2");
    let n3El = document.getElementById("neg3");
    let n4El = document.getElementById("neg4");

    if (tEl) tEl.value = motion || "";
    if (ogTeamEl) ogTeamEl.value = ogTeam || "";
    if (cgTeamEl) cgTeamEl.value = cgTeam || "";
    if (ooTeamEl) ooTeamEl.value = ooTeam || "";
    if (coTeamEl) coTeamEl.value = coTeam || "";
    if (p1El) p1El.value = pmDebater || "";
    if (p2El) p2El.value = dpmDebater || "";
    if (p3El) p3El.value = gmDebater || "";
    if (p4El) p4El.value = gwDebater || "";
    if (n1El) n1El.value = loDebater || "";
    if (n2El) n2El.value = dloDebater || "";
    if (n3El) n3El.value = omDebater || "";
    if (n4El) n4El.value = owDebater || "";
}

// Synchronize state variables to current match in matches array
function saveCurrentMatchFromState() {
    if (!matches || matches.length === 0) {
        matches = [createEmptyMatch()];
        currentMatchIndex = 0;
    }
    if (!matches[currentMatchIndex]) {
        matches[currentMatchIndex] = createEmptyMatch();
    }
    matches[currentMatchIndex].motion = motion;
    matches[currentMatchIndex].ogTeam = ogTeam;
    matches[currentMatchIndex].cgTeam = cgTeam;
    matches[currentMatchIndex].ooTeam = ooTeam;
    matches[currentMatchIndex].coTeam = coTeam;
    matches[currentMatchIndex].pmDebater = pmDebater;
    matches[currentMatchIndex].dpmDebater = dpmDebater;
    matches[currentMatchIndex].gmDebater = gmDebater;
    matches[currentMatchIndex].gwDebater = gwDebater;
    matches[currentMatchIndex].loDebater = loDebater;
    matches[currentMatchIndex].dloDebater = dloDebater;
    matches[currentMatchIndex].omDebater = omDebater;
    matches[currentMatchIndex].owDebater = owDebater;
}

// Load a specific match from matches array into state variables and modal inputs
function applyMatchToState(idx) {
    if (!matches || matches.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= matches.length) idx = matches.length - 1;
    currentMatchIndex = idx;
    let m = matches[idx];
    motion = m.motion || "";
    ogTeam = m.ogTeam || "";
    cgTeam = m.cgTeam || "";
    ooTeam = m.ooTeam || "";
    coTeam = m.coTeam || "";
    pmDebater = m.pmDebater || "";
    dpmDebater = m.dpmDebater || "";
    gmDebater = m.gmDebater || "";
    gwDebater = m.gwDebater || "";
    loDebater = m.loDebater || "";
    dloDebater = m.dloDebater || "";
    omDebater = m.omDebater || "";
    owDebater = m.owDebater || "";
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

    matches.push(createEmptyMatch());
    applyMatchToState(matches.length - 1);
    initialize();
}

// Delete current group in Debate Info
function deleteCurrentGroup() {
    if (matches.length <= 1) {
        matches = [createEmptyMatch()];
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
    let cur = createEmptyMatch();
    let curHasData = false;

    function hasAnyMatchData(m) {
        return m.motion || m.ogTeam || m.cgTeam || m.ooTeam || m.coTeam ||
               m.pmDebater || m.dpmDebater || m.gmDebater || m.gwDebater ||
               m.loDebater || m.dloDebater || m.omDebater || m.owDebater;
    }

    function pushCurrent() {
        if (curHasData || hasAnyMatchData(cur)) {
            result.push(cur);
            cur = createEmptyMatch();
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
        } else if (key === "og" || key.indexOf("og team") !== -1 || key.indexOf("ogteam") !== -1 || key.indexOf("team og") !== -1 || key.indexOf("opening gov") !== -1 || key.indexOf("opening prop") !== -1 || key.indexOf("prop 1 team") !== -1 || key.indexOf("prop1 team") !== -1 || key === "正方一队" || key === "正一队") {
            field = "ogTeam";
        } else if (key === "cg" || key.indexOf("cg team") !== -1 || key.indexOf("cgteam") !== -1 || key.indexOf("team cg") !== -1 || key.indexOf("closing gov") !== -1 || key.indexOf("closing prop") !== -1 || key.indexOf("prop 2 team") !== -1 || key.indexOf("prop2 team") !== -1 || key === "正方二队" || key === "正二队") {
            field = "cgTeam";
        } else if (key === "oo" || key.indexOf("oo team") !== -1 || key.indexOf("ooteam") !== -1 || key.indexOf("team oo") !== -1 || key.indexOf("opening opp") !== -1 || key.indexOf("opp 1 team") !== -1 || key.indexOf("oppo 1 team") !== -1 || key.indexOf("opp1 team") !== -1 || key === "反方一队" || key === "反一队") {
            field = "ooTeam";
        } else if (key === "co" || key.indexOf("co team") !== -1 || key.indexOf("coteam") !== -1 || key.indexOf("team co") !== -1 || key.indexOf("closing opp") !== -1 || key.indexOf("opp 2 team") !== -1 || key.indexOf("oppo 2 team") !== -1 || key.indexOf("opp2 team") !== -1 || key === "反方二队" || key === "反二队") {
            field = "coTeam";
        } else if (key.indexOf("prop team") !== -1 || key.indexOf("propteam") !== -1 || key.indexOf("team prop") !== -1 || key === "正方队伍" || key === "正方队号") {
            if (!cur.ogTeam) {
                field = "ogTeam";
            } else if (!cur.cgTeam) {
                field = "cgTeam";
            } else {
                pushCurrent();
                field = "ogTeam";
            }
        } else if (key.indexOf("opp team") !== -1 || key.indexOf("oppo team") !== -1 || key.indexOf("oppteam") !== -1 || key.indexOf("oppoteam") !== -1 || key.indexOf("team opp") !== -1 || key === "反方队伍" || key === "反方队号") {
            if (!cur.ooTeam) {
                field = "ooTeam";
            } else if (!cur.coTeam) {
                field = "coTeam";
            } else {
                pushCurrent();
                field = "ooTeam";
            }
        } else if (key === "team" || key.indexOf("team") !== -1 || key === "队伍" || key === "队号") {
            if (!cur.ogTeam && !cur.pmDebater && !cur.dpmDebater) {
                field = "ogTeam";
            } else if (!cur.cgTeam && !cur.gmDebater && !cur.gwDebater && !cur.loDebater && !cur.ooTeam) {
                field = "cgTeam";
            } else if (!cur.ooTeam) {
                field = "ooTeam";
            } else if (!cur.coTeam) {
                field = "coTeam";
            } else {
                pushCurrent();
                field = "ogTeam";
            }
        } else if (key === "dpm" || key.indexOf("deputy prime minister") !== -1 || key.indexOf("deputy pm") !== -1 || key.indexOf("og 2") !== -1 || key.indexOf("og2") !== -1 || key.indexOf("prop 2") !== -1 || key.indexOf("prop2") !== -1 || key === "正方二辩" || key === "正二") {
            field = "dpmDebater";
        } else if (key === "pm" || key.indexOf("prime minister") !== -1 || key.indexOf("og 1") !== -1 || key.indexOf("og1") !== -1 || key.indexOf("prop 1") !== -1 || key.indexOf("prop1") !== -1 || key === "正方一辩" || key === "正一") {
            field = "pmDebater";
        } else if (key === "gm" || key === "mg" || key.indexOf("government member") !== -1 || key.indexOf("gov member") !== -1 || key.indexOf("member of government") !== -1 || key.indexOf("cg 1") !== -1 || key.indexOf("cg1") !== -1 || key.indexOf("prop 3") !== -1 || key.indexOf("prop3") !== -1 || key === "正方三辩" || key === "正三") {
            field = "gmDebater";
        } else if (key === "gw" || key.indexOf("government whip") !== -1 || key.indexOf("gov whip") !== -1 || key.indexOf("cg 2") !== -1 || key.indexOf("cg2") !== -1 || key.indexOf("prop 4") !== -1 || key.indexOf("prop4") !== -1 || key === "正方四辩" || key === "正四") {
            field = "gwDebater";
        } else if (key === "dlo" || key.indexOf("deputy leader of opposition") !== -1 || key.indexOf("deputy lo") !== -1 || key.indexOf("oo 2") !== -1 || key.indexOf("oo2") !== -1 || key.indexOf("opp 2") !== -1 || key.indexOf("opp2") !== -1 || key === "反方二辩" || key === "反二") {
            field = "dloDebater";
        } else if (key === "lo" || key.indexOf("leader of opposition") !== -1 || key.indexOf("oo 1") !== -1 || key.indexOf("oo1") !== -1 || key.indexOf("opp 1") !== -1 || key.indexOf("opp1") !== -1 || key === "反方一辩" || key === "反一") {
            field = "loDebater";
        } else if (key === "om" || key === "mo" || key.indexOf("opposition member") !== -1 || key.indexOf("opp member") !== -1 || key.indexOf("member of opposition") !== -1 || key.indexOf("co 1") !== -1 || key.indexOf("co1") !== -1 || key.indexOf("opp 3") !== -1 || key.indexOf("opp3") !== -1 || key === "反方三辩" || key === "反三") {
            field = "omDebater";
        } else if (key === "ow" || key.indexOf("opposition whip") !== -1 || key.indexOf("opp whip") !== -1 || key.indexOf("co 2") !== -1 || key.indexOf("co2") !== -1 || key.indexOf("opp 4") !== -1 || key.indexOf("opp4") !== -1 || key === "反方四辩" || key === "反四") {
            field = "owDebater";
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
        if (m.ogTeam) {
            lines.push("OG Team: " + m.ogTeam);
        }
        lines.push("PM: " + (m.pmDebater || ""));
        lines.push("DPM: " + (m.dpmDebater || ""));
        if (m.cgTeam) {
            lines.push("CG Team: " + m.cgTeam);
        }
        lines.push("GM: " + (m.gmDebater || ""));
        lines.push("GW: " + (m.gwDebater || ""));
        if (m.ooTeam) {
            lines.push("OO Team: " + m.ooTeam);
        }
        lines.push("LO: " + (m.loDebater || ""));
        lines.push("DLO: " + (m.dloDebater || ""));
        if (m.coTeam) {
            lines.push("CO Team: " + m.coTeam);
        }
        lines.push("OM: " + (m.omDebater || ""));
        lines.push("OW: " + (m.owDebater || ""));
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
        var target = event.target;
        var tag = target && target.tagName ? target.tagName.toUpperCase() : "";
        if (tag === "INPUT" || tag === "TEXTAREA") {
            return;
        }
        if (event.keyCode === 13) {
            start();
        } else if (event.keyCode === 32) {
            event.preventDefault();
            if (isRunning) {
                pause();
            } else {
                start();
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
