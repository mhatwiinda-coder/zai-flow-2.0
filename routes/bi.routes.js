const express = require("express");
const router = express.Router();

const biController = require("../controllers/bi.controller");

// Existing
router.get("/sales-summary", biController.salesSummary);
router.get("/sales-summary-filtered", biController.salesSummaryFiltered);
router.get("/inventory-summary", biController.inventorySummary);
router.get("/payment-breakdown", biController.paymentBreakdown);
router.get("/low-stock", biController.lowStockProducts);
router.get("/sales-trend", biController.salesTrend);
router.get("/export/excel", biController.exportSalesExcel);

// Product Analytics (MATCH CONTROLLER NAMES)
router.get("/top-products", biController.topProducts);
router.get("/least-products", biController.leastProducts);
router.get("/product-revenue", biController.productRevenue);

module.exports = router;