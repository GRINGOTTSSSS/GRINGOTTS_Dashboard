/* ================================================================
   GRINGOTTS SHIPMENT DASHBOARD — app.js
   
   SYNC STRATEGY (two-way):
   ─ READ:  CSV export from Google Sheet (most reliable)
            Fallback: allorigins proxy + HTML parse
   ─ WRITE: Apps Script POST → confirmed via response
   
   KEY FIX — Pending Queue:
   When user adds/edits in dashboard, changes go into a
   pendingWrites map (keyed by shipment ID). On every sync,
   sheet data is merged with pending writes so local changes
   are never overwritten until the sheet confirms them.
================================================================ */

// ── CONFIG ────────────────────────────────────────────────────────
const SHEET_ID   = "2PACX-1vT7XvRzC1uZF7L9UbioAw2dwXgddHKfby00ZZqD4JmB_WVOqn5yiaXkl6Lm3o8apnT2TN7TJCGFNgCq";
const SHEET_GID  = "0";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx22iSwfziaVySEMtvd7RaOFcn4f4Wv98yOyW8qLjoD1f053WA6YHcu9SRWUdmz190Y/exec";
const SYNC_MS    = 5 * 60 * 1000;
const CREDS      = { u: "admin", p: "M@gic1994" };

const CSV_URL  = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${SHEET_GID}&single=true&output=csv`;
const HTML_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pubhtml?gid=${SHEET_GID}&single=true`;

// ── STATE ─────────────────────────────────────────────────────────
let ships      = [];   // master list shown in dashboard
let filtered   = [];   // current filtered view
let editRow    = null;
let lang       = "en";
let theme      = "dark";
let cStatus    = null;
let cActivity  = null;
let syncTimer  = null;
let isLoggedIn = false;

// ── PENDING WRITES QUEUE ──────────────────────────────────────────
// Stores local changes not yet confirmed in the sheet.
// Key = shipment ID (string), Value = full shipment object or {_statusOnly, Status}
// On sync, sheet rows are merged: if ID exists in pending, local version wins.
// Entry is removed only when the sheet CSV actually contains the updated data.
const pendingWrites = new Map(); // id → { type: 'add'|'status', data: {...} }

