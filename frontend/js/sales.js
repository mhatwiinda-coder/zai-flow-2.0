// Supabase client initialized in supabase-init.js

let cart = [];
let lastSaleData = null;
let drawerIsOpen = false;
let allSales = [];
let posQuaggaInitialized = false;
let balanceAttempts = 0; // Track till balance attempts

/* =====================================================
   UTILITY FUNCTIONS
===================================================== */
function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =====================================================
   INITIALIZE
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  console.log('📄 Sales page loaded');
  loadSales();
  loadSummary();
  checkDrawerStatus();
  setupPOSEventListeners();

  const openDrawerBtn = document.getElementById("openDrawerBtn");
  console.log('🔘 Open Drawer Button found:', openDrawerBtn);
  if (openDrawerBtn) {
    openDrawerBtn.addEventListener("click", openDrawer);
    console.log('✅ Click listener attached to openDrawerBtn');
  } else {
    console.error('❌ openDrawerBtn not found!');
  }

  document.getElementById("balanceTillBtn")
    ?.addEventListener("click", showBalanceModal);

  document.getElementById("paymentMethod")
    ?.addEventListener("change", updatePaymentUI);

  document.getElementById("filterDate")
    ?.addEventListener("change", filterSalesHistory);

  document.getElementById("filterPayment")
    ?.addEventListener("change", filterSalesHistory);
});

/* =====================================================
   QUAGGA2 BARCODE SCANNER (POS)
===================================================== */

function togglePOSCamera() {
  const scanner = document.getElementById("posScanner");
  const btn = document.getElementById("posCameraBtn");
  const input = document.getElementById("posBarcodeInput");
  const captureBtn = document.getElementById("posCaptureBtn");

  if (scanner.style.display === "none") {
    scanner.style.display = "block";
    input.style.display = "none";
    if (captureBtn) captureBtn.style.display = "block";
    btn.innerText = "🛑 Stop Camera";
    startPOSCamera();
  } else {
    scanner.style.display = "none";
    btn.innerText = "📷 Start Camera";
    stopPOSCamera();
    input.style.display = "block";
    if (captureBtn) captureBtn.style.display = "none";
  }
}

function togglePOSManualEntry() {
  const input = document.getElementById("posBarcodeInput");
  const scanner = document.getElementById("posScanner");
  const btn = document.getElementById("posCameraBtn");

  if (input.style.display === "none") {
    input.style.display = "block";
    scanner.style.display = "none";
    btn.innerText = "Start Camera";
    stopPOSCamera();
    input.focus();
  } else {
    input.style.display = "none";
    startPOSCamera();
    btn.innerText = "Stop Camera";
    scanner.style.display = "block";
  }
}

function startPOSCamera() {
  if (posQuaggaInitialized) return;

  try {
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          facingMode: "environment"
        },
        target: document.getElementById("posScanner")
      },
      locator: {
        halfSample: true,
        patchSize: "large"
      },
      frequency: 10,
      decoder: {
        readers: ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"]
      }
    }, function(err) {
      if (err) {
        console.error("Quagga error:", err);
        document.getElementById("posBarcodeInput").style.display = "block";
        document.getElementById("posScanner").style.display = "none";
        alert("Camera access denied. Using manual entry instead.");
        return;
      }
      Quagga.start();
      posQuaggaInitialized = true;

      Quagga.onDetected(function(data) {
        const barcode = data.codeResult.code;
        handlePOSBarcodeScan(barcode);
      });
    });
  } catch (err) {
    console.error("Camera init error:", err);
    alert("Camera not available. Please use manual entry.");
  }
}

function stopPOSCamera() {
  if (!posQuaggaInitialized) return;
  try {
    Quagga.stop();
    posQuaggaInitialized = false;
  } catch (err) {
    console.error("Camera stop error:", err);
  }
}

function handlePOSBarcodeScan(barcode = null) {
  const input = document.getElementById("posBarcodeInput");
  const code = barcode || input.value.trim();

  if (!code) return;

  input.value = code;
  manualCapture();
}

function capturePOSBarcode() {
  console.log('📸 Manual capture button clicked');

  // Try to capture from Quagga if available
  if (typeof Quagga !== 'undefined' && Quagga.canvas) {
    try {
      const canvas = Quagga.canvas.ctx.canvas;
      if (canvas) {
        // Attempt to read barcode from current frame
        console.log('📷 Attempting to read barcode from camera frame');
        // Trigger Quagga to process current frame
        Quagga.onProcessed(function(result) {
          if (result && result.codeResult) {
            const barcode = result.codeResult.code;
            console.log('✅ Barcode captured:', barcode);
            handlePOSBarcodeScan(barcode);
          }
        });
      }
    } catch (err) {
      console.error('❌ Capture error:', err);
      alert('Could not capture barcode. Please try scanning manually.');
    }
  } else {
    alert('Camera not ready. Please wait a moment and try again.');
  }
}

/* =====================================================
   PAYMENT METHOD UI
===================================================== */

function updatePaymentUI() {
  const method = document.getElementById("paymentMethod").value;
  const cashLabel = document.getElementById("cashLabel");
  const cashInput = document.getElementById("cashGiven");
  const changeDisplay = document.getElementById("changeDisplay");

  if (method === "Cash") {
    cashLabel.style.display = "block";
    cashInput.style.display = "block";
    changeDisplay.style.display = "block";
  } else {
    cashLabel.style.display = "none";
    cashInput.style.display = "none";
    changeDisplay.style.display = "none";
    cashInput.value = "";
  }
}

