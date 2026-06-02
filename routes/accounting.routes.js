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
router.get("/general-ledger", auth, controller.generalLedger);

router.get("/profit-loss", auth, controller.profitAndLoss);

router.get("/trial-balance/export", auth, controller.exportTrialBalance);

router.get("/ledger/export", auth, controller.exportLedger);

module.exports = router;