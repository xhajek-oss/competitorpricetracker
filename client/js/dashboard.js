// Dashboard — Product List and Product Detail Views

/**
 * Fetch and render all products into the grid
 */
async function renderProducts() {
  var grid = document.getElementById('product-list');
  var emptyState = document.getElementById('empty-state');

  grid.innerHTML =
    '<div class="loading-overlay"><span class="spinner spinner-dark"></span> Loading products...</div>';
  emptyState.style.display = 'none';

  try {
    var products = await getProducts();

    if (!products || products.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    var html = '';
    for (var i = 0; i < products.length; i++) {
      html += renderProductCard(products[i]);
    }
    grid.innerHTML = html;
  } catch (err) {
    grid.innerHTML =
      '<div class="loading-overlay text-danger">Failed to load products: ' +
      escapeHtml(err.message) +
      '</div>';
  }
}

/**
 * Render a single product card
 */
function renderProductCard(product) {
  var name = product.name || 'Unnamed Product';
  if (name.length > 50) name = name.substring(0, 47) + '...';

  var price =
    product.current_price !== null
      ? formatPrice(product.current_price, product.currency)
      : 'No price yet';

  var urlDisplay = product.url;
  if (urlDisplay.length > 40) urlDisplay = urlDisplay.substring(0, 37) + '...';

  var lastChecked = product.last_checked_at
    ? formatTimeAgo(product.last_checked_at)
    : 'Never';

  var intervalLabel = 'Every ' + product.check_interval + 'h';

  var shopBadge = formatShopBadge(product.shop_type);

  var statusClass = product.is_active ? 'status-dot-active' : 'status-dot-paused';
  var statusLabel = product.is_active ? 'Active' : 'Paused';

  return (
    '<div class="product-card" onclick="showProductDetail(' +
    product.id +
    ')">' +
    '  <div class="product-card-header">' +
    '    <div class="product-card-name">' +
    escapeHtml(name) +
    '</div>' +
    '    ' +
    shopBadge +
    '  </div>' +
    '  <div class="product-card-price">' +
    escapeHtml(price) +
    '</div>' +
    '  <div class="product-card-url"><a href="' +
    escapeHtml(product.url) +
    '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' +
    escapeHtml(urlDisplay) +
    '</a></div>' +
    '  <div class="product-card-meta">' +
    '    <span class="status-dot ' +
    statusClass +
    '"></span> ' +
    escapeHtml(statusLabel) +
    '    <span>&middot;</span>' +
    '    <span>' +
    escapeHtml(intervalLabel) +
    '</span>' +
    '    <span>&middot;</span>' +
    '    <span>Checked ' +
    escapeHtml(lastChecked) +
    '</span>' +
    '  </div>' +
    '  <div class="product-card-actions">' +
    '    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); handleCheckNow(' +
    product.id +
    ', this)">Check Now</button>' +
    '    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); handleDeleteProduct(' +
    product.id +
    ', \'' +
    escapeHtml(name).replace(/'/g, "\\'") +
    '\')">Delete</button>' +
    '  </div>' +
    '</div>'
  );
}

/**
 * Show full product detail view
 */
async function showProductDetail(id) {
  switchView('view-detail');

  var container = document.getElementById('product-detail');
  container.innerHTML =
    '<div class="loading-overlay"><span class="spinner spinner-dark"></span> Loading product...</div>';

  try {
    var product = await getProduct(id);
    var prices = await getProductPrices(id, { limit: 100 });

    var name = product.name || 'Unnamed Product';
    var price =
      product.current_price !== null
        ? formatPrice(product.current_price, product.currency)
        : 'No price yet';
    var lastChecked = product.last_checked_at
      ? formatTimeAgo(product.last_checked_at)
      : 'Never';
    var shopBadge = formatShopBadge(product.shop_type);

    var html =
      '<div class="detail-header">' +
      '  <div class="detail-title">' +
      '    <h2>' +
      escapeHtml(name) +
      ' ' +
      shopBadge +
      '</h2>' +
      '    <div class="detail-url"><a href="' +
      escapeHtml(product.url) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(product.url) +
      '</a></div>' +
      '  </div>' +
      '  <div class="detail-price-block">' +
      '    <div class="detail-current-price">' +
      escapeHtml(price) +
      '</div>' +
      '    <div class="detail-last-checked">Last checked: ' +
      escapeHtml(lastChecked) +
      '</div>' +
      '  </div>' +
      '</div>';

    // Info cards
    html +=
      '<div class="info-grid">' +
      '  <div class="info-card">' +
      '    <div class="info-card-label">Status</div>' +
      '    <div class="info-card-value"><span class="status-dot ' +
      (product.is_active ? 'status-dot-active' : 'status-dot-paused') +
      '"></span> ' +
      (product.is_active ? 'Active' : 'Paused') +
      '</div>' +
      '  </div>' +
      '  <div class="info-card">' +
      '    <div class="info-card-label">Check Interval</div>' +
      '    <div class="info-card-value">Every ' +
      product.check_interval +
      ' hours</div>' +
      '  </div>' +
      '  <div class="info-card">' +
      '    <div class="info-card-label">Price Points</div>' +
      '    <div class="info-card-value">' +
      (prices ? prices.length : 0) +
      ' records</div>' +
      '  </div>' +
      '  <div class="info-card">' +
      '    <div class="info-card-label">Tracking Since</div>' +
      '    <div class="info-card-value">' +
      new Date(product.created_at).toLocaleDateString('de-DE') +
      '</div>' +
      '  </div>' +
      '</div>';

    // Actions
    html +=
      '<div class="detail-actions">' +
      '  <button class="btn btn-primary btn-sm" onclick="handleCheckNow(' +
      product.id +
      ', this)">Check Price Now</button>' +
      '  <button class="btn btn-ghost btn-sm" onclick="showAlertModal(' +
      product.id +
      ')">+ Add Alert</button>' +
      '  <button class="btn btn-ghost btn-sm" onclick="handleToggleActive(' +
      product.id +
      ', ' +
      !product.is_active +
      ')">' +
      (product.is_active ? 'Pause Tracking' : 'Resume Tracking') +
      '</button>' +
      '  <button class="btn btn-danger btn-sm" onclick="handleDeleteProduct(' +
      product.id +
      ', \'' +
      escapeHtml(name).replace(/'/g, "\\'") +
      '\')">Delete Product</button>' +
      '</div>';

    // Chart section
    html +=
      '<div class="detail-section">' +
      '  <h3>Price History</h3>' +
      '  <div class="chart-container">' +
      '    <canvas id="price-chart"></canvas>' +
      '  </div>' +
      '</div>';

    // Alerts section
    html +=
      '<div class="detail-section">' +
      '  <h3>Alerts</h3>' +
      '  <div id="detail-alerts"></div>' +
      '</div>';

    container.innerHTML = html;

    // Render chart
    if (prices && prices.length > 0) {
      createPriceChart('price-chart', prices, product.currency || '\u20AC');
    }

    // Render alerts
    renderAlerts(product.id, 'detail-alerts');
  } catch (err) {
    container.innerHTML =
      '<div class="loading-overlay text-danger">Failed to load product: ' +
      escapeHtml(err.message) +
      '</div>';
  }
}

/**
 * Trigger an immediate price check
 */
async function handleCheckNow(productId, btn) {
  var origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-dark"></span> Checking...';

  try {
    var result = await checkProductPrice(productId);
    if (result.changed) {
      showToast('Price updated! Check the new price.', 'success');
    } else {
      showToast('Price unchanged.', 'info');
    }
    // Refresh current view
    var detailView = document.getElementById('view-detail');
    if (detailView.classList.contains('active')) {
      showProductDetail(productId);
    } else {
      renderProducts();
    }
  } catch (err) {
    showToast('Price check failed: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

/**
 * Toggle product active/paused
 */
async function handleToggleActive(productId, isActive) {
  try {
    await updateProduct(productId, { is_active: isActive });
    showToast(isActive ? 'Tracking resumed' : 'Tracking paused', 'success');
    showProductDetail(productId);
  } catch (err) {
    showToast('Failed to update product: ' + err.message, 'error');
  }
}

/**
 * Delete a product with confirmation
 */
async function handleDeleteProduct(productId, name) {
  if (
    !confirm(
      'Delete "' + name + '" and all its price history? This cannot be undone.'
    )
  )
    return;

  try {
    await deleteProduct(productId);
    showToast('Product deleted', 'success');
    switchView('view-products');
    renderProducts();
  } catch (err) {
    showToast('Failed to delete product: ' + err.message, 'error');
  }
}
