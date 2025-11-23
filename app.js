const storeKey = "anesthesia_app_v1";
const el = id => document.getElementById(id);
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const ranges = {
  dog: {
    hr: [60,140], rr: [8,20], spo2: [95,100], temp: [36,38.5], etco2: [35,45], map: [60,90]
  },
  cat: {
    hr: [120,180], rr: [10,20], spo2: [95,100], temp: [36.5,38.5], etco2: [35,45], map: [60,90]
  },
  rabbit: {
    hr: [140,200], rr: [20,40], spo2: [95,100], temp: [37,39], etco2: [30,45], map: [60,90]
  }
};
const state = {
  case: {
    species: "dog", breed: "", name: "", sex: "", age: "", weight: "",
    asa: "I", anesthetist: "", procedure: "", startTime: "", drugs: ""
  },
  readings: [],
  bolus: ["Propofol 2mg/kg","Cerenia 1mg/kg","Vena 1mg/kg"],
  events: []
};
let timerId = null;
function load() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data.case) Object.assign(state.case, data.case);
  if (Array.isArray(data.readings)) state.readings = data.readings;
  if (Array.isArray(data.bolus)) state.bolus = data.bolus;
  if (Array.isArray(data.events)) state.events = data.events;
}
function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}
function bindCaseForm() {
  const keys = ["species","breed","name","sex","age","weight","asa","anesthetist","procedure","startTime","drugs"];
  keys.forEach(k => {
    const v = state.case[k] || "";
    el(k).value = v;
    el(k).addEventListener("change", () => {
      state.case[k] = el(k).value;
      save();
      renderTable();
    });
  });
  el("save-case").addEventListener("click", () => { save(); });
  el("new-case").addEventListener("click", () => {
    Object.assign(state.case, { species: "dog", breed:"", name:"", sex:"", age:"", weight:"", asa:"I", anesthetist:"", procedure:"", startTime:"", drugs:"" });
    state.readings = [];
    keys.forEach(k => el(k).value = state.case[k] || "");
    save();
    renderTable();
  });
}
function bindReadingForm() {
  el("timestamp").value = nowLocal();
  el("add-reading").addEventListener("click", () => {
    const r = {
      timestamp: el("timestamp").value || nowLocal(),
      hr: num(el("hr").value), rr: num(el("rr").value), spo2: num(el("spo2").value), temp: num(el("temp").value),
      etco2: num(el("etco2").value), sbp: num(el("sbp").value), dbp: num(el("dbp").value), map: num(el("map").value),
      o2: num(el("o2").value), note: el("note").value || ""
    };
    if (!r.timestamp) r.timestamp = nowLocal();
    state.readings.push(r);
    save();
    clearReadingForm();
    renderTable();
  });
  el("export-csv").addEventListener("click", exportCSV);
  el("start-timer").addEventListener("click", () => {
    if (timerId) return;
    const min = Number(el("intervalMin").value) || 5;
    timerId = setInterval(() => {
      const r = { timestamp: nowLocal(), hr:"", rr:"", spo2:"", temp:"", etco2:"", sbp:"", dbp:"", map:"", o2:"", note:"" };
      state.readings.push(r);
      save();
      renderTable();
    }, min*60000);
    el("start-timer").disabled = true;
    el("stop-timer").disabled = false;
  });
  el("stop-timer").addEventListener("click", () => {
    if (timerId){ clearInterval(timerId); timerId = null; }
    el("start-timer").disabled = false;
    el("stop-timer").disabled = true;
  });
}
function clearReadingForm() {
  ["hr","rr","spo2","temp","etco2","sbp","dbp","map","o2","note"].forEach(k => el(k).value = "");
  el("timestamp").value = nowLocal();
}
function num(v){
  if (v===undefined || v===null || v==="") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}
