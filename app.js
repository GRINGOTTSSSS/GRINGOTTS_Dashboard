/* GRINGOTTS DASHBOARD — app.js
   Apps Script URL: your deployed web app
   Sheet sync: CSV export (read) + GET params (write)
*/

// ── CONFIG ────────────────────────────────────────────────────────
var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwrTyg0p_cMVpdTG9VdL0eJ9i-2iDpTT5UVhrTdgjYKQYzG_bgLKylwg6s0a4Ic7BY/exec";
var SHEET_ID   = "2PACX-1vT7XvRzC1uZF7L9UbioAw2dwXgddHKfby00ZZqD4JmB_WVOqn5yiaXkl6Lm3o8apnT2TN7TJCGFNgCq";
var SHEET_GID  = "0";
var CSV_URL    = "https://docs.google.com/spreadsheets/d/e/" + SHEET_ID + "/pub?gid=" + SHEET_GID + "&single=true&output=csv";
var SYNC_MS    = 5 * 60 * 1000;
var CREDS      = { u: "admin", p: "M@gic1994" };

// ── STATE ─────────────────────────────────────────────────────────
var ships      = [];
var filtered   = [];
var editRow    = null;
var lang       = "en";
var theme      = "dark";
var cStatus    = null;
var cActivity  = null;
var syncTimer  = null;
var loggedIn   = false;
var pending    = {};   // id → {type,data}  — local changes not yet in sheet

// ── i18n ──────────────────────────────────────────────────────────
var STR = {
  en:{
    d:"Dashboard",s:"Shipments",a:"Add Shipment",sub:"Shipment Command Center",
    t0:"Total Shipments",t1:"In Transit",t2:"Delivered",t3:"Pending",t4:"Returned",
    c1:"Status Breakdown",c2:"Activity — 7 Days",
    rec:"Recent Shipments",va:"View All",
    i:"ID",tr:"Tracking",cu:"Customer",or:"Origin",de:"Destination",
    st:"Status",da:"Date",wt:"Weight",no:"Notes",ac:"Action",
    al:"All Statuses",re:"Refresh",nt:"New Shipment",ab:"Add to Sheet",
    es:"Update Status",ca:"Cancel",su:"Confirm Update",lo:"Logout",
    nd:"No shipments found.",lu:"USERNAME",lp:"PASSWORD",li:"SIGN IN",
    sy:"Syncing...",sk:"Live",se:"Offline",ls:"Synced",
    ok:"Shipment sent to sheet",er:"Could not reach sheet — saved locally",
    so:"Status updated in sheet",sr:"Status saved locally",
    rf:"Please fill in ID, Tracking and Customer"
  },
  ar:{
    d:"لوحة التحكم",s:"الشحنات",a:"إضافة شحنة",sub:"مركز إدارة الشحنات",
    t0:"إجمالي الشحنات",t1:"في الطريق",t2:"تم التسليم",t3:"معلق",t4:"مُعاد",
    c1:"توزيع الحالة",c2:"النشاط — ٧ أيام",
    rec:"الشحنات الأخيرة",va:"عرض الكل",
    i:"الرقم",tr:"التتبع",cu:"العميل",or:"المصدر",de:"الوجهة",
    st:"الحالة",da:"التاريخ",wt:"الوزن",no:"ملاحظات",ac:"إجراء",
    al:"جميع الحالات",re:"تحديث",nt:"شحنة جديدة",ab:"إضافة إلى الجدول",
    es:"تعديل الحالة",ca:"إلغاء",su:"تأكيد",lo:"خروج",
    nd:"لا توجد شحنات.",lu:"اسم المستخدم",lp:"كلمة المرور",li:"دخول",
    sy:"جارٍ المزامنة...",sk:"مباشر",se:"غير متصل",ls:"مزامنة",
    ok:"تمت إضافة الشحنة",er:"فشل الإرسال — محفوظ محلياً",
    so:"تم تحديث الحالة",sr:"محفوظ محلياً",
    rf:"يرجى ملء الحقول المطلوبة"
  },
  fa:{
    d:"داشبورد",s:"محموله‌ها",a:"افزودن محموله",sub:"مرکز مدیریت محموله",
    t0:"کل محموله‌ها",t1:"در راه",t2:"تحویل داده شده",t3:"در انتظار",t4:"بازگشتی",
    c1:"توزیع وضعیت",c2:"فعالیت — ۷ روز",
    rec:"محموله‌های اخیر",va:"مشاهده همه",
    i:"شناسه",tr:"رهگیری",cu:"مشتری",or:"مبدأ",de:"مقصد",
    st:"وضعیت",da:"تاریخ",wt:"وزن",no:"یادداشت",ac:"عملیات",
    al:"همه وضعیت‌ها",re:"بروزرسانی",nt:"محموله جدید",ab:"افزودن به جدول",
    es:"ویرایش وضعیت",ca:"لغو",su:"تأیید",lo:"خروج",
    nd:"هیچ محموله‌ای یافت نشد.",lu:"نام کاربری",lp:"رمز عبور",li:"ورود",
    sy:"در حال همگام‌سازی...",sk:"آنلاین",se:"آفلاین",ls:"همگام",
    ok:"محموله اضافه شد",er:"ارسال ناموفق — ذخیره محلی",
    so:"وضعیت به‌روز شد",sr:"ذخیره محلی",
    rf:"لطفاً فیلدهای اجباری را پر کنید"
  }
};
function t(k){ return (STR[lang]||STR.en)[k]||k; }

