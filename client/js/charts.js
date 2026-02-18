// Price History Charts using Chart.js

let priceChart = null;

function createPriceChart(canvasId, priceData, currency) {
  if (!currency) currency = '\u20AC';
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing chart
  if (priceChart) {
    priceChart.destroy();
  }

  var labels = priceData.map(function (p) {
    // SQLite dates have no timezone — treat as UTC
    var raw = p.checked_at.replace(' ', 'T');
    if (!raw.endsWith('Z') && !raw.includes('+')) raw += 'Z';
    var date = new Date(raw);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  var prices = priceData.map(function (p) {
    return p.price;
  });

  priceChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Price (' + currency + ')',
          data: prices,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return currency + ctx.parsed.y.toFixed(2);
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return currency + value.toFixed(2);
            },
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
            maxTicksLimit: 10,
          },
        },
      },
    },
  });
}

function destroyPriceChart() {
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }
}
