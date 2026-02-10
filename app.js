// ==========================================================
// BUSINESS DASHBOARD CONFIG
// ==========================================================
const DATA = {
  currency: "₹",

  expenseCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=980089094&single=true&output=csv",

  receiptCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=2012196942&single=true&output=csv",

  contraCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=1047506309&single=true&output=csv"
};

const currencySymbol = DATA.currency;

let expenseData = [];
let receiptData = [];
let contraData = [];

const pageSize = 20;
let expensePage = 1;
let receiptPage = 1;

let trendChart, supplierPayableChart, workTypeChart, paidByChart;

// Ledger cache for modal filtering
let activePersonLedger = [];
let activeSupplierLedger = [];
let activePersonName = "";
let activeSupplierName = "";

// ==========================================================
// PERSON LEDGER PAGINATION CONFIG (NEW)
// ==========================================================
const personLedgerPageSize = 50;
let personLedgerPage = 1;
let personLedgerFilteredRows = []; // holds filtered rows (sorted) for paging

// ==========================================================
// HELPERS
// ==========================================================
function normalizeText(txt) {
  return (txt || "")
    .toString()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(key) {
  return normalizeText(key)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function cleanRow(row) {
  const cleaned = {};
  for (let key in row) {
    cleaned[normalizeKey(key)] = normalizeText(row[key]);
  }
  return cleaned;
}

function removeEmptyRows(data) {
  return data.map(cleanRow).filter(r => Object.values(r).some(v => v !== ""));
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;

  let v = String(value).trim();
  if (v === "") return 0;

  v = v.replace(/INR/gi, "");
  v = v.replace(/₹/g, "");
  v = v.replace(/,/g, "");
  v = v.replace(/\s+/g, "");

  let num = parseFloat(v);
  if (isNaN(num)) return 0;

  return num;
}

function formatMoney(num) {
  if (num === null || num === undefined || isNaN(num)) return "0.00";
  return Number(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function money(num) {
  return `${currencySymbol} ${formatMoney(num)}`;
}

function parseDateValue(dateStr) {
  if (!dateStr) return new Date("1900-01-01");

  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    const day = parts[0];
    const mon = parts[1];
    const year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    return new Date(`${day} ${mon} ${year}`);
  }

  return new Date(dateStr);
}

function cleanAccountName(name) {
  if (!name) return "";
  return name
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function monthYearToDate(label) {
  if (!label) return new Date("1900-01-01");
  const parts = label.trim().split(" ");
  if (parts.length < 2) return new Date("1900-01-01");

  const monthName = parts[0];
  const year = parts[1];

  return new Date(`${monthName} 01, ${year}`);
}

// ==========================================================
// CSV PARSER
// ==========================================================
function parseCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

// ==========================================================
// LOADER FUNCTIONS
// ==========================================================
function showGlobalLoader() {
  document.getElementById("globalLoader").classList.remove("d-none");
}

function hideGlobalLoader() {
  document.getElementById("globalLoader").classList.add("d-none");
}

function showSummaryLoaders() {
  const ids = [
    "loader_totalExpense",
    "loader_totalPaid",
    "loader_totalPayables",
    "loader_totalReceipts",
    "loader_netProfit"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("d-none");
  });
}

function hideSummaryLoaders() {
  const ids = [
    "loader_totalExpense",
    "loader_totalPaid",
    "loader_totalPayables",
    "loader_totalReceipts",
    "loader_netProfit"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("d-none");
  });
}

function showChartLoaders() {
  document.getElementById("trendChartLoader").classList.remove("d-none");
  document.getElementById("supplierChartLoader").classList.remove("d-none");
  document.getElementById("workTypeChartLoader").classList.remove("d-none");
  document.getElementById("paidByChartLoader").classList.remove("d-none");
}

function hideChartLoaders() {
  document.getElementById("trendChartLoader").classList.add("d-none");
  document.getElementById("supplierChartLoader").classList.add("d-none");
  document.getElementById("workTypeChartLoader").classList.add("d-none");
  document.getElementById("paidByChartLoader").classList.add("d-none");
}

function showTableSkeleton(tableId, cols, rows = 10) {
  const tbody = document.getElementById(tableId);
  let html = "";

  for (let i = 0; i < rows; i++) {
    html += "<tr>";
    for (let j = 0; j < cols; j++) {
      html += `<td><div class="skeleton skeleton-row"></div></td>`;
    }
    html += "</tr>";
  }

  tbody.innerHTML = html;
}

// ==========================================================
// UI HELPERS
// ==========================================================
function setControlsEnabled(enabled) {
  const ids = [
    "refreshBtn",
    "projectFilter",
    "yearFilter",
    "monthFilter",
    "supplierFilter",
    "paidByFilter",
    "receivedByFilter",
    "searchBox",
    "expenseSort",
    "receiptSort"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

function fillDropdown(elId, values, allText) {
  const el = document.getElementById(elId);
  el.innerHTML = `<option value="ALL">${allText}</option>`;
  values.forEach(v => {
    el.innerHTML += `<option value="${v}">${v}</option>`;
  });
}

// ==========================================================
// FILTERING
// ==========================================================
function applyFilters(data, type) {
  const project = document.getElementById("projectFilter").value;
  const year = document.getElementById("yearFilter").value;
  const month = document.getElementById("monthFilter").value;
  const supplier = document.getElementById("supplierFilter").value;
  const paidBy = cleanAccountName(document.getElementById("paidByFilter").value);
  const receivedBy = cleanAccountName(document.getElementById("receivedByFilter").value);

  const q = document.getElementById("searchBox").value.trim().toLowerCase();

  let filtered = [...data];

  if (project !== "ALL") {
    filtered = filtered.filter(r => (r.Project || "") === project);
  }

  if (year !== "ALL") {
    filtered = filtered.filter(r => (r.Year || "") === year);
  }

  if (month !== "ALL") {
    filtered = filtered.filter(r => (r.Month || "") === month);
  }

  if (type === "expense") {
    if (supplier !== "ALL") {
      filtered = filtered.filter(r => (r.Supplier || "") === supplier);
    }

    if (paidBy !== "All" && paidBy !== "ALL" && paidBy !== "") {
      filtered = filtered.filter(r => cleanAccountName(r.Paid_By) === paidBy);
    }
  }

  if (type === "receipt") {
    if (receivedBy !== "All" && receivedBy !== "ALL" && receivedBy !== "") {
      filtered = filtered.filter(r => cleanAccountName(r.Received_By) === receivedBy);
    }
  }

  if (q) {
    filtered = filtered.filter(row =>
      Object.values(row).join(" ").toLowerCase().includes(q)
    );
  }

  return filtered;
}

// ==========================================================
// DROPDOWNS
// ==========================================================
function fillMainDropdowns() {
  const projectSet = new Set();
  const yearSet = new Set();
  const monthSet = new Set();
  const supplierSet = new Set();
  const paidBySet = new Set();
  const receivedBySet = new Set();

  expenseData.forEach(r => {
    if (r.Project) projectSet.add(r.Project);
    if (r.Year) yearSet.add(r.Year);
    if (r.Month) monthSet.add(r.Month);
    if (r.Supplier) supplierSet.add(r.Supplier);
    if (r.Paid_By) paidBySet.add(cleanAccountName(r.Paid_By));
  });

  receiptData.forEach(r => {
    if (r.Project) projectSet.add(r.Project);
    if (r.Year) yearSet.add(r.Year);
    if (r.Month) monthSet.add(r.Month);
    if (r.Received_By) receivedBySet.add(cleanAccountName(r.Received_By));
  });

  contraData.forEach(r => {
    if (r.From) paidBySet.add(cleanAccountName(r.From));
    if (r.To) receivedBySet.add(cleanAccountName(r.To));
  });

  fillDropdown("projectFilter", Array.from(projectSet).sort(), "All Projects");
  fillDropdown("yearFilter", Array.from(yearSet).sort(), "All Years");
  fillDropdown("monthFilter", Array.from(monthSet).sort(), "All Months");
  fillDropdown("supplierFilter", Array.from(supplierSet).sort(), "All Suppliers");
  fillDropdown("paidByFilter", Array.from(paidBySet).sort(), "Paid By (All)");
  fillDropdown("receivedByFilter", Array.from(receivedBySet).sort(), "Received By (All)");

  document.getElementById("projectFilter").onchange = resetPagesAndUpdate;
  document.getElementById("yearFilter").onchange = resetPagesAndUpdate;
  document.getElementById("monthFilter").onchange = resetPagesAndUpdate;
  document.getElementById("supplierFilter").onchange = resetPagesAndUpdate;
  document.getElementById("paidByFilter").onchange = resetPagesAndUpdate;
  document.getElementById("receivedByFilter").onchange = resetPagesAndUpdate;
}

// ==========================================================
// SUMMARY
// ==========================================================
function updateSummary() {
  const exp = applyFilters(expenseData, "expense");
  const rec = applyFilters(receiptData, "receipt");

  const totalExpense = exp.reduce((sum, r) => sum + toNumber(r.Total_Amount), 0);
  const totalPaid = exp.reduce((sum, r) => sum + toNumber(r.Paid_Amount), 0);
  const totalPayables = exp.reduce((sum, r) => sum + toNumber(r.Payables), 0);
  const totalReceipts = rec.reduce((sum, r) => sum + toNumber(r.Amount), 0);

  document.getElementById("totalExpense").innerText = money(totalExpense);
  document.getElementById("totalPaid").innerText = money(totalPaid);
  document.getElementById("totalPayables").innerText = money(totalPayables);
  document.getElementById("totalReceipts").innerText = money(totalReceipts);

  const selectedProject = document.getElementById("projectFilter").value;

  let profitExpense = [...expenseData];
  let profitReceipts = [...receiptData];

  if (selectedProject !== "ALL") {
    profitExpense = profitExpense.filter(r => (r.Project || "") === selectedProject);
    profitReceipts = profitReceipts.filter(r => (r.Project || "") === selectedProject);
  }

  const projectExpenseTotal = profitExpense.reduce(
    (sum, r) => sum + toNumber(r.Total_Amount),
    0
  );

  const projectReceiptsTotal = profitReceipts.reduce(
    (sum, r) => sum + toNumber(r.Amount),
    0
  );

  const profit = projectReceiptsTotal - projectExpenseTotal;

  const profitEl = document.getElementById("netProfit");
  profitEl.innerText = money(profit);

  if (profit < 0) {
    profitEl.classList.remove("text-success");
    profitEl.classList.add("text-danger");
  } else {
    profitEl.classList.remove("text-danger");
    profitEl.classList.add("text-success");
  }

  document.getElementById("profitNote").innerText =
    `Project Income (${money(projectReceiptsTotal)}) - Project Expense (${money(projectExpenseTotal)})`;
}

// ==========================================================
// PAGINATION
// ==========================================================
function paginate(data, page) {
  const start = (page - 1) * pageSize;
  return data.slice(start, start + pageSize);
}

function totalPages(data) {
  return Math.max(1, Math.ceil(data.length / pageSize));
}

function resetPagesAndUpdate() {
  expensePage = 1;
  receiptPage = 1;
  updateDashboard();
}

// ==========================================================
// SORTING
// ==========================================================
function applySorting(data, sortValue, type) {
  let sorted = [...data];

  if (sortValue === "date_desc") sorted.sort((a, b) => parseDateValue(b.Date) - parseDateValue(a.Date));
  if (sortValue === "date_asc") sorted.sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date));

  if (sortValue === "amount_desc") {
    if (type === "expense") sorted.sort((a, b) => toNumber(b.Total_Amount) - toNumber(a.Total_Amount));
    if (type === "receipt") sorted.sort((a, b) => toNumber(b.Amount) - toNumber(a.Amount));
  }

  if (sortValue === "amount_asc") {
    if (type === "expense") sorted.sort((a, b) => toNumber(a.Total_Amount) - toNumber(b.Total_Amount));
    if (type === "receipt") sorted.sort((a, b) => toNumber(a.Amount) - toNumber(b.Amount));
  }

  return sorted;
}

// ==========================================================
// TABLES (PLAIN, NO LINKS)
// ==========================================================
function updateExpenseTable() {
  let exp = applyFilters(expenseData, "expense");
  exp = applySorting(exp, document.getElementById("expenseSort").value, "expense");

  const maxPages = totalPages(exp);
  if (expensePage > maxPages) expensePage = maxPages;
  if (expensePage < 1) expensePage = 1;

  const pageData = paginate(exp, expensePage);

  const tbody = document.getElementById("expenseTable");
  tbody.innerHTML = "";

  pageData.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.Date || ""}</td>
        <td>${r.Project || ""}</td>
        <td>${cleanAccountName(r.Paid_By) || ""}</td>
        <td>${r.Supplier || ""}</td>
        <td>${r.Work_Type || ""}</td>
        <td class="text-end">${money(toNumber(r.Total_Amount))}</td>
        <td class="text-end text-success fw-bold">${money(toNumber(r.Paid_Amount))}</td>
        <td class="text-end text-danger fw-bold">${money(toNumber(r.Payables))}</td>
      </tr>
    `;
  });

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No expense data</td></tr>`;
  }

  document.getElementById("expensePageInfo").innerText =
    `Page ${expensePage} of ${maxPages} (Rows: ${exp.length})`;
}