// ── CANVAS ANIMATION ──────────────────────────────────────────────
function initCanvas(){
  var cv = document.getElementById("loginCanvas");
  if(!cv) return;
  var ctx = cv.getContext("2d");
  var W,H,pts;
  function resize(){ W=cv.width=window.innerWidth; H=cv.height=window.innerHeight; }
  function make(){ pts=[];for(var i=0;i<55;i++) pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.4+.3,o:Math.random()*.45+.1}); }
  function draw(){
    ctx.clearRect(0,0,W,H);
    var dk=document.documentElement.getAttribute("data-theme")!=="light";
    var c=dk?"201,168,76":"184,144,26";
    for(var i=0;i<pts.length;i++){
      var p=pts[i]; p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle="rgba("+c+","+p.o+")";ctx.fill();
    }
    for(var i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){
      var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<110){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle="rgba("+c+","+(0.055*(1-d/110))+")";ctx.lineWidth=.5;ctx.stroke();}
    }
    requestAnimationFrame(draw);
  }
  resize();make();draw();
  window.addEventListener("resize",function(){resize();make();});
}

// ── THEME ─────────────────────────────────────────────────────────
function cycleTheme(){
  theme=theme==="dark"?"light":"dark";
  applyTheme();
  localStorage.setItem("g_theme",theme);
  if(cStatus) renderCharts();
}
function applyTheme(){
  document.documentElement.setAttribute("data-theme",theme);
  var moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var ic=theme==="dark"?moon:sun;
  ["themeBtn","themeBtn2","themeBtnM"].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML=ic;});
}

// ── LANGUAGE ──────────────────────────────────────────────────────
function setLang(l){
  lang=l;
  var rtl=l==="ar"||l==="fa";
  document.documentElement.setAttribute("dir",rtl?"rtl":"ltr");
  document.documentElement.setAttribute("lang",l);
  document.querySelectorAll(".lbtn").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-lang")===l);});
  // Update all text labels
  var m={
    loginSub:t("sub"),lblUser:t("lu"),lblPass:t("lp"),loginBtnText:t("li"),
    logoutBtn:t("lo"),nav1:t("d"),nav2:t("s"),nav3:t("a"),sbSub:t("sub"),
    kpiLbl0:t("t0"),kpiLbl1:t("t1"),kpiLbl2:t("t2"),kpiLbl3:t("t3"),kpiLbl4:t("t4"),
    chartTitle1:t("c1"),chartTitle2:t("c2"),recentTitle:t("rec"),viewAllBtn:t("va"),
    thId:t("i"),thCust:t("cu"),thDest:t("de"),thStat:t("st"),thDate:t("da"),
    thId2:t("i"),thTrack2:t("tr"),thCust2:t("cu"),thOrig2:t("or"),thDest2:t("de"),
    thStat2:t("st"),thDate2:t("da"),thWt2:t("wt"),thAct2:t("ac"),
    addTitle:t("nt"),addBtnText:t("ab"),fId:t("i"),fTrack:t("tr"),fCust:t("cu"),
    fOrig:t("or"),fDest:t("de"),fStat:t("st"),fDate:t("da"),fWt:t("wt"),fNotes:t("no"),
    refreshBtn:t("re"),optAll:t("al"),modalTitle:t("es"),modalStatLbl:t("st"),
    cancelBtn:t("ca"),submitBtnText:t("su")
  };
  Object.keys(m).forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=m[id];});
  var si=document.getElementById("searchInp");
  if(si) si.placeholder=l==="ar"?"بحث...":l==="fa"?"جستجو...":"Search shipments...";
  if(loggedIn){renderTbl();renderRecent();}
  localStorage.setItem("g_lang",l);
}

