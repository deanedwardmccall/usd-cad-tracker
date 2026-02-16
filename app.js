let currentRate = 0;
let previousRate = 0;
let chart = null;
let historicalData = [];

function initChart(ctx) {
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'USD/CAD',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(4);
                        }
                    }
                }
            }
        }
    });
    return chart;
}

async function fetchRate() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('loading');
    btn.textContent = 'Updating...';

    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();

        previousRate = currentRate;
        currentRate = data.rates.CAD;

        updateDisplay();
        updateChart();
        updateConverter();

        document.getElementById('lastUpdate').textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Error fetching rate:', error);
        alert('Failed to fetch exchange rate. Please try again.');
    } finally {
        btn.classList.remove('loading');
        btn.textContent = 'Refresh Rate';
    }
}

function updateDisplay() {
    document.getElementById('currentRate').textContent = currentRate.toFixed(4);

    if (previousRate > 0) {
        const change = currentRate - previousRate;
        const changePercent = ((change / previousRate) * 100).toFixed(2);
        const changeDisplay = document.getElementById('changeDisplay');

        if (change > 0) {
            changeDisplay.className = 'change positive';
            changeDisplay.textContent = `▲ +${change.toFixed(4)} (+${changePercent}%)`;
        } else if (change < 0) {
            changeDisplay.className = 'change negative';
            changeDisplay.textContent = `▼ ${change.toFixed(4)} (${changePercent}%)`;
        } else {
            changeDisplay.className = 'change';
            changeDisplay.textContent = '— No change';
        }
    }

    // Simulate 24h high/low (in real app, you'd get this from API)
    const variance = 0.01;
    document.getElementById('high24h').textContent =
        (currentRate * (1 + variance)).toFixed(4);
    document.getElementById('low24h').textContent =
        (currentRate * (1 - variance)).toFixed(4);
}

function updateChart() {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    historicalData.push({
        time: timeLabel,
        rate: currentRate
    });

    // Keep only last 20 data points
    if (historicalData.length > 20) {
        historicalData.shift();
    }

    chart.data.labels = historicalData.map(d => d.time);
    chart.data.datasets[0].data = historicalData.map(d => d.rate);
    chart.update();
}

function updateConverter() {
    const usdInput = document.getElementById('usdInput');
    const cadInput = document.getElementById('cadInput');

    usdInput.addEventListener('input', () => {
        const usd = parseFloat(usdInput.value) || 0;
        cadInput.value = (usd * currentRate).toFixed(2);
    });

    // Initial conversion
    cadInput.value = (parseFloat(usdInput.value) * currentRate).toFixed(2);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getState: () => ({ currentRate, previousRate, chart, historicalData }),
        setState: (state) => {
            if (state.currentRate !== undefined) currentRate = state.currentRate;
            if (state.previousRate !== undefined) previousRate = state.previousRate;
            if (state.chart !== undefined) chart = state.chart;
            if (state.historicalData !== undefined) historicalData = state.historicalData;
        },
        initChart,
        fetchRate,
        updateDisplay,
        updateChart,
        updateConverter
    };
}
