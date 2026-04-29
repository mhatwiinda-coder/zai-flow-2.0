// Supabase client initialized in supabase-init.js

let editId = null;
let quaggaInitialized = false;
let allProducts = [];

/* =====================================================
   INITIALIZE PAGE
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initInventory();
});

function initInventory() {
  loadInventoryMetrics();
  loadProducts();
  loadMovements();
  setupEventListeners();
}

/* =====================================================
   QUAGGA2 BARCODE SCANNER
===================================================== */

function toggleCamera() {
  const scanner = document.getElementById("scanner");
  const btn = document.getElementById("cameraBtn");
  const input = document.getElementById("barcodeInput");

  if (scanner.style.display === "none") {
    scanner.style.display = "block";
    input.style.display = "none";
    btn.innerText = "Stop Camera";
    startCamera();
  } else {
    scanner.style.display = "none";
    btn.innerText = "Start Camera";
    stopCamera();
    input.style.display = "block";
  }
}

function toggleManualEntry() {
  const input = document.getElementById("barcodeInput");
  const scanner = document.getElementById("scanner");
  const btn = document.getElementById("cameraBtn");

  if (input.style.display === "none") {
    input.style.display = "block";
    scanner.style.display = "none";
    btn.innerText = "Start Camera";
    stopCamera();
    input.focus();
  } else {
    input.style.display = "none";
    startCamera();
    btn.innerText = "Stop Camera";
    scanner.style.display = "block";
  }
}

function startCamera() {
  if (quaggaInitialized) return;

  try {
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          facingMode: "environment"
        },
        target: document.getElementById("scanner")
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
        document.getElementById("barcodeInput").style.display = "block";
        document.getElementById("scanner").style.display = "none";
        alert("Camera access denied. Using manual entry instead.");
        return;
      }
      Quagga.start();
      quaggaInitialized = true;

      Quagga.onDetected(function(data) {
        const barcode = data.codeResult.code;
        handleBarcodeScan(barcode);
      });
    });
  } catch (err) {
    console.error("Camera init error:", err);
    alert("Camera not available. Please use manual entry.");
  }
}

function stopCamera() {
  if (!quaggaInitialized) return;
  try {
    Quagga.stop();
    quaggaInitialized = false;
  } catch (err) {
    console.error("Camera stop error:", err);
  }
}

function handleBarcodeScan(barcode) {
  const input = document.getElementById("barcodeInput");
  input.value = barcode;
  handleBarcodeLookup(barcode);
}

function handleBarcodeLookup(barcode) {
  if (!barcode) return;

  (async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .or(`barcode.eq.${barcode},sku.eq.${barcode},id.eq.${barcode}`)
        .single();

      if (error || !product) {
        document.getElementById("productPreview").style.display = "none";
        return;
      }

      displayProductPreview(product);
      // Auto-populate edit form when product is found
      populateLookupForm(product.id);
    } catch (err) {
      console.error("Lookup error:", err);
      document.getElementById("productPreview").style.display = "none";
    }
  })();
}

function displayProductPreview(product) {
  const preview = document.getElementById("productPreview");
  const stock = Number(product.stock || 0);

  preview.innerHTML = `
    <h4>📦 Product Found</h4>
    <div class="preview-content">
      <div><strong>Product:</strong> ${product.name || product.product_name || "-"}</div>
      <div><strong>Price:</strong> K ${Number(product.price || 0).toFixed(2)}</div>
      <div><strong>Stock:</strong> ${stock} units</div>
      <div><strong>SKU:</strong> ${product.sku || "-"}</div>
      <div><strong>Barcode:</strong> ${product.barcode || "-"}</div>
    </div>
  `;
  preview.style.display = "block";
}

function addToLookup() {
  const barcode = document.getElementById("barcodeInput").value;
  if (!barcode) return alert("No product scanned");

  const lookupKey = document.getElementById("lookupKey");
  lookupKey.value = barcode;
  lookupProduct();
}

/* =====================================================
   PRODUCT CATALOG (DROPDOWN)
===================================================== */

function loadProducts() {
  (async () => {
    try {
      const { data: products, error } = await withBranchFilter(
        supabase.from('products').select('*')
      )
        .order('id', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        return;
      }

      if (!Array.isArray(products)) return;

      allProducts = products;
      displayProducts(products);
      updateProductCount(products.length);
    } catch (err) {
      console.error("Load products error:", err);
    }
  })();
}

