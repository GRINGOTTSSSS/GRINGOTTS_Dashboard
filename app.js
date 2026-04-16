/* GRINGOTTS DASHBOARD — app.js
   Columns: Inquiry, BillOfLading, Customer, Origin, Destination, Type, Status, Date, Containers
*/

var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwH1xM5hEFtW3mj98HmiOGGUSQoxNfBIhgO8H3b6F5gEiSQK0L4yf697izD5TS6skEv/exec";
var SHEET_ID   = "2PACX-1vT7XvRzC1uZF7L9UbioAw2dwXgddHKfby00ZZqD4JmB_WVOqn5yiaXkl6Lm3o8apnT2TN7TJCGFNgCq";
var SHEET_GID  = "0";
var CSV_URL    = "https://docs.google.com/spreadsheets/d/e/"+SHEET_ID+"/pub?gid="+SHEET_GID+"&single=true&output=csv";
var SYNC_MS    = 5*60*1000;
var CREDS      = {u:"admin",p:"M@gic1994"};

var ships=[], filtered=[], editRow=null;
var lang="en", theme="dark";
var cStatus=null, cActivity=null, syncTimer=null, loggedIn=false;
var pending={};

var STR={
  en:{d:"Dashboard",s:"Shipments",a:"Add Shipment",sub:"Shipment Command Center",
    t0:"Total",t1:"In Transit",t2:"Delivered",t3:"Pending",t4:"Returned",
    c1:"Status Breakdown",c2:"Activity — 7 Days",rec:"Recent Shipments",va:"View All",
    i:"Inquiry",bl:"Bill of Lading",cu:"Customer",or:"Origin",de:"Destination",
    tp:"Type",st:"Status",da:"Date",wt:"Containers / Trucks",ac:"Action",
    al:"All Statuses",re:"Refresh",nt:"New Shipment",ab:"Add to Sheet",
    es:"Edit Shipment",ca:"Cancel",su:"Save Changes",lo:"Logout",
    nd:"No shipments found.",lu:"USERNAME",lp:"PASSWORD",li:"SIGN IN",
    sy:"Syncing...",sk:"Live",se:"Offline",ls:"Synced",
    ok:"Shipment saved to sheet",er:"Saved locally — sheet unreachable",
    so:"Changes saved to sheet",sr:"Saved locally",rf:"Please fill in Inquiry, Bill of Lading and Customer"},
  ar:{d:"لوحة التحكم",s:"الشحنات",a:"إضافة شحنة",sub:"مركز إدارة الشحنات",
    t0:"الإجمالي",t1:"في الطريق",t2:"تم التسليم",t3:"معلق",t4:"مُعاد",
    c1:"توزيع الحالة",c2:"النشاط — ٧ أيام",rec:"الشحنات الأخيرة",va:"عرض الكل",
    i:"الاستفسار",bl:"بوليصة الشحن",cu:"العميل",or:"المصدر",de:"الوجهة",
    tp:"النوع",st:"الحالة",da:"التاريخ",wt:"الحاويات / الشاحنات",ac:"إجراء",
    al:"جميع الحالات",re:"تحديث",nt:"شحنة جديدة",ab:"إضافة إلى الجدول",
    es:"تعديل الشحنة",ca:"إلغاء",su:"حفظ التغييرات",lo:"خروج",
    nd:"لا توجد شحنات.",lu:"اسم المستخدم",lp:"كلمة المرور",li:"دخول",
    sy:"جارٍ المزامنة...",sk:"مباشر",se:"غير متصل",ls:"مزامنة",
    ok:"تم الحفظ في الجدول",er:"محفوظ محلياً",so:"تم تحديث الشحنة",sr:"محفوظ محلياً",
    rf:"يرجى ملء الحقول المطلوبة"},
  fa:{d:"داشبورد",s:"محموله‌ها",a:"افزودن محموله",sub:"مرکز مدیریت محموله",
    t0:"کل",t1:"در راه",t2:"تحویل داده شده",t3:"در انتظار",t4:"بازگشتی",
    c1:"توزیع وضعیت",c2:"فعالیت — ۷ روز",rec:"محموله‌های اخیر",va:"مشاهده همه",
    i:"استعلام",bl:"بارنامه",cu:"مشتری",or:"مبدأ",de:"مقصد",
    tp:"نوع",st:"وضعیت",da:"تاریخ",wt:"کانتینر / کامیون",ac:"عملیات",
    al:"همه وضعیت‌ها",re:"بروزرسانی",nt:"محموله جدید",ab:"افزودن به جدول",
    es:"ویرایش محموله",ca:"لغو",su:"ذخیره تغییرات",lo:"خروج",
    nd:"هیچ محموله‌ای یافت نشد.",lu:"نام کاربری",lp:"رمز عبور",li:"ورود",
    sy:"در حال همگام‌سازی...",sk:"آنلاین",se:"آفلاین",ls:"همگام",
    ok:"ذخیره در جدول",er:"ذخیره محلی",so:"تغییرات ذخیره شد",sr:"ذخیره محلی",
    rf:"لطفاً فیلدهای اجباری را پر کنید"}
};
function t(k){return (STR[lang]||STR.en)[k]||k;}