function updateReceiptTable() {
  let rec = applyFilters(receiptData, "receipt");
  rec = applySorting(rec, document.getElementById("receiptSort").value, "receipt");

  const maxPages = totalPages(rec);
  if (receiptPage > maxPages) receiptPage = maxPages;
  if (receiptPage < 1) receiptPage = 1;

  const pageData = paginate(rec, receiptPage);

  const tbody = document.getElementById("receiptTable");
  tbody.innerHTML = "";

  pageData.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.Date || ""}</td>
        <td>${r.Project || ""}</td>
        <td>${r.Stage || ""}</td>
        <td>${cleanAccountName(r.Received_By) || ""}</td>
        <td class="text-end text-success fw-bold">${money(toNumber(r.Amount))}</td>
      </tr>
    `;
  });

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No receipts data</td></tr>`;
  }

  document.getElementById("receiptPageInfo").innerText =
    `Page ${receiptPage} of ${maxPages} (Rows: ${rec.length})`;
}

// ==========================================================
// SUPPLIER LEDGER MODAL
// ==========================================================
function openSupplierLedgerModal(supplierName) {
  activeSupplierName = supplierName;
  activeSupplierLedger = expenseData.filter(r => (r.Supplier || "") === supplierName);

  buildSupplierLedgerFilters();
  renderSupplierLedger();
  new bootstrap.Modal(document.getElementById("supplierLedgerModal")).show();
}

