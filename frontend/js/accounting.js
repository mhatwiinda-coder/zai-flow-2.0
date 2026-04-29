// Supabase client initialized in supabase-init.js

let allLedgerData = [];
let selectedTab = 'pl';
let fromDate, toDate;

/* =====================================================
   INITIALIZE ACCOUNTING
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initAccounting();
});

function initAccounting() {
  // Set default date range (current month)
  setDefaultDateRange();
  // Load all reports
  loadAllReports();
}

/* =====================================================
   DATE RANGE MANAGEMENT
===================================================== */
function setDefaultDateRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  fromDate = firstDay;
  toDate = today;

  document.getElementById("fromDate").value = formatDateForInput(firstDay);
  document.getElementById("toDate").value = formatDateForInput(today);
}

function updatePeriodDates() {
  const periodType = document.getElementById("periodType").value;
  const today = new Date();
  let start, end;

  switch(periodType) {
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
      break;
    case 'quarter':
      const quarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), quarter * 3, 1);
      end = today;
      break;
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
      break;
    case 'custom':
      return; // Let user select custom dates
    default:
      return;
  }

  fromDate = start;
  toDate = end;
  document.getElementById("fromDate").value = formatDateForInput(start);
  document.getElementById("toDate").value = formatDateForInput(end);
  loadAllReports();
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(value) {
  return 'ZMW ' + Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =====================================================
   TAB MANAGEMENT
===================================================== */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Deactivate all buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const selectedTabEl = document.getElementById(`tab-${tabName}`);
  if (selectedTabEl) {
    selectedTabEl.classList.add('active');
  }

  // Activate corresponding button
  event.target.classList.add('active');
  selectedTab = tabName;

  // Load data for the tab if needed
  if (tabName === 'pl') loadProfitAndLoss();
  else if (tabName === 'balancesheet') loadBalanceSheet();
  else if (tabName === 'trialbalance') loadTrialBalance();
  else if (tabName === 'ledger') loadGeneralLedger();
}

/* =====================================================
   LOAD ALL REPORTS
===================================================== */
function loadAllReports() {
  fromDate = new Date(document.getElementById("fromDate").value);
  toDate = new Date(document.getElementById("toDate").value);

  loadProfitAndLoss();
  loadBalanceSheet();
  loadTrialBalance();
  loadGeneralLedger();
  updateKPICards();
}

function refreshAccounting() {
  const btn = document.querySelector(".refresh-btn");
  btn.style.animation = "spin 0.6s linear";
  loadAllReports();
  setTimeout(() => {
    btn.style.animation = "";
  }, 600);
}

/* =====================================================
   P&L STATEMENT
===================================================== */
function loadProfitAndLoss() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data, error } = await supabase.rpc('get_profit_loss', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error('P&L error:', error);
        return;
      }

      if (!data || data.length === 0) return;

      const pl = data[0];
      const totalRevenue = Number(pl.revenue || 0);
      const totalCogs = Number(pl.cogs || 0);
      const grossProfit = totalRevenue - totalCogs;
      const totalExpenses = Number(pl.expenses || 0);
      const netIncome = Number(pl.net_profit || 0);

      const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
      const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;

      document.getElementById("plTotalRevenue").innerText = money(totalRevenue);
      document.getElementById("plTotalCogs").innerText = money(totalCogs);
      document.getElementById("plGrossProfit").innerText = money(grossProfit);
      document.getElementById("plGrossMargin").innerText = grossMargin + "%";
      document.getElementById("plTotalExpenses").innerText = money(totalExpenses);
      document.getElementById("plNetIncome").innerText = money(netIncome);
      document.getElementById("plNetMargin").innerText = netMargin + "%";
      document.getElementById("netIncomeValue").innerText = money(netIncome);
      document.getElementById("totalRevenueValue").innerText = money(totalRevenue);

      // Trend indicator
      const trend = netIncome > 0 ? "↗ Profitable" : "↘ Loss";
      const trendColor = netIncome > 0 ? "#28c76f" : "#ff5b5b";
      document.getElementById("plTrend").innerText = trend;
      document.getElementById("plTrend").style.color = trendColor;

      // Clear individual revenue/COGS/expense sections (simplified from detailed trial balance)
      document.getElementById("plRevenues").innerHTML = `<div style="padding: 8px 0;">Total Revenue: ${money(totalRevenue)}</div>`;
      document.getElementById("plCogs").innerHTML = `<div style="padding: 8px 0;">Total COGS: ${money(totalCogs)}</div>`;
      document.getElementById("plExpenses").innerHTML = `<div style="padding: 8px 0;">Total Expenses: ${money(totalExpenses)}</div>`;
    } catch (err) {
      console.error("P&L error:", err);
    }
  })();
}

