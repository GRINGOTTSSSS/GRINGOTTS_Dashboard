/* ─────────────────────────────────────────────────────────────
   GRINGOT SHIPMENT DASHBOARD — app.js
   ─ Login/Logout   ─ Google Sheet sync (read + write)
   ─ Status editing  ─ Add shipment   ─ Charts
   ─ i18n (EN / AR / FA)  ─ Dark/Light theme
──────────────────────────────────────────────────────────────── */

// ══════════════════════════════════════════════════════════════
// ❗ CONFIGURATION — Edit these two lines after setup
// ══════════════════════════════════════════════════════════════
const SHEET_PUBLIC_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7XvRzC1uZF7L9UbioAw2dwXgddHKfby00ZZqD4JmB_WVOqn5yiaXkl6Lm3o8apnT2TN7TJCGFNgCq/pubhtml?gid=0&single=true";

// After you deploy the Apps Script, replace the string below
// with your Web App URL, e.g.:
// "https://script.google.com/macros/s/AKfycby.../exec"
const APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycbwIELrDRDv-xPWFa1y5C_Q85a7DuKt0binn5lwj7TAN3iPGThDJa82oQrYDJSVTgxVf/exec;

// ── AUTH ──────────────────────────────────────────────────────
const AUTH = { username: "admin", password: "M@gic1994" };
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── STATE ─────────────────────────────────────────────────────
let shipments = [];          // master data array
let filtered  = [];          // filtered view
let currentLang = "en";
let currentTheme = "dark";
let editingRow = null;       // { id, trackingNum }
let syncTimer = null;
let chartStatus = null;
let chartActivity = null;

