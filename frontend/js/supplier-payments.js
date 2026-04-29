// Supplier Payments & Invoice Management Module
// Depends on: supabase-init.js, purchasing.js

let currentInvoicePoId = null;
let currentPaymentInvoiceId = null;
let currentPaymentPoId = null;

/* =====================================================
   PURCHASE INVOICES
===================================================== */
function loadPurchaseInvoices() {
  (async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('id, po_id, supplier_invoice_no, invoice_date, amount, status, purchase_orders(po_number, total_amount, suppliers(name))')
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const tbody = document.getElementById('invoicesTableBody');
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No invoices found</td></tr>';
        return;
      }

      let html = '';
      data.forEach(invoice => {
        const po = invoice.purchase_orders;
        const variance = Math.abs(invoice.amount - po.total_amount);
        const variancePct = (variance / po.total_amount * 100).toFixed(2);
        const poNumber = po?.po_number || 'N/A';
        const supplierName = po?.suppliers?.name || 'N/A';

        html += `
          <tr>
            <td>${poNumber}</td>
            <td>${supplierName}</td>
            <td>${invoice.supplier_invoice_no}</td>
            <td>K ${formatMoney(invoice.amount)}</td>
            <td>
              <span class="badge badge-${invoice.status === 'MATCHED' ? 'success' : (invoice.status === 'PENDING' ? 'warning' : 'secondary')}">
                ${invoice.status}
                ${invoice.status === 'PENDING' ? ` (${variancePct}% variance)` : ''}
              </span>
            </td>
            <td>
              ${invoice.status === 'PENDING' ? `<button class="btn-secondary" onclick="openRecordInvoiceModal(${po.id})">Approve</button>` : ''}
              ${invoice.status === 'MATCHED' ? `<button class="btn-primary" onclick="openPaymentModal(${po.id}, ${invoice.id})">Pay</button>` : ''}
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Load invoices error:', err);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading invoices</td></tr>';
    }
  })();
}

/* =====================================================
   RECORD INVOICE MODAL
===================================================== */
function openRecordInvoiceModal(poId) {
  (async () => {
    try {
      currentInvoicePoId = poId;

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, suppliers(name)')
        .eq('id', poId)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('PO not found');
        return;
      }

      const po = data[0];
      document.getElementById('invoiceForm').reset();
      document.getElementById('recordInvoiceModal').style.display = 'block';

      // Listen for amount changes to show variance
      const amountInput = document.getElementById('invoiceAmount');
      amountInput.addEventListener('input', () => {
        const amount = parseFloat(amountInput.value) || 0;
        const variance = Math.abs(amount - po.total_amount);
        const variancePct = (variance / po.total_amount * 100).toFixed(2);
        const varianceElem = document.getElementById('invoiceVariance');
        varianceElem.textContent = `PO Total: K ${formatMoney(po.total_amount)} | Variance: ${variancePct}% ${variance > 0 ? '⚠️' : ''}`;
      });
    } catch (err) {
      console.error('Open record invoice error:', err);
      alert('Failed to open invoice form: ' + err.message);
    }
  })();
}

function closeRecordInvoiceModal() {
  const modal = document.getElementById('recordInvoiceModal');
  if (modal) modal.style.display = 'none';
  currentInvoicePoId = null;
}

function recordInvoice(event) {
  event.preventDefault();
  (async () => {
    try {
      const invoiceNumber = document.getElementById('invoiceNumber').value;
      const invoiceDate = document.getElementById('invoiceDate').value;
      const amount = parseFloat(document.getElementById('invoiceAmount').value);

      if (!invoiceNumber || !invoiceDate || !amount) {
        alert('Please fill all required fields');
        return;
      }

      const { data, error } = await supabase.rpc('record_purchase_invoice', {
        p_po_id: currentInvoicePoId,
        p_supplier_invoice_no: invoiceNumber,
        p_invoice_date: invoiceDate,
        p_amount: amount
      });

      if (error) throw error;

      alert('✅ ' + data[0].message);
      closeRecordInvoiceModal();
      loadPurchaseInvoices();
      loadPurchaseOrders();
    } catch (err) {
      console.error('Record invoice error:', err);
      alert('Failed to record invoice: ' + err.message);
    }
  })();
}

/* =====================================================
   SUPPLIER PAYMENTS
===================================================== */
function loadSupplierPayments() {
  (async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('purchase_invoices')
        .select('id, po_id, supplier_invoice_no, amount, invoice_date, status, purchase_orders(po_number, suppliers(name))')
        .eq('status', 'MATCHED')
        .order('invoice_date', { ascending: true });

      if (error) throw error;

      const tbody = document.getElementById('paymentsTableBody');
      if (!Array.isArray(invoices) || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending payments</td></tr>';
        return;
      }

      let html = '';
      invoices.forEach(invoice => {
        const po = invoice.purchase_orders;
        const invoiceDate = new Date(invoice.invoice_date);
        const daysOutstanding = Math.floor((new Date() - invoiceDate) / (1000 * 60 * 60 * 24));
        const agingStatus = daysOutstanding > 90 ? 'danger' : (daysOutstanding > 60 ? 'warning' : (daysOutstanding > 30 ? 'info' : 'secondary'));

        html += `
          <tr>
            <td>${po?.suppliers?.name || 'N/A'}</td>
            <td>${invoice.supplier_invoice_no}</td>
            <td>K ${formatMoney(invoice.amount)}</td>
            <td><span class="badge badge-${agingStatus}">${daysOutstanding} days</span></td>
            <td><span class="badge badge-warning">${invoice.status}</span></td>
            <td>
              <button class="btn-primary" onclick="openPaymentModal(${po.id}, ${invoice.id})">Pay Now</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Load payments error:', err);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading payments</td></tr>';
    }
  })();
}