function refreshPOS() {
  const btn = document.querySelector(".refresh-btn");
  btn.style.animation = "spin 0.6s linear";
  loadSales();
  loadSummary();
  checkDrawerStatus();
  setTimeout(() => {
    btn.style.animation = "";
  }, 600);
}

/* =====================================================
   SALES HISTORY FILTERING
===================================================== */

function filterSalesHistory() {
  const filterDate = document.getElementById("filterDate")?.value || "";
  const filterPayment = document.getElementById("filterPayment")?.value || "";

  const filtered = allSales.filter(sale => {
    const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
    const matchDate = !filterDate || saleDate === filterDate;
    const matchPayment = !filterPayment || sale.payment_method === filterPayment;
    return matchDate && matchPayment;
  });

  displaySalesHistory(filtered);
}

function displaySalesHistory(sales) {
  const tbody = document.getElementById("salesTable");
  tbody.innerHTML = "";

  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No sales found</td></tr>';
    return;
  }

  let html = "";
  sales.forEach(s => {
    const time = new Date(s.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isReversed = s.status === 'REVERSED';

    html += `
      <tr style="${isReversed ? 'opacity: 0.6;' : ''}">
        <td>#${s.id} ${isReversed ? '(Reversed)' : ''}</td>
        <td>K${Number(s.total).toFixed(2)}</td>
        <td>${s.payment_method}</td>
        <td>${time}</td>
        <td style="display: flex; gap: 4px;">
          <button onclick="viewSale(${s.id})" style="padding: 4px 6px; font-size: 11px; background: #64a4ff; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 View</button>
          <button onclick="reprintSaleReceipt(${s.id})" style="padding: 4px 6px; font-size: 11px; background: #7367f0; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Reprint</button>
          ${!isReversed ? `<button onclick="reverseSaleTransaction(${s.id})" style="padding: 4px 6px; font-size: 11px; background: #ff5b5b; color: white; border: none; border-radius: 4px; cursor: pointer;">↩️ Reverse</button>` : ''}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function setupPOSEventListeners() {
  updatePaymentUI();
}

/* =====================================================
   HELPER
===================================================== */
function money(value) {
  return 'ZMW ' + Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =====================================================
   DRAWER STATUS
===================================================== */
function checkDrawerStatus() {
  (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      console.log('🔍 Checking drawer status for user:', user?.id);

      // Get the most recent open drawer for this user (using PostgREST instead of RPC)
      const { data: drawers, error: drawerError } = await withBranchFilter(
        window.supabase.from('cash_drawer').select('*')
      )
        .eq('user_id', String(user?.id))
        .order('opened_at', { ascending: false })
        .limit(1);

      if (drawerError || !drawers || drawers.length === 0) {
        console.log('⚠️ No drawer found');
        drawerIsOpen = false;

        const bar = document.getElementById("drawerStatus");
        const openSection = document.getElementById("openTillSection");

        if (bar) bar.innerHTML = `🔴 Cash Drawer CLOSED`;
        if (openSection) openSection.style.display = "block";

        lockPOS(true);
        return;
      }

      const drawer = drawers[0];
      console.log('📊 Drawer found:', drawer);

      // If drawer is not open, mark as closed
      if (drawer.status !== 'OPEN') {
        console.log('❌ Drawer is CLOSED');
        drawerIsOpen = false;

        const bar = document.getElementById("drawerStatus");
        const openSection = document.getElementById("openTillSection");

        if (bar) bar.innerHTML = `🔴 Cash Drawer CLOSED`;
        if (openSection) openSection.style.display = "block";

        lockPOS(true);
        return;
      }

      // Drawer is open - calculate expected balance
      const { data: sales, error: salesError } = await withBranchFilter(
        supabase.from('sales').select('total')
      )
        .eq('payment_method', 'Cash')
        .eq('status', 'COMPLETED')
        .gte('created_at', drawer.opened_at);

      const salesTotal = sales ? sales.reduce((sum, s) => sum + Number(s.total || 0), 0) : 0;
      const expectedBalance = Number(drawer.opening_balance || 0) + salesTotal;

      console.log('✅ Drawer is OPEN - Expected balance:', expectedBalance);

      drawerIsOpen = true;

      const bar = document.getElementById("drawerStatus");
      const openSection = document.getElementById("openTillSection");

      if (bar)
        bar.innerHTML = `🟢 Cash Drawer OPEN | Expected: ${money(expectedBalance)}`;

      if (openSection)
        openSection.style.display = "none";

      lockPOS(false);
    } catch (err) {
      console.error('❌ Drawer status error:', err);
    }
  })();
}

/* =====================================================
   OPEN DRAWER
===================================================== */
function openDrawer() {
  console.log('🔵 openDrawer() called');
  (async () => {
    try {
      const balanceEl = document.getElementById("openingBalance");
      const opening = Number(balanceEl?.value || 0);
      console.log('📊 Opening balance value:', opening);

      if (opening <= 0) {
        alert("Please enter a valid opening balance");
        return;
      }

      const user = JSON.parse(localStorage.getItem("user"));
      console.log('👤 User data:', user);

      const context = getBranchContext();

      console.log('📤 Calling RPC: open_cash_drawer', {
        p_branch_id: context.branch_id,
        p_user_id: user?.id,
        p_opening_balance: opening
      });

      const { data, error } = await window.supabase.rpc('open_cash_drawer', {
        p_branch_id: context.branch_id,
        p_user_id: user?.id,
        p_opening_balance: opening
      });

      console.log('📥 RPC Response:', { data, error });

      if (error) {
        console.error('❌ RPC Error:', error);
        alert(`Error: ${error.message || "Failed to open drawer"}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned from RPC');
        alert("Failed to open drawer - no response");
        return;
      }

      console.log('✅ Drawer opened successfully:', data[0]);

      if (balanceEl) balanceEl.value = "";

      // Wait 500ms for database to commit, then check status
      console.log('⏳ Waiting for database to commit...');
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔄 Checking drawer status after commit');
      checkDrawerStatus();
      alert("✅ Drawer opened successfully!");
    } catch (err) {
      console.error('❌ Error opening drawer:', err);
      alert(`Error: ${err.message}`);
    }
  })();
}