// ══════════════════════════════════════════════════════════════
// i18n STRINGS
// ══════════════════════════════════════════════════════════════
const STRINGS = {
  en: {
    nav_dashboard: "Dashboard", nav_shipments: "Shipments", nav_add: "Add Shipment",
    stat_total: "Total Shipments", stat_transit: "In Transit",
    stat_delivered: "Delivered", stat_pending: "Pending", stat_returned: "Returned",
    chart_status: "Status Breakdown", chart_recent: "Recent Activity (7 days)",
    recent_shipments: "Recent Shipments", view_all: "View All",
    col_id: "ID", col_tracking: "Tracking", col_customer: "Customer",
    col_origin: "Origin", col_dest: "Destination", col_status: "Status",
    col_date: "Date", col_weight: "Weight", col_notes: "Notes", col_actions: "Actions",
    all_statuses: "All Statuses", status_pending: "Pending", status_transit: "In Transit",
    status_delivered: "Delivered", status_returned: "Returned", status_cancelled: "Cancelled",
    refresh: "↻ Refresh", add_title: "Add New Shipment", add_btn: "➕ Add Shipment to Sheet",
    edit_status: "Edit Status", cancel: "Cancel", submit: "Submit Change",
    syncing: "Syncing…", logout: "Logout", no_data: "No shipments found.",
    lbl_username: "Username", lbl_password: "Password", lbl_login: "Sign In",
    login_sub: "Shipment Command Center",
    last_sync: "Last sync:", never: "Never",
    added_ok: "✅ Shipment added to sheet!", added_err: "❌ Could not add. Check Apps Script URL.",
    status_ok: "✅ Status updated!", status_err: "❌ Update failed. Check Apps Script URL.",
    no_script: "⚠️ Apps Script URL not configured. Two-way sync disabled.",
    synced_ok: "✅ Synced with sheet",
  },
  ar: {
    nav_dashboard: "لوحة التحكم", nav_shipments: "الشحنات", nav_add: "إضافة شحنة",
    stat_total: "إجمالي الشحنات", stat_transit: "في الطريق",
    stat_delivered: "تم التسليم", stat_pending: "معلق", stat_returned: "مُعاد",
    chart_status: "توزيع الحالة", chart_recent: "النشاط (٧ أيام)",
    recent_shipments: "الشحنات الأخيرة", view_all: "عرض الكل",
    col_id: "الرقم", col_tracking: "رقم التتبع", col_customer: "العميل",
    col_origin: "المصدر", col_dest: "الوجهة", col_status: "الحالة",
    col_date: "التاريخ", col_weight: "الوزن", col_notes: "ملاحظات", col_actions: "إجراءات",
    all_statuses: "جميع الحالات", status_pending: "معلق", status_transit: "في الطريق",
    status_delivered: "تم التسليم", status_returned: "مُعاد", status_cancelled: "ملغي",
    refresh: "↻ تحديث", add_title: "إضافة شحنة جديدة", add_btn: "➕ إضافة الشحنة إلى الجدول",
    edit_status: "تعديل الحالة", cancel: "إلغاء", submit: "تأكيد التغيير",
    syncing: "جاري المزامنة…", logout: "تسجيل خروج", no_data: "لا توجد شحنات.",
    lbl_username: "اسم المستخدم", lbl_password: "كلمة المرور", lbl_login: "دخول",
    login_sub: "مركز إدارة الشحنات",
    last_sync: "آخر مزامنة:", never: "أبدًا",
    added_ok: "✅ تمت إضافة الشحنة!", added_err: "❌ فشل الإضافة. تحقق من رابط Apps Script.",
    status_ok: "✅ تم تحديث الحالة!", status_err: "❌ فشل التحديث. تحقق من رابط Apps Script.",
    no_script: "⚠️ لم يتم تهيئة Apps Script. المزامنة الثنائية معطلة.",
    synced_ok: "✅ تمت المزامنة مع الجدول",
  },
  fa: {
    nav_dashboard: "داشبورد", nav_shipments: "محموله‌ها", nav_add: "افزودن محموله",
    stat_total: "کل محموله‌ها", stat_transit: "در راه",
    stat_delivered: "تحویل داده شده", stat_pending: "در انتظار", stat_returned: "بازگشتی",
    chart_status: "توزیع وضعیت", chart_recent: "فعالیت اخیر (۷ روز)",
    recent_shipments: "محموله‌های اخیر", view_all: "مشاهده همه",
    col_id: "شناسه", col_tracking: "کد رهگیری", col_customer: "مشتری",
    col_origin: "مبدأ", col_dest: "مقصد", col_status: "وضعیت",
    col_date: "تاریخ", col_weight: "وزن", col_notes: "یادداشت", col_actions: "عملیات",
    all_statuses: "همه وضعیت‌ها", status_pending: "در انتظار", status_transit: "در راه",
    status_delivered: "تحویل داده شده", status_returned: "بازگشتی", status_cancelled: "لغو شده",
    refresh: "↻ بروزرسانی", add_title: "افزودن محموله جدید", add_btn: "➕ افزودن محموله به جدول",
    edit_status: "ویرایش وضعیت", cancel: "لغو", submit: "تأیید تغییر",
    syncing: "در حال همگام‌سازی…", logout: "خروج", no_data: "هیچ محموله‌ای یافت نشد.",
    lbl_username: "نام کاربری", lbl_password: "رمز عبور", lbl_login: "ورود",
    login_sub: "مرکز مدیریت محموله",
    last_sync: "آخرین همگام:", never: "هرگز",
    added_ok: "✅ محموله اضافه شد!", added_err: "❌ افزودن ناموفق. لینک Apps Script را بررسی کنید.",
    status_ok: "✅ وضعیت به‌روز شد!", status_err: "❌ به‌روزرسانی ناموفق. لینک Apps Script را بررسی کنید.",
    no_script: "⚠️ لینک Apps Script تنظیم نشده. همگام‌سازی دوطرفه غیرفعال است.",
    synced_ok: "✅ با جدول همگام شد",
  }
};

function t(key) { return (STRINGS[currentLang] || STRINGS.en)[key] || key; }

// ══════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════
function cycleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  const icon = currentTheme === "dark" ? "🌙" : "☀️";
  document.getElementById("themeBtn").textContent  = icon;
  document.getElementById("themeBtn2").textContent = icon;
  localStorage.setItem("gringot_theme", currentTheme);
  if (chartStatus) renderCharts();
}

