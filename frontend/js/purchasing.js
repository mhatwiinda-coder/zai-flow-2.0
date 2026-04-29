// Purchasing Module - Supplier & PO Management
// Depends on: supabase-init.js

let currentPOStep = 1;
let currentPOData = {};
let poLineItems = [];
let currentSupplierFilter = 'all';

/* =====================================================
   TAB SWITCHING & INITIALIZATION
===================================================== */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');

  // Load data for specific tab
  if (tabName === 'suppliers') {
    loadSupplierList();
  } else if (tabName === 'purchase-orders') {
    loadPurchaseOrders();
  } else if (tabName === 'goods-receipt') {
    loadGoodsReceiptList();
  } else if (tabName === 'purchase-invoices') {
    loadPurchaseInvoices();
  } else if (tabName === 'supplier-payments') {
    loadSupplierPayments();
  } else if (tabName === 'purchasing-analytics') {
    loadPurchasingAnalytics();
  }
}

function refreshAllData() {
  loadSupplierList();
  loadPurchaseOrders();
  loadGoodsReceiptList();
  loadPurchaseInvoices();
  loadSupplierPayments();
  loadPurchasingAnalytics();
  alert('✅ All data refreshed');
}

document.addEventListener('DOMContentLoaded', () => {
  // Verify user authentication and branch context
  const context = getBranchContext();
  if (!context) {
    console.error('❌ No branch context - user not authenticated');
    window.location.href = 'login.html';
    return;
  }

  // Load all data filtered to current branch
  console.log(`✅ Loading purchasing data for: ${context.branch_name} (Branch ${context.branch_id})`);

  loadSupplierList();
  loadPurchaseOrders();
  loadGoodsReceiptList();
  loadPurchaseInvoices();
  loadSupplierPayments();
  loadPurchasingAnalytics();

  // Auto-refresh data every 60 seconds to keep isolation fresh
  let purchasingRefreshInterval = setInterval(() => {
    const currentContext = getBranchContext();
    if (currentContext) {
      loadPurchaseOrders();
      loadGoodsReceiptList();
      loadPurchaseInvoices();
      loadSupplierPayments();
    }
  }, 60000);

  // Clear interval on page unload
  window.addEventListener('beforeunload', () => {
    if (purchasingRefreshInterval) {
      clearInterval(purchasingRefreshInterval);
    }
  });
});

