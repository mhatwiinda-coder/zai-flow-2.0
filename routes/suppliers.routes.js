const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/suppliers.controller");

router.get("/", auth, controller.getSuppliers);
router.post("/", auth, controller.addSupplier);

module.exports = router;