/* =====================================================
   PRODUCT LOOKUP
===================================================== */
/* Store currently previewed product */
let currentPreviewedProduct = null;

function manualCapture() {
  // 🔒 HARD LOCK
  if (!drawerIsOpen) {
    alert("Till is closed. Open drawer before adding items.");
    return;
  }

  const code = document.getElementById("posBarcodeInput").value.trim();
  if (!code) return alert("Enter product code");

  (async () => {
    try {
      console.log('🔍 Looking up product:', code);
      let product = null;

      // Try 1: Look up by SKU
      const { data: skuMatch, error: skuError } = await withBranchFilter(
        supabase.from('products').select('*')
      )
        .eq('sku', code)
        .single();

      if (skuMatch && !skuError) {
        product = skuMatch;
        console.log('✅ Found by SKU');
      }

      // Try 2: Look up by barcode
      if (!product) {
        const { data: barcodeMatch, error: barcodeError } = await withBranchFilter(
          supabase.from('products').select('*')
        )
          .eq('barcode', code)
          .single();

        if (barcodeMatch && !barcodeError) {
          product = barcodeMatch;
          console.log('✅ Found by barcode');
        }
      }

      // Try 3: Look up by ID (if code is numeric)
      if (!product && !isNaN(code)) {
        const { data: idMatch, error: idError } = await withBranchFilter(
          supabase.from('products').select('*')
        )
          .eq('id', parseInt(code))
          .single();

        if (idMatch && !idError) {
          product = idMatch;
          console.log('✅ Found by ID');
        }
      }

      if (!product) {
        console.error('❌ Product not found:', code);
        alert("Product not found");
        document.getElementById("posBarcodeInput").value = "";
        return;
      }

      // 🔒 DOUBLE CHECK LOCK
      if (!drawerIsOpen) return;

      // Store for later use and display preview
      currentPreviewedProduct = product;
      displayProductPreview(product);
    } catch (err) {
      console.error('❌ Product lookup error:', err);
      alert("Product not found");
      document.getElementById("posBarcodeInput").value = "";
    }
  })();
}

function displayProductPreview(product) {
  const preview = document.getElementById("productPreview");
  if (!preview) return; // Element not found

  const stockColor = product.stock > 10 ? '#28c76f' : product.stock > 0 ? '#ff9f43' : '#ff5b5b';

  preview.innerHTML = `
    <div style="background: rgba(40, 199, 111, 0.15); border: 1px solid rgba(40, 199, 111, 0.3); border-radius: 8px; padding: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <h4 style="margin: 0; color: #28c76f;">📦 ${product.name}</h4>
        <button onclick="clearProductPreview()" style="background: #ff5b5b; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">Close</button>
      </div>

      <div style="font-size: 13px; line-height: 1.6; margin-bottom: 12px;">
        <div style="margin: 6px 0;">
          <strong>Price:</strong> K ${Number(product.price || 0).toFixed(2)}
        </div>
        <div style="margin: 6px 0;">
          <strong>Stock:</strong> <span style="color: ${stockColor};">${product.stock} units</span>
        </div>
        <div style="margin: 6px 0;">
          <strong>Barcode:</strong> ${product.barcode || '-'}
        </div>
        <div style="margin: 6px 0;">
          <strong>SKU:</strong> ${product.sku || '-'}
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button onclick="addToCartFromPreview()"
                style="flex: 1; background: #28c76f; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-weight: 600; font-size: 12px;">
          ✓ Add to Cart
        </button>
        <button onclick="clearProductPreview()"
                style="flex: 1; background: #7367f0; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-weight: 600; font-size: 12px;">
          Cancel
        </button>
      </div>
    </div>
  `;
  preview.style.display = "block";
}

function addToCartFromPreview() {
  if (!currentPreviewedProduct) {
    alert("No product selected");
    return;
  }

  const product = currentPreviewedProduct;
  const existing = cart.find(p => p.id === product.id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name || product.product_name,
      price: Number(product.price || product.selling_price || 0),
      quantity: 1
    });
  }

  renderCart();
  clearProductPreview();
}

function clearProductPreview() {
  const preview = document.getElementById("productPreview");
  if (preview) {
    preview.innerHTML = "";
    preview.style.display = "none";
  }

  document.getElementById("posBarcodeInput").value = "";
  document.getElementById("posBarcodeInput").focus();
  currentPreviewedProduct = null;
}

