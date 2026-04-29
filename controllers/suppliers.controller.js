const db = require("../data/db");

exports.getSuppliers = (req, res) => {
  db.all(
    "SELECT * FROM suppliers ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

exports.addSupplier = (req, res) => {
  const { name, phone, email } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Supplier name required" });
  }

  db.run(
    "INSERT INTO suppliers (name, phone, email) VALUES (?, ?, ?)",
    [name, phone, email],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ id: this.lastID });
    }
  );
};
