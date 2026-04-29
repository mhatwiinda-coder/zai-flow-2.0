/**
 * ZRA Smart Invoice Service — Phase 1
 * Integrates with ZRA VSDC API v1.0.7
 * Handles online submission and offline queuing
 */

const db = require('../data/db');

/* =========================
   ZRA CODE MAPPINGS
========================= */
const PAYMENT_CODES = {
  'Cash':              '01',
  'Credit':            '02',
  'Card':              '03',
  'Airtel Money':      '04',
  'MTN Mobile Money':  '04',
  'Zamtel':            '04',
  'Mobile Money':      '04'
};

const TAX_RATES = { 'A': 16, 'B': 0, 'C': 0, 'D': 0, 'E': 1.5 };

/* =========================
   HELPERS
========================= */
function formatDateTime(d) {
  return d.toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
}
function formatDate(d) {
  return d.toISOString().split('T')[0].replace(/-/g, '');
}
function dbGet(sql, params) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  );
}
function dbAll(sql, params) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
  );
}
function dbRun(sql, params) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    })
  );
}

/* =========================
   GET ZRA CONFIG
========================= */
async function getConfig() {
  return dbGet('SELECT * FROM zra_config LIMIT 1', []);
}

/* =========================
   BUILD ZRA INVOICE PAYLOAD
========================= */
async function buildSalePayload(saleId, userId) {
  const config = await getConfig();
  if (!config) throw new Error('ZRA not configured. Go to ZRA Setup to configure Smart Invoice.');

  const sale = await dbGet('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) throw new Error(`Sale ${saleId} not found`);

  const items = await dbAll(`
    SELECT si.product_id, si.quantity, si.price,
           p.name, p.barcode, p.sku,
           COALESCE(p.unspsc_code, '10000000') AS unspsc_code,
           COALESCE(p.tax_category, 'A')        AS tax_category
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
  `, [saleId]);

  const now = new Date();
  const pmtCode = PAYMENT_CODES[sale.payment_method] || '01';

  // Per-category tax accumulators
  const taxbl = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const taxAmt = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  const itemList = items.map((item, idx) => {
    const cat = (item.tax_category || 'A').toUpperCase();
    const rate = TAX_RATES[cat] ?? 16;
    const lineTotal = Number((item.quantity * item.price).toFixed(2));
    // Price is VAT-inclusive; extract base
    const base = rate > 0 ? lineTotal / (1 + rate / 100) : lineTotal;
    const tax  = lineTotal - base;

    if (taxbl[cat] !== undefined) {
      taxbl[cat]  += base;
      taxAmt[cat] += tax;
    }

    return {
      itemSeq:        idx + 1,
      itemCd:         item.sku || `ITEM-${item.product_id}`,
      itemClsCd:      item.unspsc_code || '10000000',
      itemNm:         item.name,
      bcd:            item.barcode || null,
      pkgUnitCd:      'EA',
      pkg:            item.quantity,
      qtyUnitCd:      'U',
      qty:            item.quantity,
      prc:            Number(item.price.toFixed(2)),
      splyAmt:        Number(lineTotal.toFixed(2)),
      dcRt:           0,
      dcAmt:          0,
      vatCatCd:       cat,
      taxblAmt:       Number(base.toFixed(2)),
      taxAmt:         Number(tax.toFixed(2)),
      totAmt:         Number(lineTotal.toFixed(2))
    };
  });

  return {
    tpin:           config.tpin,
    bhfId:          config.bhf_id || '000',
    orgInvcNo:      0,
    cisInvcNo:      `ZAI-${saleId}`,
    custTpin:       null,
    custNm:         'Cash Customer',
    salesTyCd:      'N',
    rcptTyCd:       'S',
    pmtTyCd:        pmtCode,
    salesSttsCd:    '02',
    cfmDt:          formatDateTime(now),
    salesDt:        formatDate(now),
    stockRlsDt:     null,
    totItemCnt:     items.length,
    taxblAmtA:      Number(taxbl.A.toFixed(2)),
    taxblAmtB:      Number(taxbl.B.toFixed(2)),
    taxblAmtC:      Number(taxbl.C.toFixed(2)),
    taxblAmtD:      Number(taxbl.D.toFixed(2)),
    taxblAmtE:      Number(taxbl.E.toFixed(2)),
    taxRtA:         16,
    taxRtB:         0,
    taxRtC:         0,
    taxRtD:         0,
    taxRtE:         1.5,
    taxAmtA:        Number(taxAmt.A.toFixed(2)),
    taxAmtB:        Number(taxAmt.B.toFixed(2)),
    taxAmtC:        Number(taxAmt.C.toFixed(2)),
    taxAmtD:        Number(taxAmt.D.toFixed(2)),
    taxAmtE:        Number(taxAmt.E.toFixed(2)),
    totTaxblAmt:    Number((taxbl.A + taxbl.B + taxbl.C).toFixed(2)),
    totTaxAmt:      Number((taxAmt.A + taxAmt.B + taxAmt.C).toFixed(2)),
    totAmt:         Number(sale.total.toFixed(2)),
    prchrAcptcYn:   'N',
    remark:         null,
    regrId:         `user_${userId}`,
    regrNm:         'ZAI Flow Cashier',
    modrId:         `user_${userId}`,
    modrNm:         'ZAI Flow Cashier',
    receipt: {
      custTpin:     null,
      custMblNo:    null,
      rptNo:        saleId,
      trdeNm:       config.business_name    || 'ZAI Flow',
      adrs:         config.business_address || 'Lusaka, Zambia',
      topMsg:       'Thank you for your purchase',
      btmMsg:       'Powered by ZAI Flow ERP | www.zaiflow.com',
      prchrAcptcYn: 'N'
    },
    itemList
  };
}

/* =========================
   SUBMIT TO ZRA VSDC API
========================= */
async function submitToZRA(payload, config) {
  const baseUrl = config.vsdc_url
    || process.env.ZRA_VSDC_URL
    || 'https://vsdc.zra.org.zm/api/v1';

  const url = `${baseUrl}/trnsSales/saveSales`;

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'bhfId':           config.bhf_id || '000',
      'X-Device-Serial': config.device_serial || ''
    },
    body:   JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)   // 10 second timeout
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ZRA API ${res.status}: ${body}`);
  }

  return res.json();
}

/* =========================
   SAVE FISCAL INVOICE RECORD
========================= */
async function saveFiscalInvoice(saleId, payload, status, response, errorMsg) {
  return dbRun(`
    INSERT INTO fiscal_invoices
      (sale_id, internal_invoice_no, submission_status, payload, response, error_message, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (internal_invoice_no) DO UPDATE SET
      submission_status = EXCLUDED.submission_status,
      response          = EXCLUDED.response,
      error_message     = EXCLUDED.error_message,
      submitted_at      = EXCLUDED.submitted_at
  `, [
    saleId,
    `ZAI-${saleId}`,
    status,
    JSON.stringify(payload),
    response   ? JSON.stringify(response) : null,
    errorMsg   || null,
    status === 'SUBMITTED' ? new Date().toISOString() : null
  ]);
}

/* =========================
   ADD TO OFFLINE QUEUE
========================= */
async function queueInvoice(saleId, payload) {
  return dbRun(
    `INSERT INTO smart_invoice_queue (sale_id, payload, status) VALUES (?, ?, 'PENDING')`,
    [saleId, JSON.stringify(payload)]
  );
}

/* =========================
   MAIN: SUBMIT SALE INVOICE
   (with automatic offline fallback)
========================= */
async function submitSaleInvoice(saleId, userId) {
  let config;
  try {
    config = await getConfig();
  } catch (e) {
    console.warn('Smart Invoice: cannot load config —', e.message);
    return { status: 'SKIPPED', reason: 'DB error loading config' };
  }

  if (!config) {
    return { status: 'SKIPPED', reason: 'ZRA not configured' };
  }

  // Sandbox mode — simulate a successful response without hitting real API
  if (config.environment === 'sandbox') {
    const payload = await buildSalePayload(saleId, userId).catch(e => null);
    if (!payload) return { status: 'ERROR', reason: 'Could not build payload' };

    const mockResponse = {
      resultCd:   '000',
      resultMsg:  'Sandbox: Invoice accepted',
      resultDt:   new Date().toISOString(),
      data: {
        rcptNo:    `SANDBOX-${saleId}-${Date.now()}`,
        intrlData: `MOCK-${Date.now()}`,
        rcptSign:  `SIG-${Math.random().toString(36).substr(2, 12).toUpperCase()}`
      }
    };
    await saveFiscalInvoice(saleId, payload, 'SUBMITTED', mockResponse, null);
    console.log(`✅ [SANDBOX] ZRA fiscal receipt for sale ${saleId}: ${mockResponse.data.rcptNo}`);
    return { status: 'SUBMITTED', response: mockResponse };
  }

  // Production mode
  let payload;
  try {
    payload = await buildSalePayload(saleId, userId);
  } catch (e) {
    console.error('Smart Invoice: payload build failed —', e.message);
    return { status: 'ERROR', reason: e.message };
  }

  try {
    const zraResponse = await submitToZRA(payload, config);
    await saveFiscalInvoice(saleId, payload, 'SUBMITTED', zraResponse, null);
    console.log(`✅ ZRA Smart Invoice submitted for sale ${saleId}`);
    return { status: 'SUBMITTED', response: zraResponse };
  } catch (e) {
    // Offline or API error — queue for later sync
    console.warn(`⚠️  ZRA submission queued for sale ${saleId}: ${e.message}`);
    await saveFiscalInvoice(saleId, payload, 'QUEUED', null, e.message).catch(() => {});
    await queueInvoice(saleId, payload).catch(() => {});
    return { status: 'QUEUED', reason: e.message };
  }
}

/* =========================
   PROCESS OFFLINE QUEUE
   Call this on an interval (every 5 min)
========================= */
async function processQueue() {
  const config = await getConfig().catch(() => null);
  if (!config || config.environment === 'sandbox') return;

  const pending = await dbAll(`
    SELECT * FROM smart_invoice_queue
    WHERE status = 'PENDING' AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 10
  `, []);

  if (pending.length > 0) {
    console.log(`🔄 ZRA queue: processing ${pending.length} pending invoice(s)...`);
  }

  for (const item of pending) {
    await dbRun(
      `UPDATE smart_invoice_queue SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?`,
      [item.id]
    ).catch(() => {});

    try {
      const payload = JSON.parse(item.payload);
      const response = await submitToZRA(payload, config);

      await dbRun(
        `UPDATE smart_invoice_queue SET status = 'DONE' WHERE id = ?`,
        [item.id]
      );
      await saveFiscalInvoice(item.sale_id, payload, 'SUBMITTED', response, null);
      console.log(`✅ ZRA queue item ${item.id} submitted for sale ${item.sale_id}`);
    } catch (e) {
      const exhausted = (item.attempts + 1) >= item.max_attempts;
      if (exhausted) {
        await dbRun(
          `UPDATE smart_invoice_queue SET status = 'FAILED', error_message = ? WHERE id = ?`,
          [e.message, item.id]
        ).catch(() => {});
        await saveFiscalInvoice(item.sale_id, JSON.parse(item.payload), 'FAILED', null, e.message).catch(() => {});
        console.warn(`❌ ZRA queue item ${item.id} permanently failed: ${e.message}`);
      }
    }
  }
}

/* =========================
   GET FISCAL DATA FOR SALE
========================= */
async function getFiscalInvoice(saleId) {
  return dbGet('SELECT * FROM fiscal_invoices WHERE sale_id = ?', [saleId]);
}

module.exports = { submitSaleInvoice, processQueue, getConfig, buildSalePayload, getFiscalInvoice };