/* =====================================================
   CART RENDER
===================================================== */
function renderCart() {

  // 🔒 Prevent rendering cart if drawer closed
  if (!drawerIsOpen) {
    cart = [];
    document.getElementById("cartItems").innerHTML = "";
    document.getElementById("emptyCart").style.display = "block";
    document.getElementById("grandTotal").innerText = "K 0.00";
    return;
  }

  const tbody = document.getElementById("cartItems");
  const emptyMsg = document.getElementById("emptyCart");
  tbody.innerHTML = "";

  let total = 0;
  let html = "";

  cart.forEach((item, index) => {

    const line = item.price * item.quantity;
    total += line;

    html += `
      <tr>
        <td>${item.name}</td>
        <td>
          <button onclick="adjustQty(${index}, -1)" style="padding: 2px 6px; margin-right: 4px;">−</button>
          ${item.quantity}
          <button onclick="adjustQty(${index}, 1)" style="padding: 2px 6px; margin-left: 4px;">+</button>
        </td>
        <td>K${money(item.price)}</td>
        <td>K${money(line)}</td>
        <td>
          <button onclick="removeFromCart(${index})" class="remove-item">Remove</button>
        </td>
      </tr>
    `;
  });

  if (cart.length === 0) {
    emptyMsg.style.display = "block";
    tbody.innerHTML = "";
  } else {
    emptyMsg.style.display = "none";
    tbody.innerHTML = html;
  }

  document.getElementById("grandTotal").innerText = money(total);
}

function adjustQty(index, change) {
  if (cart[index]) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
    renderCart();
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}
/* =====================================================
   CHANGE CALCULATION
===================================================== */
function calculateChange() {
  // Calculate total from cart (not from UI text which may be formatted)
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const cashGiven = Number(
    document.getElementById("cashGiven").value || 0
  );

  if (cashGiven < total) {
    document.getElementById("changeDisplay").innerText = "Change: K 0.00";
    return;
  }

  const change = cashGiven - total;

  document.getElementById("changeDisplay").innerText =
    "Change: K " + change.toFixed(2);
}

/* =====================================================
   COMPLETE SALE
===================================================== */
function completeSale() {

  // 🔒 HARD DRAWER LOCK
  if (!drawerIsOpen) {
    alert("Till is closed. Open drawer before transacting.");
    return;
  }

  if (!cart.length) {
    alert("Cart empty");
    return;
  }

  const paymentMethod = document.getElementById("paymentMethod").value;

  // 🔢 Calculate total properly (never trust UI text)
  const total = cart.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  const cashGiven = Number(
    document.getElementById("cashGiven").value || 0
  );

  let change = 0;

  // 💵 CASH VALIDATION
  if (paymentMethod === "Cash") {

    if (cashGiven <= 0) {
      alert("Enter cash received.");
      return;
    }

    if (cashGiven < total) {
      alert("Insufficient cash received.");
      return;
    }

    change = cashGiven - total;

    // Optional: Prevent giving change if drawer empty
    // (uncomment if you want strict float control)
    /*
    fetch(`${API}/sales/drawer/status`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
    .then(r => r.json())
    .then(status => {
      const expected = Number(status.expected_balance);

      if (expected < change) {
        alert("Not enough cash in drawer to give change.");
        return;
      }
    });
    */
  }

  // 🚀 Call Supabase create_sale() function
  (async () => {
    try {
      // Prepare items in JSONB format for the function
      const items = cart.map(i => ({
        product_id: i.id,
        quantity: i.quantity,
        price: i.price
      }));

      const context = getBranchContext();
      if (!context) {
        alert('❌ No branch context found. Please log in again.');
        return;
      }

      const { data, error } = await window.supabase.rpc('create_sale', {
        p_branch_id: context.branch_id,
        p_total: total,
        p_payment_method: paymentMethod,
        p_items: items
      });

      if (error) {
        console.error('RPC error:', error);
        alert(error.message || "Sale failed.");
        return;
      }

      if (!data || data.length === 0 || data[0].status !== 'SUCCESS') {
        alert("Sale failed.");
        return;
      }

      // ✅ Clean receipt data
      lastSaleData = {
        sale_id: data[0].sale_id,
        total: Number(total),
        items: [...cart],
        cashGiven: paymentMethod === "Cash" ? cashGiven : 0,
        change: paymentMethod === "Cash" ? change : 0
      };

      document.getElementById("receiptActions").style.display = "block";

      if (paymentMethod === "Cash") {
        openPhysicalDrawer();
      }

      // 🔄 Reset cart AFTER backend success
      cart = [];
      renderCart();

      document.getElementById("cashGiven").value = "";
      document.getElementById("changeDisplay").innerText = "Change: 0.00";

      loadSales();
      loadSummary();
      checkDrawerStatus();
    } catch (err) {
      console.error('Error:', err);
      alert("Sale error occurred.");
    }
  })();
}