/* =====================================================
   SUPPLIERS MANAGEMENT
===================================================== */
function loadSupplierList() {
  (async () => {
    try {
      const { data, error } = await withBranchFilter(
        supabase.from('suppliers').select('*')
      )
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const tbody = document.getElementById('suppliersTableBody');
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No suppliers found</td></tr>';
        return;
      }

      let html = '';
      data.forEach(supplier => {
        html += `
          <tr>
            <td><strong>${supplier.name || 'N/A'}</strong></td>
            <td>${supplier.contact_person || 'N/A'}</td>
            <td>${supplier.city || 'N/A'}</td>
            <td>${supplier.payment_terms || 'N/A'}</td>
            <td><span class="badge badge-success">${supplier.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <button class="btn-view" onclick="editSupplier(${supplier.id})">Edit</button>
              <button class="btn-danger" onclick="deactivateSupplier(${supplier.id})">Deactivate</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Load suppliers error:', err);
      document.getElementById('suppliersTableBody').innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">Error loading suppliers</td></tr>';
    }
  })();
}

function filterSuppliers() {
  const searchText = document.getElementById('supplierSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#suppliersTableBody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchText) ? '' : 'none';
  });
}

function openSupplierModal() {
  const form = document.getElementById('supplierForm');
  if (form) form.reset();
  const modal = document.getElementById('supplierModal');
  if (modal) modal.style.display = 'block';
  delete document.getElementById('supplierForm')?.dataset.supplierId;
}

function closeSupplierModal() {
  const modal = document.getElementById('supplierModal');
  if (modal) modal.style.display = 'none';
}

function saveSupplier(event) {
  event.preventDefault();
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        alert('❌ No branch context - please login again');
        return;
      }

      const supplierId = document.getElementById('supplierForm').dataset.supplierId;
      const supplierData = {
        name: document.getElementById('supplierName').value,
        contact_person: document.getElementById('supplierContact').value,
        email: document.getElementById('supplierEmail').value,
        phone: document.getElementById('supplierPhone').value,
        tax_id: document.getElementById('supplierTaxID').value,
        address: document.getElementById('supplierAddress').value,
        city: document.getElementById('supplierCity').value,
        postal_code: document.getElementById('supplierPostalCode').value,
        payment_terms: document.getElementById('supplierPaymentTerms').value,
        is_active: document.getElementById('supplierIsActive').checked,
        branch_id: context.branch_id  // CRITICAL: Set branch_id for multi-tenancy
      };

      let result;
      if (supplierId) {
        // UPDATE: Only update suppliers from current branch
        result = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', supplierId)
          .eq('branch_id', context.branch_id);
      } else {
        // INSERT: New suppliers are auto-scoped to current branch
        result = await supabase
          .from('suppliers')
          .insert([supplierData]);
      }

      if (result.error) throw result.error;

      alert('✅ Supplier saved successfully');
      closeSupplierModal();
      loadSupplierList();
      loadPOSupplierDropdown();
    } catch (err) {
      console.error('Save supplier error:', err);
      alert('Failed to save supplier: ' + err.message);
    }
  })();
}

function editSupplier(supplierId) {
  (async () => {
    try {
      // SECURITY: Use branch filter to ensure supplier belongs to current branch
      const { data, error } = await withBranchFilter(
        supabase.from('suppliers').select('*')
      ).eq('id', supplierId).limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('❌ Supplier not found or does not belong to your branch');
        return;
      }

      const supplier = data[0];
      document.getElementById('supplierName').value = supplier.name || '';
      document.getElementById('supplierContact').value = supplier.contact_person || '';
      document.getElementById('supplierEmail').value = supplier.email || '';
      document.getElementById('supplierPhone').value = supplier.phone || '';
      document.getElementById('supplierTaxID').value = supplier.tax_id || '';
      document.getElementById('supplierAddress').value = supplier.address || '';
      document.getElementById('supplierCity').value = supplier.city || '';
      document.getElementById('supplierPostalCode').value = supplier.postal_code || '';
      document.getElementById('supplierPaymentTerms').value = supplier.payment_terms || 'Net 30';
      document.getElementById('supplierIsActive').checked = supplier.is_active;
      document.getElementById('supplierForm').dataset.supplierId = supplierId;
      document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
      document.getElementById('supplierModal').style.display = 'block';
    } catch (err) {
      console.error('Edit supplier error:', err);
      alert('Failed to load supplier: ' + err.message);
    }
  })();
}

function deactivateSupplier(supplierId) {
  if (!confirm('Are you sure you want to deactivate this supplier?')) return;

  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        alert('❌ No branch context - please login again');
        return;
      }

      // SECURITY: Verify supplier belongs to current branch before deactivating
      const { data: supplierCheck, error: checkError } = await withBranchFilter(
        supabase.from('suppliers').select('id, branch_id')
      ).eq('id', supplierId).limit(1);

      if (checkError || !supplierCheck || supplierCheck.length === 0) {
        alert('❌ Supplier not found or does not belong to your branch - access denied');
        return;
      }

      // Proceed with deactivation only for verified branch
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', supplierId)
        .eq('branch_id', context.branch_id);

      if (error) throw error;

      alert('✅ Supplier deactivated');
      loadSupplierList();
    } catch (err) {
      console.error('Deactivate supplier error:', err);
      alert('Failed to deactivate supplier: ' + err.message);
    }
  })();
}

/* =====================================================
   PURCHASE ORDERS - LOAD & FILTER
===================================================== */
function loadPurchaseOrders() {
  (async () => {
    try {
      let query = withBranchFilter(
        supabase.from('purchase_orders').select('*, suppliers(name)')
      );

      if (currentSupplierFilter !== 'all') {
        query = query.eq('status', currentSupplierFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const tbody = document.getElementById('poTableBody');

      // UPDATE KPI METRICS WITH FILTERED DATA (ALWAYS UPDATE, EVEN IF EMPTY)
      if (!Array.isArray(data)) {
        data = [];
      }

      if (data.length > 0) {
        const totalSpent = data.reduce((sum, po) => sum + Number(po.total_amount || 0), 0);
        const pendingRcpt = data.filter(po => po.status === 'CONFIRMED').length;
        const pendingPay = data.filter(po => po.status === 'INVOICED').length;

        document.getElementById('totalPOs').innerText = data.length;
        document.getElementById('pendingReceipt').innerText = pendingRcpt;
        document.getElementById('pendingPayment').innerText = pendingPay;
        document.getElementById('totalSpent').innerText = 'K ' + formatMoney(totalSpent);

        console.log(`✅ KPI metrics updated: ${data.length} POs, K ${formatMoney(totalSpent)}`);

        // Render table with data
        let html = '';
        data.forEach(po => {
          const supplierName = po.suppliers ? po.suppliers.name : 'N/A';
          html += `
            <tr>
              <td><strong>${po.po_number}</strong></td>
              <td>${supplierName}</td>
              <td><span class="badge badge-${getStatusBadgeColor(po.status)}">${po.status}</span></td>
              <td>K ${formatMoney(po.total_amount)}</td>
              <td>${po.expected_delivery_date || 'N/A'}</td>
              <td>
                <button class="btn-view" onclick="viewPODetails(${po.id})">View</button>
                ${po.status === 'DRAFT' ? `<button class="btn-primary" onclick="confirmPO(${po.id})">Confirm</button>` : ''}
                ${po.status === 'DRAFT' ? `<button class="btn-secondary" onclick="editPO(${po.id})">Edit</button>` : ''}
                ${po.status === 'DRAFT' ? `<button class="btn-danger" onclick="deletePO(${po.id})">Delete</button>` : ''}
                ${po.status === 'CONFIRMED' ? `<button class="btn-primary" onclick="openGoodsReceiptModal(${po.id})">Receive</button>` : ''}
                ${po.status === 'RECEIVED' ? `<button class="btn-primary" onclick="openRecordInvoiceModal(${po.id})">Invoice</button>` : ''}
                ${po.status === 'INVOICED' ? `<button class="btn-primary" onclick="openPaymentModal(${po.id})">Pay</button>` : ''}
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      } else {
        // No POs for this branch - clear metrics and show empty message
        document.getElementById('totalPOs').innerText = '0';
        document.getElementById('pendingReceipt').innerText = '0';
        document.getElementById('pendingPayment').innerText = '0';
        document.getElementById('totalSpent').innerText = 'K 0.00';

        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No purchase orders found</td></tr>';

        console.log('✅ No POs for this branch - metrics cleared to 0');
      }
    } catch (err) {
      console.error('Load POs error:', err);
      document.getElementById('poTableBody').innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">Error loading POs</td></tr>';
    }
  })();
}