/* =====================================================
   PAYMENT MODAL
===================================================== */
function openPaymentModal(poId, invoiceId) {
  (async () => {
    try {
      currentPaymentPoId = poId;
      currentPaymentInvoiceId = invoiceId;

      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('id, amount, purchase_orders(po_number, suppliers(name))')
        .eq('id', invoiceId)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Invoice not found');
        return;
      }

      const invoice = data[0];
      document.getElementById('paymentForm').reset();
      document.getElementById('paymentAmount').value = invoice.amount;
      document.getElementById('paymentDate').valueAsDate = new Date();
      document.getElementById('paymentModal').style.display = 'block';
    } catch (err) {
      console.error('Open payment modal error:', err);
      alert('Failed to open payment form: ' + err.message);
    }
  })();
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.style.display = 'none';
  currentPaymentInvoiceId = null;
  currentPaymentPoId = null;
}

function processPayment(event) {
  event.preventDefault();
  (async () => {
    try {
      const amount = parseFloat(document.getElementById('paymentAmount').value.replace(/K\s?/, '')) || 0;
      const paymentDate = document.getElementById('paymentDate').value;
      const method = document.getElementById('paymentMethod').value;
      const reference = document.getElementById('paymentReference').value;

      if (!amount || !paymentDate || !method) {
        alert('Please fill all required fields');
        return;
      }

      const { data, error } = await supabase.rpc('process_purchase_payment', {
        p_invoice_id: currentPaymentInvoiceId,
        p_amount: amount,
        p_payment_date: paymentDate,
        p_method: method,
        p_reference: reference || null
      });

      if (error) throw error;

      alert('✅ ' + data[0].message + '\n\nGL entries posted automatically');
      closePaymentModal();
      loadSupplierPayments();
      loadPurchaseInvoices();
      loadPurchaseOrders();
    } catch (err) {
      console.error('Process payment error:', err);
      alert('Failed to process payment: ' + err.message);
    }
  })();
}

/* =====================================================
   PURCHASING ANALYTICS
===================================================== */
function loadPurchasingAnalytics() {
  (async () => {
    try {
      // Load all PO data
      const { data: allPOs, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, status, total_amount, suppliers(name)');

      if (poError) throw poError;

      // Calculate KPIs
      const totalPOs = allPOs?.length || 0;
      const pendingReceipt = allPOs?.filter(p => p.status === 'CONFIRMED').length || 0;
      const pendingPayment = allPOs?.filter(p => p.status === 'INVOICED').length || 0;
      const totalSpent = allPOs?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;

      document.getElementById('totalPOs').textContent = totalPOs;
      document.getElementById('pendingReceipt').textContent = pendingReceipt;
      document.getElementById('pendingPayment').textContent = pendingPayment;
      document.getElementById('totalSpent').textContent = 'K ' + formatMoney(totalSpent);

      // Top suppliers chart
      const supplierSpend = {};
      allPOs?.forEach(po => {
        const name = po.suppliers?.name || 'Unknown';
        supplierSpend[name] = (supplierSpend[name] || 0) + (po.total_amount || 0);
      });

      const topSuppliers = Object.entries(supplierSpend)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      const topSupplierCtx = document.getElementById('topSuppliersChart');
      if (topSupplierCtx && topSuppliers.length > 0) {
        new Chart(topSupplierCtx, {
          type: 'pie',
          data: {
            labels: topSuppliers.map(([name]) => name),
            datasets: [{
              data: topSuppliers.map(([, amount]) => amount),
              backgroundColor: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Top 5 Suppliers by Spend' } }
          }
        });
      }

      // Spend by status chart
      const statusSpend = {
        DRAFT: 0,
        SUBMITTED: 0,
        CONFIRMED: 0,
        RECEIVED: 0,
        INVOICED: 0,
        PAID: 0
      };

      allPOs?.forEach(po => {
        statusSpend[po.status] = (statusSpend[po.status] || 0) + (po.total_amount || 0);
      });

      const statusCtx = document.getElementById('spendByStatusChart');
      if (statusCtx) {
        new Chart(statusCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(statusSpend),
            datasets: [{
              label: 'Spend by Status',
              data: Object.values(statusSpend),
              backgroundColor: '#36A2EB'
            }]
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Spend by PO Status' } }
          }
        });
      }

      // Payment aging chart
      const { data: invoices, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .select('invoice_date, amount, status')
        .eq('status', 'MATCHED');

      if (invoiceError) throw invoiceError;

      const agingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      invoices?.forEach(inv => {
        const days = Math.floor((new Date() - new Date(inv.invoice_date)) / (1000 * 60 * 60 * 24));
        if (days <= 30) agingBuckets['0-30'] += inv.amount;
        else if (days <= 60) agingBuckets['31-60'] += inv.amount;
        else if (days <= 90) agingBuckets['61-90'] += inv.amount;
        else agingBuckets['90+'] += inv.amount;
      });

      const agingCtx = document.getElementById('paymentAgingChart');
      if (agingCtx) {
        new Chart(agingCtx, {
          type: 'line',
          data: {
            labels: Object.keys(agingBuckets),
            datasets: [{
              label: 'Payables by Age',
              data: Object.values(agingBuckets),
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Supplier Payables Aging' } }
          }
        });
      }
    } catch (err) {
      console.error('Load analytics error:', err);
      alert('Error loading analytics: ' + err.message);
    }
  })();
}

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
