// Goods Receipt & Inventory Update Module
// Depends on: supabase-init.js, purchasing.js

let currentGRPoId = null;

/* =====================================================
   GOODS RECEIPT LIST
===================================================== */
function loadGoodsReceiptList() {
  (async () => {
    try {
      const { data, error } = await withBranchFilter(
        supabase.from('purchase_orders').select('id, po_number, status, total_amount, suppliers(name), purchase_order_items(quantity_ordered, quantity_received)')
      )
        .eq('status', 'CONFIRMED')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tbody = document.getElementById('goodsReceiptTableBody');
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No pending receipts</td></tr>';
        return;
      }

      let html = '';
      data.forEach(po => {
        const itemCount = po.purchase_order_items?.length || 0;
        html += `
          <tr>
            <td><strong>${po.po_number}</strong></td>
            <td>${po.suppliers?.name || 'N/A'}</td>
            <td><span class="badge badge-info">${po.status}</span></td>
            <td>${itemCount} items</td>
            <td>
              <button class="btn-primary" onclick="openGoodsReceiptModal(${po.id})">Receive Goods</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Load goods receipt list error:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading receipts</td></tr>';
    }
  })();
}

/* =====================================================
   GOODS RECEIPT MODAL
===================================================== */
function openGoodsReceiptModal(poId) {
  (async () => {
    try {
      currentGRPoId = poId;

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(id, product_id, quantity_ordered, quantity_received, products(name, sku))')
        .eq('id', poId)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('PO not found');
        return;
      }

      const po = data[0];
      const tbody = document.getElementById('grItemsBody');
      tbody.innerHTML = '';

      po.purchase_order_items?.forEach(item => {
        const row = document.createElement('tr');
        const remaining = item.quantity_ordered - item.quantity_received;
        row.innerHTML = `
          <td>${item.products?.name} (${item.products?.sku})</td>
          <td>${item.quantity_ordered}</td>
          <td>${item.quantity_received}</td>
          <td>
            <input type="number" min="0" max="${remaining}" value="${remaining}"
                   data-item-id="${item.id}" data-item-remaining="${remaining}"
                   class="gr-quantity">
          </td>
        `;
        tbody.appendChild(row);
      });

      document.getElementById('goodsReceiptModal').style.display = 'block';
    } catch (err) {
      console.error('Open goods receipt error:', err);
      alert('Failed to load PO items: ' + err.message);
    }
  })();
}

function closeGoodsReceiptModal() {
  const modal = document.getElementById('goodsReceiptModal');
  if (modal) modal.style.display = 'none';
  currentGRPoId = null;
}

function submitGoodsReceipt() {
  (async () => {
    try {
      const inputs = document.querySelectorAll('.gr-quantity');
      if (inputs.length === 0) {
        alert('No items to receive');
        return;
      }

      const receivedItems = [];
      let hasItems = false;

      inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
          hasItems = true;
          receivedItems.push({
            po_item_id: input.dataset.itemId,
            quantity_received: qty
          });
        }
      });

      if (!hasItems) {
        alert('Please enter quantity for at least one item');
        return;
      }

      // Call RPC function to receive goods
      const { data, error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: currentGRPoId,
        p_received_items: receivedItems
      });

      if (error) throw error;

      alert('✅ ' + data[0].message + '\n\nInventory and GL entries updated');
      closeGoodsReceiptModal();
      loadGoodsReceiptList();
      loadPurchaseOrders();
    } catch (err) {
      console.error('Submit goods receipt error:', err);
      alert('Failed to receive goods: ' + err.message);
    }
  })();
}
