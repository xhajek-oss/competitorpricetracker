// Main Application Controller

var refreshInterval = null;

/**
 * Initialize the app on page load
 */
function init() {
  // Load initial product list
  renderProducts();

  // Set up event listeners
  setupEventListeners();

  // Auto-refresh every 60 seconds
  refreshInterval = setInterval(function () {
    var productsView = document.getElementById('view-products');
    if (productsView.classList.contains('active')) {
      renderProducts();
    }
  }, 60000);
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Add product button -> open modal
  document.getElementById('btn-add-product').addEventListener('click', function () {
    document.getElementById('form-add-product').reset();
    openModal('modal-add-product');
  });

  // Back button -> return to product list
  document.getElementById('btn-back').addEventListener('click', function () {
    destroyPriceChart();
    switchView('view-products');
    renderProducts();
  });

  // Add product form submission
  document
    .getElementById('form-add-product')
    .addEventListener('submit', handleAddProduct);

  // Alert form submission
  document.getElementById('form-alert').addEventListener('submit', handleAlertSubmit);

  // Alert type changes threshold visibility
  document
    .getElementById('alert-type')
    .addEventListener('change', updateAlertThresholdVisibility);

  // Close modal on backdrop click
  document.querySelectorAll('.modal').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(function (modal) {
        closeModal(modal.id);
      });
    }
  });
}

/**
 * Handle add product form submission
 */
async function handleAddProduct(e) {
  e.preventDefault();

  var url = document.getElementById('product-url').value.trim();
  var name = document.getElementById('product-name').value.trim();
  var interval = parseInt(document.getElementById('check-interval').value, 10);

  if (!url) {
    showToast('Please enter a product URL', 'error');
    return;
  }

  var submitBtn = document.getElementById('btn-submit-product');
  var btnText = submitBtn.querySelector('.btn-text');
  var btnLoading = submitBtn.querySelector('.btn-loading');

  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';

  try {
    var data = { url: url, check_interval: interval };
    if (name) data.name = name;

    await addProduct(data);
    closeModal('modal-add-product');
    showToast('Product added! Initial price has been scraped.', 'success');
    renderProducts();
  } catch (err) {
    showToast('Failed to add product: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

/**
 * Switch between views
 */
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(function (view) {
    view.classList.remove('active');
  });
  var target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

/**
 * Show a toast notification
 */
function showToast(message, type) {
  if (!type) type = 'info';

  var container = document.getElementById('toast-container');

  var icons = {
    success: '\u2705',
    error: '\u274C',
    info: '\u2139\uFE0F',
  };

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML =
    '<span class="toast-icon">' +
    (icons[type] || icons.info) +
    '</span>' +
    '<span class="toast-message">' +
    escapeHtml(message) +
    '</span>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';

  container.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(function () {
    if (toast.parentElement) {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards';
      setTimeout(function () {
        if (toast.parentElement) toast.remove();
      }, 300);
    }
  }, 4000);
}

/**
 * Open a modal
 */
function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    // Focus first input
    var firstInput = modal.querySelector('input:not([type="hidden"]), select');
    if (firstInput) {
      setTimeout(function () {
        firstInput.focus();
      }, 100);
    }
  }
}

/**
 * Close a modal
 */
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

/**
 * Format a price with currency symbol
 */
function formatPrice(price, currency) {
  if (price === null || price === undefined) return 'N/A';
  var symbol = '\u20AC';
  if (currency === 'USD' || currency === '$') symbol = '$';
  else if (currency === 'GBP' || currency === '\u00A3') symbol = '\u00A3';
  else if (currency && currency !== 'EUR' && currency !== '\u20AC') symbol = currency;
  return symbol + price.toFixed(2);
}

/**
 * Format a date string as relative time
 */
function formatTimeAgo(dateString) {
  var now = new Date();
  var date = new Date(dateString);
  var seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return date.toLocaleDateString('de-DE');
}

/**
 * Format a shop type badge
 */
function formatShopBadge(shopType) {
  var classes = {
    amazon: 'shop-badge-amazon',
    ebay: 'shop-badge-ebay',
    shopify: 'shop-badge-shopify',
    generic: 'shop-badge-generic',
  };
  var badgeClass = classes[shopType] || classes.generic;
  var label = shopType
    ? shopType.charAt(0).toUpperCase() + shopType.slice(1)
    : 'Generic';
  return '<span class="shop-badge ' + badgeClass + '">' + label + '</span>';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