/* =====================================================
   RECEIPT PREVIEW
===================================================== */
function printReceiptPreview() {
  console.log('🧾 Receipt preview called. Data:', lastSaleData);

  if (!lastSaleData) {
    alert("No sale data. Complete a sale first.");
    return;
  }

  try {
    const sale = lastSaleData;
    const total = Number(sale.total || 0);
    const vat = Number(total - total / 1.16);
    const net = Number(total / 1.16);

    console.log('💰 Receipt totals:', { total, vat, net, items: sale.items });

    let itemsHtml = '';
    if (sale.items && sale.items.length > 0) {
      sale.items.forEach(i => {
        const itemPrice = Number(i.price || 0);
        const itemQty = Number(i.quantity || 0);
        const itemTotal = itemPrice * itemQty;
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px 0; border-bottom: 1px dotted #ccc;">
            <div style="flex: 1;">
              <div style="font-weight: bold; margin-bottom: 2px;">${i.name || 'Unknown'}</div>
              <div style="font-size: 12px;">K${itemPrice.toFixed(2)} × ${itemQty}</div>
            </div>
            <div style="text-align: right; font-weight: bold;">K${itemTotal.toFixed(2)}</div>
          </div>
        `;
      });
    } else {
      itemsHtml = '<p style="color: red;">No items in sale</p>';
    }

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 15px; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 20px;">ZAI FLOW</h2>
          <p style="margin: 5px 0; font-size: 14px;">Receipt #${sale.sale_id}</p>
          <p style="margin: 5px 0; font-size: 12px;">${new Date().toLocaleString()}</p>
        </div>

        <hr style="margin: 10px 0; border: none; border-top: 1px solid #999;">

        <div style="margin: 10px 0;">
          ${itemsHtml}
        </div>

        <hr style="margin: 10px 0; border: none; border-top: 1px dashed #ccc;">

        <div style="text-align: right; margin: 10px 0; font-size: 14px;">
          <div style="margin: 5px 0;">Subtotal: K${net.toFixed(2)}</div>
          <div style="margin: 5px 0;">VAT (16%): K${vat.toFixed(2)}</div>
          <div style="margin: 10px 0; font-size: 18px; font-weight: bold; color: #333;">
            TOTAL: K${total.toFixed(2)}
          </div>
          ${sale.cashGiven > 0 ? `<div style="margin: 5px 0; font-size: 12px;">Cash: K${sale.cashGiven.toFixed(2)}</div>` : ''}
          ${sale.change > 0 ? `<div style="margin: 5px 0; font-size: 12px; color: green; font-weight: bold;">Change: K${sale.change.toFixed(2)}</div>` : ''}
        </div>

        <hr style="margin: 10px 0; border: none; border-top: 1px solid #999;">

        <div id="receiptQR" style="text-align: center; margin: 10px 0; min-height: 100px;"></div>

        <div style="text-align: center; font-size: 11px; margin: 10px 0; line-height: 1.4;">
          <p style="margin: 3px 0;">Please verify items before leaving.</p>
          <p style="margin: 3px 0;">Thank you for your business!</p>
        </div>
      </div>
    `;

    const contentEl = document.getElementById("receiptContent");
    if (!contentEl) {
      console.error('❌ receiptContent element not found');
      alert("Receipt container not found");
      return;
    }

    contentEl.innerHTML = html;
    console.log('✅ Receipt HTML set, length:', html.length);

    const previewEl = document.getElementById("receiptPreview");
    if (previewEl) {
      previewEl.style.display = "block";
      console.log('✅ Receipt preview shown');
    }

    // Generate QR code
    setTimeout(() => {
      try {
        const qrEl = document.getElementById("receiptQR");
        if (qrEl) {
          qrEl.innerHTML = '';
          new QRCode(qrEl, {
            text: `SALE-${sale.sale_id}`,
            width: 100,
            height: 100,
            correctLevel: QRCode.CorrectLevel.H
          });
          console.log('✅ QR code generated');
        }
      } catch (qrErr) {
        console.error('⚠️ QR code generation failed:', qrErr);
      }
    }, 100);
  } catch (err) {
    console.error('❌ Receipt preview error:', err);
    alert(`Receipt error: ${err.message}`);
  }
}

/* =====================================================
   CONFIRM PRINT
===================================================== */
function confirmPrint() {
  console.log('🖨️ Confirming print');

  try {
    if (!lastSaleData) {
      alert("No sale data to print");
      return;
    }

    const sale = lastSaleData;
    const total = Number(sale.total || 0);
    const vat = Number(total - total / 1.16);
    const net = Number(total / 1.16);

    console.log('🧾 Generating receipt for printing:', sale);

    // Generate items HTML
    let itemsHtml = '';
    if (sale.items && sale.items.length > 0) {
      sale.items.forEach(i => {
        const itemPrice = Number(i.price || 0);
        const itemQty = Number(i.quantity || 0);
        const itemTotal = itemPrice * itemQty;
        itemsHtml += `
          <tr>
            <td style="padding: 5px 0; border-bottom: 1px dotted #ccc;">${i.name || 'Unknown'}</td>
            <td style="padding: 5px 0; border-bottom: 1px dotted #ccc; text-align: center;">${itemQty}</td>
            <td style="padding: 5px 0; border-bottom: 1px dotted #ccc; text-align: right;">K${itemPrice.toFixed(2)}</td>
            <td style="padding: 5px 0; border-bottom: 1px dotted #ccc; text-align: right;"><strong>K${itemTotal.toFixed(2)}</strong></td>
          </tr>
        `;
      });
    }

    // Create detailed QR code data
    const itemNames = sale.items ? sale.items.map(i => i.name).join(', ') : 'N/A';
    const itemCount = sale.items ? sale.items.length : 0;
    const receiptDate = new Date();
    const qrData = `COMPANY:ZAI FLOW
PLACE:Main Store
DATE:${receiptDate.toLocaleDateString()}
TIME:${receiptDate.toLocaleTimeString()}
TRANSACTION_ID:${sale.sale_id}
ITEMS:${itemCount} (${itemNames})
TOTAL:K${total.toFixed(2)}`;

    // Generate QR code URL using API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

    console.log('📱 QR Code Data:', qrData);
    console.log('📱 QR Code URL:', qrCodeUrl);

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ZAI FLOW Receipt #${sale.sale_id}</title>
        <style>
          * { margin: 0; padding: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            background: white;
            padding: 20px;
          }
          .receipt-container {
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            background: white;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .receipt-header h1 { font-size: 24px; margin: 5px 0; }
          .receipt-header p { font-size: 12px; margin: 3px 0; }
          .receipt-items {
            margin: 20px 0;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .receipt-items table {
            width: 100%;
            font-size: 12px;
            line-height: 1.8;
          }
          .receipt-items td { padding: 3px 0; }
          .receipt-totals {
            margin: 15px 0;
            text-align: right;
            font-size: 13px;
          }
          .receipt-totals .total-line { margin: 5px 0; }
          .receipt-totals .grand-total {
            font-size: 16px;
            font-weight: bold;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid #333;
          }
          .receipt-qr {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            border: 1px dotted #999;
            background: #f9f9f9;
          }
          .receipt-qr img {
            max-width: 150px;
            height: auto;
          }
          .receipt-qr-text {
            font-size: 9px;
            color: #666;
            margin-top: 5px;
            line-height: 1.2;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 15px;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt-container { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt-header">
            <h1>ZAI FLOW</h1>
            <p><strong>Receipt #${sale.sale_id}</strong></p>
            <p>${new Date().toLocaleString()}</p>
          </div>

          <div class="receipt-items">
            <table>
              <tr style="font-weight: bold; border-bottom: 1px solid #999;">
                <td>Item</td>
                <td style="text-align: center;">Qty</td>
                <td style="text-align: right;">Price</td>
                <td style="text-align: right;">Total</td>
              </tr>
              ${itemsHtml}
            </table>
          </div>

          <div class="receipt-totals">
            <div class="total-line">Subtotal: K${net.toFixed(2)}</div>
            <div class="total-line">VAT (16%): K${vat.toFixed(2)}</div>
            <div class="grand-total">TOTAL: K${total.toFixed(2)}</div>
            ${sale.cashGiven > 0 ? `<div class="total-line" style="margin-top: 10px;">Cash Received: K${sale.cashGiven.toFixed(2)}</div>` : ''}
            ${sale.change > 0 ? `<div class="total-line" style="color: green; font-weight: bold;">Change: K${sale.change.toFixed(2)}</div>` : ''}
          </div>

          <div class="receipt-qr">
            <img src="${qrCodeUrl}" alt="Receipt QR Code" />
            <div class="receipt-qr-text">
              <strong>Receipt Information</strong><br>
              Company: ZAI FLOW<br>
              Transaction ID: ${sale.sale_id}<br>
              Date: ${receiptDate.toLocaleDateString()}<br>
              Time: ${receiptDate.toLocaleTimeString()}
            </div>
          </div>

          <div class="receipt-footer">
            <p>Please verify items before leaving.</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();

    console.log('✅ Receipt HTML written to print window');

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      // Reset UI after print dialog
      setTimeout(() => {
        printWindow.close();

        document.getElementById("receiptPreview").style.display = "none";
        document.getElementById("receiptActions").style.display = "none";

        cart = [];
        lastSaleData = null;

        renderCart();
        document.getElementById("cashGiven").value = "";
        document.getElementById("changeDisplay").innerText = "Change: K 0.00";

        console.log('✅ UI reset after print');
      }, 500);
    }, 500);
  } catch (err) {
    console.error('❌ Print error:', err);
    alert(`Print error: ${err.message}`);
  }
}

/* =====================================================
   VIEW SALE
===================================================== */
function viewSale(id) {
  (async () => {
    try {
      // Get sale details
      const { data: sale, error: saleError } = await withBranchFilter(
        supabase.from('sales').select('*')
      )
        .eq('id', id)
        .single();

      if (saleError || !sale) {
        alert("Sale not found");
        return;
      }

      // Get sale items
      const { data: items, error: itemsError } = await withBranchFilter(
        supabase.from('sale_items').select('product_id,quantity,price,products(name)')
      )
        .eq('sale_id', id);

      if (itemsError) {
        console.error('Error loading sale items:', itemsError);
        return;
      }

      lastSaleData = {
        sale_id: sale.id,
        total: Number(sale.total),
        items: (items || []).map(i => ({
          id: i.product_id,
          name: i.products?.name || 'Unknown',
          price: Number(i.price),
          quantity: i.quantity
        })),
        cashGiven: 0,
        change: 0
      };

      printReceiptPreview();
    } catch (err) {
      console.error('View sale error:', err);
      alert("Error loading sale");
    }
  })();
}

/* =====================================================
   LOAD SALES HISTORY
===================================================== */
async function loadSales() {
  try {
    const { data: rows, error } = await withBranchFilter(
      supabase.from('sales').select('*')
    )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading sales:', error);
      return;
    }

    if (!Array.isArray(rows)) return;

    allSales = rows;
    updateSalesCount(rows.length);
    displaySalesHistory(rows);
  } catch (err) {
    console.error('Load sales error:', err);
  }
}

/* =====================================================
   DAILY SUMMARY
===================================================== */
async function loadSummary() {
  try {
    // Get today's date (00:00:00 to 23:59:59)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: sales, error } = await withBranchFilter(
      supabase.from('sales').select('total, payment_method')
    )
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (error) {
      console.error('Error loading summary:', error);
      return;
    }

    const transactions = sales ? sales.length : 0;
    const totalSales = sales ? sales.reduce((sum, s) => sum + (s.total || 0), 0) : 0;
    const vat = totalSales * (16 / 116); // 16% VAT calculation

    document.getElementById("dailySummary").innerHTML = `
      Transactions: ${transactions}<br>
      Total: ${money(totalSales)}<br>
      VAT: ${money(vat)}
    `;
  } catch (err) {
    console.error('Load summary error:', err);
  }
}

/* =====================================================
   HARDWARE DRAWER
===================================================== */
function openPhysicalDrawer() {
  // Open physical cash drawer
}
function lockPOS(lock) {

  const barcodeInput = document.getElementById("posBarcodeInput");
  const addBtn = document.querySelector(".pos-left button");
  const payment = document.getElementById("paymentMethod");
  const cash = document.getElementById("cashGiven");
  const complete = document.querySelector(".complete-btn");
  const clear = document.querySelector(".clear-btn");

  if (barcodeInput) barcodeInput.disabled = lock;
  if (addBtn) addBtn.disabled = lock;
  if (payment) payment.disabled = lock;
  if (cash) cash.disabled = lock;
  if (complete) complete.disabled = lock;
  if (clear) clear.disabled = lock;
}
function showBalanceModal() {
  (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const { data, error } = await supabase
        .from('cash_drawer')
        .select('*')
        .eq('user_id', String(user?.id))
        .order('opened_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error getting drawer status:', error);
        alert("Error loading drawer status");
        return;
      }

      if (!data || data.length === 0 || data[0].status !== 'OPEN') {
        alert("No open drawer to balance.");
        return;
      }

      const drawer = data[0];

      // Calculate expected balance (opening + sales since drawer opened)
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total')
        .eq('payment_method', 'Cash')
        .eq('status', 'COMPLETED')
        .gte('created_at', drawer.opened_at);

      const salesTotal = sales ? sales.reduce((sum, s) => sum + Number(s.total || 0), 0) : 0;
      const expectedBalance = Number(drawer.opening_balance || 0) + salesTotal;

      document.getElementById("balanceModal").style.display = "flex";

      document.getElementById("balanceInfo").innerHTML = `
        <p><strong>Expected Balance:</strong> ${money(expectedBalance)}</p>
      `;

      document.getElementById("balanceResult").innerHTML = "";
    } catch (err) {
      console.error('Show balance modal error:', err);
      alert("Error loading drawer");
    }
  })();
}
function closeTill() {
  (async () => {
    try {
      const declaredInput = document.getElementById("declaredCash");
      if (!declaredInput) return;

      const declared = Number(declaredInput.value);

      if (isNaN(declared)) {
        alert("Enter counted cash amount.");
        return;
      }

      // Get current drawer ID
      const user = JSON.parse(localStorage.getItem("user"));
      const { data: drawerData, error: drawerError } = await supabase
        .from('cash_drawer')
        .select('*')
        .eq('user_id', String(user?.id))
        .order('opened_at', { ascending: false })
        .limit(1);

      if (drawerError || !drawerData || drawerData.length === 0) {
        alert("No open drawer found");
        return;
      }

      const drawer = drawerData[0];
      const drawerId = drawer.id;

      // Calculate expected balance (opening + sales since drawer opened)
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total')
        .eq('payment_method', 'Cash')
        .eq('status', 'COMPLETED')
        .gte('created_at', drawer.opened_at);

      const salesTotal = sales ? sales.reduce((sum, s) => sum + Number(s.total || 0), 0) : 0;
      const expectedBalance = Number(drawer.opening_balance || 0) + salesTotal;
      const declaredBalance = parseFloat(declared);
      const variance = expectedBalance - declaredBalance;

      balanceAttempts++;

      // CHECK: If till doesn't balance
      if (variance !== 0) {
        if (balanceAttempts < 3) {
          // Option A: Prevent closing (attempts 1-2)
          alert(`❌ TILL DOES NOT BALANCE\n\n` +
            `Expected: K ${formatMoney(expectedBalance)}\n` +
            `Declared: K ${formatMoney(declaredBalance)}\n` +
            `Variance: K ${formatMoney(Math.abs(variance))}\n\n` +
            `Attempt: ${balanceAttempts}/3\n` +
            `Please recount and try again.`);
          return;
        } else {
          // Option B: Allow closing on attempt 3 + post GL entry
          const allow = confirm(`⚠️ TILL VARIANCE - ATTEMPT 3\n\n` +
            `Expected: K ${formatMoney(expectedBalance)}\n` +
            `Declared: K ${formatMoney(declaredBalance)}\n` +
            `Variance: K ${formatMoney(Math.abs(variance))}\n\n` +
            `${variance > 0 ? 'SHORTAGE' : 'OVERAGE'}\n\n` +
            `Allow closing with variance GL entry?`);

          if (!allow) {
            return;
          }

          // POST GL ENTRY for till variance
          try {
            const context = getBranchContext();

            // Look up account IDs by account code
            const { data: accounts, error: accountError } = await withBranchFilter(
              supabase.from('chart_of_accounts').select('id, account_code')
            )
              .in('account_code', ['1000', '5200']);

            if (accountError) throw accountError;

            const cashAccount = accounts.find(a => a.account_code === '1000');
            const varianceAccount = accounts.find(a => a.account_code === '5200');

            if (!cashAccount || !varianceAccount) {
              throw new Error('Required accounts not found in chart of accounts (Cash: 1000, Till Variance: 5200)');
            }

            const journalRef = `TILL-VAR-${new Date().getTime()}`;
            const { data: journalData, error: journalError } = await supabase
              .from('journal_entries')
              .insert({
                branch_id: context.branch_id,
                reference: journalRef,
                description: `Till Variance: ${variance > 0 ? 'Shortage' : 'Overage'} K ${formatMoney(Math.abs(variance))}`
              })
              .select();

            if (journalError) throw journalError;

            const journalId = journalData[0].id;

            // Debit/Credit based on variance
            if (variance > 0) {
              // SHORTAGE: Debit Till Variance Expense, credit Cash
              await window.supabase.from('journal_lines').insert([
                { journal_id: journalId, account_id: varianceAccount.id, debit: Math.abs(variance), branch_id: context.branch_id },
                { journal_id: journalId, account_id: cashAccount.id, credit: Math.abs(variance), branch_id: context.branch_id }
              ]);
            } else {
              // OVERAGE: Debit Cash, credit Till Variance Expense
              await window.supabase.from('journal_lines').insert([
                { journal_id: journalId, account_id: cashAccount.id, debit: Math.abs(variance), branch_id: context.branch_id },
                { journal_id: journalId, account_id: varianceAccount.id, credit: Math.abs(variance), branch_id: context.branch_id }
              ]);
            }

            console.log('✅ Till variance GL entry posted:', journalRef);
          } catch (err) {
            console.error('Error posting till variance GL:', err);
            alert('Warning: Could not post GL entry - ' + err.message + '\n\nBut drawer is being closed');
          }
        }
      }

      // Reset attempts for next drawer
      balanceAttempts = 0;

      // Close drawer - update status to CLOSED
      const { error: closeError } = await supabase
        .from('cash_drawer')
        .update({
          status: 'CLOSED',
          declared_balance: declaredBalance,
          closed_at: new Date().toISOString()
        })
        .eq('id', drawerId);

      if (closeError) {
        alert(closeError.message || "Failed to close drawer");
        return;
      }

      // Hide modal
      document.getElementById("balanceModal").style.display = "none";

      // Reset input
      declaredInput.value = "";

      // Force lock POS
      drawerIsOpen = false;
      lockPOS(true);

      // Refresh UI
      checkDrawerStatus();
      loadSummary();

      alert("Drawer successfully closed.");
    } catch (err) {
      console.error('Close till error:', err);
      alert("Error closing drawer.");
    }
  })();
}