// ── LOGIN ─────────────────────────────────────────────────────────
function doLogin(){
  var u=document.getElementById("loginUser").value.trim();
  var p=document.getElementById("loginPass").value;
  var err=document.getElementById("loginErr");
  if(u===CREDS.u&&p===CREDS.p){
    err.textContent="";
    document.getElementById("loginScreen").style.display="none";
    document.getElementById("app").style.display="grid";
    loggedIn=true;
    initApp();
  } else {
    err.textContent=lang==="ar"?"بيانات غير صحيحة":lang==="fa"?"اطلاعات نادرست است":"Incorrect username or password";
    document.getElementById("loginPass").value="";
    var card=document.querySelector(".login-card");
    card.style.animation="none";void card.offsetHeight;card.style.animation="shake .4s ease";
  }
}
function doLogout(){
  loggedIn=false;clearInterval(syncTimer);syncTimer=null;
  ships=[];filtered=[];pending={};
  document.getElementById("app").style.display="none";
  document.getElementById("loginScreen").style.display="flex";
  document.getElementById("loginUser").value="";
  document.getElementById("loginPass").value="";
  document.getElementById("loginErr").textContent="";
}
function togglePw(){var i=document.getElementById("loginPass");i.type=i.type==="password"?"text":"password";}

// ── INIT ──────────────────────────────────────────────────────────
function initApp(){
  loadData();
  syncTimer=setInterval(loadData,SYNC_MS);
}

// ── READ FROM SHEET ───────────────────────────────────────────────
function loadData(){
  if(!loggedIn) return;
  setSyncState("syncing");
  fetch(CSV_URL+"&t="+Date.now(),{cache:"no-store"})
    .then(function(r){return r.ok?r.text():Promise.reject(r.status);})
    .then(function(csv){
      var parsed=parseCSV(csv);
      if(parsed.length>0){
        ships=mergePending(parsed);
        setSyncState("ok");
        var el=document.getElementById("lastSync");
        if(el) el.textContent=t("ls")+" "+new Date().toLocaleTimeString();
      } else {
        if(ships.length===0) ships=demo();
        setSyncState("err");
      }
      renderAll();
    })
    .catch(function(){
      if(ships.length===0) ships=demo();
      setSyncState("err");
      renderAll();
    });
}

// ── MERGE pending writes on top of fresh sheet data ───────────────
function mergePending(sheetData){
  if(!Object.keys(pending).length) return sheetData;
  var map={};
  sheetData.forEach(function(s){map[String(s.ID)]=s;});
  Object.keys(pending).forEach(function(id){
    var entry=pending[id];
    if(entry.type==="status"){
      if(map[id]){
        if(map[id].Status===entry.status){ delete pending[id]; }
        else { map[id].Status=entry.status; }
      }
    } else if(entry.type==="add"){
      if(map[id]){ delete pending[id]; }
      else { sheetData.unshift(entry.ship); }
    }
  });
  return sheetData;
}

// ── CSV PARSER ────────────────────────────────────────────────────
function parseCSV(csv){
  if(!csv||!csv.trim()) return [];
  var lines=csv.trim().split("\n");
  if(lines.length<2) return [];
  function parseLine(line){
    var res=[],cur="",inQ=false;
    for(var i=0;i<line.length;i++){
      var ch=line[i];
      if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else{inQ=!inQ;}}
      else if(ch===','&&!inQ){res.push(cur.trim());cur="";}
      else{cur+=ch;}
    }
    res.push(cur.trim());return res;
  }
  var hdrs=parseLine(lines[0]).map(function(h){return h.toLowerCase().replace(/[^a-z0-9]/g,"");});
  var out=[];
  for(var i=1;i<lines.length;i++){
    var cells=parseLine(lines[i]);
    if(cells.every(function(c){return!c.trim();})) continue;
    var raw={};
    hdrs.forEach(function(h,j){raw[h]=cells[j]||"";});
    var obj={
      _row:i+1,
      ID:         raw.id||raw.shipmentid||String(i),
      Tracking:   raw.tracking||raw.trackingnumber||raw.track||"",
      Customer:   raw.customer||raw.customername||raw.name||raw.client||"",
      Origin:     raw.origin||raw.from||raw.source||"",
      Destination:raw.destination||raw.to||raw.dest||"",
      Status:     fixStatus(raw.status||raw.state||"Pending"),
      Date:       raw.date||raw.shipmentdate||raw.shipped||"",
      Weight:     raw.weight||raw.weightkg||raw.kg||"",
      Notes:      raw.notes||raw.note||raw.remarks||""
    };
    if(obj.ID||obj.Tracking||obj.Customer) out.push(obj);
  }
  return out;
}

