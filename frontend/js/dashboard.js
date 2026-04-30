// Supabase client initialized in supabase-init.js

const CURRENCY = "ZMW";
let charts = {};
let dashboardRefreshInterval;

/* =====================================================
   INITIALIZE DASHBOARD
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  // Auto-refresh every 30 seconds
  dashboardRefreshInterval = setInterval(initDashboard, 30000);
});

function initDashboard() {
  loadSalesMetrics();
  loadInventoryMetrics();
  loadFinancialMetrics();
  loadCashMetrics();
  loadChartsData();
  loadAlerts();
}

function refreshDashboard() {
  const btn = document.querySelector(".refresh-btn");
  btn.style.animation = "spin 0.6s linear";
  initDashboard();
  setTimeout(() => {
    btn.style.animation = "";
  }, 600);
}

/* =====================================================
   SALES METRICS
===================================================== */
function loadSalesMetrics() {
  (async () => {
    try {
      const { data: allSales, error } = await withBranchFilter(
        window.supabase.from('sales').select('*')
      )
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!Array.isArray(allSales)) return;

      // Get today's sales
      const today = new Date().toISOString().split('T')[0];
      const todaySales = allSales.filter(s => {
        const saleDate = new Date(s.created_at).toISOString().split('T')[0];
        return saleDate === today;
      });

      const totalRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const count = todaySales.length;

      document.getElementById("salesValue").innerText = money(totalRevenue);
      document.getElementById("salesCount").innerText = count;
      document.getElementById("salesStatus").innerText = "📊 Sales Module: Active";

      // Calculate trend (compare with yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];
      const yesterdaySales = allSales.filter(s => {
        const saleDate = new Date(s.created_at).toISOString().split('T')[0];
        return saleDate === yesterdayDate;
      });
      const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

      const trendPercent = yesterdayRevenue > 0
        ? ((totalRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
        : 0;

      const trendEl = document.getElementById("salesTrend");
      trendEl.innerText = trendPercent > 0 ? `↗ +${trendPercent}%` : `↘ ${trendPercent}%`;
      trendEl.style.color = trendPercent > 0 ? "#28c76f" : "#ff5b5b";
    } catch (err) {
      console.error("Sales metrics error:", err);
      document.getElementById("salesStatus").innerText = "📊 Sales Module: Error";
    }
  })();
}

/* =====================================================
   INVENTORY METRICS
===================================================== */
function loadInventoryMetrics() {
  (async () => {
    try {
      const { data: products, error } = await withBranchFilter(
        supabase.from('products').select('*')
      );

      if (error) {
        throw error;
      }

      if (!Array.isArray(products)) return;

      // Calculate total inventory value AT COST (not selling price)
      const totalValue = products.reduce((sum, p) => sum + (Number(p.cost_price || 0) * Number(p.stock || 0)), 0);

      // Count low stock items (< 5 units)
      const lowStock = products.filter(p => Number(p.stock || 0) < 5).length;

      document.getElementById("inventoryValue").innerText = money(totalValue);
      document.getElementById("lowStockCount").innerText = lowStock;
      document.getElementById("inventoryStatus").innerText = "📦 Inventory Module: Active";

      // Update alert color
      const alertBadge = document.getElementById("inventoryAlert");
      alertBadge.style.color = lowStock > 0 ? "#ff5b5b" : "#28c76f";
      alertBadge.style.background = lowStock > 0
        ? "rgba(255, 91, 91, 0.15)"
        : "rgba(40, 199, 111, 0.15)";
    } catch (err) {
      console.error("Inventory metrics error:", err);
      document.getElementById("inventoryStatus").innerText = "📦 Inventory Module: Error";
    }
  })();
}

/* =====================================================
   FINANCIAL METRICS
===================================================== */
function loadFinancialMetrics() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return;

      const { data: profitLoss, error } = await window.supabase.rpc('get_profit_loss', {
        p_business_id: context.business_id
      });

      if (error) {
        throw error;
      }

      if (!profitLoss || profitLoss.length === 0) return;

      const pl = profitLoss[0];
      const revenue = Number(pl.revenue || 0);
      const expenses = Number(pl.expenses || 0);
      const netProfit = Number(pl.net_profit || 0);
      const ratio = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;

      document.getElementById("financialValue").innerText = money(netProfit);
      document.getElementById("revenueRatio").innerText = ratio + "%";
      document.getElementById("accountingStatus").innerText = "💼 Accounting Module: Active";

      // Trend indicator
      const trendEl = document.getElementById("financialTrend");
      trendEl.innerText = netProfit > 0 ? `↗ Profit` : `↘ Loss`;
      trendEl.style.color = netProfit > 0 ? "#28c76f" : "#ff5b5b";
    } catch (err) {
      console.error("Financial metrics error:", err);
      document.getElementById("accountingStatus").innerText = "💼 Accounting Module: Error";
    }
  })();
}

