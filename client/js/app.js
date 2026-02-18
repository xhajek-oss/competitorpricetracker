// Main Application Controller

var refreshInterval = null;

/**
 * Initialize the app on page load
 */
async function init() {
  // Apply saved theme
  applyTheme();

  // Set up event listeners (including login form)
  setupEventListeners();

  // Check if API requires authentication
  try {
    var headers = {};
    if (getApiKey()) headers['X-API-Key'] = getApiKey();
    var response = await fetch('/api/auth/check', { headers: headers });
    var result = await response.json();
    var authData = result.data || {};
    if (authData.auth_required && !authData.authenticated) {
      showLoginModal();
      return;
    }
  } catch (_) {
    // Auth check failed — proceed anyway (server may not require auth)
  }

  // Load initial product list
  renderProducts();

  // Auto-refresh every 60 seconds
  refreshInterval = setInterval(function () {
    var productsView = document.getElementById('view-products');
    if (productsView.classList.contains('active')) {
      renderProducts();
    }
  }, 60000);
}

/**
 * Start the app after successful auth
 */
function startApp() {
  renderProducts();
  if (!refreshInterval) {
    refreshInterval = setInterval(function () {
      var productsView = document.getElementById('view-products');
      if (productsView.classList.contains('active')) {
        renderProducts();
      }
    }, 60000);
  }
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
        // Don't allow closing login modal with Escape
        if (modal.id === 'modal-login') return;
        closeModal(modal.id);
      });
    }
  });

  // CSV import handlers
  setupImportHandlers();

  // Login form submission
  document.getElementById('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    var key = document.getElementById('login-api-key').value.trim();
    if (!key) return;

    setApiKey(key);

    try {
      var response = await fetch('/api/auth/check', {
        headers: { 'X-API-Key': key },
      });
      var result = await response.json();
      var authData = result.data || {};
      if (authData.authenticated) {
        closeModal('modal-login');
        showToast('Authenticated successfully', 'success');
        startApp();
      } else {
        clearApiKey();
        showToast('Invalid API key', 'error');
      }
    } catch (_) {
      clearApiKey();
      showToast('Authentication failed', 'error');
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
  if (!dateString) return 'Never';
  var now = new Date();
  // SQLite stores dates without timezone — treat as UTC
  var normalized = dateString.replace(' ', 'T');
  if (!normalized.endsWith('Z') && !normalized.includes('+')) normalized += 'Z';
  var date = new Date(normalized);
  if (isNaN(date.getTime())) return dateString;
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
  return '<span class="shop-badge ' + badgeClass + '">' + escapeHtml(label) + '</span>';
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

/**
 * Export price history as CSV
 */
async function exportPricesCsv(productId, productName) {
  try {
    var prices = await getProductPrices(productId, { limit: 1000 });
    if (!prices || prices.length === 0) {
      showToast('No price data to export', 'info');
      return;
    }

    var csv = 'Date,Price,Currency\n';
    for (var i = 0; i < prices.length; i++) {
      var p = prices[i];
      var date = p.checked_at.replace(' ', 'T');
      if (!date.endsWith('Z') && !date.includes('+')) date += 'Z';
      csv += new Date(date).toISOString() + ',' + p.price.toFixed(2) + ',' + (p.currency || 'EUR') + '\n';
    }

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    var safeName = (productName || 'product').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    link.download = 'prices_' + safeName + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('CSV exported (' + prices.length + ' records)', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

/**
 * Comparison chart — multi-product overlay
 */
var compareChart = null;
var compareSelectedIds = [];
var compareProducts = [];

var COMPARE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

async function showCompareView() {
  switchView('view-compare');

  var container = document.getElementById('compare-container');
  container.innerHTML =
    '<div class="loading-overlay"><span class="spinner spinner-dark"></span> Loading products...</div>';

  try {
    compareProducts = await getProducts();
    compareSelectedIds = [];

    if (!compareProducts || compareProducts.length < 2) {
      container.innerHTML =
        '<p class="text-muted" style="padding:24px; text-align:center;">You need at least 2 products to compare prices.</p>';
      return;
    }

    renderCompareUI();
  } catch (err) {
    container.innerHTML =
      '<div class="loading-overlay text-danger">Failed to load products: ' +
      escapeHtml(err.message) +
      '</div>';
  }
}

function renderCompareUI() {
  var container = document.getElementById('compare-container');

  var html = '<div class="compare-select-area">';
  for (var i = 0; i < compareProducts.length; i++) {
    var p = compareProducts[i];
    var name = p.name || 'Unnamed';
    if (name.length > 30) name = name.substring(0, 27) + '...';
    var color = COMPARE_COLORS[i % COMPARE_COLORS.length];
    var selected = compareSelectedIds.indexOf(p.id) !== -1;
    html +=
      '<div class="compare-chip' +
      (selected ? ' selected' : '') +
      '" onclick="toggleCompareProduct(' +
      p.id +
      ')" data-compare-id="' +
      p.id +
      '">' +
      '<span class="chip-dot" style="background:' +
      color +
      '"></span>' +
      escapeHtml(name) +
      '</div>';
  }
  html += '</div>';

  html +=
    '<div class="compare-chart-container">' +
    '  <canvas id="compare-chart"></canvas>' +
    '  <div id="compare-empty" class="compare-empty">Select 2 or more products to compare</div>' +
    '</div>';

  container.innerHTML = html;
}

function toggleCompareProduct(productId) {
  var idx = compareSelectedIds.indexOf(productId);
  if (idx === -1) {
    compareSelectedIds.push(productId);
  } else {
    compareSelectedIds.splice(idx, 1);
  }

  // Update chip styling
  var chips = document.querySelectorAll('.compare-chip');
  chips.forEach(function (chip) {
    var id = parseInt(chip.getAttribute('data-compare-id'), 10);
    if (compareSelectedIds.indexOf(id) !== -1) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });

  updateCompareChart();
}

async function updateCompareChart() {
  var emptyEl = document.getElementById('compare-empty');
  var canvas = document.getElementById('compare-chart');

  if (compareSelectedIds.length < 2) {
    if (compareChart) { compareChart.destroy(); compareChart = null; }
    if (emptyEl) emptyEl.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (canvas) canvas.style.display = 'block';

  var datasets = [];
  for (var i = 0; i < compareSelectedIds.length; i++) {
    var pid = compareSelectedIds[i];
    var product = compareProducts.find(function (p) { return p.id === pid; });
    if (!product) continue;

    try {
      var prices = await getProductPrices(pid, { limit: 100 });
      if (!prices || prices.length === 0) continue;

      var productIdx = compareProducts.indexOf(product);
      var color = COMPARE_COLORS[productIdx % COMPARE_COLORS.length];
      var name = product.name || 'Product #' + pid;
      if (name.length > 25) name = name.substring(0, 22) + '...';

      datasets.push({
        label: name,
        data: prices.map(function (p) {
          var raw = p.checked_at.replace(' ', 'T');
          if (!raw.endsWith('Z') && !raw.includes('+')) raw += 'Z';
          return { x: new Date(raw), y: p.price };
        }),
        borderColor: color,
        backgroundColor: color + '1A',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    } catch {
      // Skip products that fail to load prices
    }
  }

  if (compareChart) { compareChart.destroy(); }

  compareChart = new Chart(canvas, {
    type: 'line',
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2);
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'dd.MM.yyyy HH:mm' },
          ticks: { maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) { return value.toFixed(2); },
          },
        },
      },
    },
  });
}

/**
 * Dark mode toggle
 */
function applyTheme() {
  var saved = localStorage.getItem('cpt_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cpt_theme', next);
  var btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

/**
 * CSV Import
 */
function setupImportHandlers() {
  var fileInput = document.getElementById('import-file');
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var text = e.target.result;
        var lines = text.split('\n').filter(function (l) { return l.trim().length > 0; });
        var preview = document.getElementById('import-preview');
        var content = document.getElementById('import-preview-content');
        if (preview && content) {
          content.textContent = lines.length + ' line(s) found:\n' + lines.slice(0, 5).join('\n') +
            (lines.length > 5 ? '\n... and ' + (lines.length - 5) + ' more' : '');
          preview.style.display = 'block';
        }
      };
      reader.readAsText(file);
    });
  }

  var form = document.getElementById('form-import');
  if (form) {
    form.addEventListener('submit', handleCsvImport);
  }
}

async function handleCsvImport(e) {
  e.preventDefault();
  var fileInput = document.getElementById('import-file');
  var file = fileInput.files[0];
  if (!file) {
    showToast('Please select a CSV file', 'error');
    return;
  }

  var submitBtn = document.getElementById('btn-submit-import');
  var btnText = submitBtn.querySelector('.btn-text');
  var btnLoading = submitBtn.querySelector('.btn-loading');
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';

  try {
    var text = await file.text();
    var result = await apiRequest('POST', '/products/import', { csv: text });
    closeModal('modal-import');
    showToast('Imported ' + result.imported + ' product(s)' +
      (result.failed > 0 ? ' (' + result.failed + ' failed)' : ''), 'success');
    renderProducts();
  } catch (err) {
    showToast('Import failed: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