function buildSupplierLedgerFilters() {
  const projSet = new Set();
  const monthSet = new Set();
  const yearSet = new Set();
  const paidBySet = new Set();
  const workTypeSet = new Set();

  activeSupplierLedger.forEach(r => {
    if (r.Project) projSet.add(r.Project);
    if (r.Month) monthSet.add(r.Month);
    if (r.Year) yearSet.add(r.Year);
    if (r.Paid_By) paidBySet.add(cleanAccountName(r.Paid_By));
    if (r.Work_Type) workTypeSet.add(r.Work_Type);
  });

  fillDropdown("supplierProjectFilter", Array.from(projSet).sort(), "All Projects");
  fillDropdown("supplierMonthFilter", Array.from(monthSet).sort(), "All Months");
  fillDropdown("supplierYearFilter", Array.from(yearSet).sort(), "All Years");
  fillDropdown("supplierPaidByFilter", Array.from(paidBySet).sort(), "Paid By (All)");
  fillDropdown("supplierWorkTypeFilter", Array.from(workTypeSet).sort(), "All Work Types");

  document.getElementById("supplierSearchBox").value = "";
}

function renderSupplierLedger() {
  const project = document.getElementById("supplierProjectFilter").value;
  const month = document.getElementById("supplierMonthFilter").value;
  const year = document.getElementById("supplierYearFilter").value;
  const paidBy = document.getElementById("supplierPaidByFilter").value;
  const workType = document.getElementById("supplierWorkTypeFilter").value;
  const q = document.getElementById("supplierSearchBox").value.trim().toLowerCase();

  let rows = [...activeSupplierLedger];

  if (project !== "ALL") rows = rows.filter(r => (r.Project || "") === project);
  if (month !== "ALL") rows = rows.filter(r => (r.Month || "") === month);
  if (year !== "ALL") rows = rows.filter(r => (r.Year || "") === year);
  if (paidBy !== "ALL") rows = rows.filter(r => cleanAccountName(r.Paid_By) === paidBy);
  if (workType !== "ALL") rows = rows.filter(r => (r.Work_Type || "") === workType);

  if (q) {
    rows = rows.filter(r => Object.values(r).join(" ").toLowerCase().includes(q));
  }

  rows.sort((a, b) => parseDateValue(b.Date) - parseDateValue(a.Date));

  const totalPurchase = rows.reduce((sum, r) => sum + toNumber(r.Total_Amount), 0);
  const totalPaid = rows.reduce((sum, r) => sum + toNumber(r.Paid_Amount), 0);
  const totalPayables = rows.reduce((sum, r) => sum + toNumber(r.Payables), 0);

  document.getElementById("supplierLedgerTitle").innerText = `🏗 Supplier Ledger: ${activeSupplierName}`;
  document.getElementById("supplierTotalPurchase").innerText = money(totalPurchase);
  document.getElementById("supplierTotalPaid").innerText = money(totalPaid);
  document.getElementById("supplierTotalPayables").innerText = money(totalPayables);

  const tbody = document.getElementById("supplierLedgerTable");
  tbody.innerHTML = "";

  rows.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.Date || ""}</td>
        <td>${r.Project || ""}</td>
        <td>${cleanAccountName(r.Paid_By) || ""}</td>
        <td>${r.Work_Type || ""}</td>
        <td class="text-end">${money(toNumber(r.Total_Amount))}</td>
        <td class="text-end text-success fw-bold">${money(toNumber(r.Paid_Amount))}</td>
        <td class="text-end text-danger fw-bold">${money(toNumber(r.Payables))}</td>
      </tr>
    `;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No supplier data found</td></tr>`;
  }

  document.getElementById("supplierLedgerInfo").innerText = `Rows: ${rows.length}`;
}