/* ── CANVAS ── */
function initCanvas(){
  var cv=document.getElementById("loginCanvas");if(!cv)return;
  var ctx=cv.getContext("2d"),W,H,pts;
  function resize(){W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;}
  function make(){pts=[];for(var i=0;i<55;i++)pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.4+.3,o:Math.random()*.45+.1});}
  function draw(){
    ctx.clearRect(0,0,W,H);
    var c=document.documentElement.getAttribute("data-theme")!=="light"?"201,168,76":"184,144,26";
    for(var i=0;i<pts.length;i++){var p=pts[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba("+c+","+p.o+")";ctx.fill();}
    for(var i=0;i<pts.length;i++)for(var j=i+1;j<pts.length;j++){var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle="rgba("+c+","+(0.055*(1-d/110))+")";ctx.lineWidth=.5;ctx.stroke();}}
    requestAnimationFrame(draw);
  }
  resize();make();draw();window.addEventListener("resize",function(){resize();make();});
}

/* ── THEME ── */
function cycleTheme(){theme=theme==="dark"?"light":"dark";applyTheme();localStorage.setItem("g_theme",theme);if(cStatus)renderCharts();}
function applyTheme(){
  document.documentElement.setAttribute("data-theme",theme);
  var moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var ic=theme==="dark"?moon:sun;
  ["themeBtn","themeBtn2","themeBtnM"].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML=ic;});
}

/* ── LANGUAGE ── */
function setLang(l){
  lang=l;
  var rtl=l==="ar"||l==="fa";
  document.documentElement.setAttribute("dir",rtl?"rtl":"ltr");
  document.documentElement.setAttribute("lang",l);
  document.querySelectorAll(".lbtn").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-lang")===l);});
  var m={
    loginSub:t("sub"),lblUser:t("lu"),lblPass:t("lp"),loginBtnText:t("li"),
    logoutBtn:t("lo"),nav1:t("d"),nav2:t("s"),nav3:t("a"),sbSub:t("sub"),
    kpiLbl0:t("t0"),kpiLbl1:t("t1"),kpiLbl2:t("t2"),kpiLbl3:t("t3"),kpiLbl4:t("t4"),
    chartTitle1:t("c1"),chartTitle2:t("c2"),recentTitle:t("rec"),viewAllBtn:t("va"),
    thId:t("i"),thBL:t("bl"),thCust:t("cu"),thType:t("tp"),thDest:t("de"),thStat:t("st"),thDate:t("da"),
    thId2:t("i"),thBL2:t("bl"),thCust2:t("cu"),thOrig2:t("or"),thDest2:t("de"),thType2:t("tp"),
    thStat2:t("st"),thDate2:t("da"),thWt2:t("wt"),thAct2:t("ac"),
    addTitle:t("nt"),addBtnText:t("ab"),
    fId:t("i"),fBL:t("bl"),fCust:t("cu"),fOrig:t("or"),fDest:t("de"),
    fType:t("tp"),fStat:t("st"),fDate:t("da"),fWt:t("wt"),
    refreshBtn:t("re"),optAll:t("al"),modalTitle:t("es"),
    cancelBtn:t("ca"),submitBtnText:t("su"),
    mLblBL:t("bl"),mLblCust:t("cu"),mLblOrig:t("or"),mLblDest:t("de"),
    mLblType:t("tp"),mLblStat:t("st"),mLblDate:t("da"),mLblWt:t("wt")
  };
  Object.keys(m).forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=m[id];});
  var si=document.getElementById("searchInp");
  if(si)si.placeholder=l==="ar"?"بحث...":l==="fa"?"جستجو...":"Search shipments...";
  if(loggedIn){renderTbl();renderRecent();}
  localStorage.setItem("g_lang",l);
}

