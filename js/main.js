// ═══════════════════════════════════════════════════════════
// BitcoinDC — Main Entry Point
// ═══════════════════════════════════════════════════════════

const DEBUG = false;

// ── Global Error Boundary ──────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
    console.error('[UnhandledRejection]', e.reason);
});

window.addEventListener('error', (e) => {
    console.error('[UncaughtError]', e.message, e.filename, e.lineno);
});

const BTC_API = {
    BASE: 'https://api.coingecko.com/api/v3',
    SIMPLE_PRICE: '/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
    COIN_DATA: '/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
};

// ── State ───────────────────────────────────────────────
let btcData = {
    price: null,
    change24h: null,
    marketCap: null,
    volume: null,
    supply: null,
    ath: null,
    high24h: null,
    low24h: null,
    dominance: null,
};

let _fetching = false;

// ── Fetch Bitcoin Data ─────────────────────────────────
async function fetchBitcoinData() {
    if (_fetching) return;
    _fetching = true;
    try {
        const [simpleData, coinData] = await Promise.all([
            Utils.apiFetch(BTC_API.BASE + BTC_API.SIMPLE_PRICE),
            Utils.apiFetch(BTC_API.BASE + BTC_API.COIN_DATA),
        ]);

        const btc = simpleData.bitcoin;
        btcData.price = btc.usd;
        btcData.change24h = btc.usd_24h_change;
        btcData.marketCap = btc.usd_market_cap;

        const marketData = coinData.market_data;
        btcData.volume = marketData.total_volume.usd;
        btcData.supply = marketData.circulating_supply;
        btcData.ath = marketData.ath.usd;
        btcData.high24h = marketData.high_24h.usd;
        btcData.low24h = marketData.low_24h.usd;
        btcData.dominance = marketData.market_cap_percentage?.btc ?? null;

        updateUI();
    } catch (err) {
        if (DEBUG) console.warn('[BitcoinDC] API fetch failed, using offline data:', err.message);
        Utils.showToast({ title: 'Offline Data', message: 'Could not reach CoinGecko API. Showing estimated data.', type: 'warning' });
        loadOfflineData();
    } finally {
        _fetching = false;
    }
}

function loadOfflineData() {
    btcData = {
        price: 67432.18,
        change24h: 2.34,
        marketCap: 1320000000000,
        volume: 42300000000,
        supply: 19700000,
        ath: 73750.07,
        high24h: 68123.45,
        low24h: 65987.32,
    };
    updateUI();
}

// ── Update UI ───────────────────────────────────────────
function updateUI() {
    const dashboard = document.getElementById('dashboard-content');

    // Hide loading, show content
    const loadingEl = document.getElementById('dashboard-loading');
    if (loadingEl) loadingEl.hidden = true;
    if (dashboard) dashboard.hidden = false;

    // Price
    const priceEl = document.getElementById('btc-price');
    if (priceEl) priceEl.textContent = Utils.formatPrice(btcData.price);

    // Change
    const changeEl = document.getElementById('btc-change');
    const changeValueEl = document.getElementById('btc-change-value');
    if (changeEl && changeValueEl) {
        const isPositive = btcData.change24h >= 0;
        changeEl.className = 'price-display__change' + (isPositive ? ' price-display__change--positive' : ' price-display__change--negative');
        changeValueEl.textContent = Utils.formatPercent(btcData.change24h);
        const svg = changeEl.querySelector('svg');
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', isPositive ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
        svg.replaceChildren();
        svg.appendChild(polyline);
    }

    // Market Cap
    const capEl = document.getElementById('btc-market-cap');
    if (capEl) capEl.textContent = Utils.formatCurrency(btcData.marketCap);

    // Dominance
    const domEl = document.getElementById('btc-dominance');
    if (domEl) domEl.textContent = btcData.dominance != null ? btcData.dominance.toFixed(1) + '%' : '—';

    // Metrics
    setMetric('metric-volume', Utils.formatCurrency(btcData.volume));
    setMetric('metric-supply', Utils.formatLargeNumber(btcData.supply) + ' BTC');
    setMetric('metric-ath', Utils.formatPrice(btcData.ath));

    const athChangeEl = document.getElementById('metric-ath-change');
    if (athChangeEl && btcData.price && btcData.ath) {
        const fromAth = ((btcData.price - btcData.ath) / btcData.ath * 100);
        const isPositive = fromAth >= 0;
        athChangeEl.className = 'metric-card__change ' + (isPositive ? 'metric-card__change--positive' : 'metric-card__change--negative');
        athChangeEl.textContent = Utils.formatPercent(fromAth) + ' from ATH';
    }

    setMetric('metric-hilo', Utils.formatPrice(btcData.high24h) + ' / ' + Utils.formatPrice(btcData.low24h));

    // Update alert modal current price
    const alertCurrPrice = document.getElementById('alert-current-price');
    if (alertCurrPrice) alertCurrPrice.textContent = Utils.formatPrice(btcData.price);

    // Trigger scroll reveal on new content
    Animations.initScrollReveal();
}

function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ── Auto-refresh ────────────────────────────────────────
let _refreshInterval;
function startRefresh() {
    if (_refreshInterval) clearInterval(_refreshInterval);
    _refreshInterval = setInterval(fetchBitcoinData, 60000);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(_refreshInterval);
        _refreshInterval = null;
    } else if (!_refreshInterval) {
        fetchBitcoinData();
        startRefresh();
    }
});

// ── Init ────────────────────────────────────────────────
function init() {
    try { Layout.initLayout(); } catch (e) { if (DEBUG) console.warn('[Layout]', e); }
    try { Components.initComponents(); } catch (e) { if (DEBUG) console.warn('[Components]', e); }
    try { Animations.initScrollReveal(); } catch (e) { if (DEBUG) console.warn('[Animations]', e); }

    // Fetch data
    fetchBitcoinData();

    // Start auto-refresh
    startRefresh();
}

// ── Boot ────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}