// ==========================================================
// PERSON LEDGER MODAL (FULL FIX + PAGINATION + TOTALS + COLLAPSIBLE FILTERS)
// ==========================================================
function openPersonLedgerModal(personName) {
  activePersonName = cleanAccountName(personName);
  activePersonLedger = [];
  personLedgerPage = 1;

  // EXPENSES = CREDIT (ONLY Paid_Amount)
  expenseData.forEach(r => {
    if (cleanAccountName(r.Paid_By) === activePersonName) {
      activePersonLedger.push({
        date: parseDateValue(r.Date),
        dateText: r.Date || "",
        type: "Expense",
        project: r.Project || "",
        supplier: r.Supplier || "",
        month: r.Month || "",
        year: r.Year || "",
        description: `Paid to ${r.Supplier || ""} (${r.Work_Type || ""})`,
        debit: 0,
        credit: toNumber(r.Paid_Amount)
      });
    }
  });

  // RECEIPTS = DEBIT
  receiptData.forEach(r => {
    if (cleanAccountName(r.Received_By) === activePersonName) {
      activePersonLedger.push({
        date: parseDateValue(r.Date),
        dateText: r.Date || "",
        type: "Receipt",
        project: r.Project || "",
        supplier: "",
        month: r.Month || "",
        year: r.Year || "",
        description: `Received from Project (${r.Stage || ""})`,
        debit: toNumber(r.Amount),
        credit: 0
      });
    }
  });

  // CONTRA
  contraData.forEach(r => {
    const fromAcc = cleanAccountName(r.From);
    const toAcc = cleanAccountName(r.To);
    const amt = toNumber(r.Amount);

    if (fromAcc === activePersonName) {
      activePersonLedger.push({
        date: parseDateValue(r.Date),
        dateText: r.Date || "",
        type: "Contra Out",
        project: r.Project || "",
        supplier: "",
        month: r.Month || "",
        year: r.Year || "",
        description: `Transfer to ${toAcc} (${r.Mode || ""})`,
        debit: 0,
        credit: amt
      });
    }

    if (toAcc === activePersonName) {
      activePersonLedger.push({
        date: parseDateValue(r.Date),
        dateText: r.Date || "",
        type: "Contra In",
        project: r.Project || "",
        supplier: "",
        month: r.Month || "",
        year: r.Year || "",
        description: `Received from ${fromAcc} (${r.Mode || ""})`,
        debit: amt,
        credit: 0
      });
    }
  });

  buildPersonLedgerFilters();
  ensurePersonLedgerUIExtras(); // NEW (adds pagination + hamburger)
  renderPersonLedger();
  new bootstrap.Modal(document.getElementById("personLedgerModal")).show();
}

function buildPersonLedgerFilters() {
  const projSet = new Set();
  const supplierSet = new Set();
  const monthSet = new Set();
  const yearSet = new Set();

  activePersonLedger.forEach(r => {
    if (r.project) projSet.add(r.project);
    if (r.supplier) supplierSet.add(r.supplier);
    if (r.month) monthSet.add(r.month);
    if (r.year) yearSet.add(r.year);
  });

  fillDropdown("ledgerProjectFilter", Array.from(projSet).sort(), "All Projects");
  fillDropdown("ledgerSupplierFilter", Array.from(supplierSet).sort(), "All Suppliers");
  fillDropdown("ledgerMonthFilter", Array.from(monthSet).sort(), "All Months");
  fillDropdown("ledgerYearFilter", Array.from(yearSet).sort(), "All Years");

  document.getElementById("ledgerTypeFilter").innerHTML = `
    <option value="ALL">All Types</option>
    <option value="Receipt">Receipt</option>
    <option value="Expense">Expense</option>
    <option value="Contra In">Contra In</option>
    <option value="Contra Out">Contra Out</option>
  `;

  document.getElementById("ledgerSearchBox").value = "";
}