/* ── LOGIN ── */
function doLogin(){
  var u=document.getElementById("loginUser").value.trim();
  var p=document.getElementById("loginPass").value;
  var err=document.getElementById("loginErr");
  if(u===CREDS.u&&p===CREDS.p){
    err.textContent="";
    document.getElementById("loginScreen").style.display="none";
    document.getElementById("app").style.display="grid";
    loggedIn=true;initApp();
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

/* ── INIT ── */
function initApp(){loadData();syncTimer=setInterval(loadData,SYNC_MS);}

/* ── READ ── */
function loadData(){
  if(!loggedIn)return;
  setSyncState("syncing");
  fetch(CSV_URL+"&t="+Date.now(),{cache:"no-store"})
    .then(function(r){return r.ok?r.text():Promise.reject(r.status);})
    .then(function(csv){
      var parsed=parseCSV(csv);
      if(parsed.length>0){ships=mergePending(parsed);setSyncState("ok");var el=document.getElementById("lastSync");if(el)el.textContent=t("ls")+" "+new Date().toLocaleTimeString();}
      else{if(ships.length===0)ships=demo();setSyncState("err");}
      renderAll();
    })
    .catch(function(){if(ships.length===0)ships=demo();setSyncState("err");renderAll();});
}

/* ── MERGE PENDING ── */
function mergePending(sheetData){
  if(!Object.keys(pending).length)return sheetData;
  var map={};sheetData.forEach(function(s){map[String(s.Inquiry)]=s;});
  Object.keys(pending).forEach(function(id){
    var entry=pending[id];
    if(entry.type==="edit"){
      if(map[id]){if(JSON.stringify(map[id])===JSON.stringify(entry.ship)){delete pending[id];}else{map[id]=entry.ship;}}
    } else if(entry.type==="add"){
      if(map[id]){delete pending[id];}else{sheetData.unshift(entry.ship);}
    }
  });
  return sheetData;
}

/* ── CSV PARSER ── */
function parseCSV(csv){
  if(!csv||!csv.trim())return[];
  var lines=csv.trim().split("\n");
  if(lines.length<2)return[];
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
    if(cells.every(function(c){return!c.trim();}))continue;
    var raw={};hdrs.forEach(function(h,j){raw[h]=cells[j]||"";});
    var obj={
      _row:i+1,
      Inquiry:     raw.inquiry||raw.id||String(i),
      BillOfLading:raw.billoflading||raw.bl||raw.tracking||raw.trackingnumber||"",
      Customer:    raw.customer||raw.customername||raw.name||raw.client||"",
      Origin:      raw.origin||raw.from||raw.source||"",
      Destination: raw.destination||raw.to||raw.dest||"",
      Type:        fixType(raw.type||raw.typeofshipment||raw.shipmenttype||"SEA"),
      Status:      fixStatus(raw.status||raw.state||"Pending"),
      Date:        raw.date||raw.shipmentdate||raw.shipped||"",
      Containers:  raw.containers||raw.numberofcontainersortruck||raw.containerortruck||raw.weight||raw.kg||""
    };
    if(obj.Inquiry||obj.BillOfLading||obj.Customer)out.push(obj);
  }
  return out;
}

function fixStatus(s){
  if(!s)return"Pending";
  var l=s.toLowerCase().trim();
  if(l.indexOf("transit")>=0||l.indexOf("ship")>=0)return"In Transit";
  if(l.indexOf("deliver")>=0||l.indexOf("complet")>=0)return"Delivered";
  if(l.indexOf("return")>=0)return"Returned";
  if(l.indexOf("cancel")>=0)return"Cancelled";
  if(l.indexOf("pend")>=0||l.indexOf("wait")>=0)return"Pending";
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function fixType(s){
  if(!s)return"SEA";
  var l=s.toUpperCase().trim();
  if(l==="SEA"||l==="OCEAN"||l==="MARITIME")return"SEA";
  if(l==="LAND"||l==="ROAD"||l==="TRUCK"||l==="GROUND")return"Land";
  if(l==="SKY"||l==="AIR"||l==="AIRLINE"||l==="FLIGHT")return"SKY";
  return s;
}

/* ── DEMO DATA ── */
function demo(){
  return [
    {_row:2,Inquiry:"GRT-001",BillOfLading:"BL900001",Customer:"Ali Hassan",Origin:"Tehran",Destination:"Dubai",Type:"SEA",Status:"In Transit",Date:"2025-04-14",Containers:"2"},
    {_row:3,Inquiry:"GRT-002",BillOfLading:"BL900002",Customer:"Sara Mehr",Origin:"Dubai",Destination:"London",Type:"SKY",Status:"Delivered",Date:"2025-04-13",Containers:"1"},
    {_row:4,Inquiry:"GRT-003",BillOfLading:"BL900003",Customer:"John Smith",Origin:"London",Destination:"New York",Type:"SEA",Status:"Pending",Date:"2025-04-15",Containers:"5"},
    {_row:5,Inquiry:"GRT-004",BillOfLading:"BL900004",Customer:"Leila Karimi",Origin:"Istanbul",Destination:"Tehran",Type:"Land",Status:"Returned",Date:"2025-04-12",Containers:"3"},
    {_row:6,Inquiry:"GRT-005",BillOfLading:"BL900005",Customer:"Omar Farsi",Origin:"Cairo",Destination:"Riyadh",Type:"Land",Status:"In Transit",Date:"2025-04-15",Containers:"2"},
    {_row:7,Inquiry:"GRT-006",BillOfLading:"BL900006",Customer:"David Park",Origin:"Paris",Destination:"Berlin",Type:"SKY",Status:"Delivered",Date:"2025-04-11",Containers:"1"},
    {_row:8,Inquiry:"GRT-007",BillOfLading:"BL900007",Customer:"Nina Sato",Origin:"Berlin",Destination:"Tokyo",Type:"SEA",Status:"Pending",Date:"2025-04-15",Containers:"4"},
  ];
}

/* ── JSONP WRITE ── */
function callScript(params){
  return new Promise(function(resolve,reject){
    var cbName="gs_cb_"+Date.now()+"_"+Math.floor(Math.random()*9999);
    window[cbName]=function(result){cleanup();resolve(result);};
    var timer=setTimeout(function(){cleanup();resolve({ok:true,timedOut:true});},15000);
    function cleanup(){clearTimeout(timer);delete window[cbName];var el=document.getElementById(cbName);if(el)el.parentNode.removeChild(el);}
    var parts=["callback="+encodeURIComponent(cbName)];
    Object.keys(params).forEach(function(k){parts.push(encodeURIComponent(k)+"="+encodeURIComponent(params[k]));});
    parts.push("t="+Date.now());
    var script=document.createElement("script");
    script.id=cbName;script.src=SCRIPT_URL+"?"+parts.join("&");
    script.onerror=function(){cleanup();reject(new Error("Script load failed"));};
    document.head.appendChild(script);
  });
}

/* ── RENDER ── */
function renderAll(){renderKPIs();renderCharts();filterTbl();renderRecent();}

function cnt(s){return ships.filter(function(x){return x.Status===s;}).length;}
function renderKPIs(){
  var e;
  e=document.getElementById("kTotal");    if(e)e.textContent=ships.length;
  e=document.getElementById("kTransit");  if(e)e.textContent=cnt("In Transit");
  e=document.getElementById("kDelivered");if(e)e.textContent=cnt("Delivered");
  e=document.getElementById("kPending");  if(e)e.textContent=cnt("Pending");
  e=document.getElementById("kReturned"); if(e)e.textContent=cnt("Returned");
}

function renderCharts(){
  if(typeof Chart==="undefined")return;
  var dk=theme==="dark";
  var tc=dk?"#7c8499":"#5a6070",gc=dk?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)";
  var c1=document.getElementById("cStatus");
  if(c1){
    if(cStatus){cStatus.destroy();cStatus=null;}
    cStatus=new Chart(c1.getContext("2d"),{type:"doughnut",data:{
      labels:["Pending","In Transit","Delivered","Returned","Cancelled"],
      datasets:[{data:[cnt("Pending"),cnt("In Transit"),cnt("Delivered"),cnt("Returned"),cnt("Cancelled")],
        backgroundColor:["#f0a500","#4ea8f7","#3ecf8e","#8b74f5","#f05252"],
        borderColor:dk?"#13151a":"#ffffff",borderWidth:2,hoverOffset:8}]
    },options:{plugins:{legend:{position:"bottom",labels:{color:tc,padding:14,font:{size:11,family:"'DM Sans'"}}}},cutout:"62%",responsive:true,maintainAspectRatio:false}});
  }
  var c2=document.getElementById("cActivity");
  if(c2){
    if(cActivity){cActivity.destroy();cActivity=null;}
    var days=[],dc=[];
    for(var i=6;i>=0;i--){
      var d=new Date(Date.now()-i*86400000),ds=d.toISOString().slice(0,10);
      days.push(d.toLocaleDateString(lang==="ar"?"ar-SA":lang==="fa"?"fa-IR":"en-US",{weekday:"short"}));
      dc.push(ships.filter(function(s){return s.Date===ds;}).length);
    }
    cActivity=new Chart(c2.getContext("2d"),{type:"bar",data:{labels:days,datasets:[{data:dc,backgroundColor:"rgba(201,168,76,0.5)",borderColor:"#c9a84c",borderWidth:2,borderRadius:6}]},
      options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:tc,font:{size:11}},grid:{color:gc}},y:{ticks:{color:tc,stepSize:1},grid:{color:gc},beginAtZero:true}},responsive:true,maintainAspectRatio:false}});
  }
}

