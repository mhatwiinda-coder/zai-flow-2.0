const db = require('../data/db');
const si = require('../services/smartinvoice.service');

/* ============================================
   GET ZRA STATUS
============================================ */
exports.getStatus = async (req, res) => {
  try {
    const config = await si.getConfig();

    // Queue counts
    const queueRow = await new Promise(resolve =>
      db.get(`
        SELECT
          COUNT(*)::int                                              AS total,
          SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END)::int   AS pending,
          SUM(CASE WHEN status='DONE'    THEN 1 ELSE 0 END)::int   AS done,
          SUM(CASE WHEN status='FAILED'  THEN 1 ELSE 0 END)::int   AS failed
        FROM smart_invoice_queue
      `, [], (err, row) => resolve(row || {}))
    );

    // Recent fiscal invoices
    const recent = await new Promise(resolve =>
      db.all(`
        SELECT fi.*, s.total, s.payment_method
        FROM fiscal_invoices fi
        JOIN sales s ON s.id = fi.sale_id
        ORDER BY fi.created_at DESC
        LIMIT 10
      `, [], (err, rows) => resolve(rows || []))
    );

    res.json({
      configured: !!config,
      config: config ? {
        tpin:          config.tpin,
        bhf_id:        config.bhf_id,
        business_name: config.business_name,
        tax_type:      config.tax_type,
        environment:   config.environment,
        last_initialized: config.last_initialized
      } : null,
      queue:  queueRow,
      recent
    });
  } catch (err) {
    console.error('ZRA status error:', err);
    res.status(500).json({ message: 'Failed to load ZRA status' });
  }
};

/* ============================================
   SAVE / UPDATE ZRA CONFIG
============================================ */
exports.configure = async (req, res) => {
  const { tpin, bhf_id, business_name, business_address, tax_type, environment, vsdc_url, device_serial } = req.body;

  if (!tpin) return res.status(400).json({ message: 'TPIN is required' });

  try {
    const existing = await si.getConfig();

    if (existing) {
      db.run(`
        UPDATE zra_config SET
          tpin             = ?,
          bhf_id           = ?,
          business_name    = ?,
          business_address = ?,
          tax_type         = ?,
          environment      = ?,
          vsdc_url         = ?,
          device_serial    = ?
        WHERE id = ?
      `, [
        tpin,
        bhf_id        || '000',
        business_name || '',
        business_address || '',
        tax_type      || 'VAT',
        environment   || 'sandbox',
        vsdc_url      || null,
        device_serial || null,
        existing.id
      ], err => {
        if (err) return res.status(500).json({ message: 'Update failed' });
        res.json({ message: 'ZRA configuration updated successfully' });
      });
    } else {
      db.run(`
        INSERT INTO zra_config
          (tpin, bhf_id, business_name, business_address, tax_type, environment, vsdc_url, device_serial)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tpin,
        bhf_id        || '000',
        business_name || '',
        business_address || '',
        tax_type      || 'VAT',
        environment   || 'sandbox',
        vsdc_url      || null,
        device_serial || null
      ], err => {
        if (err) return res.status(500).json({ message: 'Insert failed' });
        res.json({ message: 'ZRA configuration saved successfully' });
      });
    }
  } catch (err) {
    console.error('ZRA configure error:', err);
    res.status(500).json({ message: 'Configuration error' });
  }
};

/* ============================================
   GET FISCAL INVOICE FOR A SALE
============================================ */
exports.getFiscalBySale = (req, res) => {
  const saleId = req.params.saleId;
  db.get(
    'SELECT * FROM fiscal_invoices WHERE sale_id = ?',
    [saleId],
    (err, row) => {
      if (err)  return res.status(500).json({ message: 'DB error' });
      if (!row) return res.status(404).json({ message: 'No fiscal invoice found for this sale' });
      res.json(row);
    }
  );
};

/* ============================================
   GET QUEUE STATUS
============================================ */
exports.getQueue = (req, res) => {
  db.all(`
    SELECT q.*, s.total, s.payment_method
    FROM smart_invoice_queue q
    JOIN sales s ON s.id = q.sale_id
    ORDER BY q.created_at DESC
    LIMIT 50
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows);
  });
};

/* ============================================
   MANUAL QUEUE SYNC
============================================ */
exports.syncQueue = async (req, res) => {
  try {
    await si.processQueue();
    res.json({ message: 'Queue sync completed' });
  } catch (err) {
    res.status(500).json({ message: 'Sync failed: ' + err.message });
  }
};

/* ============================================
   MANUALLY RESUBMIT A FAILED SALE
============================================ */
exports.resubmit = async (req, res) => {
  const saleId = req.params.saleId;
  const userId = req.user.id;

  try {
    const result = await si.submitSaleInvoice(Number(saleId), userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Resubmit failed: ' + err.message });
  }
};