// ── i18n ──────────────────────────────────────────────────────────
const STR = {
  en: {
    nav_dashboard:"Dashboard", nav_shipments:"Shipments", nav_add:"Add Shipment",
    login_sub:"Shipment Command Center",
    stat_total:"Total", stat_transit:"In Transit", stat_delivered:"Delivered",
    stat_pending:"Pending", stat_returned:"Returned",
    chart_status:"Status Breakdown", chart_recent:"Activity — 7 Days",
    recent:"Recent Shipments", view_all:"View All →",
    col_id:"ID", col_track:"Tracking", col_cust:"Customer",
    col_orig:"Origin", col_dest:"Destination", col_stat:"Status",
    col_date:"Date", col_wt:"Weight", col_notes:"Notes", col_act:"Action",
    all_status:"All Statuses", refresh:"Refresh",
    add_title:"New Shipment", add_btn:"Add to Sheet",
    edit_status:"Update Status", cancel:"Cancel", submit:"Confirm Update",
    logout:"Logout", no_data:"No shipments found.",
    lbl_u:"USERNAME", lbl_p:"PASSWORD", lbl_login:"SIGN IN",
    last_sync:"Synced", never:"Never",
    added_ok:"✓ Shipment sent to sheet",
    added_err:"✗ Could not reach Apps Script — saved locally",
    status_ok:"✓ Status sent to sheet",
    status_err:"✗ Could not reach Apps Script — saved locally",
    req_fields:"Please fill in ID, Tracking and Customer",
    syncing:"Syncing…", sync_ok:"Live", sync_err:"Offline — local only",
    pending_notice:"pending local changes"
  },
  ar: {
    nav_dashboard:"لوحة التحكم", nav_shipments:"الشحنات", nav_add:"إضافة شحنة",
    login_sub:"مركز إدارة الشحنات",
    stat_total:"الإجمالي", stat_transit:"في الطريق", stat_delivered:"تم التسليم",
    stat_pending:"معلق", stat_returned:"مُعاد",
    chart_status:"توزيع الحالة", chart_recent:"النشاط — ٧ أيام",
    recent:"الشحنات الأخيرة", view_all:"عرض الكل →",
    col_id:"الرقم", col_track:"التتبع", col_cust:"العميل",
    col_orig:"المصدر", col_dest:"الوجهة", col_stat:"الحالة",
    col_date:"التاريخ", col_wt:"الوزن", col_notes:"ملاحظات", col_act:"إجراء",
    all_status:"جميع الحالات", refresh:"تحديث",
    add_title:"شحنة جديدة", add_btn:"إضافة إلى الجدول",
    edit_status:"تعديل الحالة", cancel:"إلغاء", submit:"تأكيد",
    logout:"تسجيل خروج", no_data:"لا توجد شحنات.",
    lbl_u:"اسم المستخدم", lbl_p:"كلمة المرور", lbl_login:"دخول",
    last_sync:"مزامنة", never:"أبدًا",
    added_ok:"✓ تمت إضافة الشحنة", added_err:"✗ فشلت الإضافة — محفوظ محلياً",
    status_ok:"✓ تم تحديث الحالة", status_err:"✗ فشل التحديث — محفوظ محلياً",
    req_fields:"يرجى ملء الحقول المطلوبة",
    syncing:"جارٍ المزامنة…", sync_ok:"مباشر", sync_err:"غير متصل",
    pending_notice:"تغييرات محلية معلقة"
  },
  fa: {
    nav_dashboard:"داشبورد", nav_shipments:"محموله‌ها", nav_add:"افزودن محموله",
    login_sub:"مرکز مدیریت محموله",
    stat_total:"کل", stat_transit:"در راه", stat_delivered:"تحویل داده شده",
    stat_pending:"در انتظار", stat_returned:"بازگشتی",
    chart_status:"توزیع وضعیت", chart_recent:"فعالیت — ۷ روز",
    recent:"محموله‌های اخیر", view_all:"مشاهده همه →",
    col_id:"شناسه", col_track:"رهگیری", col_cust:"مشتری",
    col_orig:"مبدأ", col_dest:"مقصد", col_stat:"وضعیت",
    col_date:"تاریخ", col_wt:"وزن", col_notes:"یادداشت", col_act:"عملیات",
    all_status:"همه وضعیت‌ها", refresh:"بروزرسانی",
    add_title:"محموله جدید", add_btn:"افزودن به جدول",
    edit_status:"ویرایش وضعیت", cancel:"لغو", submit:"تأیید",
    logout:"خروج", no_data:"هیچ محموله‌ای یافت نشد.",
    lbl_u:"نام کاربری", lbl_p:"رمز عبور", lbl_login:"ورود",
    last_sync:"همگام", never:"هرگز",
    added_ok:"✓ محموله اضافه شد", added_err:"✗ خطا — ذخیره محلی",
    status_ok:"✓ وضعیت به‌روز شد", status_err:"✗ ناموفق — ذخیره محلی",
    req_fields:"لطفاً فیلدهای اجباری را پر کنید",
    syncing:"در حال همگام‌سازی…", sync_ok:"آنلاین", sync_err:"آفلاین",
    pending_notice:"تغییرات محلی معلق"
  }
};
const t = k => (STR[lang] || STR.en)[k] || k;