function cellClass(key, value){
  if (value === "" || value === null || value === undefined) return "";
  const sp = state.case.species;
  const r = ranges[sp];
  if (!r || !r[key]) return "";
  const [low, high] = r[key];
  if (key === "spo2"){
    if (value < 90) return "bad";
    if (value < low) return "warn";
    return "ok";
  }
  if (value < low) return "bad";
  if (value > high) return "bad";
  return "ok";
}
function renderTable(){
  const tbody = document.querySelector("#readings-table tbody");
  tbody.innerHTML = "";
  if (!state.readings.length){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 12; td.className = "empty"; td.textContent = "尚無紀錄";
    tr.appendChild(td); tbody.appendChild(tr);
    return;
  }
  state.readings.forEach((r, idx) => {
    const tr = document.createElement("tr");
    const cells = [
      r.timestamp,
      [r.hr, "hr"],
      [r.rr, "rr"],
      [r.spo2, "spo2"],
      [r.temp, "temp"],
      [r.etco2, "etco2"],
      r.sbp,
      r.dbp,
      [r.map, "map"],
      r.o2,
      r.note
    ];
    cells.forEach(c => {
      const td = document.createElement("td");
      if (Array.isArray(c)){
        td.textContent = c[0] === "" ? "" : String(c[0]);
        td.className = cellClass(c[1], c[0]);
      } else {
        td.textContent = c === "" ? "" : String(c);
      }
      tr.appendChild(td);
    });
    const tdAct = document.createElement("td");
    tdAct.className = "row-actions";
    const del = document.createElement("button");
    del.className = "danger"; del.textContent = "刪除";
    del.addEventListener("click", () => { state.readings.splice(idx,1); save(); renderTable(); });
    tdAct.appendChild(del);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
  renderDashboard();
  renderTrend();
  renderTimeline();
}
function exportCSV(){
  const header = ["時間","HR","RR","SpO2","體溫","EtCO2","SBP","DBP","MAP","O2","備註"];
  const lines = [header.join(",")];
  state.readings.forEach(r => {
    const row = [r.timestamp,r.hr,r.rr,r.spo2,r.temp,r.etco2,r.sbp,r.dbp,r.map,r.o2,r.note].map(v => v === undefined || v === null ? "" : v);
    lines.push(row.join(","));
  });
  const caseInfo = Object.entries(state.case).map(([k,v]) => `${k}:${v||""}`).join("; ");
  const blob = new Blob([`個案資訊,${caseInfo}\n`+lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.case.name||"case"}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function latest(){
  if (!state.readings.length) return null;
  return state.readings[state.readings.length-1];
}
function mapValue(sbp, dbp, map){
  if (map !== "" && Number.isFinite(Number(map))) return Number(map);
  if (sbp === "" || dbp === "") return "";
  const n1 = Number(sbp), n2 = Number(dbp);
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) return "";
  return Math.round(n2 + (n1 - n2)/3);
}
function renderDashboard(){
  const l = latest();
  const set = (id, v) => el(id).textContent = (v === "" || v === null || v === undefined) ? "--" : String(v);
  if (!l){
    ["val-hr","val-bp","val-rr","val-spo2","val-etco2","val-temp"].forEach(id => set(id, "--"));
    return;
  }
  set("val-hr", l.hr);
  set("val-bp", mapValue(l.sbp, l.dbp, l.map));
  set("val-rr", l.rr);
  set("val-spo2", l.spo2);
  set("val-etco2", l.etco2);
  set("val-temp", l.temp);
}
function renderTrend(){
  const c = document.getElementById("trend");
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = Math.floor(rect.width*dpr);
  c.height = Math.floor(c.height*dpr);
  const ctx = c.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,rect.width,rect.height);
  const data = state.readings.slice(-12);
  if (!data.length) return;
  const W = rect.width, H = rect.height;
  const keys = ["hr","rr","sbp","dbp","spo2","etco2"];
  const colors = { hr: "#22c55e", rr: "#38bdf8", sbp: "#10b981", dbp: "#0ea5e9", spo2: "#f59e0b", etco2: "#a78bfa" };
  const spec = ranges[state.case.species] || ranges.dog;
  const range = { hr: spec.hr, rr: spec.rr, sbp: [80,140], dbp: [40,90], spo2: spec.spo2, etco2: spec.etco2 };
  const stepX = W / Math.max(1, data.length-1);
  keys.forEach(k => {
    ctx.beginPath();
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = 2;
    data.forEach((r,i) => {
      let v = r[k];
      if (k === "sbp" && v === "" && r.sbp !== "") v = r.sbp;
      if (k === "dbp" && v === "" && r.dbp !== "") v = r.dbp;
      if (v === "" || v === null || v === undefined) return;
      const [lo, hi] = range[k];
      const t = Math.max(0, Math.min(1, (Number(v)-lo)/(hi-lo)));
      const x = i*stepX;
      const y = H - t*H;
      if (ctx.currentX === undefined){ ctx.moveTo(x,y); } else { ctx.lineTo(x,y); }
      ctx.currentX = x;
    });
    ctx.stroke();
    ctx.currentX = undefined;
  });
}
function renderBolus(){
  const wrap = el("bolus-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  state.bolus.forEach(b => {
    const d = document.createElement("button");
    d.className = "pill"; d.type = "button"; d.textContent = b;
    d.addEventListener("click", () => {
      state.events.push({ timestamp: nowLocal(), text: b });
      save();
      renderTimeline();
    });
    wrap.appendChild(d);
  });
}
function renderTimeline(){
  const wrap = el("timeline");
  if (!wrap) return;
  wrap.innerHTML = "";
  const items = [];
  state.readings.forEach(r => {
    const bp = mapValue(r.sbp, r.dbp, r.map);
    const txt = `HR:${r.hr||""} BP:${bp||""} ${r.note||""}`.trim();
    items.push({ timestamp: r.timestamp, text: txt });
  });
  state.events.forEach(e => items.push(e));
  items.sort((a,b) => (a.timestamp||"") < (b.timestamp||"") ? -1 : 1);
  items.slice(-20).forEach(it => {
    const row = document.createElement("div"); row.className = "entry";
    const t = document.createElement("div"); t.className = "time"; t.textContent = it.timestamp || "";
    const x = document.createElement("div"); x.className = "text"; x.textContent = it.text || "";
    const r = document.createElement("div"); r.textContent = "Record"; r.style.color = "#94a3b8";
    row.appendChild(t); row.appendChild(x); row.appendChild(r);
    wrap.appendChild(row);
  });
}
function init(){
  load();
  bindCaseForm();
  bindReadingForm();
  renderTable();
  el("stop-timer").disabled = true;
  renderBolus();
  const btnAddBolus = el("add-bolus");
  if (btnAddBolus){
    btnAddBolus.addEventListener("click", () => {
      const name = prompt("新增劑量或藥物項目");
      if (!name) return;
      state.bolus.push(name);
      save();
      renderBolus();
    });
  }
  const btnAddEvent = el("add-event");
  if (btnAddEvent){
    btnAddEvent.addEventListener("click", () => {
      const text = prompt("輸入事件內容");
      if (!text) return;
      state.events.push({ timestamp: nowLocal(), text });
      save();
      renderTimeline();
    });
  }
}
document.addEventListener("DOMContentLoaded", init);