function filterPOByStatus(status) {
  currentSupplierFilter = status;
  loadPurchaseOrders();

  // Update filter button active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

function getStatusBadgeColor(status) {
  const colors = {
    'DRAFT': 'secondary',
    'SUBMITTED': 'warning',
    'CONFIRMED': 'info',
    'RECEIVED': 'info',
    'INVOICED': 'warning',
    'PAID': 'success'
  };
  return colors[status] || 'secondary';
}

/* =====================================================
   PURCHASE ORDER - CREATE/EDIT
===================================================== */
function loadPOSupplierDropdown() {
  (async () => {
    try {
      // SECURITY: Only load suppliers for current branch
      const { data, error } = await withBranchFilter(
        supabase.from('suppliers').select('id, name')
      )
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const select = document.getElementById('poSupplier');
      select.innerHTML = '<option value="">-- Select Supplier --</option>';
      data.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        select.appendChild(option);
      });
    } catch (err) {
      console.error('Load supplier dropdown error:', err);
    }
  })();
}

function openNewPOModal() {
  currentPOStep = 1;
  currentPOData = {};
  poLineItems = [];
  loadPOSupplierDropdown();
  showPOStep(1);
  document.getElementById('poModal').style.display = 'block';
}

function closePOModal() {
  const modal = document.getElementById('poModal');
  if (modal) modal.style.display = 'none';
}

function showPOStep(step) {
  for (let i = 1; i <= 3; i++) {
    const elem = document.getElementById(`step${i}`);
    if (elem) {
      elem.classList.toggle('active', i === step);
      elem.style.display = i === step ? 'block' : 'none';
    }
  }
  currentPOStep = step;
}

function nextPOStep() {
  if (currentPOStep === 1) {
    const supplier = document.getElementById('poSupplier').value;
    if (!supplier) {
      alert('Please select a supplier');
      return;
    }
    currentPOData.supplier_id = supplier;
    currentPOData.expected_delivery_date = document.getElementById('poDeliveryDate').value;
    currentPOData.notes = document.getElementById('poNotes').value;
    loadPoLineItemsUI();
    showPOStep(2);
  } else if (currentPOStep === 2) {
    buildPOReview();
    showPOStep(3);
  }
}

function prevPOStep() {
  if (currentPOStep > 1) {
    showPOStep(currentPOStep - 1);
  }
}

