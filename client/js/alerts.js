// Alert Management UI

/**
 * Render alerts for a product into a container
 */
async function renderAlerts(productId, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML =
    '<div class="loading-overlay"><span class="spinner spinner-dark"></span> Loading alerts...</div>';

  try {
    var alerts = await getAlerts(productId);

    if (!alerts || alerts.length === 0) {
      container.innerHTML =
        '<p class="text-muted" style="padding: 16px 0;">No alerts configured. <a href="#" onclick="showAlertModal(' +
        productId +
        '); return false;">Add one</a></p>';
      return;
    }

    var html = '<div class="alert-list">';
    for (var i = 0; i < alerts.length; i++) {
      html += renderAlertItem(alerts[i]);
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML =
      '<p class="text-danger">Failed to load alerts: ' +
      escapeHtml(err.message) +
      '</p>';
  }
}

/**
 * Render a single alert item
 */
function renderAlertItem(alert) {
  var typeLabel = getAlertTypeLabel(alert.alert_type);
  var detail = getAlertDetail(alert);

  return (
    '<div class="alert-item" data-alert-id="' +
    alert.id +
    '">' +
    '  <div class="alert-item-info">' +
    '    <div class="alert-item-type">' +
    escapeHtml(typeLabel) +
    '</div>' +
    '    <div class="alert-item-detail">' +
    escapeHtml(detail) +
    ' &middot; via ' +
    escapeHtml(alert.notification_method) +
    '</div>' +
    '  </div>' +
    '  <div class="alert-item-actions">' +
    '    <label class="toggle">' +
    '      <input type="checkbox" ' +
    (alert.is_active ? 'checked' : '') +
    ' onchange="toggleAlert(' +
    alert.id +
    ', this.checked)">' +
    '      <span class="toggle-slider"></span>' +
    '    </label>' +
    '    <button class="btn btn-ghost btn-sm" onclick="confirmDeleteAlert(' +
    alert.id +
    ', ' +
    alert.product_id +
    ')">Delete</button>' +
    '  </div>' +
    '</div>'
  );
}

/**
 * Get human-readable alert type label
 */
function getAlertTypeLabel(type) {
  switch (type) {
    case 'price_change_any':
      return 'Any price change';
    case 'price_drop_percent':
      return 'Price drop (%)';
    case 'price_below':
      return 'Price below threshold';
    default:
      return type;
  }
}

/**
 * Get detail text for an alert
 */
function getAlertDetail(alert) {
  switch (alert.alert_type) {
    case 'price_change_any':
      return 'Triggers on any price change';
    case 'price_drop_percent':
      return 'Triggers when price drops by ' + (alert.threshold_percent || 0) + '%';
    case 'price_below':
      return (
        'Triggers when price falls below \u20AC' +
        (alert.threshold_price ? alert.threshold_price.toFixed(2) : '0.00')
      );
    default:
      return '';
  }
}

/**
 * Open the alert creation modal for a product
 */
function showAlertModal(productId) {
  document.getElementById('alert-product-id').value = productId;
  document.getElementById('form-alert').reset();
  document.getElementById('alert-product-id').value = productId;
  updateAlertThresholdVisibility();
  openModal('modal-alert');
}

/**
 * Show/hide threshold inputs based on alert type selection
 */
function updateAlertThresholdVisibility() {
  var type = document.getElementById('alert-type').value;
  document.getElementById('group-threshold-percent').style.display =
    type === 'price_drop_percent' ? 'block' : 'none';
  document.getElementById('group-threshold-price').style.display =
    type === 'price_below' ? 'block' : 'none';
}

/**
 * Toggle alert active/inactive
 */
async function toggleAlert(alertId, isActive) {
  try {
    await updateAlert(alertId, { is_active: isActive });
    showToast(isActive ? 'Alert enabled' : 'Alert paused', 'success');
  } catch (err) {
    showToast('Failed to update alert: ' + err.message, 'error');
  }
}

/**
 * Delete alert with confirmation
 */
async function confirmDeleteAlert(alertId, productId) {
  if (!confirm('Delete this alert? This cannot be undone.')) return;

  try {
    await deleteAlert(alertId);
    showToast('Alert deleted', 'success');
    renderAlerts(productId, 'detail-alerts');
  } catch (err) {
    showToast('Failed to delete alert: ' + err.message, 'error');
  }
}

/**
 * Handle alert form submission
 */
async function handleAlertSubmit(e) {
  e.preventDefault();

  var productId = parseInt(document.getElementById('alert-product-id').value, 10);
  var alertType = document.getElementById('alert-type').value;
  var method = document.getElementById('alert-method').value;

  var data = {
    product_id: productId,
    alert_type: alertType,
    notification_method: method,
  };

  if (alertType === 'price_drop_percent') {
    data.threshold_percent = parseInt(
      document.getElementById('alert-threshold-percent').value,
      10
    );
  } else if (alertType === 'price_below') {
    data.threshold_price = parseFloat(
      document.getElementById('alert-threshold-price').value
    );
  }

  try {
    await createAlert(data);
    closeModal('modal-alert');
    showToast('Alert created', 'success');
    renderAlerts(productId, 'detail-alerts');
  } catch (err) {
    showToast('Failed to create alert: ' + err.message, 'error');
  }
}