// ==========================================================
// NEW: PERSON LEDGER UI EXTRA ELEMENTS (FILTER TOGGLE + PAGINATION + TOTALS AREA)
// ==========================================================
function ensurePersonLedgerUIExtras() {
  // Add hamburger filter toggle button in modal header (only once)
  const modalHeader = document.querySelector("#personLedgerModal .modal-header");
  if (modalHeader && !document.getElementById("ledgerFilterToggleBtn")) {
    const btn = document.createElement("button");
    btn.id = "ledgerFilterToggleBtn";
    btn.className = "btn btn-sm btn-light me-2";
    btn.type = "button";
    btn.innerHTML = "☰ Filters";

    btn.onclick = () => {
      const filterRow = document.getElementById("ledgerFilterRow");
      if (!filterRow) return;
      filterRow.classList.toggle("d-none");
    };

    // insert before close button
    const closeBtn = modalHeader.querySelector(".btn-close");
    modalHeader.insertBefore(btn, closeBtn);
  }

  // Add id to filter row so we can collapse it (only once)
  const filterRow = document.querySelector("#personLedgerModal .modal-body .row.g-2.mb-3");
  if (filterRow && !filterRow.id) {
    filterRow.id = "ledgerFilterRow";
  }

  // Add pagination + totals footer inside modal (only once)
  const modalBody = document.querySelector("#personLedgerModal .modal-body");
  if (!modalBody) return;

  if (!document.getElementById("personLedgerPaginationBar")) {
    const div = document.createElement("div");
    div.className = "mt-3";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <button class="btn btn-outline-dark btn-sm" id="ledgerPrevBtn">⬅ Prev</button>
        <div class="small-muted fw-bold" id="ledgerPageInfo">Page 1</div>
        <button class="btn btn-outline-dark btn-sm" id="ledgerNextBtn">Next ➡</button>
      </div>

      <div class="row g-3 mt-2" id="personLedgerPaginationBar">
        <div class="col-md-4">
          <div class="metric-card">
            <div class="metric-title">Page Debit</div>
            <div class="metric-value text-success" id="ledgerPageDebit">--</div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="metric-card">
            <div class="metric-title">Page Credit</div>
            <div class="metric-value text-danger" id="ledgerPageCredit">--</div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="metric-card highlight">
            <div class="metric-title">Page Balance Change</div>
            <div class="metric-value" id="ledgerPageBalanceChange">--</div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-2">
        <div class="col-md-3">
          <div class="metric-card">
            <div class="metric-title">Total Receipts</div>
            <div class="metric-value text-success" id="ledgerTotalReceipts">--</div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="metric-card">
            <div class="metric-title">Total Expense Paid</div>
            <div class="metric-value text-danger" id="ledgerTotalExpensePaid">--</div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="metric-card">
            <div class="metric-title">Contra In</div>
            <div class="metric-value text-success" id="ledgerTotalContraIn">--</div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="metric-card">
            <div class="metric-title">Contra Out</div>
            <div class="metric-value text-danger" id="ledgerTotalContraOut">--</div>
          </div>
        </div>
      </div>
    `;
    modalBody.appendChild(div);

    // pagination buttons
    document.getElementById("ledgerPrevBtn").addEventListener("click", () => {
      personLedgerPage--;
      renderPersonLedger();
    });

    document.getElementById("ledgerNextBtn").addEventListener("click", () => {
      personLedgerPage++;
      renderPersonLedger();
    });
  }
}

// ==========================================================
// PERSON LEDGER FILTERED ROWS + PAGINATION RENDER
// ==========================================================
function getFilteredPersonLedgerRows() {
  const project = document.getElementById("ledgerProjectFilter").value;
  const supplier = document.getElementById("ledgerSupplierFilter").value;
  const month = document.getElementById("ledgerMonthFilter").value;
  const year = document.getElementById("ledgerYearFilter").value;
  const type = document.getElementById("ledgerTypeFilter").value;
  const q = document.getElementById("ledgerSearchBox").value.trim().toLowerCase();

  let rows = [...activePersonLedger];

  if (project !== "ALL") rows = rows.filter(r => r.project === project);
  if (supplier !== "ALL") rows = rows.filter(r => r.supplier === supplier);
  if (month !== "ALL") rows = rows.filter(r => r.month === month);
  if (year !== "ALL") rows = rows.filter(r => r.year === year);
  if (type !== "ALL") rows = rows.filter(r => r.type === type);

  if (q) {
    rows = rows.filter(r =>
      Object.values(r).join(" ").toLowerCase().includes(q)
    );
  }

  // ALWAYS sort by date ASC for correct running balance
  rows.sort((a, b) => a.date - b.date);

  return rows;
}

function paginatePersonLedger(rows, page) {
  const start = (page - 1) * personLedgerPageSize;
  return rows.slice(start, start + personLedgerPageSize);
}

function personLedgerTotalPages(rows) {
  return Math.max(1, Math.ceil(rows.length / personLedgerPageSize));
}

function renderPersonLedger() {
  const rows = getFilteredPersonLedgerRows();
  personLedgerFilteredRows = rows;

  const maxPages = personLedgerTotalPages(rows);
  if (personLedgerPage > maxPages) personLedgerPage = maxPages;
  if (personLedgerPage < 1) personLedgerPage = 1;

  const pageRows = paginatePersonLedger(rows, personLedgerPage);

  // ---- FULL TOTALS (based on filtered rows, not page) ----
  let totalDebit = 0;
  let totalCredit = 0;

  let totalReceipts = 0;
  let totalExpensePaid = 0;
  let totalContraIn = 0;
  let totalContraOut = 0;

  rows.forEach(r => {
    totalDebit += r.debit;
    totalCredit += r.credit;

    if (r.type === "Receipt") totalReceipts += r.debit;
    if (r.type === "Expense") totalExpensePaid += r.credit;
    if (r.type === "Contra In") totalContraIn += r.debit;
    if (r.type === "Contra Out") totalContraOut += r.credit;
  });

  // ---- PAGE TOTALS ----
  let pageDebit = 0;
  let pageCredit = 0;
  pageRows.forEach(r => {
    pageDebit += r.debit;
    pageCredit += r.credit;
  });

  // ---- RUNNING BALANCE FULL (NOT PAGE ONLY) ----
  // We must compute running balance from start until each row
  let runningBalance = 0;
  const tbody = document.getElementById("personLedgerTable");
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
    runningBalance += row.debit - row.credit;
    row._runningBalance = runningBalance; // store for display
  });

  // Now display only current page rows but using correct running balance
  pageRows.forEach(row => {
    tbody.innerHTML += `
      <tr>
        <td>${row.dateText}</td>
        <td>${row.type}</td>
        <td>${row.project}</td>
        <td>${row.supplier || ""}</td>
        <td>${row.description}</td>
        <td class="text-end text-success fw-bold">${row.debit ? money(row.debit) : ""}</td>
        <td class="text-end text-danger fw-bold">${row.credit ? money(row.credit) : ""}</td>
        <td class="text-end fw-bold">${money(row._runningBalance)}</td>
      </tr>
    `;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No ledger data found</td></tr>`;
  }

  // ---- MAIN HEADER TOTAL CARDS (existing ones, kept) ----
  document.getElementById("personLedgerTitle").innerText = `👤 Account Ledger: ${activePersonName}`;
  document.getElementById("ledgerDebit").innerText = money(totalDebit);
  document.getElementById("ledgerCredit").innerText = money(totalCredit);
  document.getElementById("ledgerBalance").innerText = money(totalDebit - totalCredit);

  document.getElementById("personLedgerInfo").innerText =
    `Rows: ${rows.length} | Showing Page ${personLedgerPage}/${maxPages} (50 rows per page)`;

  // ---- PAGE INFO ----
  const pageInfoEl = document.getElementById("ledgerPageInfo");
  if (pageInfoEl) {
    pageInfoEl.innerText = `Page ${personLedgerPage} of ${maxPages} (Rows: ${rows.length})`;
  }

  // ---- PAGE TOTALS UI ----
  const pageDebitEl = document.getElementById("ledgerPageDebit");
  const pageCreditEl = document.getElementById("ledgerPageCredit");
  const pageBalEl = document.getElementById("ledgerPageBalanceChange");

  if (pageDebitEl) pageDebitEl.innerText = money(pageDebit);
  if (pageCreditEl) pageCreditEl.innerText = money(pageCredit);
  if (pageBalEl) pageBalEl.innerText = money(pageDebit - pageCredit);

  // ---- FULL TOTALS UI ----
  const recEl = document.getElementById("ledgerTotalReceipts");
  const expEl = document.getElementById("ledgerTotalExpensePaid");
  const cinEl = document.getElementById("ledgerTotalContraIn");
  const coutEl = document.getElementById("ledgerTotalContraOut");

  if (recEl) recEl.innerText = money(totalReceipts);
  if (expEl) expEl.innerText = money(totalExpensePaid);
  if (cinEl) cinEl.innerText = money(totalContraIn);
  if (coutEl) coutEl.innerText = money(totalContraOut);
}