function addPOLineItem() {
  (async () => {
    try {
      // SECURITY: Only load products for current branch
      const { data, error } = await withBranchFilter(
        supabase.from('products').select('id, name, cost_price')
      )
        .order('name', { ascending: true });

      if (error) throw error;

      let productOptions = '<option value="">-- Select Product --</option>';
      data.forEach(product => {
        productOptions += `<option value="${product.id}" data-price="${product.cost_price}">${product.name}</option>`;
      });

      const tbody = document.getElementById('poItemsBody');
      const itemId = 'item_' + Date.now();
      const row = document.createElement('tr');
      row.id = itemId;
      row.innerHTML = `
        <td>
          <select onchange="updateLineTotal('${itemId}')" data-item-select>
            ${productOptions}
          </select>
        </td>
        <td><input type="number" min="1" value="1" onchange="updateLineTotal('${itemId}')" data-item-qty></td>
        <td><input type="number" min="0" step="0.01" value="0" onchange="updateLineTotal('${itemId}')" data-item-price></td>
        <td><span data-item-total>0.00</span></td>
        <td><button type="button" class="btn-danger" onclick="removePOLineItem('${itemId}')">Remove</button></td>
      `;
      tbody.appendChild(row);
    } catch (err) {
      console.error('Add line item error:', err);
      alert('Failed to add line item: ' + err.message);
    }
  })();
}

function updateLineTotal(itemId) {
  const row = document.getElementById(itemId);
  const qty = parseFloat(row.querySelector('[data-item-qty]').value) || 0;
  const price = parseFloat(row.querySelector('[data-item-price]').value) || 0;
  const total = qty * price;
  row.querySelector('[data-item-total]').textContent = total.toFixed(2);
}

function loadPoLineItemsUI() {
  const tbody = document.getElementById('poItemsBody');
  tbody.innerHTML = '';
}

function removePOLineItem(itemId) {
  document.getElementById(itemId).remove();
}

function buildPOReview() {
  const supplierSelect = document.getElementById('poSupplier');
  const supplierName = supplierSelect.options[supplierSelect.selectedIndex].text;

  const rows = document.querySelectorAll('#poItemsBody tr');
  let itemCount = rows.length;
  let totalAmount = 0;

  rows.forEach(row => {
    const price = parseFloat(row.querySelector('[data-item-price]').value) || 0;
    const qty = parseFloat(row.querySelector('[data-item-qty]').value) || 0;
    totalAmount += price * qty;
  });

  document.getElementById('reviewSupplier').textContent = supplierName;
  document.getElementById('reviewItems').textContent = itemCount + ' items';
  document.getElementById('reviewTotal').textContent = 'K ' + formatMoney(totalAmount);
}

function submitPO() {
  (async () => {
    try {
      const rows = document.querySelectorAll('#poItemsBody tr');
      if (rows.length === 0) {
        alert('Please add at least one line item');
        return;
      }

      const poItems = [];
      let totalAmount = 0;

      rows.forEach(row => {
        const productId = row.querySelector('[data-item-select]').value;
        if (!productId) {
          throw new Error('Please select a product for all line items');
        }

        const qty = parseFloat(row.querySelector('[data-item-qty]').value) || 0;
        const price = parseFloat(row.querySelector('[data-item-price]').value) || 0;

        if (qty <= 0 || price < 0) {
          throw new Error('Invalid quantity or price');
        }

        poItems.push({
          product_id: productId,
          quantity: qty,
          unit_price: price
        });

        totalAmount += qty * price;
      });

      const context = getBranchContext();

      const { data, error } = await supabase.rpc('create_purchase_order', {
        p_branch_id: context.branch_id,
        p_supplier_id: currentPOData.supplier_id,
        p_items: poItems,
        p_expected_delivery_date: currentPOData.expected_delivery_date || null,
        p_notes: currentPOData.notes || null
      });

      if (error) throw error;

      alert(`✅ PO created successfully!\n\nPO Number: ${data[0].po_number}\nTotal: K ${formatMoney(data[0].total_amount)}`);
      closePOModal();
      loadPurchaseOrders();
    } catch (err) {
      console.error('Submit PO error:', err);
      alert('Failed to create PO: ' + err.message);
    }
  })();
}