function typeBadge(tp){
  var map={SEA:"bt",Land:"bg",SKY:"bk"};
  var icons={SEA:"⛴",Land:"🚚",SKY:"✈"};
  return '<span class="badge '+(map[tp]||"bt")+'" style="font-size:10px">'+(icons[tp]||"")+" "+esc(tp)+"</span>";
}
function badge(s){
  var map={Pending:"bp","In Transit":"bt",Delivered:"bd",Returned:"br",Cancelled:"bc"};
  var icons={Pending:"⏳","In Transit":"→",Delivered:"✓",Returned:"↩",Cancelled:"✕"};
  return '<span class="badge '+(map[s]||"bp")+'">'+icons[s]+" "+s+"</span>";
}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

function renderRows(data,tbodyId,emptyId,full){
  var tb=document.getElementById(tbodyId),em=document.getElementById(emptyId);
  if(!tb)return;
  if(!data.length){tb.innerHTML="";if(em){em.style.display="block";em.textContent=t("nd");}return;}
  if(em)em.style.display="none";
  var mono="font-family:'DM Mono',monospace;font-size:11px";
  tb.innerHTML=data.map(function(s){
    var pd=full&&pending[String(s.Inquiry)]?'<span title="Pending" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f0a500;margin-left:4px;vertical-align:middle"></span>':"";
    var act=full?'<td><button class="btn-action" type="button" onclick="openModal(\''+esc(s.Inquiry)+'\')">'+t("es")+"</button></td>":"";
    return "<tr>"
      +"<td><span style='"+mono+"'>"+esc(s.Inquiry)+pd+"</span></td>"
      +(full?"<td><span style='"+mono+"'>"+esc(s.BillOfLading)+"</span></td>":"")
      +"<td class='tname'>"+esc(s.Customer)+"</td>"
      +(full?"<td>"+esc(s.Origin)+"</td>":"")
      +"<td>"+esc(s.Destination)+"</td>"
      +"<td>"+typeBadge(s.Type)+"</td>"
      +"<td>"+badge(s.Status)+"</td>"
      +"<td><span style='"+mono+"'>"+esc(s.Date)+"</span></td>"
      +(full?"<td><span style='"+mono+"'>"+esc(s.Containers)+"</span></td>":"")
      +act+"</tr>";
  }).join("");
}