// ==========================================================
// WORK TYPE MODAL
// ==========================================================
function openWorkTypeModal(workType) {
  let exp = applyFilters(expenseData, "expense");
  exp = exp.filter(r => (r.Work_Type || "") === workType);

  document.getElementById("workTypeModalTitle").innerText =
    `🧱 Work Type Details: ${workType}`;

  const tbody = document.getElementById("workTypeModalTable");
  tbody.innerHTML = "";

  exp.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.Date || ""}</td>
        <td>${r.Project || ""}</td>
        <td>${cleanAccountName(r.Paid_By) || ""}</td>
        <td>${r.Supplier || ""}</td>
        <td>${r.Work_Type || ""}</td>
        <td class="text-end">${money(toNumber(r.Total_Amount))}</td>
        <td class="text-end text-success fw-bold">${money(toNumber(r.Paid_Amount))}</td>
        <td class="text-end text-danger fw-bold">${money(toNumber(r.Payables))}</td>
      </tr>
    `;
  });

  if (exp.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No data found</td></tr>`;
  }

  document.getElementById("workTypeModalInfo").innerText =
    `Rows: ${exp.length}`;

  new bootstrap.Modal(document.getElementById("workTypeModal")).show();
}

// ==========================================================
// DEBUG FUNCTION (UPDATED)
// ==========================================================
// function debugPersonBalances() {
//   console.log("=========================================");
//   console.log("DEBUG FULL FINANCIAL CHECK (FIXED EXPENSE)");
//   console.log("=========================================");

//   const personSet = new Set();

//   expenseData.forEach(r => {
//     if (r.Paid_By) personSet.add(cleanAccountName(r.Paid_By));
//   });

//   receiptData.forEach(r => {
//     if (r.Received_By) personSet.add(cleanAccountName(r.Received_By));
//   });

//   contraData.forEach(r => {
//     if (r.From) personSet.add(cleanAccountName(r.From));
//     if (r.To) personSet.add(cleanAccountName(r.To));
//   });

//   const persons = Array.from(personSet).filter(x => x).sort();

//   let totalAllPersonReceipts = 0;
//   let totalAllPersonExpensesPaid = 0;
//   let totalAllContraIn = 0;
//   let totalAllContraOut = 0;
//   let totalAllPersonBalance = 0;

//   persons.forEach(person => {
//     const expTotalPaid = expenseData
//       .filter(r => cleanAccountName(r.Paid_By) === person)
//       .reduce((sum, r) => sum + toNumber(r.Paid_Amount), 0);

//     const receiptTotal = receiptData
//       .filter(r => cleanAccountName(r.Received_By) === person)
//       .reduce((sum, r) => sum + toNumber(r.Amount), 0);

//     const contraIn = contraData
//       .filter(r => cleanAccountName(r.To) === person)
//       .reduce((sum, r) => sum + toNumber(r.Amount), 0);

//     const contraOut = contraData
//       .filter(r => cleanAccountName(r.From) === person)
//       .reduce((sum, r) => sum + toNumber(r.Amount), 0);

//     const balance = receiptTotal + contraIn - expTotalPaid - contraOut;

//     totalAllPersonReceipts += receiptTotal;
//     totalAllPersonExpensesPaid += expTotalPaid;
//     totalAllContraIn += contraIn;
//     totalAllContraOut += contraOut;
//     totalAllPersonBalance += balance;

//     console.log(`\n👤 PERSON: ${person}`);
//     console.log(`   Total Receipts : ${receiptTotal}`);
//     console.log(`   Total Paid Exp : ${expTotalPaid}`);
//     console.log(`   Contra IN      : ${contraIn}`);
//     console.log(`   Contra OUT     : ${contraOut}`);
//     console.log(`   FINAL BALANCE  : ${balance}`);
//   });

//   const totalProjectIncome = receiptData.reduce((sum, r) => sum + toNumber(r.Amount), 0);
//   const totalProjectExpense = expenseData.reduce((sum, r) => sum + toNumber(r.Total_Amount), 0);
//   const totalProjectPaid = expenseData.reduce((sum, r) => sum + toNumber(r.Paid_Amount), 0);
//   const totalProjectPayables = expenseData.reduce((sum, r) => sum + toNumber(r.Payables), 0);