/* =====================================================
   CASH DRAWER METRICS
===================================================== */
function loadCashMetrics() {
  (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));

      // Get the most recent drawer for this user using PostgREST
      const { data: drawers, error: drawerError } = await supabase
        .from('cash_drawer')
        .select('*')
        .eq('user_id', String(user?.id))
        .order('opened_at', { ascending: false })
        .limit(1);

      const statusEl = document.getElementById("drawerStatus");
      const balanceEl = document.getElementById("drawerBalance");
      const varianceEl = document.getElementById("drawerVariance");
      const diffEl = document.getElementById("drawerDifference");

      if (drawerError || !drawers || drawers.length === 0 || drawers[0].status !== 'OPEN') {
        statusEl.innerText = "CLOSED";
        statusEl.style.color = "#ff5b5b";
        balanceEl.innerText = "0.00";
        varianceEl.innerText = "—";
        diffEl.innerText = "—";
        return;
      }

      const drawer = drawers[0];

      // Calculate expected balance (opening + cash sales since drawer opened)
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total')
        .eq('payment_method', 'Cash')
        .eq('status', 'COMPLETED')
        .gte('created_at', drawer.opened_at);

      const salesTotal = sales ? sales.reduce((sum, s) => sum + Number(s.total || 0), 0) : 0;
      const expectedBalance = Number(drawer.opening_balance || 0) + salesTotal;

      statusEl.innerText = "OPEN";
      statusEl.style.color = "#28c76f";
      balanceEl.innerText = money(expectedBalance);

      varianceEl.innerText = expectedBalance > 0 ? "✓" : "!";
      varianceEl.style.color = expectedBalance > 0 ? "#28c76f" : "#ff5b5b";
      diffEl.innerText = "0%";
    } catch (err) {
      console.error("Cash metrics error:", err);
      document.getElementById("drawerStatus").innerText = "ERROR";
    }
  })();
}

/* =====================================================
   CHARTS & ANALYTICS
===================================================== */
function loadChartsData() {
  // Load sales trend
  loadSalesTrendChart();
  // Load payment distribution
  loadPaymentDistributionChart();
}

function loadSalesTrendChart() {
  (async () => {
    try {
      const chartEl = document.getElementById("salesTrendChart");
      const loadingEl = document.getElementById("salesChartLoading");

      loadingEl.style.display = "flex";
      if (charts.salesTrend) charts.salesTrend.destroy();

      const { data: allSales, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!Array.isArray(allSales)) return;

      // Get last 7 days data
      const days = [];
      const dailyRevenue = {};

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push(dateStr);
        dailyRevenue[dateStr] = 0;
      }

      // Sum revenue by day
      allSales.forEach(sale => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        if (dailyRevenue.hasOwnProperty(saleDate)) {
          dailyRevenue[saleDate] += Number(sale.total || 0);
        }
      });

      const revenues = days.map(d => dailyRevenue[d]);
      const labels = days.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

      loadingEl.style.display = "none";

      charts.salesTrend = new Chart(chartEl, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Daily Revenue',
            data: revenues,
            borderColor: '#00bcd4',
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#00bcd4',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: 'rgba(255,255,255,0.7)',
                callback: function(value) {
                  return money(value);
                }
              },
              grid: {
                color: 'rgba(255,255,255,0.05)'
              }
            },
            x: {
              ticks: {
                color: 'rgba(255,255,255,0.7)'
              },
              grid: {
                color: 'rgba(255,255,255,0.05)'
              }
            }
          }
        }
      });
    } catch (err) {
      console.error("Sales trend chart error:", err);
      document.getElementById("salesChartLoading").innerText = "Failed to load chart";
    }
  })();
}

