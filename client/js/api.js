// API Client — talks to the backend REST API
const API_BASE = '/api';

function getApiKey() {
  return localStorage.getItem('cpt_api_key') || '';
}

function setApiKey(key) {
  localStorage.setItem('cpt_api_key', key);
}

function clearApiKey() {
  localStorage.removeItem('cpt_api_key');
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${path}`, options);

  if (response.status === 401) {
    clearApiKey();
    showLoginModal();
    throw new Error('Authentication required');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'An error occurred');
  }
  return data.data;
}

function showLoginModal() {
  var modal = document.getElementById('modal-login');
  if (modal) modal.classList.add('active');
}

// Products
const getProducts = () => apiRequest('GET', '/products');
const getProduct = (id) => apiRequest('GET', `/products/${id}`);
const addProduct = (data) => apiRequest('POST', '/products', data);
const updateProduct = (id, data) => apiRequest('PUT', `/products/${id}`, data);
const deleteProduct = (id) => apiRequest('DELETE', `/products/${id}`);

// Prices
const getProductPrices = (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiRequest('GET', `/products/${id}/prices${query ? '?' + query : ''}`);
};
const checkProductPrice = (id) => apiRequest('POST', `/products/${id}/check`);

// Alerts
const getAlerts = (productId = null) => {
  const query = productId ? `?product_id=${productId}` : '';
  return apiRequest('GET', `/alerts${query}`);
};
const createAlert = (data) => apiRequest('POST', '/alerts', data);
const updateAlert = (id, data) => apiRequest('PUT', `/alerts/${id}`, data);
const deleteAlert = (id) => apiRequest('DELETE', `/alerts/${id}`);

// Notifications
const getNotifications = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiRequest('GET', `/notifications${query ? '?' + query : ''}`);
};
