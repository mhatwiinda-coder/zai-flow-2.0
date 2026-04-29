const db = require("../data/db");

/* ===============================
   ADD PRODUCT
=============================== */
exports.addProduct = (req, res) => {
  const { name, barcode, price, cost_price, initial_stock } = req.body;

  if (!name || !barcode || price == null || initial_stock == null) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // Generate SKU (first 3 letters + last 4 barcode digits)
  const prefix = name.replace(/\s/g, "").substring(0, 3).toUpperCase();
  const suffix = barcode.slice(-4);
  const sku = `${prefix}-${suffix}`;

  db.run(
    `INSERT INTO products (name, barcode, sku, price, stock)
     VALUES (?, ?, ?, ?, ?)`,
    [name, barcode, sku, price, initial_stock],
    function (err) {
      if (err) return res.status(500).json(err);

      db.run(
        `INSERT INTO inventory_movements
         (product_id, type, quantity, reason)
         VALUES (?, 'IN', ?, 'Initial Stock')`,
        [this.lastID, initial_stock]
      );

      res.json({
        message: "Product created successfully",
        sku
      });
    }
  );
};

/* ===============================
   GET ALL PRODUCTS
=============================== */
exports.getProducts = (req, res) => {
  db.all(
    `SELECT * FROM products ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

/* ===============================
   LOOKUP (ID / BARCODE / SKU)
=============================== */
exports.lookupProduct = (req, res) => {

  const code = req.params.code;

  db.get(
    `SELECT * FROM products
     WHERE id=? OR sku=? OR barcode=?`,
    [code, code, code],
    (err, row) => {

      if (!row)
        return res.status(404).json({ message: "Not found" });

      res.json(row);
    }
  );
};

/* ===============================
   UPDATE PRODUCT + STOCK
=============================== */
exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, barcode, price, new_stock, reason } = req.body;

  db.get(
    `SELECT stock FROM products WHERE id = ?`,
    [id],
    (err, product) => {
      if (err || !product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const diff = new_stock - product.stock;
      const type = diff > 0 ? "IN" : "OUT";

      db.run(
        `UPDATE products
         SET name = ?, barcode = ?, price = ?, stock = ?
         WHERE id = ?`,
        [name, barcode, price, new_stock, id],
        err => {
          if (err) return res.status(500).json(err);

          if (diff !== 0) {
            db.run(
              `INSERT INTO inventory_movements
               (product_id, type, quantity, reason)
               VALUES (?, ?, ?, ?)`,
              [id, type, Math.abs(diff), reason || "Manual adjustment"]
            );
          }

          res.json({ message: "Product updated successfully" });
        }
      );
    }
  );
};

/* ===============================
   DELETE PRODUCT
=============================== */
exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM products WHERE id = ?`,
    [id],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product deleted successfully" });
    }
  );
};

/* ===============================
   GET INVENTORY MOVEMENTS
=============================== */
exports.getMovements = (req, res) => {
  db.all(
    `SELECT m.*, p.name
     FROM inventory_movements m
     JOIN products p ON p.id = m.product_id
     ORDER BY m.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};
