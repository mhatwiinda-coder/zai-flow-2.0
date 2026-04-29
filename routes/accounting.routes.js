const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/accounting.controller");

/* ===============================
   BASE ACCOUNTING ENDPOINT (for dashboard)
=============================== */
router.get("/", auth, controller.profitAndLoss);

/* ===============================
   CHART OF ACCOUNTS
=============================== */
router.get("/accounts", auth, controller.getAllAccounts);

/* ===============================
   TRIAL BALANCE
=============================== */
router.get("/trial-balance", auth, controller.trialBalance);

/* ===============================
   GENERAL LEDGER
=============================== */
router.get("/general-ledger", controller.generalLedger);

router.get("/profit-loss", controller.profitAndLoss);

router.get("/trial-balance/export", controller.exportTrialBalance);

router.get("/ledger/export", controller.exportLedger);

module.exports = router;