function viewPODetails(poId) {
  (async () => {
    try {
      const { data, error } = await withBranchFilter(
        supabase.from('purchase_orders').select('*, purchase_order_items(*, products(name)), suppliers(name)')
      )
        .eq('id', poId)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('PO not found');
        return;
      }

      const po = data[0];
      let details = `PO Number: ${po.po_number}\n`;
      details += `Supplier: ${po.suppliers?.name}\n`;
      details += `Status: ${po.status}\n`;
      details += `Total: K ${formatMoney(po.total_amount)}\n\n`;
      details += `Items:\n`;

      po.purchase_order_items?.forEach(item => {
        details += `- ${item.products?.name}: ${item.quantity_ordered} x K ${formatMoney(item.unit_price)}\n`;
      });

      alert(details);
    } catch (err) {
      console.error('View PO error:', err);
      alert('Failed to load PO details: ' + err.message);
    }
  })();
}

function confirmPO(poId) {
  if (!confirm('Confirm this PO? It will be sent to the supplier.')) return;

  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        alert('❌ No branch context - please login again');
        return;
      }

      // SECURITY: Verify PO belongs to current branch before updating
      const { data: poCheck, error: checkError } = await withBranchFilter(
        supabase.from('purchase_orders').select('id, branch_id')
      ).eq('id', poId).limit(1);

      if (checkError || !poCheck || poCheck.length === 0) {
        alert('❌ PO not found or does not belong to your branch - access denied');
        return;
      }

      // Proceed with update only for verified branch
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'CONFIRMED' })
        .eq('id', poId)
        .eq('branch_id', context.branch_id);

      if (error) throw error;

      alert('✅ PO confirmed successfully!');
      loadPurchaseOrders();
    } catch (err) {
      console.error('Confirm PO error:', err);
      alert('Failed to confirm PO: ' + err.message);
    }
  })();
}

function editPO(poId) {
  alert('Edit functionality coming soon');
}

function deletePO(poId) {
  if (!confirm('Are you sure you want to delete this draft PO?')) return;

  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        alert('❌ No branch context - please login again');
        return;
      }

      // SECURITY: Verify PO belongs to current branch before deleting
      const { data: poCheck, error: checkError } = await withBranchFilter(
        supabase.from('purchase_orders').select('id, branch_id, status')
      ).eq('id', poId).limit(1);

      if (checkError || !poCheck || poCheck.length === 0) {
        alert('❌ PO not found or does not belong to your branch - access denied');
        return;
      }

      if (poCheck[0].status !== 'DRAFT') {
        alert('❌ Only DRAFT POs can be deleted');
        return;
      }

      // Proceed with deletion only for verified branch
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId)
        .eq('branch_id', context.branch_id);

      if (error) throw error;

      alert('✅ PO deleted');
      loadPurchaseOrders();
    } catch (err) {
      console.error('Delete PO error:', err);
      alert('Failed to delete PO: ' + err.message);
    }
  })();
}

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =====================================================
   GOODS RECEIPT (WITH BRANCH FILTER VIA PO)
===================================================== */
function loadGoodsReceiptList() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        console.error('No branch context');
        return;
      }

      const tbody = document.getElementById('goodsReceiptTableBody');
      if (!tbody) return;

      // Get all POs for current branch
      const { data: poData, error: poError } = await withBranchFilter(
        supabase.from('purchase_orders').select('id')
      );

      if (poError || !poData || poData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No goods receipts found</td></tr>';
        return;
      }

      const poIds = poData.map(po => po.id);

      // Get goods receipts only for these POs
      const { data: receipts, error: grError } = await supabase
        .from('goods_receipt')
        .select('*, purchase_orders(po_number), suppliers(name)')
        .in('purchase_order_id', poIds)
        .order('created_at', { ascending: false });

      if (grError) throw grError;

      if (!Array.isArray(receipts) || receipts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No goods receipts found</td></tr>';
        console.log('✅ No goods receipts for this branch');
        return;
      }

      let html = '';
      receipts.forEach(gr => {
        html += `<tr><td>${gr.purchase_orders?.po_number || 'N/A'}</td><td>${gr.suppliers?.name || 'N/A'}</td><td>${gr.receipt_number || 'N/A'}</td><td>${gr.quantity_received || 0}</td><td>${gr.status || 'PENDING'}</td><td>View</td></tr>`;
      });
      tbody.innerHTML = html;
      console.log(`✅ Loaded ${receipts.length} goods receipts for branch ${context.branch_id}`);
    } catch (err) {
      console.error('Goods receipt error:', err);
      const tbody = document.getElementById('goodsReceiptTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading goods receipts</td></tr>';
      }
    }
  })();
}

