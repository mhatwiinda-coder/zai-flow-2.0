const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/receipts.controller");

router.get("/:id", auth, controller.printReceipt);

module.exports = router;