//   const projectBalance = totalProjectIncome - totalProjectExpense;

//   console.log("\n=========================================");
//   console.log("PROJECT TOTAL CHECK");
//   console.log("=========================================");
//   console.log("Total Project Income (Receipts): ", totalProjectIncome);
//   console.log("Total Project Expense (Total_Amount): ", totalProjectExpense);
//   console.log("Total Project Paid (Paid_Amount): ", totalProjectPaid);
//   console.log("Total Project Payables: ", totalProjectPayables);
//   console.log("Project Balance (Income - Expense): ", projectBalance);

//   console.log("\n=========================================");
//   console.log("PERSON TOTAL CHECK");
//   console.log("=========================================");
//   console.log("Total Person Receipts: ", totalAllPersonReceipts);
//   console.log("Total Person Paid Expenses: ", totalAllPersonExpensesPaid);
//   console.log("Total Contra IN: ", totalAllContraIn);
//   console.log("Total Contra OUT: ", totalAllContraOut);
//   console.log("Sum of All Person Balances: ", totalAllPersonBalance);

//   console.log("\n=========================================");
//   console.log("CORRECT CROSS CHECK RESULT");
//   console.log("=========================================");

//   const expectedCashWithPersons = totalProjectIncome - totalProjectPaid;
//   const diffCash = totalAllPersonBalance - expectedCashWithPersons;

//   console.log("Expected Cash With Persons (Income - Paid): ", expectedCashWithPersons);
//   console.log("Actual Cash With Persons (Sum of Persons): ", totalAllPersonBalance);
//   console.log("DIFFERENCE: ", diffCash);

//   if (Math.abs(diffCash) < 0.01) {
//     console.log("✅ PERFECT MATCH: Person balances are correct.");
//   } else {
//     console.log("❌ Person balance mismatch still exists.");
//   }

//   const expectedProjectBalance = totalProjectIncome - totalProjectExpense;
//   const derivedProjectBalance = totalAllPersonBalance - totalProjectPayables;
//   const diffProject = derivedProjectBalance - expectedProjectBalance;

//   console.log("\nExpected Project Balance (Income - Total Expense): ", expectedProjectBalance);
//   console.log("Derived Project Balance (PersonCash - Payables): ", derivedProjectBalance);
//   console.log("DIFFERENCE: ", diffProject);

//   if (Math.abs(diffProject) < 0.01) {
//     console.log("✅ PERFECT MATCH: Project balance matches after subtracting payables.");
//   } else {
//     console.log("❌ Project mismatch still exists.");
//   }

//   console.log("\n=========================================");
//   console.log("END DEBUG");
//   console.log("=========================================");
// }

// ==========================================================
// CHARTS
// ==========================================================
function updateCharts() {
  const exp = applyFilters(expenseData, "expense");
  const rec = applyFilters(receiptData, "receipt");

  // ---- TREND CHART ----
  const monthExpense = {};
  const monthReceipts = {};

  exp.forEach(r => {
    const key = `${r.Month || ""} ${r.Year || ""}`.trim();
    if (!key) return;
    monthExpense[key] = (monthExpense[key] || 0) + toNumber(r.Total_Amount);
  });

  rec.forEach(r => {
    const key = `${r.Month || ""} ${r.Year || ""}`.trim();
    if (!key) return;
    monthReceipts[key] = (monthReceipts[key] || 0) + toNumber(r.Amount);
  });

  const allMonths = Array.from(new Set([...Object.keys(monthExpense), ...Object.keys(monthReceipts)]))
    .filter(x => x)
    .sort((a, b) => monthYearToDate(a) - monthYearToDate(b));

  const expVals = allMonths.map(m => monthExpense[m] || 0);
  const recVals = allMonths.map(m => monthReceipts[m] || 0);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels: allMonths,
      datasets: [
        { label: "Expense", data: expVals, tension: 0.3 },
        { label: "Receipts", data: recVals, tension: 0.3 }
      ]
    }
  });

  // ---- PAYABLES BY SUPPLIER ----
  const supplierPay = {};
  exp.forEach(r => {
    const sup = r.Supplier || "Unknown";
    supplierPay[sup] = (supplierPay[sup] || 0) + toNumber(r.Payables);
  });

  const supplierLabels = Object.keys(supplierPay)
    .sort((a, b) => supplierPay[b] - supplierPay[a])
    .slice(0, 12);

  const supplierVals = supplierLabels.map(k => supplierPay[k]);

  if (supplierPayableChart) supplierPayableChart.destroy();
  supplierPayableChart = new Chart(document.getElementById("supplierPayableChart"), {
    type: "bar",
    data: {
      labels: supplierLabels,
      datasets: [{
        label: "Payables",
        data: supplierVals
      }]
    },
    options: {
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const supplierName = supplierPayableChart.data.labels[index];
        openSupplierLedgerModal(supplierName);
      }
    }
  });

  // ---- WORK TYPE CHART ----
  const workTotals = {};
  exp.forEach(r => {
    const wt = r.Work_Type || "Unknown";
    workTotals[wt] = (workTotals[wt] || 0) + toNumber(r.Total_Amount);
  });

  const workLabels = Object.keys(workTotals)
    .sort((a, b) => workTotals[b] - workTotals[a])
    .slice(0, 10);

  const workVals = workLabels.map(k => workTotals[k]);

  if (workTypeChart) workTypeChart.destroy();
  workTypeChart = new Chart(document.getElementById("workTypeChart"), {
    type: "doughnut",
    data: {
      labels: workLabels,
      datasets: [{
        label: "Expense",
        data: workVals
      }]
    },
    options: {
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const clickedWorkType = workTypeChart.data.labels[index];
        openWorkTypeModal(clickedWorkType);
      }
    }
  });

  // ---- PAID BY CHART ----
  const paidByTotals = {};
  exp.forEach(r => {
    const p = cleanAccountName(r.Paid_By) || "Unknown";
    paidByTotals[p] = (paidByTotals[p] || 0) + toNumber(r.Paid_Amount);
  });

  const paidLabels = Object.keys(paidByTotals)
    .sort((a, b) => paidByTotals[b] - paidByTotals[a]);

  const paidVals = paidLabels.map(k => paidByTotals[k]);

  if (paidByChart) paidByChart.destroy();
  paidByChart = new Chart(document.getElementById("paidByChart"), {
    type: "pie",
    data: {
      labels: paidLabels,
      datasets: [{
        label: "Paid",
        data: paidVals
      }]
    },
    options: {
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const personName = paidByChart.data.labels[index];
        openPersonLedgerModal(personName);
      }
    }
  });
}

