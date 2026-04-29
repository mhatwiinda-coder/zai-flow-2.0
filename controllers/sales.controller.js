const db         = require("../data/db");
const accounting = require("./accounting.controller");
const bcrypt     = require("bcryptjs");
const si         = require("../services/smartinvoice.service");

/* ======================================================
   MAKE SALE
====================================================== */
exports.makeSale = async (req, res) => {

  const { items, payment_method } = req.body;
  const userId = req.user.id;

  if (!items || !items.length) {
    return res.status(400).json({ message: "Empty sale" });
  }

  // 🚨 CHECK DRAWER OPEN FIRST
  const drawer = await new Promise((resolve) => {
    db.get(
      `SELECT * FROM cash_drawer WHERE user_id = ? AND status = 'OPEN'`,
      [userId],
      (err, row) => resolve(row)
    );
  });

  if (!drawer) {
    return res.status(403).json({ message: "Open till first" });
  }

  let total       = 0;
  let costOfGoods = 0;

  for (const item of items) {
    const product = await new Promise((resolve, reject) => {
      db.get(
        `SELECT price, cost_price, stock FROM products WHERE id = ?`,
        [item.product_id],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < item.quantity) return res.status(400).json({ message: "Insufficient stock" });

    total       += item.quantity * product.price;
    costOfGoods += item.quantity * (product.cost_price || 0);
  }

  db.run(
    `INSERT INTO sales (total, payment_method, status) VALUES (?, ?, 'COMPLETED')`,
    [total, payment_method],
    async function (err) {

      if (err) return res.status(500).json(err);
      const saleId = this.lastID;

      for (const item of items) {
        const product = await new Promise((resolve) => {
          db.get(
            `SELECT price, cost_price FROM products WHERE id = ?`,
            [item.product_id],
            (err, row) => resolve(row)
          );
        });

        if (!product) { console.error("Product not found for ID:", item.product_id); continue; }

        db.run(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`,
          [saleId, item.product_id, item.quantity, product.price]
        );

        db.run(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [item.quantity, item.product_id]
        );

        db.run(
          `INSERT INTO inventory_movements (product_id, type, quantity, reason) VALUES (?, 'OUT', ?, 'POS Sale')`,
          [item.product_id, item.quantity]
        );
      }

      /* ================= ACCOUNTING ================= */
      try {
        const CASH_ID      = await accounting.getAccountIdByCode("1000");
        const SALES_ID     = await accounting.getAccountIdByCode("4000");
        const COGS_ID      = await accounting.getAccountIdByCode("5000");
        const INVENTORY_ID = await accounting.getAccountIdByCode("1200");

        await accounting.postJournal(
          "SALE-" + saleId,
          "POS Sale",
          [
            { account_id: CASH_ID,      debit: total,       credit: 0 },
            { account_id: SALES_ID,     debit: 0,           credit: total },
            { account_id: COGS_ID,      debit: costOfGoods, credit: 0 },
            { account_id: INVENTORY_ID, debit: 0,           credit: costOfGoods }
          ]
        );

        if (payment_method === "Cash") {
          db.run(
            `UPDATE cash_drawer SET expected_balance = expected_balance + ? WHERE user_id = ? AND status = 'OPEN'`,
            [total, userId]
          );
        }
      } catch (err) {
        console.error("Accounting failed:", err);
      }

      /* ================= ZRA SMART INVOICE ================= */
      let fiscalData = null;
      try {
        const zraResult = await si.submitSaleInvoice(saleId, userId);
        if (zraResult.status !== 'SKIPPED') {
          fiscalData = await si.getFiscalInvoice(saleId).catch(() => null);
        }
      } catch (e) {
        console.error("Smart Invoice (non-blocking):", e.message);
      }

      res.json({ sale_id: saleId, total, fiscal: fiscalData });
    }
  );
};


/* ======================================================
   OPEN DRAWER
====================================================== */
exports.openDrawer = (req, res) => {

  const { opening_balance } = req.body;
  const userId = req.user.id;

  if (opening_balance < 0) return res.status(400).json({ message: "Invalid opening balance" });

  db.get(
    `SELECT * FROM cash_drawer WHERE user_id = ? AND status = 'OPEN'`,
    [userId],
    (err, existing) => {
      if (existing) return res.status(400).json({ message: "Drawer already open" });

      db.run(
        `INSERT INTO cash_drawer (user_id, opening_balance, expected_balance) VALUES (?, ?, ?)`,
        [userId, opening_balance, opening_balance],
        function (err) {
          if (err) return res.status(500).json(err);
          res.json({ opened: true });
        }
      );
    }
  );
};


/* ======================================================
   CLOSE DRAWER
====================================================== */
exports.closeDrawer = (req, res) => {

  const userId   = req.user.id;
  const declared = Number(Number(req.body.declared_balance).toFixed(2));

  db.get(
    `SELECT * FROM cash_drawer WHERE user_id = ? AND status = 'OPEN'`,
    [userId],
    (err, drawer) => {
      if (err)     return res.status(500).json(err);
      if (!drawer) return res.status(400).json({ message: "No open drawer" });

      const expected   = Number(Number(drawer.expected_balance).toFixed(2));
      const difference = Number((declared - expected).toFixed(2));
      const isBalanced = Math.abs(difference) < 0.01;

      db.run(
        `UPDATE cash_drawer
         SET declared_balance = ?, difference = ?, closed_at = NOW(), status = 'CLOSED'
         WHERE id = ?`,
        [declared, difference, drawer.id],
        err => {
          if (err) return res.status(500).json(err);
          res.json({ closed: true, balanced: isBalanced, opening: drawer.opening_balance, expected, declared, difference });
        }
      );
    }
  );
};


/* ======================================================
   DRAWER STATUS (PER USER)
====================================================== */
exports.getDrawerStatus = (req, res) => {

  const userId = req.user.id;

  db.get(
    `SELECT * FROM cash_drawer WHERE user_id = ? AND status = 'OPEN'`,
    [userId],
    (err, row) => {
      if (row) res.json({ isOpen: true,  expected_balance: row.expected_balance });
      else     res.json({ isOpen: false });
    }
  );
};


/* ======================================================
   SUPERVISOR AUTH
====================================================== */
exports.authorizeSupervisor = async (req, res) => {

  const { password } = req.body;

  db.get(`SELECT * FROM users WHERE role = 'supervisor'`, [], async (err, user) => {
    if (!user) return res.status(401).json({ authorized: false });
    const match = await bcrypt.compare(password, user.password);
    res.json({ authorized: match });
  });
};


/* ======================================================
   GET ALL SALES
====================================================== */
exports.getAllSales = (req, res) => {
  db.all(
    `SELECT * FROM sales ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};


/* ======================================================
   GET SALES BY DATE
====================================================== */
exports.getSalesByDate = (req, res) => {
  db.all(
    `SELECT * FROM sales WHERE created_at::date = $1::date ORDER BY created_at DESC`,
    [req.params.date],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};


/* ======================================================
   DAILY SUMMARY
====================================================== */
exports.dailySummary = (req, res) => {
  db.get(`
    SELECT
      COUNT(*)::int                             AS transactions,
      COALESCE(SUM(total), 0)                   AS total_sales,
      COALESCE(SUM(total / 1.16), 0)            AS net_sales,
      COALESCE(SUM(total - total / 1.16), 0)    AS vat_total
    FROM sales
    WHERE created_at::date = CURRENT_DATE
      AND status = 'COMPLETED'
  `, [], (err, row) => {
    if (err) return res.status(500).json(err);
    res.json(row || {});
  });
};


/* ======================================================
   GET SINGLE SALE
====================================================== */
exports.getSingleSale = (req, res) => {
  const saleId = req.params.id;

  db.get(`SELECT * FROM sales WHERE id = ?`, [saleId], (err, sale) => {
    if (err || !sale) return res.status(404).json({ message: "Sale not found" });

    db.all(
      `SELECT p.name, si.quantity, si.price
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`,
      [saleId],
      (err, items) => {
        if (err) return res.status(500).json(err);
        res.json({ sale_id: sale.id, sale, items });
      }
    );
  });
};


/* ======================================================
   REVERSE SALE
====================================================== */
exports.reverseSale = (req, res) => {

  const saleId = req.params.id;

  db.get(`SELECT * FROM sales WHERE id = ?`, [saleId], (err, sale) => {
    if (err || !sale)             return res.status(404).json({ message: "Sale not found" });
    if (sale.status === "REVERSED") return res.status(400).json({ message: "Already reversed" });

    db.run(`UPDATE sales SET status = 'REVERSED' WHERE id = ?`, [saleId], err => {
      if (err) return res.status(500).json(err);

      db.all(`SELECT * FROM sale_items WHERE sale_id = ?`, [saleId], (err, items) => {
        items.forEach(item => {
          db.run(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.product_id]);
        });
        res.json({ reversed: true });
      });
    });
  });
};


/* ======================================================
   DRAWER SUMMARY
====================================================== */
exports.drawerSummary = (req, res) => {

  const drawerId = req.params.id;

  db.get(`SELECT * FROM cash_drawer WHERE id = ?`, [drawerId], (err, drawer) => {
    if (err || !drawer) return res.status(404).json({ message: "Drawer not found" });
    res.json(drawer);
  });
};


/* ======================================================
   SALES TREND
====================================================== */
exports.salesTrend = (req, res) => {
  db.all(`
    SELECT created_at::date AS date,
           SUM(total)       AS total
    FROM sales
    WHERE status = 'COMPLETED'
    GROUP BY created_at::date
    ORDER BY date DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};


/* ======================================================
   TOP PRODUCTS
====================================================== */
exports.topProducts = (req, res) => {
  db.all(`
    SELECT p.name,
           SUM(si.quantity)::int AS total_sold
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    GROUP BY si.product_id, p.name
    ORDER BY total_sold DESC
    LIMIT 10
  `, [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};
