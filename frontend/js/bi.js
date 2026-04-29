// Supabase client initialized in supabase-init.js

/* Get DOM elements with null checks */
const salesSummary = document.getElementById("salesSummary");
const inventorySummary = document.getElementById("inventorySummary");

/* SALES SUMMARY */
if (salesSummary) {
  (async () => {
    try {
      const { data: sales, error } = await withBranchFilter(
        supabase.from('sales').select('*')
      );

      if (error) throw error;

      if (Array.isArray(sales) && sales.length > 0) {
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const avgSale = totalRevenue / totalSales;

        salesSummary.innerText =
          `Total Sales: ${totalSales}
           | Revenue: K${totalRevenue.toFixed(2)}
           | Avg Sale: K${avgSale.toFixed(2)}`;
      }
    } catch (err) {
      console.error("Sales summary error:", err);
    }
  })();
}

/* INVENTORY SUMMARY */
if (inventorySummary) {
  (async () => {
    try {
      const { data: products, error } = await withBranchFilter(
        supabase.from('products').select('*')
      );

      if (error) throw error;

      if (Array.isArray(products)) {
        const totalProducts = products.length;
        const lowStock = products.filter(p => Number(p.stock || 0) < 5).length;
        const outOfStock = products.filter(p => Number(p.stock || 0) === 0).length;

        inventorySummary.innerText =
          `Products: ${totalProducts}
           | Low Stock: ${lowStock}
           | Out of Stock: ${outOfStock}`;
      }
    } catch (err) {
      console.error("Inventory summary error:", err);
    }
  })();
}

/* TOP PRODUCTS */
function loadTopProducts() {
  (async () => {
    try {
      const { data: salesItems, error } = await supabase
        .from('sales_items')
        .select('product_id,quantity,products(name)');

      if (error) throw error;

      // Client-side aggregation: group by product and sum quantities
      const productTotals = {};
      if (Array.isArray(salesItems)) {
        salesItems.forEach(item => {
          const name = item.products?.name || `Product ${item.product_id}`;
          productTotals[name] = (productTotals[name] || 0) + (Number(item.quantity) || 0);
        });
      }

      // Sort and get top 10
      const sorted = Object.entries(productTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      const labels = sorted.map(([name]) => name);
      const totals = sorted.map(([,qty]) => qty);

      if (document.getElementById("topProductsChart")) {
        new Chart(document.getElementById("topProductsChart"), {
          type: "bar",
          data: {
            labels,
            datasets: [{
              label: "Units Sold",
              data: totals,
              backgroundColor: "#f7c948"
            }]
          }
        });
      }
    } catch (err) {
      console.error("Top products error:", err);
    }
  })();
}

/* SALES TREND */
function loadSalesTrend() {
  (async () => {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Client-side aggregation: group by date
      const dailyTotals = {};
      if (Array.isArray(sales)) {
        sales.forEach(sale => {
          const date = new Date(sale.created_at).toISOString().split('T')[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + (Number(sale.total) || 0);
        });
      }

      const labels = Object.keys(dailyTotals);
      const totals = Object.values(dailyTotals);

      if (document.getElementById("salesTrendChart")) {
        new Chart(document.getElementById("salesTrendChart"), {
          type: "line",
          data: {
            labels,
            datasets: [{
              label: "Revenue",
              data: totals,
              borderColor: "#28c76f",
              fill: false
            }]
          }
        });
      }
    } catch (err) {
      console.error("Sales trend error:", err);
    }
  })();
}

function loadFiltered(range) {
  (async () => {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*');

      if (error) throw error;

      // Client-side filtering based on range
      let filtered = sales;
      const now = new Date();

      if (range === 'today') {
        const today = now.toISOString().split('T')[0];
        filtered = sales.filter(s => new Date(s.created_at).toISOString().split('T')[0] === today);
      } else if (range === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = sales.filter(s => new Date(s.created_at) >= sevenDaysAgo);
      } else if (range === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = sales.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
      }

      if (Array.isArray(filtered) && filtered.length > 0) {
        const totalSales = filtered.length;
        const totalRevenue = filtered.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const avgSale = totalRevenue / totalSales;

        if (salesSummary) {
          salesSummary.innerText =
            `Sales: ${totalSales}
             | Revenue: K${totalRevenue.toFixed(2)}
             | Avg: K${avgSale.toFixed(2)}`;
        }
      }
    } catch (err) {
      console.error("Filtered sales error:", err);
    }
  })();
}

function loadPaymentChart() {
  (async () => {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('payment_method,total');

      if (error) throw error;

      // Client-side aggregation: group by payment method
      const paymentBreakdown = {};
      if (Array.isArray(sales)) {
        sales.forEach(sale => {
          const method = sale.payment_method || 'Other';
          paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (Number(sale.total) || 0);
        });
      }

      const labels = Object.keys(paymentBreakdown);
      const totals = Object.values(paymentBreakdown);

      if (document.getElementById("paymentChart")) {
        new Chart(document.getElementById("paymentChart"), {
          type: "pie",
          data: {
            labels,
            datasets: [{
              data: totals,
              backgroundColor: [
                "#28c76f",
                "#ff9f43",
                "#ea5455",
                "#7367f0"
              ]
            }]
          }
        });
      }
    } catch (err) {
      console.error("Payment chart error:", err);
    }
  })();
}

function loadLowStock() {
  (async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .lt('stock', 5)
        .order('stock', { ascending: true });

      if (error) throw error;

      let html = "<h4>Low Stock Alerts</h4>";

      if (!Array.isArray(products) || products.length === 0) {
        html += "<p>No low stock items 🎉</p>";
      } else {
        products.forEach(p => {
          html += `
            <div style="color:red;">
              ⚠ ${p.name} — ${p.stock} left
            </div>
          `;
        });
      }

      const widget = document.getElementById("lowStockWidget");
      if (widget) {
        widget.innerHTML = html;
      }
    } catch (err) {
      console.error("Low stock error:", err);
    }
  })();
}

function exportExcel() {
  alert("Excel export coming soon! For now, use the Accounting module to export reports.");
}

document.addEventListener("DOMContentLoaded", () => {
  loadFiltered("today");
  loadPaymentChart();
  loadLowStock();
});