/* =====================================================
   CLEAR SALE
===================================================== */
function clearSale() {
  // Completely reset all sale state
  cart = [];
  lastSaleData = null;

  // Clear all form inputs
  document.getElementById("posBarcodeInput").value = "";
  document.getElementById("cashGiven").value = "";
  document.getElementById("changeDisplay").innerText = "Change: K 0.00";

  // Hide receipt and balance modals
  document.getElementById("receiptActions").style.display = "none";
  document.getElementById("receiptPreview").style.display = "none";
  document.getElementById("balanceModal").style.display = "none";

  // Re-render cart and reset UI
  renderCart();
  updatePaymentUI();

  // Return focus to barcode input
  document.getElementById("posBarcodeInput").focus();
}

function updateSalesCount(count) {
  const el = document.getElementById("salesCount");
  if (el) el.innerText = `(${count} sales)`;
}

/* =====================================================
   REPRINT RECEIPT
===================================================== */
function reprintReceipt() {
  if (!lastSaleData) {
    alert("No receipt to reprint.");
    return;
  }
  printReceiptPreview();
}

function reprintSaleReceipt(saleId) {
  console.log('🖨️ Reprinting sale:', saleId);

  (async () => {
    try {
      // Get sale details
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError || !sale) {
        alert("Sale not found");
        return;
      }

      // Get sale items
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_id,quantity,price,products(name)')
        .eq('sale_id', saleId);

      if (itemsError) {
        console.error('Error loading sale items:', itemsError);
        alert("Failed to load sale items");
        return;
      }

      lastSaleData = {
        sale_id: sale.id,
        total: Number(sale.total),
        items: (items || []).map(i => ({
          id: i.product_id,
          name: i.products?.name || 'Unknown',
          price: Number(i.price),
          quantity: i.quantity
        })),
        cashGiven: 0,
        change: 0
      };

      console.log('✅ Sale data loaded for reprint');
      printReceiptPreview();
    } catch (err) {
      console.error('❌ Reprint error:', err);
      alert("Error loading sale for reprint");
    }
  })();
}