function fixStatus(s){
  if(!s) return "Pending";
  var l=s.toLowerCase().trim();
  if(l.indexOf("transit")>=0||l.indexOf("ship")>=0) return "In Transit";
  if(l.indexOf("deliver")>=0||l.indexOf("complet")>=0) return "Delivered";
  if(l.indexOf("return")>=0) return "Returned";
  if(l.indexOf("cancel")>=0) return "Cancelled";
  if(l.indexOf("pend")>=0||l.indexOf("wait")>=0) return "Pending";
  return s.charAt(0).toUpperCase()+s.slice(1);
}

// ── DEMO DATA ─────────────────────────────────────────────────────
function demo(){
  var rows=[
    ["GRT-001","TRK900001","Ali Hassan","Tehran","Dubai","In Transit","2025-04-14","2.5",""],
    ["GRT-002","TRK900002","Sara Mehr","Dubai","London","Delivered","2025-04-13","1.8","Fragile"],
    ["GRT-003","TRK900003","John Smith","London","New York","Pending","2025-04-15","5.2",""],
    ["GRT-004","TRK900004","Leila Karimi","Istanbul","Tehran","Returned","2025-04-12","0.9","Damaged"],
    ["GRT-005","TRK900005","Omar Farsi","Cairo","Riyadh","In Transit","2025-04-15","3.1",""],
    ["GRT-006","TRK900006","David Park","Paris","Berlin","Delivered","2025-04-11","7.0",""],
    ["GRT-007","TRK900007","Nina Sato","Berlin","Tokyo","Pending","2025-04-15","4.4",""],
  ];
  return rows.map(function(r,i){return{_row:i+2,ID:r[0],Tracking:r[1],Customer:r[2],Origin:r[3],Destination:r[4],Status:r[5],Date:r[6],Weight:r[7],Notes:r[8]};});
}

// ── WRITE TO SHEET via GET params ─────────────────────────────────
function callScript(params){
  var url=SCRIPT_URL+"?";
  var parts=[];
  Object.keys(params).forEach(function(k){parts.push(encodeURIComponent(k)+"="+encodeURIComponent(params[k]));});
  url+=parts.join("&")+"&t="+Date.now();
  // Use no-cors GET — script still executes server-side even without readable response
  return fetch(url,{method:"GET",mode:"no-cors",cache:"no-store"});
}

// ── RENDER ────────────────────────────────────────────────────────
function renderAll(){renderKPIs();renderCharts();filterTbl();renderRecent();}

function cnt(s){return ships.filter(function(x){return x.Status===s;}).length;}

function renderKPIs(){
  var e;
  e=document.getElementById("kTotal");    if(e) e.textContent=ships.length;
  e=document.getElementById("kTransit");  if(e) e.textContent=cnt("In Transit");
  e=document.getElementById("kDelivered");if(e) e.textContent=cnt("Delivered");
  e=document.getElementById("kPending");  if(e) e.textContent=cnt("Pending");
  e=document.getElementById("kReturned"); if(e) e.textContent=cnt("Returned");
}