function renderPLSection(elementId, items) {
  const container = document.getElementById(elementId);
  container.innerHTML = "";

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08);';
    row.innerHTML = `
      <span>${item.name}</span>
      <span style="font-weight: 500;">${money(item.amount)}</span>
    `;
    container.appendChild(row);
  });
}

/* =====================================================
   BALANCE SHEET
===================================================== */
function loadBalanceSheet() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: accounts, error } = await supabase.rpc('get_trial_balance', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error('Balance Sheet error:', error);
        return;
      }

      if (!Array.isArray(accounts)) return;

      let assets = { current: [], fixed: [] };
      let liabilities = { current: [], longterm: [] };
      let equity = [];

      accounts.forEach(acc => {
        const type = (acc.account_type || '').toUpperCase();
        const balance = Number(acc.total_debit || 0) - Number(acc.total_credit || 0);

        if (type === 'ASSET') {
          assets.current.push({ name: acc.account_name, balance });
        } else if (type === 'LIABILITY') {
          liabilities.current.push({ name: acc.account_name, balance });
        } else if (type === 'EQUITY') {
          equity.push({ name: acc.account_name, balance });
        }
      });

      // Calculate totals
      const totalCurrentAssets = assets.current.reduce((sum, a) => sum + a.balance, 0);
      const totalFixedAssets = assets.fixed.reduce((sum, a) => sum + a.balance, 0);
      const totalAssets = totalCurrentAssets + totalFixedAssets;

      const totalCurrentLiab = liabilities.current.reduce((sum, l) => sum + l.balance, 0);
      const totalLongTermLiab = liabilities.longterm.reduce((sum, l) => sum + l.balance, 0);
      const totalLiabilities = totalCurrentLiab + totalLongTermLiab;

      const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
      const totalLiabEquity = totalLiabilities + totalEquity;

      // Render sections
      renderBSSection('bsCurrentAssets', assets.current);
      renderBSSection('bsFixedAssets', assets.fixed);
      renderBSSection('bsCurrentLiabilities', liabilities.current);
      renderBSSection('bsLongTermLiabilities', liabilities.longterm);
      renderBSSection('bsEquity', equity);

      // Update totals
      document.getElementById("bsTotalAssets").innerText = money(totalAssets);
      document.getElementById("bsTotalLiabilities").innerText = money(totalLiabilities);
      document.getElementById("bsTotalEquity").innerText = money(totalEquity);
      document.getElementById("totalAssetsValue").innerText = money(totalAssets);

      // Balance verification
      const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01;
      const verificationEl = document.getElementById("balanceVerification");
      const statusEl = document.getElementById("balanceStatusValue");

      if (isBalanced) {
        verificationEl.innerText = "✓ BALANCED";
        verificationEl.style.color = "#28c76f";
        statusEl.innerText = "✓ Balanced";
        statusEl.style.color = "#28c76f";
      } else {
        verificationEl.innerText = "✗ UNBALANCED";
        verificationEl.style.color = "#ff5b5b";
        statusEl.innerText = "✗ Unbalanced";
        statusEl.style.color = "#ff5b5b";
      }

      document.getElementById("bsAssetsCheck").innerText = money(totalAssets);
      document.getElementById("bsLiabilitiesEquityCheck").innerText = money(totalLiabEquity);
    } catch (err) {
      console.error("Balance Sheet error:", err);
    }
  })();
}

function renderBSSection(elementId, items) {
  const container = document.getElementById(elementId);
  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 13px;">No items</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;';
    row.innerHTML = `
      <span>${item.name}</span>
      <span style="font-weight: 500;">${money(item.balance)}</span>
    `;
    container.appendChild(row);
  });
}