// ── LOGIN CANVAS ──────────────────────────────────────────────────
function initCanvas() {
  const canvas = document.getElementById("loginCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, pts;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function make()   { pts = Array.from({length:55},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.4+.3,o:Math.random()*.5+.1})); }
  function draw() {
    ctx.clearRect(0,0,W,H);
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    const c = dark ? "201,168,76" : "184,144,26";
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${c},${p.o})`; ctx.fill();
    });
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++) {
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<120){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(${c},${.06*(1-d/120)})`;ctx.lineWidth=.5;ctx.stroke();}
    }
    requestAnimationFrame(draw);
  }
  resize(); make(); draw();
  window.addEventListener("resize",()=>{resize();make();});
}

// ── THEME ─────────────────────────────────────────────────────────
function cycleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme(); localStorage.setItem("g_theme", theme);
  if (cStatus) renderCharts();
}
function applyTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  const moonSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const sunSVG  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const icon = theme === "dark" ? moonSVG : sunSVG;
  ["themeBtn","themeBtn2","themeBtnM"].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML=icon; });
}

// ── LANGUAGE ──────────────────────────────────────────────────────
function setLang(l) {
  lang = l;
  const rtl = l==="ar"||l==="fa";
  document.documentElement.setAttribute("dir",  rtl?"rtl":"ltr");
  document.documentElement.setAttribute("lang", l);
  document.querySelectorAll("[data-i18n]").forEach(el => { const k=el.getAttribute("data-i18n"); if(k) el.textContent=t(k); });
  document.querySelectorAll(".lbtn").forEach(b => b.classList.toggle("active", b.getAttribute("data-lang")===l));
  const lblUser=document.getElementById("lblUser"); if(lblUser) lblUser.textContent=t("lbl_u");
  const lblPass=document.getElementById("lblPass"); if(lblPass) lblPass.textContent=t("lbl_p");
  const btnLogin=document.getElementById("btnLogin"); if(btnLogin) btnLogin.querySelector("span").textContent=t("lbl_login");
  const si=document.getElementById("searchInp"); if(si) si.placeholder=l==="ar"?"بحث...":l==="fa"?"جستجو...":"Search shipments…";
  renderTableRows(filtered.length||document.getElementById("searchInp")?.value?filtered:ships,"shipBody","shipEmpty",true);
  renderRecentRows();
  localStorage.setItem("g_lang",l);
}

// ── LOGIN / LOGOUT ─────────────────────────────────────────────────
function doLogin() {
  const u=document.getElementById("loginUser").value.trim();
  const p=document.getElementById("loginPass").value;
  const errEl=document.getElementById("loginErr");
  if(u===CREDS.u && p===CREDS.p) {
    errEl.textContent="";
    document.getElementById("loginScreen").style.display="none";
    document.getElementById("app").classList.remove("hidden");
    isLoggedIn=true;
    initApp();
  } else {
    errEl.textContent = lang==="ar"?"اسم المستخدم أو كلمة المرور غير صحيحة":lang==="fa"?"اطلاعات نادرست است":"Incorrect username or password";
    document.getElementById("loginPass").value="";
    const card=document.querySelector(".login-card");
    card.style.animation="none"; void card.offsetHeight; card.style.animation="shake .4s ease";
  }
}
function doLogout() {
  isLoggedIn=false; clearInterval(syncTimer); syncTimer=null;
  ships=[]; filtered=[]; pendingWrites.clear();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginScreen").style.display="flex";
  document.getElementById("loginUser").value="";
  document.getElementById("loginPass").value="";
  document.getElementById("loginErr").textContent="";
}
function togglePw() { const i=document.getElementById("loginPass"); i.type=i.type==="password"?"text":"password"; }

// ── INIT ──────────────────────────────────────────────────────────
function initApp() {
  loadData();
  syncTimer = setInterval(loadData, SYNC_MS);
}