function renderCharts(){
  if(typeof Chart==="undefined") return;
  var dk=theme==="dark";
  var tc=dk?"#7c8499":"#5a6070";
  var gc=dk?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)";

  var c1=document.getElementById("cStatus");
  if(c1){
    if(cStatus){cStatus.destroy();cStatus=null;}
    cStatus=new Chart(c1.getContext("2d"),{
      type:"doughnut",
      data:{
        labels:["Pending","In Transit","Delivered","Returned","Cancelled"],
        datasets:[{data:[cnt("Pending"),cnt("In Transit"),cnt("Delivered"),cnt("Returned"),cnt("Cancelled")],
          backgroundColor:["#f0a500","#4ea8f7","#3ecf8e","#8b74f5","#f05252"],
          borderColor:dk?"#13151a":"#ffffff",borderWidth:2,hoverOffset:8}]
      },
      options:{plugins:{legend:{position:"bottom",labels:{color:tc,padding:14,font:{size:11,family:"'DM Sans'"}}}},cutout:"62%",responsive:true,maintainAspectRatio:false}
    });
  }

  var c2=document.getElementById("cActivity");
  if(c2){
    if(cActivity){cActivity.destroy();cActivity=null;}
    var days=[],dc=[];
    for(var i=6;i>=0;i--){
      var d=new Date(Date.now()-i*86400000);
      var ds=d.toISOString().slice(0,10);
      days.push(d.toLocaleDateString(lang==="ar"?"ar-SA":lang==="fa"?"fa-IR":"en-US",{weekday:"short"}));
      dc.push(ships.filter(function(s){return s.Date===ds;}).length);
    }
    cActivity=new Chart(c2.getContext("2d"),{
      type:"bar",
      data:{labels:days,datasets:[{data:dc,backgroundColor:"rgba(201,168,76,0.5)",borderColor:"#c9a84c",borderWidth:2,borderRadius:6}]},
      options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:tc,font:{size:11}},grid:{color:gc}},y:{ticks:{color:tc,stepSize:1},grid:{color:gc},beginAtZero:true}},responsive:true,maintainAspectRatio:false}
    });
  }
}

function badge(s){
  var map={Pending:["bp","⏳"],"In Transit":["bt","→"],Delivered:["bd","✓"],Returned:["br","↩"],Cancelled:["bc","✕"]};
  var b=map[s]||["bp","•"];
  return '<span class="badge '+b[0]+'">'+b[1]+" "+s+"</span>";
}

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

function renderRows(data,tbodyId,emptyId,full){
  var tb=document.getElementById(tbodyId);
  var em=document.getElementById(emptyId);
  if(!tb) return;
  if(!data.length){
    tb.innerHTML="";
    if(em){em.style.display="block";em.textContent=t("nd");}
    return;
  }
  if(em) em.style.display="none";
  var hasPendKey=full?function(id){return !!pending[String(id)];}:function(){return false;};
  tb.innerHTML=data.map(function(s){
    var pd=hasPendKey(s.ID)?'<span title="Pending sync" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f0a500;margin-left:4px;vertical-align:middle"></span>':"";
    var act=full?'<td><button class="btn-action" type="button" onclick="openModal(\''+esc(s.ID)+'\',\''+esc(s.Tracking)+'\',\''+esc(s.Status)+'\')">'+t("es")+"</button></td>":"";
    return "<tr>"
      +"<td><span style=\"font-family:'DM Mono',monospace;font-size:11px\">"+esc(s.ID)+pd+"</span></td>"
      +(full?"<td><span style=\"font-family:'DM Mono',monospace;font-size:11px\">"+esc(s.Tracking)+"</span></td>":"")
      +"<td class=\"tname\">"+esc(s.Customer)+"</td>"
      +(full?"<td>"+esc(s.Origin)+"</td>":"")
      +"<td>"+esc(s.Destination)+"</td>"
      +"<td>"+badge(s.Status)+"</td>"
      +"<td><span style=\"font-family:'DM Mono',monospace;font-size:11px\">"+esc(s.Date)+"</span></td>"
      +(full?"<td>"+(s.Weight?esc(s.Weight)+" kg":"—")+"</td>":"")
      +act+"</tr>";
  }).join("");
}

function renderTbl(){filtered=ships.slice();renderRows(filtered,"shipBody","shipEmpty",true);}
function renderRecent(){renderRows(ships.slice(0,6),"recentBody","recentEmpty",false);}

function filterTbl(){
  var q=(document.getElementById("searchInp")?document.getElementById("searchInp").value:"").toLowerCase().trim();
  var st=document.getElementById("filterSel")?document.getElementById("filterSel").value:"";
  filtered=ships.filter(function(s){
    var mS=!st||s.Status===st;
    var mQ=!q||Object.keys(s).some(function(k){return String(s[k]).toLowerCase().indexOf(q)>=0;});
    return mS&&mQ;
  });
  renderRows(filtered,"shipBody","shipEmpty",true);
}

// ── MODAL ─────────────────────────────────────────────────────────
function openModal(id,track,stat){
  editRow={id:id,track:track};
  document.getElementById("modalId").textContent=t("i")+": "+id+"   "+t("tr")+": "+track;
  document.getElementById("modalSel").value=stat||"Pending";
  document.getElementById("modalBg").style.display="flex";
}
function closeModal(){document.getElementById("modalBg").style.display="none";editRow=null;}