/* =====================================================
   TRIAL BALANCE
===================================================== */
function loadTrialBalance() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: accounts, error } = await supabase.rpc('get_trial_balance', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error('Trial Balance error:', error);
        return;
      }

      if (!Array.isArray(accounts)) return;

      const tbody = document.getElementById("trialBalanceTable");
      tbody.innerHTML = "";

      let totalDebits = 0;
      let totalCredits = 0;

      accounts.forEach(acc => {
        const debit = Number(acc.total_debit || 0);
        const credit = Number(acc.total_credit || 0);

        totalDebits += debit;
        totalCredits += credit;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${acc.account_code || '-'}</td>
          <td>${acc.account_name}</td>
          <td>${acc.account_type}</td>
          <td style="text-align: right; font-family: monospace;">${money(debit)}</td>
          <td style="text-align: right; font-family: monospace;">${money(credit)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${money(Math.abs(debit - credit))}</td>
        `;
        tbody.appendChild(row);
      });

      // Update totals
      document.getElementById("tbTotalDebits").innerText = money(totalDebits);
      document.getElementById("tbTotalCredits").innerText = money(totalCredits);

      const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
      const statusEl = document.getElementById("tbBalanceStatus");
      statusEl.innerText = isBalanced ? "✓ Balanced" : "✗ Unbalanced";
      statusEl.style.color = isBalanced ? "#28c76f" : "#ff5b5b";
    } catch (err) {
      console.error("Trial Balance error:", err);
    }
  })();
}

/* =====================================================
   GENERAL LEDGER
===================================================== */
function loadGeneralLedger() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: ledgerData, error } = await supabase.rpc('get_general_ledger', {
        p_business_id: context.business_id
      });

      if (error) {
        console.error('Ledger error:', error);
        return;
      }

      if (!Array.isArray(ledgerData)) return;

      allLedgerData = ledgerData;
      displayLedger(ledgerData);
    } catch (err) {
      console.error("Ledger error:", err);
    }
  })();
}

function displayLedger(ledgerData) {
  const tbody = document.getElementById("ledgerTable");
  tbody.innerHTML = "";

  ledgerData.forEach(entry => {
    const row = document.createElement('tr');
    const date = new Date(entry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    row.innerHTML = `
      <td>${date}</td>
      <td>${entry.reference || '-'}</td>
      <td>${entry.description}</td>
      <td>${entry.account_name}</td>
      <td style="text-align: right; font-family: monospace;">${money(entry.debit || 0)}</td>
      <td style="text-align: right; font-family: monospace;">${money(entry.credit || 0)}</td>
      <td style="text-align: right; font-family: monospace; font-weight: 600;">K 0.00</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("ledgerEntryCount").innerText = ledgerData.length;
}

function filterGeneralLedger() {
  const accountFilter = document.getElementById("ledgerAccountFilter").value.toLowerCase();
  const referenceFilter = document.getElementById("ledgerReferenceFilter").value.toLowerCase();

  const filtered = allLedgerData.filter(entry => {
    const matchAccount = !accountFilter || (entry.account_name || '').toLowerCase().includes(accountFilter);
    const matchReference = !referenceFilter || (entry.reference || '').toLowerCase().includes(referenceFilter);
    return matchAccount && matchReference;
  });

  displayLedger(filtered);
}

function clearLedgerFilters() {
  document.getElementById("ledgerAccountFilter").value = "";
  document.getElementById("ledgerReferenceFilter").value = "";
  displayLedger(allLedgerData);
}

/* =====================================================
   KPI CARD UPDATES
===================================================== */
function updateKPICards() {
  // Values are updated by individual report functions
  // This could include trend calculations, etc.
}

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function calculateAccountBalance(account) {
  const debit = Number(account.total_debit || account.debit || 0);
  const credit = Number(account.total_credit || account.credit || 0);

  const type = (account.account_type || '').toUpperCase();
  const isDebitType = ['ASSET', 'EXPENSE'].includes(type);

  return isDebitType ? (debit - credit) : (credit - debit);
}

/* =====================================================
   EXPORT FUNCTIONS
===================================================== */
function exportPLToExcel() {
  // Basic CSV export (can be enhanced with proper Excel library)
  let csv = "Profit & Loss Statement\n";
  csv += "Period: " + formatDateDisplay(fromDate) + " to " + formatDateDisplay(toDate) + "\n\n";

  csv += "REVENUE\n";
  const revenues = document.querySelectorAll('#plRevenues > div');
  revenues.forEach(r => {
    const text = r.innerText.split('\t').join(',');
    csv += text + "\n";
  });
  csv += "Total Revenue," + document.getElementById("plTotalRevenue").innerText + "\n\n";

  csv += "COST OF GOODS SOLD\n";
  const cogs = document.querySelectorAll('#plCogs > div');
  cogs.forEach(c => {
    const text = c.innerText.split('\t').join(',');
    csv += text + "\n";
  });
  csv += "Total COGS," + document.getElementById("plTotalCogs").innerText + "\n\n";

  csv += "GROSS PROFIT," + document.getElementById("plGrossProfit").innerText + "\n";
  csv += "Gross Margin," + document.getElementById("plGrossMargin").innerText + "\n\n";

  csv += "OPERATING EXPENSES\n";
  const expenses = document.querySelectorAll('#plExpenses > div');
  expenses.forEach(e => {
    const text = e.innerText.split('\t').join(',');
    csv += text + "\n";
  });
  csv += "Total Expenses," + document.getElementById("plTotalExpenses").innerText + "\n\n";

  csv += "NET INCOME," + document.getElementById("plNetIncome").innerText + "\n";
  csv += "Net Margin," + document.getElementById("plNetMargin").innerText + "\n";

  downloadCSV(csv, `PL_Statement_${new Date().toISOString().split('T')[0]}.csv`);
  logExport("P&L Statement");
}

function exportBalanceSheetToExcel() {
  let csv = "Balance Sheet\n";
  csv += "As of " + formatDateDisplay(toDate) + "\n\n";

  csv += "ASSETS\n";
  csv += "Current Assets\n";
  const currentAssets = document.querySelectorAll('#bsCurrentAssets > div');
  currentAssets.forEach(a => {
    const text = a.innerText.split('\t').join(',');
    csv += "," + text + "\n";
  });
  csv += "Fixed Assets\n";
  const fixedAssets = document.querySelectorAll('#bsFixedAssets > div');
  fixedAssets.forEach(a => {
    const text = a.innerText.split('\t').join(',');
    csv += "," + text + "\n";
  });
  csv += "TOTAL ASSETS," + document.getElementById("bsTotalAssets").innerText + "\n\n";

  csv += "LIABILITIES & EQUITY\n";
  csv += "Current Liabilities\n";
  const currentLiab = document.querySelectorAll('#bsCurrentLiabilities > div');
  currentLiab.forEach(l => {
    const text = l.innerText.split('\t').join(',');
    csv += "," + text + "\n";
  });
  csv += "Long-term Liabilities\n";
  const longTermLiab = document.querySelectorAll('#bsLongTermLiabilities > div');
  longTermLiab.forEach(l => {
    const text = l.innerText.split('\t').join(',');
    csv += "," + text + "\n";
  });
  csv += "TOTAL LIABILITIES," + document.getElementById("bsTotalLiabilities").innerText + "\n\n";

  csv += "EQUITY\n";
  const equityItems = document.querySelectorAll('#bsEquity > div');
  equityItems.forEach(e => {
    const text = e.innerText.split('\t').join(',');
    csv += "," + text + "\n";
  });
  csv += "TOTAL EQUITY," + document.getElementById("bsTotalEquity").innerText + "\n\n";

  csv += "VERIFICATION\n";
  csv += "Total Assets," + document.getElementById("bsAssetsCheck").innerText + "\n";
  csv += "Liabilities + Equity," + document.getElementById("bsLiabilitiesEquityCheck").innerText + "\n";
  csv += "Status," + document.getElementById("balanceVerification").innerText + "\n";

  downloadCSV(csv, `Balance_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
  logExport("Balance Sheet");
}

function exportTrialBalanceToExcel() {
  let csv = "Trial Balance\n";
  csv += "Period: " + formatDateDisplay(fromDate) + " to " + formatDateDisplay(toDate) + "\n\n";

  csv += "Code,Account Name,Type,Debit,Credit,Balance\n";

  const tbody = document.getElementById("trialBalanceTable");
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const values = Array.from(cells).map(cell => cell.innerText).join(',');
    csv += values + "\n";
  });

  csv += "\nTotal Debits," + document.getElementById("tbTotalDebits").innerText + "\n";
  csv += "Total Credits," + document.getElementById("tbTotalCredits").innerText + "\n";
  csv += "Status," + document.getElementById("tbBalanceStatus").innerText + "\n";

  downloadCSV(csv, `Trial_Balance_${new Date().toISOString().split('T')[0]}.csv`);
  logExport("Trial Balance");
}

function exportLedgerToCSV() {
  let csv = "General Ledger\n";
  csv += "Period: " + formatDateDisplay(fromDate) + " to " + formatDateDisplay(toDate) + "\n\n";

  csv += "Date,Reference,Description,Account,Debit,Credit,Running Balance\n";

  const tbody = document.getElementById("ledgerTable");
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const values = Array.from(cells).map(cell => cell.innerText).join(',');
    csv += values + "\n";
  });

  downloadCSV(csv, `General_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
  logExport("General Ledger");
}

function exportAllReports() {
  alert("Multi-file export feature requires backend implementation. Use individual export buttons for now.");
  // In a real app, this would download multiple files or create a ZIP archive
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function logExport(reportName) {
  const timestamp = new Date().toLocaleString();
  const historyEl = document.getElementById("exportHistory");

  if (historyEl.querySelector('.no-data')) {
    historyEl.innerHTML = "";
  }

  const entry = document.createElement('div');
  entry.style.cssText = 'padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border-left: 3px solid #f4c748; margin-bottom: 8px; font-size: 13px;';
  entry.innerHTML = `
    <strong>${reportName}</strong><br>
    <span style="color: rgba(255,255,255,0.6);">${timestamp}</span>
  `;
  historyEl.insertBefore(entry, historyEl.firstChild);

  // Keep only last 5 exports
  while (historyEl.children.length > 5) {
    historyEl.removeChild(historyEl.lastChild);
  }
}
