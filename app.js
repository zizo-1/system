// ============================================================
// نظام القادة — التوزيعة وقائمة القادة الآن مقروءة لايف من جوجل شيت
// أي تعديل في الشيت (شيت الأسماء "Sheet1" أو شيت التوزيع "tawzi3at")
// بيتحدث تلقائي هنا كل 30 ثانية، أو فورًا لما تدوس "تحديث من الشيت".
// العرض بقى بالاسم فقط (مش دروب داون) — محدش يقدر يعدل من هنا.
// ============================================================

const SPREADSHEET_ID = "15ZNYbRcTxSLqf0Gqrh6-71Kg1HMa7ZMpVoPOIeXkgng";

const INFO_SHEET_NAME = "INFO";      // شيت الترتيب (leaderboard) — زي ما هو
const LEADERS_SHEET_GID = 0;          // شيت "Sheet1" — قائمة الأسماء + الدرجات
const DIST_SHEET_GID = 1075218155;    // شيت "tawzi3at" — توزيع الـ4 أسابيع

const CSV_INFO_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(INFO_SHEET_NAME)}`;
const CSV_LEADERS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${LEADERS_SHEET_GID}`;
const CSV_DIST_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${DIST_SHEET_GID}`;

const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
// أكواد الأيام زي ما هي مكتوبة في عمود A بشيت التوزيع (بنفس الترتيب اللي فوق)
const DAY_CODES = ["SUN","MON","THU","WED","THR"];

const BUILDINGS = [
  { name:"خارج المبنى", locs:[
    {code:"GATE", label:"البوابة"}, {code:"PATH1", label:"ممر 1"}, {code:"PATH2", label:"ممر 2"},
    {code:"PATH3", label:"ممر 3"}, {code:"WC.M1", label:"حمام رجال 1"}, {code:"WC.M2", label:"حمام رجال 2"},
    {code:"WC.W", label:"حمام سيدات"}, {code:"FRIDGE", label:"الثلاجة"}, {code:"CANTEEN", label:"الكانتين"},
    {code:"B.C.B", label:"ب.ك.ب"}, {code:"LAB1", label:"معمل 1"}, {code:"LAB2", label:"معمل 2"},
  ]},
  { name:"مبنى A", locs:[
    {code:"A.ST1", label:"سلم 1"}, {code:"A.ST2", label:"سلم 2"}, {code:"A.FLR.F", label:"الدور - سيدات"},
    {code:"A.FLR.M", label:"الدور - رجال"}, {code:"A.SV", label:"إشراف"}, {code:"A.LEAD", label:"قائد المبنى", isLeader:true},
  ]},
  { name:"مبنى B", locs:[
    {code:"B.ST", label:"السلم"}, {code:"B.F1.F", label:"دور 1 - سيدات"}, {code:"B.F1.M", label:"دور 1 - رجال"},
    {code:"B.F2.F", label:"دور 2 - سيدات"}, {code:"B.F2.M", label:"دور 2 - رجال"}, {code:"B.LEAD", label:"قائد المبنى", isLeader:true},
  ]},
  { name:"مبنى C", locs:[
    {code:"C.ST1", label:"سلم 1"}, {code:"C.ST2", label:"سلم 2"}, {code:"C.F1.A", label:"دور 1 - أ"},
    {code:"C.F1.B", label:"دور 1 - ب"}, {code:"C.F2.A", label:"دور 2 - أ"}, {code:"C.F2.B", label:"دور 2 - ب"},
    {code:"C.LEAD", label:"قائد المبنى", isLeader:true},
  ]},
];

// ترتيب أعمدة شيت التوزيع (0 = عمود A) — ثابت حسب شكل الشيت الحالي
const COLUMN_MAP = {
  GATE:2, PATH1:3, PATH2:4, PATH3:5, "WC.M1":6, "WC.M2":7, "WC.W":8, FRIDGE:9, CANTEEN:10, "B.C.B":11, LAB1:12, LAB2:13,
  "A.ST1":15, "A.ST2":16, "A.FLR.F":17, "A.FLR.M":18, "A.SV":19, "A.LEAD":20,
  "B.ST":22, "B.F1.F":23, "B.F1.M":24, "B.F2.F":25, "B.F2.M":26, "B.LEAD":27,
  "C.ST1":29, "C.ST2":30, "C.F1.A":31, "C.F1.B":32, "C.F2.A":33, "C.F2.B":34, "C.LEAD":35,
};
const LOTD_COL = 1;
const DAY_COL = 0;

let LEADERS = [];   // بتتملى لايف من شيت Sheet1
let weeks = [];      // بتتملى لايف من شيت التوزيع: [{days:[{lotd,cells}x5]} ...]
let currentWeek = 0;
let currentDay = 0;
let absentSet = new Set();
let currentView = "schedule";
let scheduleLoaded = false;
let scheduleLoading = false;
let scheduleError = null;

function cleanCell(v){
  return String(v == null ? "" : v).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function parseCSVLine(line){
  const out = []; let cur = ""; let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(inQuotes){
      if(ch === '"'){
        if(line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if(ch === '"'){ inQuotes = true; }
      else if(ch === ','){ out.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function splitCSVRows(text){
  return text.split(/\r?\n/).map(parseCSVLine);
}

// ---- قائمة القادة: لايف من شيت Sheet1 (عمود A تحت رأس "NAMES") ----
function parseLeadersSheet(text){
  const rows = splitCSVRows(text);
  let headerIdx = rows.findIndex(r => cleanCell(r[0]).toUpperCase() === "NAMES");
  if(headerIdx < 0) headerIdx = 1;
  const names = [];
  let started = false;
  for(let i = headerIdx + 1; i < rows.length; i++){
    const name = cleanCell(rows[i][0]);
    if(!name){
      if(started) break;   // خلصت قائمة الأسماء
      continue;             // لسه في صفوف عناوين فرعية (زي صف التواريخ) — تخطاها
    }
    started = true;
    names.push(name);
  }
  return names;
}

// ---- توزيع الأسابيع: لايف من شيت tawzi3at ----
// بنكتشف كل أسبوع تلقائيًا: أي 5 صفوف متتالية عمودها الأول SUN,MON,THU,WED,THR
function parseDistributionSheet(text){
  const rows = splitCSVRows(text).filter(r => r.some(c => cleanCell(c) !== ""));
  const weeksOut = [];
  for(let i=0; i<rows.length; i++){
    let matches = true;
    for(let d=0; d<5; d++){
      const row = rows[i+d];
      if(!row || cleanCell(row[DAY_COL]).toUpperCase() !== DAY_CODES[d]){ matches = false; break; }
    }
    if(matches){
      const days = [];
      for(let d=0; d<5; d++){
        const row = rows[i+d];
        const lotd = cleanCell(row[LOTD_COL]);
        const cells = {};
        Object.keys(COLUMN_MAP).forEach(code=>{
          cells[code] = cleanCell(row[COLUMN_MAP[code]]);
        });
        days.push({lotd, cells});
      }
      weeksOut.push({days});
      i += 4;
    }
  }
  return weeksOut;
}

async function fetchScheduleData(){
  scheduleLoading = true;
  scheduleError = null;
  render();
  try{
    const [leadersRes, distRes] = await Promise.all([
      fetch(CSV_LEADERS_URL),
      fetch(CSV_DIST_URL),
    ]);
    if(!leadersRes.ok) throw new Error("تعذر تحميل شيت الأسماء (HTTP " + leadersRes.status + ")");
    if(!distRes.ok) throw new Error("تعذر تحميل شيت التوزيع (HTTP " + distRes.status + ")");

    const leadersText = await leadersRes.text();
    const distText = await distRes.text();

    const names = parseLeadersSheet(leadersText);
    const distWeeks = parseDistributionSheet(distText);

    if(names.length === 0) throw new Error("مفيش أسماء اتقرت من شيت Sheet1");
    if(distWeeks.length === 0) throw new Error("مفيش أسابيع اتقرت من شيت التوزيع");

    LEADERS = names;
    weeks = distWeeks;
    if(currentWeek >= weeks.length) currentWeek = 0;
    // شيل من absentSet أي اسم مبقاش موجود في القائمة الجديدة
    absentSet = new Set([...absentSet].filter(n => LEADERS.includes(n)));
    scheduleLoaded = true;
  } catch(err){
    scheduleError = "مقدرناش نجيب البيانات لايف من الشيت (" + err.message + "). لازم شيت \"" + SPREADSHEET_ID + "\" يكون Anyone with the link – Viewer.";
  }
  scheduleLoading = false;
  render();
}

// ---- الواجهة ----

function render(){
  document.getElementById("btn-schedule").classList.toggle("active", currentView==="schedule");
  document.getElementById("btn-leaderboard").classList.toggle("active", currentView==="leaderboard");
  document.getElementById("schedule-view").style.display = currentView==="schedule" ? "grid" : "none";
  document.getElementById("leaderboard-view").style.display = currentView==="leaderboard" ? "block" : "none";
  document.getElementById("tabs").style.display = currentView==="schedule" ? "flex" : "none";
  document.getElementById("week-tabs").style.display = currentView==="schedule" ? "flex" : "none";

  if(currentView==="schedule"){
    renderScheduleStatus();
    if(scheduleLoaded){
      renderWeekTabs(); renderTabs(); renderLotd(); renderBuildings(); renderRoster(); renderStats();
    } else {
      document.getElementById("week-tabs").innerHTML = "";
      document.getElementById("tabs").innerHTML = "";
      document.getElementById("buildings").innerHTML = "";
      document.getElementById("roster").innerHTML = "";
      document.getElementById("stats").innerHTML = "";
      document.getElementById("roster-count").textContent = "";
    }
  } else {
    renderLeaderboard();
  }
}

function renderScheduleStatus(){
  const el = document.getElementById("sched-status");
  if(scheduleLoading){
    el.className = "lb-note";
    el.style.display = "block";
    el.textContent = "بنجيب التوزيعة والأسماء لايف من الشيت...";
  } else if(scheduleError){
    el.className = "lb-note err";
    el.style.display = "block";
    el.textContent = scheduleError;
  } else if(scheduleLoaded){
    el.style.display = "none";
  }
}

function renderWeekTabs(){
  const el = document.getElementById("week-tabs");
  el.innerHTML = "";
  weeks.forEach((w,i)=>{
    const b = document.createElement("button");
    b.className = "view-btn week-btn" + (i===currentWeek ? " active" : "");
    b.textContent = "الأسبوع " + (i+1);
    b.onclick = ()=>{ currentWeek = i; if(currentDay>4) currentDay=0; render(); };
    el.appendChild(b);
  });
  const refresh = document.createElement("button");
  refresh.className = "view-btn week-btn refresh-btn";
  refresh.textContent = "تحديث من الشيت";
  refresh.onclick = ()=> fetchScheduleData();
  el.appendChild(refresh);
}

function renderTabs(){
  const el = document.getElementById("tabs");
  el.innerHTML = "";
  DAYS.forEach((d,i)=>{
    const b = document.createElement("button");
    b.className = "tab" + (i===currentDay ? " active" : "");
    b.textContent = d;
    b.onclick = ()=>{ currentDay = i; render(); };
    el.appendChild(b);
  });
}

function currentDayData(){
  const week = weeks[currentWeek];
  if(!week) return null;
  return week.days[currentDay] || null;
}

function nameSpan(val, extraClass){
  const span = document.createElement("span");
  span.className = "assign-name" + (extraClass ? " " + extraClass : "");
  span.textContent = val || "— لسه فاضي —";
  return span;
}

function renderLotd(){
  const box = document.getElementById("lotd-box");
  box.innerHTML = "";
  const day = currentDayData();
  const val = day ? day.lotd : "";
  box.appendChild(nameSpan(val, val ? "" : "empty"));
}

function renderBuildings(){
  const el = document.getElementById("buildings");
  el.innerHTML = "";
  const day = currentDayData();
  const cells = day ? day.cells : {};

  BUILDINGS.forEach(building=>{
    const sec = document.createElement("div");
    sec.className = "building";
    const h2 = document.createElement("h2");
    h2.textContent = building.name;
    sec.appendChild(h2);

    const grid = document.createElement("div");
    grid.className = "loc-grid";

    building.locs.forEach(loc=>{
      const val = cells[loc.code] || "";
      const isAbsentAssigned = val && absentSet.has(val);

      const card = document.createElement("div");
      card.className = "loc" + (val ? " filled" : " empty") + (isAbsentAssigned ? " absent-warn" : "");

      const codeEl = document.createElement("span");
      codeEl.className = "code";
      codeEl.textContent = loc.label + (isAbsentAssigned ? " · غائب!" : "");
      card.appendChild(codeEl);

      card.appendChild(nameSpan(val));

      grid.appendChild(card);
    });

    sec.appendChild(grid);
    el.appendChild(sec);
  });
}

function renderRoster(){
  const el = document.getElementById("roster");
  el.innerHTML = "";
  LEADERS.forEach(name=>{
    const isAbsent = absentSet.has(name);
    const row = document.createElement("div");
    row.className = "leader-row" + (isAbsent ? " absent" : "");

    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = name;
    row.appendChild(nameEl);

    const btn = document.createElement("button");
    btn.className = "abs-toggle";
    btn.textContent = isAbsent ? "غائب" : "حاضر";
    btn.onclick = ()=>{ if(isAbsent) absentSet.delete(name); else absentSet.add(name); render(); };
    row.appendChild(btn);

    el.appendChild(row);
  });
  document.getElementById("roster-count").textContent = `${LEADERS.length} قائد — ${absentSet.size} غائب اليوم`;
}

function renderStats(){
  const el = document.getElementById("stats");
  const day = currentDayData();
  const cells = day ? day.cells : {};
  const totalLocs = BUILDINGS.reduce((s,b)=>s+b.locs.length,0);
  let filled = 0, conflicts = 0;
  const usedCount = {};
  BUILDINGS.forEach(b=>b.locs.forEach(loc=>{
    const val = cells[loc.code];
    if(val){ filled++; usedCount[val] = (usedCount[val]||0)+1; if(absentSet.has(val)) conflicts++; }
  }));
  const doubled = Object.values(usedCount).filter(c=>c>1).length;

  el.innerHTML = "";
  const stats = [
    {n: `${filled}/${totalLocs}`, l:"مواقع متوزعة", cls:""},
    {n: absentSet.size, l:"قادة غائبون اليوم", cls: absentSet.size ? "warn":""},
    {n: conflicts, l:"تعارض (قائد غائب في موقع)", cls: conflicts ? "warn":"ok"},
    {n: doubled, l:"قادة مكررون في أكثر من موقع", cls: doubled ? "warn":"ok"},
  ];
  stats.forEach(s=>{
    const d = document.createElement("div");
    d.className = "stat" + (s.cls ? " "+s.cls : "");
    d.innerHTML = `<span class="n">${s.n}</span><span class="l">${s.l}</span>`;
    el.appendChild(d);
  });
}

// ---- Leaderboard: من شيت INFO، عمود A = الاسم، وعمود النقط بيتلقط بالاسم ----
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  const rows = lines.map(parseCSVLine);
  if(!rows.length) return [];

  const normalizeHeader = v => cleanCell(v).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const headers = rows[0].map(normalizeHeader);
  const possiblePointHeaders = ["total point", "total points", "totalpoint", "totalpoints", "ترتيب الدرجات", "الدرجات", "توتل بوينت"];
  let pointsCol = headers.findIndex(h => possiblePointHeaders.includes(h));
  if(pointsCol < 0) pointsCol = 18; // fallback (عمود S)

  const data = [];
  rows.slice(1).forEach(cols=>{
    const name = cleanCell(cols[0]);
    const pointsRaw = cleanCell(cols[pointsCol]).replace(/,/g, "");
    const points = parseFloat(pointsRaw);
    if(name && !isNaN(points)) data.push({name, points});
  });

  return data.sort((a,b)=>b.points-a.points);
}

let leaderboardData = null;
let leaderboardLoaded = false;

function setLbStatus(msg, cls){
  const el = document.getElementById("lb-status");
  el.className = "lb-note" + (cls ? " "+cls : "");
  el.innerHTML = msg;
}

async function fetchLeaderboardFromSheet(){
  setLbStatus("بنحاول نجيب البيانات لايف من شيت INFO...", "");
  try{
    const res = await fetch(CSV_INFO_URL);
    if(!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const data = parseCSV(text);
    if(data.length === 0) throw new Error("مفيش بيانات اتقرت");
    leaderboardData = data;
    leaderboardLoaded = true;
    setLbStatus(`تم الجلب لايف من شيت INFO — عدد القادة: ${data.length}. لو حد غيّر النقط في الشيت، اضغط "تحديث من الشيت" تاني.`, "ok");
  } catch(err){
    setLbStatus(`مقدرناش نجيب البيانات لايف (${err.message}). لازم شيت "${SPREADSHEET_ID}" يكون مشارك كـ "Anyone with the link – Viewer".`, "err");
  }
  renderLeaderboardTable();
}

function renderLeaderboardTable(){
  const body = document.getElementById("lb-body");
  body.innerHTML = "";
  if(!leaderboardData){ return; }
  leaderboardData.forEach((r,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="rank">${i+1}</td><td>${r.name}</td><td class="pts">${r.points}</td>`;
    body.appendChild(tr);
  });
}

