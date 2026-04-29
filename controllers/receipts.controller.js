const PDFDocument = require("pdfkit");
const db = require("../data/db");

exports.printReceipt = (req, res) => {
  const saleId = req.params.id;

  db.all(
    `
    SELECT s.id, s.created_at, s.total,
           si.quantity, p.name AS product, p.price
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    WHERE s.id = ?
    `,
    [saleId],
    (err, items) => {
      if (err || !items || items.length === 0) {
        return res.status(404).json({ message: "Sale not found" });
      }

      const sale = items[0];
      const doc = new PDFDocument({ size: "A4", margin: 40 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=receipt-${saleId}.pdf`
      );

      doc.pipe(res);

      // ===== RECEIPT DESIGN =====
      doc.fontSize(22).text("ZAI FLOW", { align: "center" });
      doc.moveDown();
      doc.fontSize(14).text("Sales Receipt", { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12);
      doc.text(`Receipt #: ${sale.id}`);
      doc.text(`Date: ${sale.created_at}`);
      doc.moveDown();

      doc.text("Items:");
      items.forEach(item => {
        doc.text(`  ${item.product} x${item.quantity} @ ${item.price}`);
      });
      doc.moveDown();

      doc.fontSize(16).text(`TOTAL: ${sale.total}`, { align: "right" });

      doc.moveDown(3);
      doc.fontSize(10).text("Thank you for shopping with ZAI Flow", {
        align: "center",
      });

      doc.end();
    }
  );
};
