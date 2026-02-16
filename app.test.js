/**
 * @jest-environment jsdom
 */

// Mock Chart.js before requiring app
class MockChart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.data = { labels: [], datasets: [{ data: [] }] };
    }
    update() {}
    destroy() {}
}
global.Chart = MockChart;

// Mock canvas getContext since jsdom doesn't implement it
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({}));

// Set up DOM before requiring app
function setupDOM() {
    document.body.innerHTML = `
        <div class="rate-value" id="currentRate">Loading...</div>
        <div class="change" id="changeDisplay"></div>
        <div class="info-item-value" id="high24h">-</div>
        <div class="info-item-value" id="low24h">-</div>
        <input type="number" id="usdInput" value="100">
        <input type="number" id="cadInput" value="0" readonly>
        <button id="refreshBtn">Refresh Rate</button>
        <div id="lastUpdate">Last updated: Never</div>
        <canvas id="rateChart"></canvas>
    `;
}

let app;

beforeEach(() => {
    setupDOM();
    jest.resetModules();
    app = require('./app');
    // Reset state between tests
    app.setState({
        currentRate: 0,
        previousRate: 0,
        historicalData: [],
        chart: new MockChart(null, {})
    });
});

// ============================================================
// updateDisplay() - Calculation Logic Tests
// ============================================================
describe('updateDisplay', () => {
    test('displays current rate formatted to 4 decimal places', () => {
        app.setState({ currentRate: 1.3567 });
        app.updateDisplay();
        expect(document.getElementById('currentRate').textContent).toBe('1.3567');
    });

    test('formats rate with trailing zeros', () => {
        app.setState({ currentRate: 1.3 });
        app.updateDisplay();
        expect(document.getElementById('currentRate').textContent).toBe('1.3000');
    });

    test('shows positive change with green indicator when rate increases', () => {
        app.setState({ currentRate: 1.3600, previousRate: 1.3500 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        expect(changeDisplay.className).toBe('change positive');
        expect(changeDisplay.textContent).toContain('▲');
        expect(changeDisplay.textContent).toContain('+');
    });

    test('shows negative change with red indicator when rate decreases', () => {
        app.setState({ currentRate: 1.3400, previousRate: 1.3500 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        expect(changeDisplay.className).toBe('change negative');
        expect(changeDisplay.textContent).toContain('▼');
    });

    test('shows no change indicator when rate is unchanged', () => {
        app.setState({ currentRate: 1.3500, previousRate: 1.3500 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        expect(changeDisplay.className).toBe('change');
        expect(changeDisplay.textContent).toBe('— No change');
    });

    test('does not show change when previousRate is 0 (first load)', () => {
        app.setState({ currentRate: 1.3500, previousRate: 0 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        expect(changeDisplay.textContent).toBe('');
    });

    test('calculates correct change percentage', () => {
        app.setState({ currentRate: 1.3635, previousRate: 1.3500 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        // change = 0.0135, percent = (0.0135/1.35)*100 = 1.00%
        expect(changeDisplay.textContent).toContain('1.00%');
    });

    test('calculates correct negative change percentage', () => {
        app.setState({ currentRate: 1.3365, previousRate: 1.3500 });
        app.updateDisplay();
        const changeDisplay = document.getElementById('changeDisplay');
        // change = -0.0135, percent = (-0.0135/1.35)*100 = -1.00%
        expect(changeDisplay.textContent).toContain('-1.00%');
    });

    test('displays 24h high as currentRate * 1.01', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateDisplay();
        const expected = (1.3500 * 1.01).toFixed(4);
        expect(document.getElementById('high24h').textContent).toBe(expected);
    });

    test('displays 24h low as currentRate * 0.99', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateDisplay();
        const expected = (1.3500 * 0.99).toFixed(4);
        expect(document.getElementById('low24h').textContent).toBe(expected);
    });

    test('handles very small rate values', () => {
        app.setState({ currentRate: 0.0001 });
        app.updateDisplay();
        expect(document.getElementById('currentRate').textContent).toBe('0.0001');
    });

    test('handles large rate values', () => {
        app.setState({ currentRate: 100.5678 });
        app.updateDisplay();
        expect(document.getElementById('currentRate').textContent).toBe('100.5678');
    });
});

// ============================================================
// updateConverter() - Currency Conversion Tests
// ============================================================
describe('updateConverter', () => {
    test('performs initial conversion on call', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateConverter();
        const cadInput = document.getElementById('cadInput');
        // 100 * 1.35 = 135.00
        expect(cadInput.value).toBe('135.00');
    });

    test('converts USD to CAD on input event', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateConverter();

        const usdInput = document.getElementById('usdInput');
        const cadInput = document.getElementById('cadInput');

        usdInput.value = '200';
        usdInput.dispatchEvent(new Event('input'));
        // 200 * 1.35 = 270.00
        expect(cadInput.value).toBe('270.00');
    });

    test('handles zero USD input', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateConverter();

        const usdInput = document.getElementById('usdInput');
        const cadInput = document.getElementById('cadInput');

        usdInput.value = '0';
        usdInput.dispatchEvent(new Event('input'));
        expect(cadInput.value).toBe('0.00');
    });

    test('handles empty USD input (defaults to 0)', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateConverter();

        const usdInput = document.getElementById('usdInput');
        const cadInput = document.getElementById('cadInput');

        usdInput.value = '';
        usdInput.dispatchEvent(new Event('input'));
        expect(cadInput.value).toBe('0.00');
    });

    test('handles decimal USD input', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateConverter();

        const usdInput = document.getElementById('usdInput');
        const cadInput = document.getElementById('cadInput');

        usdInput.value = '99.99';
        usdInput.dispatchEvent(new Event('input'));
        expect(cadInput.value).toBe('134.99');
    });

    test('conversion with rate of 0 produces 0', () => {
        app.setState({ currentRate: 0 });
        app.updateConverter();
        expect(document.getElementById('cadInput').value).toBe('0.00');
    });
});

// ============================================================
// updateChart() - Chart Data Management Tests
// ============================================================
describe('updateChart', () => {
    test('adds data point to historicalData', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateChart();
        const state = app.getState();
        expect(state.historicalData).toHaveLength(1);
        expect(state.historicalData[0].rate).toBe(1.3500);
    });

    test('adds time label to each data point', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateChart();
        const state = app.getState();
        expect(state.historicalData[0].time).toBeDefined();
        expect(typeof state.historicalData[0].time).toBe('string');
    });

    test('accumulates multiple data points', () => {
        app.setState({ currentRate: 1.3500 });
        app.updateChart();
        app.setState({ currentRate: 1.3600 });
        app.updateChart();
        app.setState({ currentRate: 1.3700 });
        app.updateChart();
        const state = app.getState();
        expect(state.historicalData).toHaveLength(3);
    });

    test('caps historicalData at 20 entries', () => {
        for (let i = 0; i < 25; i++) {
            app.setState({ currentRate: 1.3500 + i * 0.001 });
            app.updateChart();
        }
        const state = app.getState();
        expect(state.historicalData).toHaveLength(20);
    });

    test('removes oldest entry when exceeding 20 points', () => {
        for (let i = 0; i < 21; i++) {
            app.setState({ currentRate: 1.0000 + i * 0.01 });
            app.updateChart();
        }
        const state = app.getState();
        // First entry (rate 1.0000) should be gone; second entry (rate 1.01) is now first
        expect(state.historicalData[0].rate).toBeCloseTo(1.01, 2);
    });

    test('updates chart labels from historicalData', () => {
        const mockChart = new MockChart(null, {});
        app.setState({ chart: mockChart, currentRate: 1.3500 });
        app.updateChart();
        expect(mockChart.data.labels).toHaveLength(1);
    });

    test('updates chart dataset from historicalData', () => {
        const mockChart = new MockChart(null, {});
        app.setState({ chart: mockChart, currentRate: 1.3500 });
        app.updateChart();
        expect(mockChart.data.datasets[0].data).toHaveLength(1);
        expect(mockChart.data.datasets[0].data[0]).toBe(1.3500);
    });
});

// ============================================================
// fetchRate() - API Integration Tests
// ============================================================
describe('fetchRate', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.alert = jest.fn();
    });

    afterEach(() => {
        console.error.mockRestore();
        delete global.alert;
    });

    test('updates currentRate from API response', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ rates: { CAD: 1.3567 } })
        });

        await app.fetchRate();
        expect(app.getState().currentRate).toBe(1.3567);
        global.fetch.mockRestore();
    });

    test('sets previousRate to old currentRate before updating', async () => {
        app.setState({ currentRate: 1.3400 });
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ rates: { CAD: 1.3567 } })
        });

        await app.fetchRate();
        expect(app.getState().previousRate).toBe(1.3400);
        expect(app.getState().currentRate).toBe(1.3567);
        global.fetch.mockRestore();
    });

    test('shows loading state on button during fetch', async () => {
        let resolvePromise;
        global.fetch = jest.fn().mockReturnValue(
            new Promise(resolve => { resolvePromise = resolve; })
        );

        const fetchPromise = app.fetchRate();
        const btn = document.getElementById('refreshBtn');

        expect(btn.classList.contains('loading')).toBe(true);
        expect(btn.textContent).toBe('Updating...');

        resolvePromise({ json: () => Promise.resolve({ rates: { CAD: 1.35 } }) });
        await fetchPromise;

        expect(btn.classList.contains('loading')).toBe(false);
        expect(btn.textContent).toBe('Refresh Rate');
        global.fetch.mockRestore();
    });

    test('restores button state after API error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        await app.fetchRate();
        const btn = document.getElementById('refreshBtn');

        expect(btn.classList.contains('loading')).toBe(false);
        expect(btn.textContent).toBe('Refresh Rate');
        global.fetch.mockRestore();
    });

    test('shows alert on API failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        await app.fetchRate();
        expect(global.alert).toHaveBeenCalledWith('Failed to fetch exchange rate. Please try again.');
        global.fetch.mockRestore();
    });

    test('logs error on API failure', async () => {
        const error = new Error('Network error');
        global.fetch = jest.fn().mockRejectedValue(error);

        await app.fetchRate();
        expect(console.error).toHaveBeenCalledWith('Error fetching rate:', error);
        global.fetch.mockRestore();
    });

    test('updates lastUpdate timestamp on success', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ rates: { CAD: 1.35 } })
        });

        await app.fetchRate();
        const lastUpdate = document.getElementById('lastUpdate').textContent;
        expect(lastUpdate).toContain('Last updated:');
        expect(lastUpdate).not.toContain('Never');
        global.fetch.mockRestore();
    });

    test('does not update lastUpdate on failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('fail'));

        await app.fetchRate();
        const lastUpdate = document.getElementById('lastUpdate').textContent;
        expect(lastUpdate).toBe('Last updated: Never');
        global.fetch.mockRestore();
    });

    test('calls the correct API endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ rates: { CAD: 1.35 } })
        });

        await app.fetchRate();
        expect(global.fetch).toHaveBeenCalledWith('https://api.exchangerate-api.com/v4/latest/USD');
        global.fetch.mockRestore();
    });
});