function renderTbl(){filtered=ships.slice();renderRows(filtered,"shipBody","shipEmpty",true);}
function renderRecent(){renderRows(ships.slice(0,6),"recentBody","recentEmpty",false);}

function filterTbl(){
  var q=(document.getElementById("searchInp")?document.getElementById("searchInp").value:"").toLowerCase().trim();
  var st=document.getElementById("filterSel")?document.getElementById("filterSel").value:"";
  var tp=document.getElementById("filterType")?document.getElementById("filterType").value:"";
  filtered=ships.filter(function(s){
    return(!st||s.Status===st)&&(!tp||s.Type===tp)&&(!q||Object.keys(s).some(function(k){return String(s[k]).toLowerCase().indexOf(q)>=0;}));
  });
  renderRows(filtered,"shipBody","shipEmpty",true);
}

/* ── MODAL — full edit ── */
function openModal(inqId){
  var s=null;
  for(var i=0;i<ships.length;i++){if(String(ships[i].Inquiry)===String(inqId)){s=ships[i];break;}}
  if(!s)return;
  editRow={inquiry:inqId};
  // Populate all fields
  sv("mBL",   s.BillOfLading);
  sv("mCust", s.Customer);
  sv("mOrig", s.Origin);
  sv("mDest", s.Destination);
  sv("mType", s.Type||"SEA");
  sv("modalSel",s.Status||"Pending");
  sv("mDate", s.Date);
  sv("mWt",   s.Containers);
  document.getElementById("modalBg").style.display="flex";
}
function closeModal(){document.getElementById("modalBg").style.display="none";editRow=null;}
function sv(id,val){var e=document.getElementById(id);if(e)e.value=val||"";}