// ==========================================================
// DASHBOARD UPDATE
// ==========================================================
function updateDashboard() {
  showSummaryLoaders();
  showChartLoaders();

  updateSummary();
  updateExpenseTable();
  updateReceiptTable();

  setTimeout(() => {
    updateCharts();
    hideChartLoaders();
    hideSummaryLoaders();
  }, 200);

  const project = document.getElementById("projectFilter").value;
  const year = document.getElementById("yearFilter").value;
  const month = document.getElementById("monthFilter").value;

  document.getElementById("dashboardSubTitle").innerText =
    `Project: ${project} | ${month} | ${year}`;
}

// ==========================================================
// LOAD DATA
// ==========================================================
async function loadAllData() {
  setControlsEnabled(false);

  showGlobalLoader();
  showSummaryLoaders();
  showChartLoaders();

  showTableSkeleton("expenseTable", 8, 10);
  showTableSkeleton("receiptTable", 5, 10);

  document.getElementById("refreshSpinner").classList.remove("d-none");
  document.getElementById("dashboardSubTitle").innerText = "Loading data...";

  try {
    expenseData = removeEmptyRows(await parseCSV(DATA.expenseCSV));
    receiptData = removeEmptyRows(await parseCSV(DATA.receiptCSV));
    contraData = removeEmptyRows(await parseCSV(DATA.contraCSV));

    expenseData.forEach(r => {
      r.Paid_By = cleanAccountName(r.Paid_By);
    });

    receiptData.forEach(r => {
      r.Received_By = cleanAccountName(r.Received_By);
    });

    contraData.forEach(r => {
      r.From = cleanAccountName(r.From);
      r.To = cleanAccountName(r.To);
    });

    fillMainDropdowns();
    resetPagesAndUpdate();

    // Debug
    // debugPersonBalances();

  } catch (err) {
    alert("Error loading CSV. Check sheet publish settings.");
    console.error(err);
  }

  document.getElementById("refreshSpinner").classList.add("d-none");
  hideGlobalLoader();

  setControlsEnabled(true);
}

// ==========================================================
// EVENTS
// ==========================================================
document.getElementById("refreshBtn").addEventListener("click", loadAllData);
document.getElementById("searchBox").addEventListener("input", resetPagesAndUpdate);

document.getElementById("expenseSort").addEventListener("change", () => {
  expensePage = 1;
  updateExpenseTable();
});

document.getElementById("receiptSort").addEventListener("change", () => {
  receiptPage = 1;
  updateReceiptTable();
});

// Pagination
document.getElementById("expenseNextBtn").addEventListener("click", () => {
  expensePage++;
  updateExpenseTable();
});

document.getElementById("expensePrevBtn").addEventListener("click", () => {
  expensePage--;
  updateExpenseTable();
});

document.getElementById("receiptNextBtn").addEventListener("click", () => {
  receiptPage++;
  updateReceiptTable();
});

document.getElementById("receiptPrevBtn").addEventListener("click", () => {
  receiptPage--;
  updateReceiptTable();
});

// Modal filter events (Person Ledger)
["ledgerProjectFilter", "ledgerSupplierFilter", "ledgerMonthFilter", "ledgerYearFilter", "ledgerTypeFilter"]
  .forEach(id => document.getElementById(id).addEventListener("change", () => {
    personLedgerPage = 1;
    renderPersonLedger();
  }));

document.getElementById("ledgerSearchBox").addEventListener("input", () => {
  personLedgerPage = 1;
  renderPersonLedger();
});

// Supplier modal filter events
["supplierProjectFilter", "supplierMonthFilter", "supplierYearFilter", "supplierPaidByFilter", "supplierWorkTypeFilter"]
  .forEach(id => document.getElementById(id).addEventListener("change", renderSupplierLedger));

document.getElementById("supplierSearchBox").addEventListener("input", renderSupplierLedger);
// ==========================================================
// MOBILE FILTER PANEL TOGGLE (MAIN DASHBOARD)
// ==========================================================
const mainFilterToggleBtn = document.getElementById("mainFilterToggleBtn");
const mainFilterPanel = document.getElementById("mainFilterPanel");

if (mainFilterToggleBtn && mainFilterPanel) {
  // Start collapsed on mobile
  if (window.innerWidth < 768) {
    mainFilterPanel.classList.add("d-none");
  }

  mainFilterToggleBtn.addEventListener("click", () => {
    mainFilterPanel.classList.toggle("d-none");
  });

  // Auto show filters again if user rotates or desktop size
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) {
      mainFilterPanel.classList.remove("d-none");
    } else {
      mainFilterPanel.classList.add("d-none");
    }
  });
}
// ==========================================================
// MOBILE FILTER PANEL TOGGLE (MAIN DASHBOARD)
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("mainFilterToggleBtn");
  const panel = document.getElementById("mainFilterPanel");

  if (!btn || !panel) return;

  btn.addEventListener("click", () => {
    panel.classList.toggle("show-mobile");
  });
});

// ==========================================================
// INITIAL LOAD
// ==========================================================
loadAllData();




