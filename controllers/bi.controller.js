const db = require("../data/db");
const ExcelJS = require("exceljs");

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/* ================= SALES SUMMARY ================= */
exports.salesSummary = async (req, res) => {
  const data = await dbAll(`
    SELECT COUNT(*)::int                AS total_sales,
           COALESCE(SUM(total), 0)      AS total_revenue,
           COALESCE(AVG(total), 0)      AS avg_sale
    FROM sales
    WHERE status = 'COMPLETED'
  `);
  res.json(data[0]);
};

/* ================= FILTERED SUMMARY ================= */
exports.salesSummaryFiltered = async (req, res) => {
  const range = req.query.range || "today";

  let condition;
  if (range === "week") {
    condition = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (range === "month") {
    condition = "TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')";
  } else {
    condition = "created_at::date = CURRENT_DATE";
  }

  const data = await dbAll(`
    SELECT COUNT(*)::int           AS total_sales,
           COALESCE(SUM(total), 0) AS total_revenue,
           COALESCE(AVG(total), 0) AS avg_sale
    FROM sales
    WHERE status = 'COMPLETED'
      AND ${condition}
  `);
  res.json(data[0]);
};

/* ================= INVENTORY SUMMARY ================= */
exports.inventorySummary = async (req, res) => {
  const data = await dbAll(`
    SELECT
      COUNT(*)::int                                            AS total_products,
      SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END)::int        AS low_stock,
      SUM(CASE WHEN stock = 0  THEN 1 ELSE 0 END)::int        AS out_of_stock
    FROM products
  `);
  res.json(data[0]);
};

/* ================= LOW STOCK ================= */
exports.lowStockProducts = async (req, res) => {
  const data = await dbAll(`
    SELECT name, stock
    FROM products
    WHERE stock <= 5
    ORDER BY stock ASC
  `);
  res.json(data);
};

/* ================= PAYMENT BREAKDOWN ================= */
exports.paymentBreakdown = async (req, res) => {
  const data = await dbAll(`
    SELECT payment_method,
           SUM(total) AS revenue
    FROM sales
    WHERE status = 'COMPLETED'
    GROUP BY payment_method
  `);
  res.json(data);
};

/* ================= SALES TREND (last 7 days) ================= */
exports.salesTrend = async (req, res) => {
  const data = await dbAll(`
    SELECT created_at::date AS date,
           SUM(total)       AS total
    FROM sales
    WHERE status = 'COMPLETED'
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY created_at::date
    ORDER BY date ASC
  `);
  res.json(data);
};

/* ================= TOP PRODUCTS ================= */
exports.topProducts = async (req, res) => {
  const data = await dbAll(`
    SELECT p.name,
           SUM(si.quantity)::int AS total_sold
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    JOIN sales s    ON s.id = si.sale_id
    WHERE s.status = 'COMPLETED'
    GROUP BY p.name
    ORDER BY total_sold DESC
    LIMIT 5
  `);
  res.json(data);
};

/* ================= LEAST PRODUCTS ================= */
exports.leastProducts = async (req, res) => {
  const data = await dbAll(`
    SELECT p.name,
           COALESCE(SUM(si.quantity), 0)::int AS total_sold
    FROM products p
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s       ON s.id = si.sale_id AND s.status = 'COMPLETED'
    GROUP BY p.name
    ORDER BY total_sold ASC
    LIMIT 5
  `);
  res.json(data);
};

/* ================= PRODUCT REVENUE ================= */
exports.productRevenue = async (req, res) => {
  const data = await dbAll(`
    SELECT p.name,
           SUM(si.quantity * si.price) AS total_revenue
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    JOIN sales s    ON s.id = si.sale_id
    WHERE s.status = 'COMPLETED'
    GROUP BY p.name
    ORDER BY total_revenue DESC
  `);
  res.json(data);
};

/* ================= EXCEL EXPORT ================= */
exports.exportSalesExcel = async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sales = await dbAll(`SELECT * FROM sales ORDER BY created_at DESC`);

  const sheet = workbook.addWorksheet("Sales");
  sheet.columns = [
    { header: "ID",         key: "id",             width: 10 },
    { header: "Total (K)",  key: "total",           width: 15 },
    { header: "Payment",    key: "payment_method",  width: 15 },
    { header: "Status",     key: "status",          width: 15 },
    { header: "Created At", key: "created_at",      width: 25 }
  ];
  sheet.addRows(sales);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=ZAI_Flow_Report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = exports;
