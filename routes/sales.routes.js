const express = require("express");
const router = express.Router();

const controller = require("../controllers/sales.controller");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

/* ================= SALES ================= */

// Only logged-in users
router.post("/", auth, role(["admin","cashier"]), controller.makeSale);
router.get("/", auth, controller.getAllSales);
router.get("/date/:date", auth, controller.getSalesByDate);
router.get("/summary/today", auth, controller.dailySummary);
router.get("/:id", auth, controller.getSingleSale);

/* ================= REVERSALS ================= */

router.post("/:id/reverse", auth, controller.reverseSale);

/* ================= DRAWER ================= */

router.get("/drawer/status", auth, controller.getDrawerStatus);
router.post("/drawer/open", auth, controller.openDrawer);
router.post("/drawer/close", auth, controller.closeDrawer);
router.get("/drawer/:id/summary", auth, controller.drawerSummary);

/* ================= SUPERVISOR ================= */

router.post("/authorize-supervisor", controller.authorizeSupervisor);

/* ================= BI ================= */

router.get("/trend", auth, controller.salesTrend);
router.get("/top-products", auth, controller.topProducts);

module.exports = router;