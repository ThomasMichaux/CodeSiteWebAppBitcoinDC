(function () {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';

    window.addEventListener('unhandledrejection', (e) => {
        console.error('[BitcoinDC] Unhandled rejection:', e.reason);
    });

    window.addEventListener('error', (e) => {
        console.error('[BitcoinDC] Uncaught error:', e.message, e.filename, e.lineno);
    });

    const BTC_API = {
        BASE: 'https://api.coingecko.com/api/v3',
        SIMPLE_PRICE: '/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
        COIN_DATA: '/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
        GLOBAL: '/global',
    };

    const EMPTY_DATA = {
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

    const SAMPLE_DATA = {
        price: 67432.18,
        change24h: 2.34,
        marketCap: 1320000000000,
        volume: 42300000000,
        supply: 19700000,
        ath: 73750.07,
        high24h: 68123.45,
        low24h: 65987.32,
        dominance: 54.2,
    };

    let btcData = { ...EMPTY_DATA };

    const MIN_REFRESH = 60000;
    const MAX_REFRESH = 600000;

    let _fetching = false;
    let _refreshDelay = MIN_REFRESH;
    let _refreshTimer = null;
    let _usingSampleData = false;

    function num(value) {
        return Utils.isNumber(value) ? value : null;
    }

    async function fetchBitcoinData() {
        if (_fetching) return;
        _fetching = true;

        try {
            const [simple, coin, global] = await Promise.allSettled([
                Utils.apiFetch(BTC_API.BASE + BTC_API.SIMPLE_PRICE),
                Utils.apiFetch(BTC_API.BASE + BTC_API.COIN_DATA),
                Utils.apiFetch(BTC_API.BASE + BTC_API.GLOBAL),
            ]);

            if (simple.status !== 'fulfilled') throw simple.reason;
            if (coin.status !== 'fulfilled') throw coin.reason;

            const btc = simple.value?.bitcoin;
            if (!btc || !Utils.isNumber(btc.usd)) {
                throw new Utils.ApiError('Unexpected price payload from CoinGecko');
            }

            const market = coin.value?.market_data ?? {};

            btcData = {
                price: btc.usd,
                change24h: num(btc.usd_24h_change),
                marketCap: num(btc.usd_market_cap),
                volume: num(market.total_volume?.usd),
                supply: num(market.circulating_supply),
                ath: num(market.ath?.usd),
                high24h: num(market.high_24h?.usd),
                low24h: num(market.low_24h?.usd),
                dominance: global.status === 'fulfilled'
                    ? num(global.value?.data?.market_cap_percentage?.btc)
                    : btcData.dominance,
            };

            _usingSampleData = false;
            _refreshDelay = MIN_REFRESH;

            updateUI();
            Layout.setLastUpdate(new Date());
            Components.checkAlerts(btcData.price);
        } catch (err) {
            handleFetchFailure(err);
        } finally {
            _fetching = false;
        }
    }

    function handleFetchFailure(err) {
        _refreshDelay = Math.min(_refreshDelay * 2, MAX_REFRESH);

        const rateLimited = err?.status === 429;

        if (btcData.price !== null && !_usingSampleData) {
            Utils.showToast({
                title: rateLimited ? 'Rate limited by CoinGecko' : 'Update failed',
                message: 'Showing the last confirmed prices. See the update time in the sidebar.',
                type: 'warning',
                key: 'refresh-failed',
            });
            return;
        }

        btcData = { ...SAMPLE_DATA };
        _usingSampleData = true;
        updateUI();
        Layout.setLastUpdate(null);

        Utils.showToast({
            title: 'Live data unavailable',
            message: 'Could not reach CoinGecko. Every figure shown is sample data, not a real price.',
            type: 'warning',
            key: 'data-offline',
        });
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function updateChangeIndicator() {
        const changeEl = document.getElementById('btc-change');
        const valueEl = document.getElementById('btc-change-value');
        if (!changeEl || !valueEl) return;

        const change = btcData.change24h;
        const known = Utils.isNumber(change);
        const isPositive = known && change >= 0;

        changeEl.className = 'price-display__change'
            + (known
                ? (isPositive ? ' price-display__change--positive' : ' price-display__change--negative')
                : ' price-display__change--unknown');

        valueEl.textContent = Utils.formatPercent(change);

        const icon = changeEl.querySelector('svg');
        if (!icon) return;

        icon.replaceChildren();
        if (known) {
            const arrow = document.createElementNS(SVG_NS, 'polyline');
            arrow.setAttribute('points', isPositive ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
            icon.appendChild(arrow);
        } else {
            const dash = document.createElementNS(SVG_NS, 'line');
            dash.setAttribute('x1', '5');
            dash.setAttribute('y1', '12');
            dash.setAttribute('x2', '19');
            dash.setAttribute('y2', '12');
            icon.appendChild(dash);
        }
    }

    function updateAthChange() {
        const el = document.getElementById('metric-ath-change');
        if (!el) return;

        if (!Utils.isNumber(btcData.price) || !Utils.isNumber(btcData.ath) || btcData.ath === 0) {
            el.className = 'metric-card__change';
            el.textContent = '';
            return;
        }

        const fromAth = ((btcData.price - btcData.ath) / btcData.ath) * 100;
        el.className = 'metric-card__change '
            + (fromAth >= 0 ? 'metric-card__change--positive' : 'metric-card__change--negative');
        el.textContent = Utils.formatPercent(fromAth) + ' from ATH';
    }

    function updateUI() {
        document.documentElement.classList.add('is-loaded');

        Animations.animateNumber(document.getElementById('btc-price'), btcData.price, {
            format: Utils.formatPrice,
        });

        updateChangeIndicator();

        setText('btc-market-cap', Utils.formatCurrency(btcData.marketCap));
        setText('btc-dominance', Utils.isNumber(btcData.dominance) ? btcData.dominance.toFixed(1) + '%' : '—');

        setText('metric-volume', Utils.formatCurrency(btcData.volume));
        setText('metric-supply', Utils.isNumber(btcData.supply)
            ? Utils.formatLargeNumber(btcData.supply) + ' BTC'
            : '—');
        setText('metric-ath', Utils.formatPrice(btcData.ath));
        updateAthChange();
        setText('metric-hilo', Utils.formatPrice(btcData.high24h) + ' / ' + Utils.formatPrice(btcData.low24h));

        setText('alert-current-price', Utils.formatPrice(btcData.price));

        Animations.initScrollReveal();
    }

    function scheduleRefresh() {
        clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(() => {
            fetchBitcoinData().finally(() => {
                if (!document.hidden) scheduleRefresh();
            });
        }, _refreshDelay);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimeout(_refreshTimer);
            _refreshTimer = null;
            return;
        }
        fetchBitcoinData().finally(scheduleRefresh);
    });

    function init() {
        try { Layout.initLayout(); } catch (e) { console.error('[BitcoinDC] Layout failed:', e); }
        try { Components.initComponents(); } catch (e) { console.error('[BitcoinDC] Components failed:', e); }
        try { Animations.initScrollReveal(); } catch (e) { console.error('[BitcoinDC] Animations failed:', e); }

        fetchBitcoinData().finally(scheduleRefresh);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();