// ══════════════════════════════════════════════════════════════
// LANGUAGE
// ══════════════════════════════════════════════════════════════
function setLang(lang) {
  currentLang = lang;
  const rtl = ["ar", "fa"].includes(lang);
  document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lang);

  // Update all data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });

  // Placeholders
  const si = document.getElementById("searchInput");
  if (si) si.placeholder = currentLang === "ar" ? "بحث…" : currentLang === "fa" ? "جستجو…" : "Search…";

  // Active lang button
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-lang") === lang);
  });

  // Login labels
  document.getElementById("lbl-username").textContent = t("lbl_username");
  document.getElementById("lbl-password").textContent = t("lbl_password");
  document.getElementById("lbl-login").textContent    = t("lbl_login");
  document.getElementById("loginSub").textContent     = t("login_sub");
  document.getElementById("lbl-add-btn").textContent  = t("add_btn");

  // Re-render table if data loaded
  renderTable();
  updateSyncText();
  localStorage.setItem("gringot_lang", lang);
}

// ══════════════════════════════════════════════════════════════
// LOGIN / LOGOUT
// ══════════════════════════════════════════════════════════════
function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  if (u === AUTH.username && p === AUTH.password) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("app").classList.remove("hidden");
    initDashboard();
  } else {
    document.getElementById("loginError").textContent =
      currentLang === "ar" ? "بيانات الاعتماد غير صحيحة" :
      currentLang === "fa" ? "اطلاعات ورود نادرست است" :
      "Invalid credentials";
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
  }
}
document.getElementById("loginPass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("loginUser").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginPass").focus();
});

function doLogout() {
  clearInterval(syncTimer);
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginError").textContent = "";
}