// ============================================================
// initChart() - Chart Initialization Tests
// ============================================================
describe('initChart', () => {
    test('creates a Chart instance', () => {
        const canvas = document.getElementById('rateChart');
        const ctx = canvas.getContext('2d');
        const result = app.initChart(ctx);
        expect(result).toBeInstanceOf(MockChart);
    });

    test('configures chart as line type', () => {
        const canvas = document.getElementById('rateChart');
        const ctx = canvas.getContext('2d');
        const result = app.initChart(ctx);
        expect(result.config.type).toBe('line');
    });
});

// ============================================================
// DOM and Event Handling Tests
// ============================================================
describe('DOM interactions', () => {
    test('refresh button exists in DOM', () => {
        const btn = document.getElementById('refreshBtn');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toBe('Refresh Rate');
    });

    test('USD input has default value of 100', () => {
        const usdInput = document.getElementById('usdInput');
        expect(usdInput.value).toBe('100');
    });

    test('CAD input is readonly', () => {
        const cadInput = document.getElementById('cadInput');
        expect(cadInput.readOnly).toBe(true);
    });

    test('currentRate element initially shows Loading...', () => {
        expect(document.getElementById('currentRate').textContent).toBe('Loading...');
    });
});

// ============================================================
// State Management Tests
// ============================================================
describe('state management', () => {
    test('getState returns current state', () => {
        const state = app.getState();
        expect(state).toHaveProperty('currentRate');
        expect(state).toHaveProperty('previousRate');
        expect(state).toHaveProperty('chart');
        expect(state).toHaveProperty('historicalData');
    });

    test('setState updates individual properties', () => {
        app.setState({ currentRate: 1.5 });
        expect(app.getState().currentRate).toBe(1.5);
        // Other properties unchanged
        expect(app.getState().previousRate).toBe(0);
    });

    test('setState can update multiple properties', () => {
        app.setState({ currentRate: 1.5, previousRate: 1.4 });
        expect(app.getState().currentRate).toBe(1.5);
        expect(app.getState().previousRate).toBe(1.4);
    });
});