function renderLeaderboard(){
  if(!leaderboardLoaded){
    fetchLeaderboardFromSheet();
  } else {
    renderLeaderboardTable();
  }
}

document.getElementById("lb-refresh").onclick = ()=> fetchLeaderboardFromSheet();

document.getElementById("lb-paste-toggle").onclick = ()=>{
  const box = document.getElementById("lb-paste-box");
  box.style.display = box.style.display === "none" ? "block" : "none";
};

document.getElementById("lb-paste-apply").onclick = ()=>{
  const raw = document.getElementById("lb-paste-area").value;
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const data = [];
  lines.forEach(line=>{
    const parts = line.split(/\t|,/).map(p=>p.trim());
    const name = parts[0];
    const points = parseFloat(parts[1]);
    if(name && !isNaN(points)) data.push({name, points});
  });
  if(data.length === 0){
    setLbStatus("مقدرتش أقرا أي صفوف صحيحة من اللي لصقته — كل صف لازم يكون: الاسم، مسافة تاب أو فاصلة، الرقم.", "err");
    return;
  }
  leaderboardData = data.sort((a,b)=>b.points-a.points);
  leaderboardLoaded = true;
  setLbStatus(`تم استخدام ${data.length} صف من البيانات اللي لصقتها.`, "ok");
  renderLeaderboardTable();
};

document.getElementById("btn-schedule").onclick = ()=>{ currentView="schedule"; render(); };
document.getElementById("btn-leaderboard").onclick = ()=>{ currentView="leaderboard"; render(); };

// تحديث تلقائي كل 30 ثانية طالما الصفحة مفتوحة — للتوزيعة والترتيب مع بعض
setInterval(()=>{
  if(currentView === "schedule") fetchScheduleData();
  else fetchLeaderboardFromSheet();
}, 30000);

fetchScheduleData();