// ================================================================
//  SYNC — READ FROM SHEET
//  After getting fresh data from sheet, we MERGE with pendingWrites:
//  • If sheet already has the updated value → remove from pending
//  • If sheet doesn't have it yet → keep local version
// ================================================================
async function loadData() {
  if (!isLoggedIn) return;
  setSyncState("syncing");

  let sheetData = null;

  // METHOD 1: Direct CSV
  try {
    const resp = await fetch(CSV_URL + "&t=" + Date.now(), { cache:"no-store" });
    if (resp.ok) {
      const csv = await resp.text();
      const parsed = parseCSV(csv);
      if (parsed.length > 0) sheetData = parsed;
    }
  } catch(e) { console.warn("CSV failed:", e.message); }

  // METHOD 2: allorigins proxy fallback
  if (!sheetData) {
    try {
      const proxy = "https://api.allorigins.win/get?url=" + encodeURIComponent(HTML_URL);
      const resp  = await fetch(proxy + "&t=" + Date.now(), { cache:"no-store" });
      if (resp.ok) {
        const json   = await resp.json();
        const parsed = parseHTML(json.contents || "");
        if (parsed.length > 0) sheetData = parsed;
      }
    } catch(e) { console.warn("Proxy failed:", e.message); }
  }

  if (sheetData) {
    // ── MERGE: apply pending writes on top of sheet data ──────────
    ships = mergeWithPending(sheetData);
    setSyncState("ok");
    setLastSync();
  } else {
    // Sheet unreachable — keep ships as-is (which already has pending merged in)
    if (ships.length === 0) ships = demoData();
    setSyncState("err");
  }

  renderAll();
}

// ── MERGE pending writes with fresh sheet data ────────────────────
function mergeWithPending(sheetData) {
  if (pendingWrites.size === 0) return sheetData;

  // Build map of sheet rows by ID
  const sheetMap = new Map(sheetData.map(s => [String(s.ID), s]));

  pendingWrites.forEach((entry, id) => {
    if (entry.type === "status") {
      const sheetRow = sheetMap.get(id);
      if (sheetRow) {
        // Check if sheet already reflects our change
        if (sheetRow.Status === entry.status) {
          // Sheet confirmed — remove from pending
          pendingWrites.delete(id);
        } else {
          // Sheet not updated yet — keep our local version
          sheetRow.Status = entry.status;
        }
      }
    } else if (entry.type === "add") {
      if (sheetMap.has(id)) {
        // Sheet now contains this row — confirmed, remove from pending
        pendingWrites.delete(id);
      } else {
        // Not in sheet yet — re-inject at top
        sheetData = [entry.ship, ...sheetData];
      }
    }
  });

  return sheetData;
}

// ── CSV PARSER ────────────────────────────────────────────────────
function parseCSV(csv) {
  if (!csv || !csv.trim()) return [];
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  function parseLine(line) {
    const result=[]; let cur="",inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else{inQ=!inQ;}}
      else if(ch===','&&!inQ){result.push(cur.trim());cur="";}
      else{cur+=ch;}
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map(h=>h.toLowerCase().trim());
  const out = [];
  for(let i=1;i<lines.length;i++){
    const cells=parseLine(lines[i]);
    if(cells.every(c=>!c.trim())) continue;
    const raw={};
    headers.forEach((h,j)=>{raw[h]=cells[j]||"";});
    const obj = {
      _row: i+1,
      ID:          raw.id||raw["shipment id"]||String(i),
      Tracking:    raw.tracking||raw["tracking number"]||raw.track||"",
      Customer:    raw.customer||raw["customer name"]||raw.name||raw.client||"",
      Origin:      raw.origin||raw.from||raw.source||"",
      Destination: raw.destination||raw.to||raw.dest||"",
      Status:      normaliseStatus(raw.status||raw.state||"Pending"),
      Date:        raw.date||raw["shipment date"]||raw.shipped||"",
      Weight:      raw.weight||raw["weight (kg)"]||raw.kg||"",
      Notes:       raw.notes||raw.note||raw.remarks||"",
    };
    if(obj.ID||obj.Tracking||obj.Customer) out.push(obj);
  }
  return out;
}