function loadPaymentDistributionChart() {
  (async () => {
    try {
      const chartEl = document.getElementById("paymentDistributionChart");
      const loadingEl = document.getElementById("paymentChartLoading");

      loadingEl.style.display = "flex";
      if (charts.paymentDist) charts.paymentDist.destroy();

      const { data: allSales, error } = await supabase
        .from('sales')
        .select('*');

      if (error) {
        throw error;
      }

      if (!Array.isArray(allSales)) return;

      // Count by payment method
      const paymentCounts = {
        'Cash': 0,
        'Card': 0,
        'Mobile Money': 0,
        'Other': 0
      };

      allSales.forEach(sale => {
        const method = sale.payment_method || 'Other';
        if (paymentCounts.hasOwnProperty(method)) {
          paymentCounts[method]++;
        } else {
          paymentCounts['Other']++;
        }
      });

      const labels = Object.keys(paymentCounts);
      const counts = Object.values(paymentCounts);
      const colors = ['#00bcd4', '#7367f0', '#ff9f43', '#28c76f'];

      loadingEl.style.display = "none";

      charts.paymentDist = new Chart(chartEl, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'rgba(255,255,255,0.7)',
                padding: 15,
                font: {
                  size: 12
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error("Payment distribution chart error:", err);
      document.getElementById("paymentChartLoading").innerText = "Failed to load chart";
    }
  })();
}

/* =====================================================
   ALERTS & RECENT SALES
===================================================== */
function loadAlerts() {
  loadLowStockAlerts();
  loadRecentSales();
}

function loadLowStockAlerts() {
  (async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*');

      if (error) {
        throw error;
      }

      if (!Array.isArray(products)) return;

      const lowStock = products.filter(p => Number(p.stock || 0) < 5);
      const listEl = document.getElementById("lowStockList");

      if (lowStock.length === 0) {
        listEl.innerHTML = '<p class="no-data">No low stock alerts ✅</p>';
        return;
      }

      let html = "";
      lowStock.forEach(product => {
        const stock = Number(product.stock || 0);
        const severity = stock === 0 ? "critical" : "warning";
        html += `
          <div class="alert-item">
            <div>
              <strong>${product.name || product.product_name}</strong><br>
              <small>Stock: ${stock} units${product.sku ? ' | SKU: ' + product.sku : ''}</small>
            </div>
          </div>
        `;
      });

      listEl.innerHTML = html;
    } catch (err) {
      console.error("Low stock alerts error:", err);
      document.getElementById("lowStockList").innerHTML = '<p class="no-data">Failed to load alerts</p>';
    }
  })();
}

function loadRecentSales() {
  (async () => {
    try {
      const { data: allSales, error } = await withBranchFilter(
        window.supabase.from('sales').select('*')
      )
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      if (!Array.isArray(allSales)) return;

      const listEl = document.getElementById("recentSalesList");

      if (allSales.length === 0) {
        listEl.innerHTML = '<p class="no-data">No recent sales</p>';
        return;
      }

      let html = "";
      allSales.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        const timeStr = saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        html += `
          <div class="transaction-item">
            <div>
              <strong>Sale #${sale.id}</strong><br>
              <small>${timeStr} • ${sale.payment_method || 'Cash'}</small>
            </div>
            <div class="transaction-amount">${money(sale.total || 0)}</div>
          </div>
        `;
      });

      listEl.innerHTML = html;
    } catch (err) {
      console.error("Recent sales error:", err);
      document.getElementById("recentSalesList").innerHTML = '<p class="no-data">Failed to load sales</p>';
    }
  })();
}

/* =====================================================
   HELPERS
===================================================== */
function money(value) {
  return "ZMW " + Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Cleanup on page unload */
window.addEventListener('beforeunload', () => {
  if (dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
  }
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
});