/* =====================================================
   PURCHASE INVOICES (WITH BRANCH FILTER VIA PO)
===================================================== */
function loadPurchaseInvoices() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        console.error('No branch context');
        return;
      }

      // Get all POs for current branch first
      const { data: poData, error: poError } = await withBranchFilter(
        supabase.from('purchase_orders').select('id')
      );

      if (poError || !poData) {
        throw new Error('Failed to get POs for branch');
      }

      const poIds = poData.map(po => po.id);

      const tbody = document.getElementById('invoicesTableBody');
      if (!tbody) return;

      if (poIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No invoices found</td></tr>';
        return;
      }

      // Now get invoices only for these POs
      const { data: invoices, error: invError } = await supabase
        .from('purchase_invoices')
        .select('*, purchase_orders(po_number, branch_id), suppliers(name)')
        .in('purchase_order_id', poIds)
        .order('created_at', { ascending: false });

      if (invError) throw invError;

      if (!Array.isArray(invoices) || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No invoices found</td></tr>';
        console.log('✅ No invoices for this branch');
        return;
      }

      let html = '';
      invoices.forEach(inv => {
        html += `<tr><td>${inv.purchase_orders?.po_number || 'N/A'}</td><td>${inv.suppliers?.name || 'N/A'}</td><td>${inv.invoice_number || 'N/A'}</td><td>K ${formatMoney(inv.amount || 0)}</td><td>${inv.match_status || 'PENDING'}</td><td>Actions</td></tr>`;
      });
      tbody.innerHTML = html;
      console.log(`✅ Loaded ${invoices.length} invoices for branch ${context.branch_id}`);
    } catch (err) {
      console.error('Purchase invoices error:', err);
      const tbody = document.getElementById('invoicesTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading invoices</td></tr>';
      }
    }
  })();
}

/* =====================================================
   SUPPLIER PAYMENTS (WITH BRANCH FILTER VIA PO)
===================================================== */
function loadSupplierPayments() {
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) {
        console.error('No branch context');
        return;
      }

      // Get all POs for current branch
      const { data: poData, error: poError } = await withBranchFilter(
        supabase.from('purchase_orders').select('id')
      );

      if (poError || !poData) {
        throw new Error('Failed to get POs for branch');
      }

      const poIds = poData.map(po => po.id);

      const tbody = document.getElementById('paymentsTableBody');
      if (!tbody) return;

      if (poIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending payments</td></tr>';
        return;
      }

      // Get invoices for these POs, then get payments for those invoices
      const { data: invoiceData, error: invError } = await supabase
        .from('purchase_invoices')
        .select('id')
        .in('purchase_order_id', poIds);

      if (invError) throw invError;

      const invoiceIds = invoiceData?.map(inv => inv.id) || [];

      if (invoiceIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending payments</td></tr>';
        return;
      }

      // Get payments for these invoices
      const { data: payments, error: payError } = await supabase
        .from('supplier_payments')
        .select('*, purchase_invoices(invoice_number, amount), suppliers(name)')
        .in('purchase_invoice_id', invoiceIds)
        .order('created_at', { ascending: false });

      if (payError) throw payError;

      if (!Array.isArray(payments) || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending payments</td></tr>';
        console.log('✅ No payments for this branch');
        return;
      }

      let html = '';
      payments.forEach(pmt => {
        html += `<tr><td>${pmt.suppliers?.name || 'N/A'}</td><td>${pmt.purchase_invoices?.invoice_number || 'N/A'}</td><td>K ${formatMoney(pmt.amount || 0)}</td><td>${pmt.days_outstanding || 0}</td><td>${pmt.status || 'PENDING'}</td><td>Pay</td></tr>`;
      });
      tbody.innerHTML = html;
      console.log(`✅ Loaded ${payments.length} supplier payments for branch ${context.branch_id}`);
    } catch (err) {
      console.error('Supplier payments error:', err);
      const tbody = document.getElementById('paymentsTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading payments</td></tr>';
      }
    }
  })();
}

/* =====================================================
   PURCHASING ANALYTICS (WITH BRANCH FILTER)
===================================================== */
function loadPurchasingAnalytics() {
  // Placeholder for analytics loading
  console.log('📊 Purchasing analytics loaded');
}

/**
 * Logout function - clear session and redirect to login
 */
function logout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }

  try {
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('session');

    // Clear any cached data
    localStorage.removeItem('poCache');
    localStorage.removeItem('supplierCache');

    // Redirect to login
    console.log('✅ Logged out successfully');
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Logout error:', err);
    alert('Error during logout: ' + err.message);
  }
}