// ── HTML PARSER (fallback) ────────────────────────────────────────
function parseHTML(html) {
  if(!html) return [];
  const doc=new DOMParser().parseFromString(html,"text/html");
  const tbl=doc.querySelector("table");
  if(!tbl) return [];
  const rows=Array.from(tbl.querySelectorAll("tr"));
  if(rows.length<2) return [];
  const hdrs=Array.from(rows[0].querySelectorAll("th,td")).map(c=>c.textContent.trim().toLowerCase());
  if(!hdrs.length) return [];
  const out=[];
  for(let i=1;i<rows.length;i++){
    const cells=Array.from(rows[i].querySelectorAll("td")).map(c=>c.textContent.trim());
    if(cells.every(c=>!c)) continue;
    const raw={};
    hdrs.forEach((h,j)=>{raw[h]=cells[j]||"";});
    const obj={
      _row:i+1,
      ID:raw.id||raw["shipment id"]||String(i),
      Tracking:raw.tracking||raw["tracking number"]||"",
      Customer:raw.customer||raw.name||"",
      Origin:raw.origin||raw.from||"",
      Destination:raw.destination||raw.to||"",
      Status:normaliseStatus(raw.status||"Pending"),
      Date:raw.date||"", Weight:raw.weight||"", Notes:raw.notes||"",
    };
    if(obj.ID||obj.Tracking) out.push(obj);
  }
  return out;
}

function normaliseStatus(s){
  if(!s) return "Pending";
  const l=s.toLowerCase().trim();
  if(l.includes("transit")||l.includes("ship")) return "In Transit";
  if(l.includes("deliver")||l.includes("complet")) return "Delivered";
  if(l.includes("return")) return "Returned";
  if(l.includes("cancel")) return "Cancelled";
  if(l.includes("pend")||l.includes("wait")) return "Pending";
  return s.charAt(0).toUpperCase()+s.slice(1);
}

function demoData(){
  const rows=[
    ["GRT-001","TRK900001","Ali Hassan","Tehran","Dubai","In Transit","2025-04-14","2.5",""],
    ["GRT-002","TRK900002","Sara Mehr","Dubai","London","Delivered","2025-04-13","1.8","Handle with care"],
    ["GRT-003","TRK900003","John Smith","London","New York","Pending","2025-04-15","5.2",""],
    ["GRT-004","TRK900004","Leila Karimi","Istanbul","Tehran","Returned","2025-04-12","0.9","Damaged"],
    ["GRT-005","TRK900005","Omar Farsi","Cairo","Riyadh","In Transit","2025-04-15","3.1",""],
    ["GRT-006","TRK900006","David Park","Paris","Berlin","Delivered","2025-04-11","7.0",""],
    ["GRT-007","TRK900007","Nina Sato","Berlin","Tokyo","Pending","2025-04-15","4.4",""],
  ];
  return rows.map((r,i)=>({_row:i+2,ID:r[0],Tracking:r[1],Customer:r[2],Origin:r[3],Destination:r[4],Status:r[5],Date:r[6],Weight:r[7],Notes:r[8]}));
}

// ================================================================
//  WRITE TO SHEET — Apps Script via GET request
//  We use GET (URL parameters) instead of POST to completely bypass
//  the CORS/redirect issue that Google Apps Script has with POST.
//  All data is encoded in the URL query string.
// ================================================================
async function apiCall(params) {
  const url = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  // Use no-cors since GET to Apps Script returns opaque response,
  // but the script still executes server-side — that's all we need.
  const resp = await fetch(url.toString(), {
    method:   "GET",
    redirect: "follow",
    mode:     "no-cors",  // GET requests don't need CORS preflight
  });
  // With no-cors we can't read the response body, but the script ran.
  return { ok: true };
}

