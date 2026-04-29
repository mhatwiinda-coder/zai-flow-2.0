const express = require("express");
const router = express.Router();

const controller = require("../controllers/inventory.controller");
const auth = require("../middleware/auth");

/* =========================
   PRODUCT ROUTES
========================= */

// Get all products (base endpoint)
router.get("/", auth, controller.getProducts);

// Create product
router.post("/products", auth, controller.addProduct);

// Get all products
router.get("/products", auth, controller.getProducts);

// Lookup by ID / Barcode / SKU
router.get("/lookup/:code", auth, controller.lookupProduct);

// Update product
router.put("/products/:id", auth, controller.updateProduct);

// Delete product
router.delete("/products/:id", auth, controller.deleteProduct);

/* =========================
   INVENTORY MOVEMENTS
========================= */

router.get("/movements", auth, controller.getMovements);

module.exports = router;