function submitEdit(){
  if(!editRow)return;
  document.getElementById("btnSubmit").disabled=true;
  // Build updated ship object from modal fields
  var idx=-1;
  for(var i=0;i<ships.length;i++){if(String(ships[i].Inquiry)===String(editRow.inquiry)){idx=i;break;}}
  if(idx<0){document.getElementById("btnSubmit").disabled=false;return;}
  var updated=JSON.parse(JSON.stringify(ships[idx]));
  updated.BillOfLading = gv("mBL");
  updated.Customer     = gv("mCust");
  updated.Origin       = gv("mOrig");
  updated.Destination  = gv("mDest");
  updated.Type         = gv("mType");
  updated.Status       = gv("modalSel");
  updated.Date         = gv("mDate");
  updated.Containers   = gv("mWt");
  // Apply locally
  ships[idx]=updated;
  pending[String(editRow.inquiry)]={type:"edit",ship:JSON.parse(JSON.stringify(updated))};
  closeModal();renderAll();
  // Send to sheet
  var encoded=encodeURIComponent(JSON.stringify(updated));
  callScript({action:"editShipment",id:editRow.inquiry,data:encoded})
    .then(function(){showToast(t("so"),"ok");setTimeout(function(){if(loggedIn)loadData();},8000);})
    .catch(function(){showToast(t("sr"),"warn");});
  document.getElementById("btnSubmit").disabled=false;
}