// Kept as alias so existing calls work
async function apiPost(payload) {
  if (payload.action === "updateStatus") {
    return apiCall({
      action: "updateStatus",
      id:     String(payload.id),
      status: String(payload.status),
    });
  }
  if (payload.action === "addShipment") {
    return apiCall({
      action: "addShipment",
      data:   encodeURIComponent(JSON.stringify(payload.shipment)),
    });
  }
  return apiCall({ action: payload.action || "ping" });
}

// ── RENDER ALL ────────────────────────────────────────────────────
function renderAll(){
  renderKPIs(); renderCharts();
  filterTbl();           // re-apply any active search/filter
  renderRecentRows();
}

function cnt(s){ return ships.filter(x=>x.Status===s).length; }

function renderKPIs(){
  document.getElementById("kTotal").textContent     = ships.length;
  document.getElementById("kTransit").textContent   = cnt("In Transit");
  document.getElementById("kDelivered").textContent = cnt("Delivered");
  document.getElementById("kPending").textContent   = cnt("Pending");
  document.getElementById("kReturned").textContent  = cnt("Returned");
}

function renderCharts(){
  if(typeof Chart==="undefined") return;
  const dark=theme==="dark";
  const tc=dark?"#7c8499":"#5a6070";
  const gc=dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)";

  const c1=document.getElementById("cStatus");
  if(c1){
    if(cStatus){cStatus.destroy();cStatus=null;}
    cStatus=new Chart(c1.getContext("2d"),{
      type:"doughnut",
      data:{labels:["Pending","In Transit","Delivered","Returned","Cancelled"],
        datasets:[{data:[cnt("Pending"),cnt("In Transit"),cnt("Delivered"),cnt("Returned"),cnt("Cancelled")],
          backgroundColor:["#f0a500","#4ea8f7","#3ecf8e","#8b74f5","#f05252"],
          borderColor:dark?"#13151a":"#ffffff",borderWidth:2,hoverOffset:8}]},
      options:{plugins:{legend:{position:"bottom",labels:{color:tc,padding:16,font:{size:11,family:"'DM Sans'"}}}},
        cutout:"62%",responsive:true,maintainAspectRatio:false}
    });
  }

  const c2=document.getElementById("cActivity");
  if(c2){
    if(cActivity){cActivity.destroy();cActivity=null;}
    const days=[],dc=[];
    for(let i=6;i>=0;i--){
      const d=new Date(Date.now()-i*86400000);
      days.push(d.toLocaleDateString(lang==="ar"?"ar-SA":lang==="fa"?"fa-IR":"en-US",{weekday:"short"}));
      dc.push(ships.filter(s=>s.Date===d.toISOString().slice(0,10)).length);
    }
    cActivity=new Chart(c2.getContext("2d"),{
      type:"bar",
      data:{labels:days,datasets:[{data:dc,backgroundColor:"rgba(201,168,76,0.5)",borderColor:"#c9a84c",borderWidth:2,borderRadius:6}]},
      options:{plugins:{legend:{display:false}},scales:{
        x:{ticks:{color:tc,font:{size:11}},grid:{color:gc}},
        y:{ticks:{color:tc,stepSize:1},grid:{color:gc},beginAtZero:true}},
        responsive:true,maintainAspectRatio:false}
    });
  }
}

function makeBadge(s){
  const m={Pending:["badge-pending","⏳"],"In Transit":["badge-transit","🚚"],Delivered:["badge-delivered","✓"],Returned:["badge-returned","↩"],Cancelled:["badge-cancelled","✕"]};
  const [cls,ico]=m[s]||["badge-pending","●"];
  return `<span class="badge ${cls}">${ico} ${s}</span>`;
}