function displayProducts(products) {
  const grid = document.getElementById("productsGrid");

  if (products.length === 0) {
    grid.innerHTML = '<p class="no-data">No products found</p>';
    return;
  }

  let html = "";
  products.forEach(p => {
    const stock = Number(p.stock || 0);
    let statusColor = "#28c76f";
    if (stock === 0) statusColor = "#ff5b5b";
    else if (stock < 5) statusColor = "#ff9f43";

    html += `
      <div class="product-card">
        <div class="product-header">
          <h4>${p.name}</h4>
          <span class="stock-badge" style="background: ${statusColor};">
            ${stock} ${stock === 1 ? "unit" : "units"}
          </span>
        </div>
        <div class="product-details">
          <div><small>Price:</small> <strong>K${Number(p.price || 0).toFixed(2)}</strong></div>
          <div><small>Cost:</small> K${Number(p.cost_price || 0).toFixed(2)}</div>
          <div><small>SKU:</small> ${p.sku || "-"}</div>
          <div><small>Barcode:</small> ${p.barcode || "-"}</div>
        </div>
        <div class="product-actions">
          <button class="btn-secondary" onclick="populateLookupForm('${p.id}')">Edit</button>
          <button class="btn-danger" onclick="quickDeleteProduct('${p.id}')">Delete</button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function searchProducts() {
  const query = document.getElementById("productSearch").value.toLowerCase();

  const filtered = allProducts.filter(p => {
    const searchStr = `${p.name} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase();
    return searchStr.includes(query);
  });

  displayProducts(filtered);
}

function updateProductCount(count) {
  const el = document.getElementById("productCount");
  if (el) el.innerText = `(${count} products)`;
}

/* =====================================================
   ADD PRODUCT
===================================================== */

function saveProduct() {
  (async () => {
    try {
      const name = document.getElementById("productName").value.trim();
      const price = Number(document.getElementById("productPrice").value);
      const cost = Number(document.getElementById("productCost").value);
      const quantity = Number(document.getElementById("productquantity").value);
      const barcode = document.getElementById("barcodeInputAdd").value.trim();

      if (!name || !price) return alert("Product name and price required");

      // Auto-generate SKU: Always generate as NAME-TIMESTAMP (not from barcode)
      // Format: AQU-1234 (first 3 letters of name + dash + 4 random digits)
      const namePrefix = name.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-4);
      const sku = namePrefix + "-" + timestamp;

      console.log("Saving product:", { name, price, cost, quantity, barcode, sku });

      // Try inserting - test if column is cost_price or cost
      const insertData = {
        name,
        barcode: barcode || null,
        sku: sku,
        price: price,
        stock: quantity || 0
      };

      // Add cost field - try cost_price first
      if (cost > 0) {
        insertData.cost_price = cost;
      }

      console.log("Insert data:", insertData);

      const { data, error } = await supabase
        .from('products')
        .insert([insertData]);

      if (error) {
        console.error("Insert error:", error);
        alert(error.message || "Failed to save product");
        return;
      }

      alert("Product saved successfully!\nSKU: " + sku);

      // Clear form
      document.getElementById("productName").value = "";
      document.getElementById("productPrice").value = "";
      document.getElementById("productCost").value = "";
      document.getElementById("productquantity").value = "";
      document.getElementById("barcodeInputAdd").value = "";

      // Reload both products list AND metrics immediately
      loadProducts();
      loadInventoryMetrics();
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving product: " + err.message);
    }
  })();
}

/* =====================================================
   LOOKUP / EDIT PRODUCT
===================================================== */