/* ── ADD ── */
function addShipment(){
  var ship={
    Inquiry:gv("aId"),BillOfLading:gv("aBL"),Customer:gv("aCust"),
    Origin:gv("aOrig"),Destination:gv("aDest"),Type:gv("aType"),
    Status:gv("aStat"),Date:gv("aDate"),Containers:gv("aWt")
  };
  if(!ship.Inquiry||!ship.BillOfLading||!ship.Customer){showFMsg(t("rf"),"er");return;}
  document.getElementById("btnAdd").disabled=true;
  ships.unshift(ship);
  pending[String(ship.Inquiry)]={type:"add",ship:JSON.parse(JSON.stringify(ship))};
  renderAll();
  var encoded=encodeURIComponent(JSON.stringify(ship));
  callScript({action:"addShipment",data:encoded})
    .then(function(){showFMsg(t("ok"),"ok");clearForm();setTimeout(function(){if(loggedIn)loadData();},8000);})
    .catch(function(){showFMsg(t("er"),"er");clearForm();});
  document.getElementById("btnAdd").disabled=false;
}
function gv(id){var e=document.getElementById(id);return e?e.value.trim():"";}
function clearForm(){
  ["aId","aBL","aCust","aOrig","aDest","aDate","aWt"].forEach(function(id){var e=document.getElementById(id);if(e)e.value="";});
  var s=document.getElementById("aStat");if(s)s.value="Pending";
  var tp=document.getElementById("aType");if(tp)tp.value="SEA";
}
function showFMsg(msg,type){var e=document.getElementById("addMsg");e.textContent=msg;e.className="form-msg "+type;setTimeout(function(){e.textContent="";e.className="form-msg";},5000);}

/* ── NAV ── */
function showSec(name,el){
  ["sec-dashboard","sec-shipments","sec-add"].forEach(function(id){var s=document.getElementById(id);if(s)s.style.display="none";});
  document.querySelectorAll(".nb").forEach(function(n){n.classList.remove("active");});
  var sec=document.getElementById("sec-"+name);if(sec)sec.style.display="block";
  if(el)el.classList.add("active");
  var titles={dashboard:t("d"),shipments:t("s"),add:t("a")};
  var pt=document.getElementById("pageTitle");if(pt)pt.textContent=titles[name]||name;
  if(window.innerWidth<=768)closeSidebar();
}
function toggleSidebar(){var sb=document.getElementById("sidebar"),ov=document.getElementById("sbOverlay"),open=sb.classList.toggle("open");ov.style.display=open?"block":"none";}
function closeSidebar(){document.getElementById("sidebar").classList.remove("open");document.getElementById("sbOverlay").style.display="none";}

function setSyncState(state){
  var dot=document.getElementById("syncDot"),txt=document.getElementById("syncTxt");
  if(!dot||!txt)return;
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

(function(){
  theme=localStorage.getItem("g_theme")||"dark";
  lang=localStorage.getItem("g_lang")||"en";
  applyTheme();setLang(lang);initCanvas();
  var lp=document.getElementById("loginPass"),lu=document.getElementById("loginUser");
  if(lp)lp.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});
  if(lu)lu.addEventListener("keydown",function(e){if(e.key==="Enter")lp&&lp.focus();});
})();
