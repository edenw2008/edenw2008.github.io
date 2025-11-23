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
  readings: []
};
let timerId = null;
function load() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data.case) Object.assign(state.case, data.case);
  if (Array.isArray(data.readings)) state.readings = data.readings;
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
function init(){
  load();
  bindCaseForm();
  bindReadingForm();
  renderTable();
  el("stop-timer").disabled = true;
}
document.addEventListener("DOMContentLoaded", init);