/* =====================================================
   REVERSE SALE TRANSACTION
===================================================== */
function reverseSaleTransaction(saleId) {
  console.log('↩️ Reversing sale:', saleId);

  const confirmed = confirm(`Are you sure you want to reverse Sale #${saleId}? This cannot be undone.`);
  if (!confirmed) return;

  (async () => {
    try {
      console.log('📤 Calling RPC: reverse_sale');

      const { data, error } = await window.supabase.rpc('reverse_sale', {
        p_sale_id: saleId
      });

      console.log('📥 RPC Response:', { data, error });

      if (error) {
        console.error('❌ RPC Error:', error);
        alert(`Reversal failed: ${error.message || "Unknown error"}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned');
        alert("Reversal failed - no response");
        return;
      }

      console.log('✅ Reversal successful:', data[0]);
      alert(`✅ Sale #${saleId} has been reversed successfully.\n\nInventory and accounting entries have been reversed.`);

      // Refresh the UI
      loadSales();
      loadSummary();
      checkDrawerStatus();
    } catch (err) {
      console.error('❌ Reversal error:', err);
      alert(`Error: ${err.message}`);
    }
  })();
}

function requestReverse(saleId) {
  const reason = prompt("Enter reason for reversal:");
  if (!reason) return;
  reverseSaleTransaction(saleId);
}