function lookupProduct() {
  (async () => {
    try {
      const key = document.getElementById("lookupKey").value.trim();

      if (!key) return alert("Enter SKU, barcode, or ID");

      console.log("Looking up product with key:", key);

      // Try multiple queries - first try by SKU, then barcode, then ID
      let product = null;
      let error = null;

      // Try SKU first
      const { data: skuResult, error: skuError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', key)
        .single();

      if (skuResult) {
        product = skuResult;
        console.log("Found by SKU:", product);
      } else {
        // Try barcode
        const { data: barcodeResult, error: barcodeError } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', key)
          .single();

        if (barcodeResult) {
          product = barcodeResult;
          console.log("Found by barcode:", product);
        } else {
          // Try ID (convert to number)
          const { data: idResult, error: idError } = await supabase
            .from('products')
            .select('*')
            .eq('id', Number(key))
            .single();

          if (idResult) {
            product = idResult;
            console.log("Found by ID:", product);
          }
        }
      }

      if (!product) {
        console.error("Product not found for key:", key);
        alert("Product not found. Try using the exact SKU, barcode, or numeric ID");
        return;
      }

      editId = product.id;
      populateEditForm(product);
    } catch (err) {
      console.error("Lookup error:", err);
      alert("Error looking up product: " + err.message);
    }
  })();
}

function populateLookupForm(productId) {
  console.log("Looking for product ID:", productId, "Type:", typeof productId);
  console.log("allProducts array has", allProducts.length, "products");

  const product = allProducts.find(p => {
    const match = p.id == productId;
    console.log("Checking:", p.id, "(type:", typeof p.id, ")", "==", productId, "->", match);
    return match;
  });

  if (!product) {
    console.error("Product not found in allProducts for ID:", productId);
    console.log("Available product IDs:", allProducts.map(p => p.id));
    alert("Product not found. Try using Lookup button with SKU/Barcode instead.");
    return;
  }

  console.log("Found product:", product);
  document.getElementById("lookupKey").value = product.sku || product.barcode || product.id;
  editId = product.id;
  populateEditForm(product);
}

function populateEditForm(product) {
  const editSection = document.getElementById("editSection");
  editSection.style.display = "block";

  document.getElementById("editName").value = product.name;
  document.getElementById("editBarcode").value = product.barcode || "";
  document.getElementById("editPrice").value = product.price;
  document.getElementById("editCost").value = product.cost_price || 0;
  document.getElementById("editStock").value = product.stock || 0;
  document.getElementById("editReason").value = "";

  // Scroll to edit section
  editSection.scrollIntoView({ behavior: "smooth" });
}

function updateProduct() {
  (async () => {
    try {
      if (!editId) return alert("Lookup a product first");

      const newStock = Number(document.getElementById("editStock").value);
      const reason = document.getElementById("editReason").value;

      // Get current product to know old stock for calculating movement
      const currentProduct = allProducts.find(p => p.id == editId);
      const oldStock = currentProduct ? Number(currentProduct.stock || 0) : 0;
      const stockDelta = newStock - oldStock;

      console.log("Stock update:", { oldStock, newStock, delta: stockDelta });

      // Update product basic info
      const updateData = {
        name: document.getElementById("editName").value,
        barcode: document.getElementById("editBarcode").value || null,
        price: Number(document.getElementById("editPrice").value),
        stock: newStock
      };

      // Add cost field
      const editCost = Number(document.getElementById("editCost").value);
      if (editCost > 0) {
        updateData.cost_price = editCost;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', editId);

      if (updateError) {
        console.error("Update error:", updateError);
        alert(updateError.message || "Failed to update product");
        return;
      }

      // Record inventory movement if stock changed
      if (reason && stockDelta !== 0) {
        const movementType = stockDelta > 0 ? 'IN' : 'OUT';
        const movementQuantity = Math.abs(stockDelta);

        console.log("Recording movement:", { type: movementType, quantity: movementQuantity, reason });

        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: editId,
            type: movementType,
            quantity: movementQuantity,
            reason: reason
          }]);

        if (movementError) {
          console.warn('Could not log movement:', movementError);
        }
      }

      alert("Product updated successfully");
      editId = null;
      document.getElementById("editSection").style.display = "none";
      loadProducts();
      loadInventoryMetrics();
      loadMovements();
    } catch (err) {
      console.error("Update error:", err);
      alert("Error updating product: " + err.message);
    }
  })();
}

function deleteProduct() {
  if (!editId) return alert("Lookup a product first");
  quickDeleteProduct(editId);
}

function quickDeleteProduct(productId) {
  if (!confirm("Delete this product permanently?")) return;

  (async () => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        alert(error.message || "Failed to delete product");
        return;
      }

      alert("Product deleted successfully");
      editId = null;
      document.getElementById("editSection").style.display = "none";
      loadProducts();
      loadMovements();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting product");
    }
  })();
}