function togglePw() {
  const p = document.getElementById("loginPass");
  p.type = p.type === "password" ? "text" : "password";
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
function initDashboard() {
  loadData(true);
  syncTimer = setInterval(() => loadData(false), SYNC_INTERVAL_MS);
}

// ══════════════════════════════════════════════════════════════
// DATA — READ FROM SHEET (published HTML → parse table)
// ══════════════════════════════════════════════════════════════
async function loadData(showLoading = false) {
  setSyncState("syncing");
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_PUBLIC_URL)}`;
    const resp = await fetch(proxy);
    const json = await resp.json();
    const html = json.contents;
    const parsed = parseSheetHTML(html);
    if (parsed.length > 0) {
      shipments = parsed;
    }
    renderAll();
    setSyncState("ok");
    document.getElementById("lastSync").textContent =
      t("last_sync") + " " + new Date().toLocaleTimeString();
  } catch (err) {
    console.error("Sync error:", err);
    setSyncState("error");
  }
}

function parseSheetHTML(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, "text/html");
  const table  = doc.querySelector("table");
  if (!table) return generateDemoData(); // fallback demo data

  const rows    = Array.from(table.querySelectorAll("tr"));
  if (rows.length < 2) return generateDemoData();

  const headers = Array.from(rows[0].querySelectorAll("th,td")).map(c => c.textContent.trim());
  const data    = [];

  rows.slice(1).forEach((row, idx) => {
    const cells = Array.from(row.querySelectorAll("td")).map(c => c.textContent.trim());
    if (cells.every(c => c === "")) return;
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = cells[i] || ""; });
    // Normalise common column names
    if (!obj.ID)          obj.ID         = obj["ID"] || obj["Id"] || String(idx + 1);
    if (!obj.Tracking)    obj.Tracking   = obj["Tracking"] || obj["Tracking Number"] || obj["tracking"] || "";
    if (!obj.Customer)    obj.Customer   = obj["Customer"] || obj["Name"] || obj["customer"] || "";
    if (!obj.Origin)      obj.Origin     = obj["Origin"] || obj["From"] || "";
    if (!obj.Destination) obj.Destination= obj["Destination"] || obj["To"] || "";
    if (!obj.Status)      obj.Status     = obj["Status"] || "Pending";
    if (!obj.Date)        obj.Date       = obj["Date"] || obj["date"] || "";
    if (!obj.Weight)      obj.Weight     = obj["Weight"] || obj["weight"] || "";
    if (!obj.Notes)       obj.Notes      = obj["Notes"] || obj["notes"] || "";
    data.push(obj);
  });

  return data.length > 0 ? data : generateDemoData();
}

// Demo / fallback data so dashboard looks populated
function generateDemoData() {
  const statuses = ["Pending","In Transit","Delivered","Returned","In Transit","Delivered","Delivered"];
  return statuses.map((s, i) => ({
    ID: "GRN-" + String(1001 + i),
    Tracking: "TRK" + String(800000 + i * 17),
    Customer: ["Ali Hassan","Sara Mehr","John Smith","Leila K.","Omar F.","David P.","Nina S."][i],
    Origin: ["Tehran","Dubai","London","Istanbul","Cairo","Paris","Berlin"][i],
    Destination: ["Dubai","London","New York","Tehran","Riyadh","Berlin","Tokyo"][i],
    Status: s,
    Date: new Date(Date.now() - i * 86400000 * 2).toISOString().slice(0,10),
    Weight: (1.5 + i * 2.3).toFixed(1),
    Notes: i === 0 ? "Fragile" : "",
    _row: i + 2
  }));
}

// ══════════════════════════════════════════════════════════════
// DATA — WRITE TO SHEET via Apps Script
// ══════════════════════════════════════════════════════════════
function hasScriptURL() {
  return APPS_SCRIPT_URL && !APPS_SCRIPT_URL.startsWith("PASTE_");
}

async function appsScriptPost(payload) {
  if (!hasScriptURL()) throw new Error("No Apps Script URL");
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
  return resp.json();
}

// ══════════════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════════════
function renderAll() {
  renderStats();
  renderCharts();
  renderTable();
  renderRecent();
}

// ── STATS ──
function renderStats() {
  document.getElementById("statTotalNum").textContent     = shipments.length;
  document.getElementById("statTransitNum").textContent   = count("In Transit");
  document.getElementById("statDeliveredNum").textContent = count("Delivered");
  document.getElementById("statPendingNum").textContent   = count("Pending");
  document.getElementById("statReturnedNum").textContent  = count("Returned");
}
function count(status) { return shipments.filter(s => s.Status === status).length; }

// ── CHARTS ──
function renderCharts() {
  const isDark = currentTheme === "dark";
  const textColor = isDark ? "#9ba3bf" : "#4a5270";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Doughnut — status breakdown
  const statusCounts = {
    Pending:    count("Pending"),
    "In Transit": count("In Transit"),
    Delivered:  count("Delivered"),
    Returned:   count("Returned"),
    Cancelled:  count("Cancelled"),
  };
  const ctx1 = document.getElementById("chartStatus").getContext("2d");
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(ctx1, {
    type: "doughnut",
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ["#f59e0b","#3b82f6","#22c55e","#8b5cf6","#ef4444"],
        borderColor: "transparent",
        hoverOffset: 10
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, padding: 16, font: { size: 11 } } }
      },
      cutout: "65%"
    }
  });

  // Bar — activity last 7 days
  const days = [];
  const dayCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const label = d.toLocaleDateString(currentLang === "ar" ? "ar-SA" : currentLang === "fa" ? "fa-IR" : "en-US", { weekday: "short" });
    const ds = d.toISOString().slice(0, 10);
    days.push(label);
    dayCounts.push(shipments.filter(s => s.Date === ds).length);
  }
  const ctx2 = document.getElementById("chartActivity").getContext("2d");
  if (chartActivity) chartActivity.destroy();
  chartActivity = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: days,
      datasets: [{
        label: t("nav_shipments"),
        data: dayCounts,
        backgroundColor: "rgba(240,165,0,0.5)",
        borderColor: "#f0a500",
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
      }
    }
  });
}

// ── TABLE ──
function filterTable() {
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const status = document.getElementById("filterStatus")?.value || "";
  filtered = shipments.filter(s => {
    const matchStatus = !status || s.Status === status;
    const matchSearch = !search || Object.values(s).some(v => String(v).toLowerCase().includes(search));
    return matchStatus && matchSearch;
  });
  renderTableRows(filtered);
}

function renderTable() {
  filtered = [...shipments];
  renderTableRows(filtered);
}

function renderTableRows(data) {
  const tbody = document.getElementById("shipTbody");
  const noData = document.getElementById("noData");
  if (!tbody) return;
  if (data.length === 0) {
    tbody.innerHTML = "";
    noData.classList.remove("hidden");
    noData.textContent = t("no_data");
    return;
  }
  noData.classList.add("hidden");
  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${s.ID || ""}</td>
      <td>${s.Tracking || ""}</td>
      <td>${s.Customer || ""}</td>
      <td>${s.Origin || ""}</td>
      <td>${s.Destination || ""}</td>
      <td>${statusBadge(s.Status)}</td>
      <td>${s.Date || ""}</td>
      <td>${s.Weight ? s.Weight + " kg" : ""}</td>
      <td>
        <button class="btn-edit" onclick="openEditModal('${escAttr(s.ID)}', '${escAttr(s.Tracking)}', '${escAttr(s.Status)}')">
          ✏️ ${t("edit_status")}
        </button>
      </td>
    </tr>
  `).join("");
}