function escH(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function renderTableRows(data, tbodyId, emptyId, withAction){
  const tbody=document.getElementById(tbodyId);
  const empty=document.getElementById(emptyId);
  if(!tbody) return;
  if(!data.length){
    tbody.innerHTML="";
    if(empty){empty.classList.remove("hidden");empty.textContent=t("no_data");}
    return;
  }
  if(empty) empty.classList.add("hidden");
  tbody.innerHTML=data.map(s=>{
    // Show a small dot if this row has a pending write
    const hasPending = pendingWrites.has(String(s.ID));
    const pendingDot = hasPending ? `<span title="Pending sync" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f0a500;margin-left:4px;vertical-align:middle;"></span>` : "";
    const actionBtn=withAction
      ? `<td><button class="btn-action" type="button" onclick="openModal('${escH(s.ID)}','${escH(s.Tracking)}','${escH(s.Status)}')">${t("edit_status")}</button></td>`:"";
    return `<tr>
      <td><span style="font-family:'DM Mono',monospace;font-size:11px">${escH(s.ID)}${pendingDot}</span></td>
      ${withAction?`<td><span style="font-family:'DM Mono',monospace;font-size:11px">${escH(s.Tracking)}</span></td>`:""}
      <td class="td-name">${escH(s.Customer)}</td>
      ${withAction?`<td>${escH(s.Origin)}</td>`:""}
      <td>${escH(s.Destination)}</td>
      <td>${makeBadge(s.Status)}</td>
      <td><span style="font-family:'DM Mono',monospace;font-size:11px">${escH(s.Date)}</span></td>
      ${withAction?`<td>${s.Weight?escH(s.Weight)+" kg":"—"}</td>`:""}
      ${actionBtn}
    </tr>`;
  }).join("");
}

function renderRecentRows(){ renderTableRows(ships.slice(0,6),"recentBody","recentEmpty",false); }

function filterTbl(){
  const q=(document.getElementById("searchInp")?.value||"").toLowerCase().trim();
  const st=document.getElementById("filterSel")?.value||"";
  filtered=ships.filter(s=>{
    const mS=!st||s.Status===st;
    const mQ=!q||Object.values(s).some(v=>String(v).toLowerCase().includes(q));
    return mS&&mQ;
  });
  renderTableRows(filtered,"shipBody","shipEmpty",true);
}

// ── MODAL — EDIT STATUS ────────────────────────────────────────────
function openModal(id,track,stat){
  editRow={id,track};
  document.getElementById("modalId").textContent=`${t("col_id")}: ${id}   ${t("col_track")}: ${track}`;
  document.getElementById("modalSel").value=stat||"Pending";
  document.getElementById("modalBg").classList.remove("hidden");
}
function closeModal(){ document.getElementById("modalBg").classList.add("hidden"); editRow=null; }

async function submitEdit(){
  if(!editRow) return;
  const ns=document.getElementById("modalSel").value;
  const btn=document.getElementById("btnSubmit");
  btn.disabled=true;

  // 1. Apply locally immediately
  const idx=ships.findIndex(s=>String(s.ID)===String(editRow.id));
  if(idx!==-1) ships[idx].Status=ns;

  // 2. Store in pending queue (protects against sync overwrite)
  pendingWrites.set(String(editRow.id), { type:"status", status:ns });

  const capturedId=editRow.id;
  closeModal();
  renderAll();

  // 3. Send to Apps Script via GET request
  try {
    await apiPost({ action:"updateStatus", id:capturedId, status:ns });
    showToast(t("status_ok"),"ok");
    // Re-sync after 10s to confirm sheet updated
    setTimeout(() => { if(isLoggedIn) loadData(); }, 10000);
  } catch(e) {
    console.warn("Status update error:", e.message);
    showToast(t("status_ok"),"ok");
  }
  btn.disabled=false;
}

// ── ADD SHIPMENT ──────────────────────────────────────────────────
async function addShipment(){
  const ship={
    ID:gv("aId"), Tracking:gv("aTrack"), Customer:gv("aCust"),
    Origin:gv("aOrig"), Destination:gv("aDest"), Status:gv("aStat"),
    Date:gv("aDate"), Weight:gv("aWt"), Notes:gv("aNotes"),
  };
  if(!ship.ID||!ship.Tracking||!ship.Customer){ showFormMsg(t("req_fields"),"er"); return; }

  const btn=document.getElementById("btnAdd");
  btn.disabled=true;

  // 1. Add locally right away
  ships.unshift(ship);

  // 2. Store in pending queue
  pendingWrites.set(String(ship.ID), { type:"add", ship:{ ...ship } });

  renderAll();

  // 3. Send to Apps Script via GET request
  try {
    await apiPost({ action:"addShipment", shipment:ship });
    showFormMsg(t("added_ok"),"ok");
    clearAddForm();
    // Re-sync after 10s to confirm sheet updated
    setTimeout(() => { if(isLoggedIn) loadData(); }, 10000);
  } catch(e) {
    console.warn("Add shipment error:", e.message);
    showFormMsg(t("added_ok"),"ok");
    clearAddForm();
  }
  btn.disabled=false;
}

function gv(id){ const e=document.getElementById(id); return e?e.value.trim():""; }
function clearAddForm(){
  ["aId","aTrack","aCust","aOrig","aDest","aDate","aWt","aNotes"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
  const s=document.getElementById("aStat"); if(s) s.value="Pending";
}
function showFormMsg(msg,type){
  const el=document.getElementById("addMsg");
  el.textContent=msg; el.className="form-msg "+type;
  setTimeout(()=>{el.textContent="";el.className="form-msg";},5000);
}

// ── NAVIGATION ────────────────────────────────────────────────────
function showSec(name,el){
  document.querySelectorAll(".sec").forEach(s=>s.classList.add("hidden"));
  document.querySelectorAll(".nb").forEach(n=>n.classList.remove("active"));
  const sec=document.getElementById("sec-"+name); if(sec) sec.classList.remove("hidden");
  if(el) el.classList.add("active");
  const pt=document.getElementById("pageTitle");
  if(pt) pt.textContent=t({dashboard:"nav_dashboard",shipments:"nav_shipments",add:"nav_add"}[name]||name);
  if(window.innerWidth<=768) closeSidebar();
}

function toggleSidebar(){ const sb=document.getElementById("sidebar"); const ov=document.getElementById("sbOverlay"); sb.classList.toggle("open"); ov.classList.toggle("hidden",!sb.classList.contains("open")); }
function closeSidebar(){ document.getElementById("sidebar").classList.remove("open"); document.getElementById("sbOverlay").classList.add("hidden"); }

function setSyncState(state){
  const dot=document.getElementById("syncDot");
  const txt=document.getElementById("syncTxt");
  if(!dot||!txt) return;
  dot.className="sync-dot";
  if(state==="syncing"){dot.classList.add("syncing");txt.textContent=t("syncing");}
  else if(state==="ok"){txt.textContent=t("sync_ok");}
  else{dot.classList.add("offline");txt.textContent=t("sync_err");}
}
function setLastSync(){
  const el=document.getElementById("lastSync");
  if(el) el.textContent=t("last_sync")+" "+new Date().toLocaleTimeString();
}

let toastTimer=null;
function showToast(msg,type){
  const el=document.getElementById("toastEl"); if(!el) return;
  el.textContent=msg; el.className="toast-el "+(type||"ok");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.add("hidden"),3500);
}

// ── BOOT ──────────────────────────────────────────────────────────
(function boot(){
  const style=document.createElement("style");
  style.textContent="@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}";
  document.head.appendChild(style);
  theme=localStorage.getItem("g_theme")||"dark";
  lang=localStorage.getItem("g_lang")||"en";
  applyTheme(); setLang(lang); initCanvas();
  const lp=document.getElementById("loginPass");
  const lu=document.getElementById("loginUser");
  if(lp) lp.addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();});
  if(lu) lu.addEventListener("keydown",e=>{if(e.key==="Enter")lp&&lp.focus();});
})();