/* =====================================================
   INVENTORY METRICS
===================================================== */

function loadInventoryMetrics() {
  (async () => {
    try {
      const { data: products, error } = await withBranchFilter(
        supabase.from('products').select('*')
      );

      if (error) {
        console.error('Error loading metrics:', error);
        return;
      }

      if (!Array.isArray(products)) return;

      const totalProducts = products.length;
      const lowStock = products.filter(p => Number(p.stock || 0) < 5).length;
      // Calculate inventory value AT COST (not selling price)
      const totalValue = products.reduce((sum, p) => sum + (Number(p.cost_price || 0) * Number(p.stock || 0)), 0);

      console.log("Metrics updated:", { totalProducts, lowStock, totalValue });
      document.getElementById("totalProducts").innerText = totalProducts;
      document.getElementById("lowStockAlert").innerText = lowStock;
      document.getElementById("inventoryTotalValue").innerText = Number(totalValue).toFixed(2);
    } catch (err) {
      console.error("Metrics error:", err);
    }
  })();
}

function loadMovements() {
  (async () => {
    try {
      const { data: movements, error } = await withBranchFilter(
        supabase.from('inventory_movements').select('*,products(name)')
      )
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Error loading movements:", error);
        return;
      }

      if (!Array.isArray(movements)) return;

      const today = new Date().toISOString().split('T')[0];
      const todayMovements = movements.filter(m => {
        const moveDate = new Date(m.created_at || m.timestamp).toISOString().split('T')[0];
        return moveDate === today;
      });

      let stockIn = 0;
      let stockOut = 0;

      todayMovements.forEach(m => {
        if (m.type === 'IN' || m.direction === 'in') stockIn += Number(m.quantity || 0);
        else if (m.type === 'OUT' || m.direction === 'out') stockOut += Number(m.quantity || 0);
      });

      document.getElementById("todayInCount").innerText = stockIn;
      document.getElementById("todayOutCount").innerText = stockOut;

      // Display movements log
      displayMovements(todayMovements);
    } catch (err) {
      console.warn("Movements load error:", err);
    }
  })();
}

function displayMovements(movements) {
  const log = document.getElementById("movementsLog");

  if (movements.length === 0) {
    log.innerHTML = '<p class="no-data">No movements today</p>';
    return;
  }

  let html = "";
  movements.forEach(m => {
    const type = (m.type || m.direction || "").toUpperCase();
    const nameField = m.product_name || m.name || "-";
    const quantity = Number(m.quantity || 0);
    const reason = m.reason || "Stock adjustment";
    const time = new Date(m.created_at || m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let color = "#00bcd4";
    let icon = "📦";
    if (type === 'IN') { color = "#28c76f"; icon = "📥"; }
    else if (type === 'OUT') { color = "#ff5b5b"; icon = "📤"; }

    html += `
      <div class="movement-item" style="border-left: 3px solid ${color};">
        <div class="movement-header">
          <span>${icon} ${type}</span>
          <span style="color: ${color}; font-weight: bold;">+${quantity}</span>
        </div>
        <div class="movement-body">
          <strong>${nameField}</strong><br>
          <small>${reason} • ${time}</small>
        </div>
      </div>
    `;
  });

  log.innerHTML = html;
}

/* =====================================================
   EVENT LISTENERS
===================================================== */

function setupEventListeners() {
  const lookupBtn = document.getElementById("lookupBtn");
  const saveBtn = document.getElementById("saveBtn");
  const updateBtn = document.getElementById("updateBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const productSearch = document.getElementById("productSearch");
  const barcodeInput = document.getElementById("barcodeInput");

  if (lookupBtn) lookupBtn.onclick = lookupProduct;
  if (saveBtn) saveBtn.onclick = saveProduct;
  if (updateBtn) updateBtn.onclick = updateProduct;
  if (deleteBtn) deleteBtn.onclick = deleteProduct;
  if (productSearch) productSearch.oninput = searchProducts;

  if (barcodeInput) {
    barcodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleBarcodeLookup(barcodeInput.value);
      }
    });
  }
}

/* =====================================================
   CLEANUP
===================================================== */

window.addEventListener("beforeunload", () => {
  stopCamera();
});