function renderRecent() {
  const div = document.getElementById("recentTable");
  if (!div) return;
  const recent = [...shipments].slice(0, 5);
  if (recent.length === 0) { div.innerHTML = `<p style="color:var(--text3);padding:16px">${t("no_data")}</p>`; return; }
  div.innerHTML = `<table class="ship-table">
    <thead><tr>
      <th>${t("col_id")}</th><th>${t("col_customer")}</th>
      <th>${t("col_dest")}</th><th>${t("col_status")}</th><th>${t("col_date")}</th>
    </tr></thead>
    <tbody>${recent.map(s => `
      <tr>
        <td>${s.ID||""}</td>
        <td>${s.Customer||""}</td>
        <td>${s.Destination||""}</td>
        <td>${statusBadge(s.Status)}</td>
        <td>${s.Date||""}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

// ── STATUS BADGE ──
function statusBadge(status) {
  const cls = {
    "Pending":    "pending",
    "In Transit": "transit",
    "Delivered":  "delivered",
    "Returned":   "returned",
    "Cancelled":  "cancelled"
  }[status] || "pending";
  const icons = { Pending:"⏳", "In Transit":"🚚", Delivered:"✅", Returned:"↩️", Cancelled:"🚫" };
  return `<span class="status-badge ${cls}">${icons[status]||""} ${status}</span>`;
}

function escAttr(s) { return String(s||"").replace(/'/g,"\\'").replace(/"/g,"&quot;"); }

// ══════════════════════════════════════════════════════════════
// EDIT STATUS MODAL
// ══════════════════════════════════════════════════════════════
function openEditModal(id, tracking, currentStatus) {
  editingRow = { id, tracking };
  document.getElementById("modalInfo").textContent =
    `${t("col_id")}: ${id}  |  ${t("col_tracking")}: ${tracking}`;
  document.getElementById("modalStatus").value = currentStatus || "Pending";
  document.getElementById("modalOverlay").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  editingRow = null;
}

async function submitStatusChange() {
  if (!editingRow) return;
  const newStatus = document.getElementById("modalStatus").value;
  const btn = document.querySelector(".btn-submit");
  btn.disabled = true;

  // Update locally first
  const idx = shipments.findIndex(s => String(s.ID) === String(editingRow.id));
  if (idx !== -1) { shipments[idx].Status = newStatus; }
  renderAll();
  closeModal();

  // Push to sheet
  if (hasScriptURL()) {
    try {
      await appsScriptPost({ action: "updateStatus", id: editingRow.id, status: newStatus });
      showToast(t("status_ok"), "ok");
    } catch { showToast(t("status_err"), "err"); }
  } else {
    showToast(t("no_script"), "warn");
  }
  btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════
// ADD SHIPMENT
// ══════════════════════════════════════════════════════════════
async function addShipment() {
  const shipment = {
    ID:          document.getElementById("addId").value.trim(),
    Tracking:    document.getElementById("addTracking").value.trim(),
    Customer:    document.getElementById("addCustomer").value.trim(),
    Origin:      document.getElementById("addOrigin").value.trim(),
    Destination: document.getElementById("addDest").value.trim(),
    Status:      document.getElementById("addStatus").value,
    Date:        document.getElementById("addDate").value,
    Weight:      document.getElementById("addWeight").value,
    Notes:       document.getElementById("addNotes").value.trim(),
  };

  if (!shipment.ID || !shipment.Tracking || !shipment.Customer) {
    showAddMsg(t("added_err"), "err");
    return;
  }

  const btn = document.getElementById("lbl-add-btn");
  btn.disabled = true;

  // Add locally
  shipments.unshift(shipment);
  renderAll();

  // Push to sheet
  if (hasScriptURL()) {
    try {
      await appsScriptPost({ action: "addShipment", shipment });
      showAddMsg(t("added_ok"), "ok");
      clearAddForm();
    } catch {
      showAddMsg(t("added_err"), "err");
    }
  } else {
    showAddMsg(t("no_script"), "warn");
    clearAddForm();
  }
  btn.disabled = false;
}

function clearAddForm() {
  ["addId","addTracking","addCustomer","addOrigin","addDest","addDate","addWeight","addNotes"]
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  document.getElementById("addStatus").value = "Pending";
}

function showAddMsg(msg, type) {
  const el = document.getElementById("addMsg");
  el.textContent = msg;
  el.className = "add-msg " + (type === "ok" ? "ok" : "err");
  setTimeout(() => { el.textContent = ""; el.className = "add-msg"; }, 4000);
}

// ══════════════════════════════════════════════════════════════
// SECTIONS / NAV
// ══════════════════════════════════════════════════════════════
function showSection(name, el) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("sec-" + name)?.classList.remove("hidden");
  if (el) el.classList.add("active");
  const titleKey = { dashboard:"nav_dashboard", shipments:"nav_shipments", add:"nav_add" }[name];
  document.getElementById("pageTitle").textContent = t(titleKey || name);
  if (window.innerWidth <= 768) toggleSidebar(false);
  return false;
}

// ══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ══════════════════════════════════════════════════════════════
let sidebarOpen = false;
function toggleSidebar(force) {
  sidebarOpen = force !== undefined ? force : !sidebarOpen;
  document.getElementById("sidebar").classList.toggle("open", sidebarOpen);
  document.getElementById("sidebarOverlay").classList.toggle("hidden", !sidebarOpen);
}

// ══════════════════════════════════════════════════════════════
// SYNC INDICATOR
// ══════════════════════════════════════════════════════════════
function setSyncState(state) {
  const dot  = document.querySelector(".sync-dot");
  const text = document.getElementById("syncText");
  dot.className = "sync-dot";
  if (state === "syncing") { dot.classList.add("syncing"); text.textContent = t("syncing"); }
  else if (state === "ok") { text.textContent = t("synced_ok"); }
  else { dot.classList.add("error"); text.textContent = "⚠ Sync error"; }
}
function updateSyncText() {
  const text = document.getElementById("syncText");
  if (text && text.textContent) text.textContent = t("syncing");
}

// ══════════════════════════════════════════════════════════════
// TOAST (lightweight notification)
// ══════════════════════════════════════════════════════════════
function showToast(msg, type) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: type === "ok" ? "var(--success)" : type === "warn" ? "var(--warning)" : "var(--danger)",
    color: "#000", padding: "10px 24px", borderRadius: "99px",
    fontWeight: "600", fontSize: "13px", zIndex: "9999",
    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    animation: "slide-up 0.3s ease"
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ══════════════════════════════════════════════════════════════
// INIT — restore preferences
// ══════════════════════════════════════════════════════════════
(function init() {
  const savedTheme = localStorage.getItem("gringot_theme") || "dark";
  const savedLang  = localStorage.getItem("gringot_lang")  || "en";
  currentTheme = savedTheme;
  document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("themeBtn").textContent  = savedTheme === "dark" ? "🌙" : "☀️";
  document.getElementById("themeBtn2").textContent = savedTheme === "dark" ? "🌙" : "☀️";
  setLang(savedLang);
})();