function submitEdit(){
  if(!editRow) return;
  var ns=document.getElementById("modalSel").value;
  document.getElementById("btnSubmit").disabled=true;
  // Apply locally
  var idx=-1;
  for(var i=0;i<ships.length;i++){if(String(ships[i].ID)===String(editRow.id)){idx=i;break;}}
  if(idx>=0) ships[idx].Status=ns;
  // Queue as pending
  pending[String(editRow.id)]={type:"status",status:ns};
  var cid=editRow.id;
  closeModal();
  renderAll();
  // Send to sheet
  callScript({action:"updateStatus",id:cid,status:ns})
    .then(function(){showToast(t("so"),"ok");setTimeout(function(){if(loggedIn)loadData();},8000);})
    .catch(function(){showToast(t("sr"),"warn");});
  document.getElementById("btnSubmit").disabled=false;
}

// ── ADD ───────────────────────────────────────────────────────────
function addShipment(){
  var ship={
    ID:gv("aId"),Tracking:gv("aTrack"),Customer:gv("aCust"),
    Origin:gv("aOrig"),Destination:gv("aDest"),Status:gv("aStat"),
    Date:gv("aDate"),Weight:gv("aWt"),Notes:gv("aNotes")
  };
  if(!ship.ID||!ship.Tracking||!ship.Customer){showFMsg(t("rf"),"er");return;}
  document.getElementById("btnAdd").disabled=true;
  ships.unshift(ship);
  pending[String(ship.ID)]={type:"add",ship:JSON.parse(JSON.stringify(ship))};
  renderAll();
  var encoded=encodeURIComponent(JSON.stringify(ship));
  callScript({action:"addShipment",data:encoded})
    .then(function(){showFMsg(t("ok"),"ok");clearForm();setTimeout(function(){if(loggedIn)loadData();},8000);})
    .catch(function(){showFMsg(t("er"),"er");clearForm();});
  document.getElementById("btnAdd").disabled=false;
}
function gv(id){var e=document.getElementById(id);return e?e.value.trim():"";}
function clearForm(){
  ["aId","aTrack","aCust","aOrig","aDest","aDate","aWt","aNotes"].forEach(function(id){var e=document.getElementById(id);if(e)e.value="";});
  var s=document.getElementById("aStat");if(s)s.value="Pending";
}
function showFMsg(msg,type){
  var e=document.getElementById("addMsg");
  e.textContent=msg;e.className="form-msg "+type;
  setTimeout(function(){e.textContent="";e.className="form-msg";},5000);
}

// ── NAV ───────────────────────────────────────────────────────────
function showSec(name,el){
  ["sec-dashboard","sec-shipments","sec-add"].forEach(function(id){
    var s=document.getElementById(id);if(s)s.style.display="none";
  });
  document.querySelectorAll(".nb").forEach(function(n){n.classList.remove("active");});
  var sec=document.getElementById("sec-"+name);if(sec)sec.style.display="block";
  if(el)el.classList.add("active");
  var titles={dashboard:t("d"),shipments:t("s"),add:t("a")};
  var pt=document.getElementById("pageTitle");if(pt)pt.textContent=titles[name]||name;
  if(window.innerWidth<=768)closeSidebar();
}

function toggleSidebar(){
  var sb=document.getElementById("sidebar");
  var ov=document.getElementById("sbOverlay");
  var open=sb.classList.toggle("open");
  ov.style.display=open?"block":"none";
}
function closeSidebar(){
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sbOverlay").style.display="none";
}

function setSyncState(state){
  var dot=document.getElementById("syncDot");
  var txt=document.getElementById("syncTxt");
  if(!dot||!txt) return;
  dot.className="sync-dot";
  if(state==="syncing"){dot.classList.add("syncing");txt.textContent=t("sy");}
  else if(state==="ok"){txt.textContent=t("sk");}
  else{dot.classList.add("offline");txt.textContent=t("se");}
}

var toastTimer=null;
function showToast(msg,type){
  var el=document.getElementById("toastEl");if(!el)return;
  el.textContent=msg;el.className=type||"ok";el.style.display="block";
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.style.display="none";},3500);
}

// ── BOOT ──────────────────────────────────────────────────────────
(function(){
  theme=localStorage.getItem("g_theme")||"dark";
  lang=localStorage.getItem("g_lang")||"en";
  applyTheme();
  setLang(lang);
  initCanvas();

  var lp=document.getElementById("loginPass");
  var lu=document.getElementById("loginUser");
  if(lp) lp.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});
  if(lu) lu.addEventListener("keydown",function(e){if(e.key==="Enter")lp&&lp.focus();});
})();
