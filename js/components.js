// ── Modal ───────────────────────────────────────────────
function initModals() {
    document.querySelectorAll('[data-modal]').forEach(trigger => {
        const modalId = trigger.dataset.modal;
        const modal = document.getElementById(modalId);
        if (!modal) return;

        trigger.addEventListener('click', () => openModal(modal, trigger));
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelectorAll('[data-modal-close]').forEach(el => {
            el.addEventListener('click', () => closeModal(modal));
        });
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal(modal);
        });
    });
}

const _modalState = new WeakMap();

function openModal(modal, trigger) {
    if (_modalState.has(modal)) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    _modalState.set(modal, { prevOverflow, prevPaddingRight });

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
        document.body.style.paddingRight = scrollbarWidth + 'px';
    }

    modal.hidden = false;

    const container = modal.querySelector('.modal__container');
    if (container && !Utils.prefersReducedMotion()) {
        container.style.animation = 'none';
        container.offsetHeight;
        container.style.animation = 'modal-slide-up var(--duration-base) var(--ease-out)';
    }

    const backdrop = modal.querySelector('.modal__backdrop');
    if (backdrop && !Utils.prefersReducedMotion()) {
        backdrop.style.animation = 'none';
        backdrop.offsetHeight;
        backdrop.style.animation = 'modal-fade-in var(--duration-base) var(--ease-out)';
    }

    // Focus trap
    const focusable = modal.querySelectorAll('input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    firstFocusable?.focus();

    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    }

    modal.addEventListener('keydown', trapFocus);
    _modalState.get(modal)._trapHandler = trapFocus;
}

function closeModal(modal) {
    const state = _modalState.get(modal);
    if (!state) return;

    function hideModal() {
        modal.hidden = true;
        document.body.style.overflow = state.prevOverflow ?? '';
        document.body.style.paddingRight = state.prevPaddingRight ?? '';
        if (state._trapHandler) modal.removeEventListener('keydown', state._trapHandler);
        _modalState.delete(modal);
        const trigger = document.querySelector('[data-modal="' + modal.id + '"]');
        trigger?.focus();
    }

    if (!Utils.prefersReducedMotion()) {
        const container = modal.querySelector('.modal__container');
        if (container) {
            container.style.animation = 'modal-slide-up var(--duration-base) var(--ease-in) reverse';
        }
        const backdrop = modal.querySelector('.modal__backdrop');
        if (backdrop) {
            backdrop.style.animation = 'modal-fade-in var(--duration-base) var(--ease-in) reverse';
        }
        modal.addEventListener('animationend', hideModal, { once: true });
        setTimeout(function () {
            if (!modal.hidden) hideModal();
        }, 500);
    } else {
        hideModal();
    }
}

// ── Dropdown ────────────────────────────────────────────
function initDropdowns() {
    document.querySelectorAll('[aria-haspopup="menu"]').forEach(trigger => {
        const menu = document.getElementById(trigger.getAttribute('aria-controls'));
        if (!menu) return;

        function open() {
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            const first = menu.querySelector('[role="menuitem"]');
            first?.focus();
        }

        function close() {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
        }

        trigger.addEventListener('click', () => {
            menu.hidden ? open() : close();
        });

        menu.addEventListener('keydown', (e) => {
            const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
            if (items.length === 0) return;
            const idx = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (idx === -1) { items[0]?.focus(); return; }
                items[(idx + 1) % items.length]?.focus();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (idx === -1) { items[items.length - 1]?.focus(); return; }
                items[(idx - 1 + items.length) % items.length]?.focus();
            }
            if (e.key === 'Escape' || e.key === 'Tab') close();
            if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== trigger) {
                e.preventDefault();
                document.activeElement?.click();
                close();
            }
        });

        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !menu.contains(e.target) && !menu.hidden) close();
        }, { passive: true });
    });
}

// ── Price Chart ─────────────────────────────────────────
class PriceChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.svg = this.container.querySelector('#price-chart');
        this.line = this.svg?.querySelector('#chart-line');
        this.area = this.svg?.querySelector('#chart-area');
        this.tooltip = this.container.querySelector('#chart-tooltip');
        this.tooltipDate = this.container.querySelector('#chart-tooltip-date');
        this.tooltipPrice = this.container.querySelector('#chart-tooltip-price');
        this.axisLabels = this.svg?.querySelector('#chart-labels');
        this.activeRange = 7;
        this.data = [];

        if (!this.svg || !this.line || !this.area) {
            return;
        }

        this.svg.addEventListener('mousemove', (e) => this._handleHover(e));
        this.svg.addEventListener('mouseleave', () => {
            if (this.tooltip) this.tooltip.classList.remove('is-visible');
        });

        this._initRangeButtons();
        this.loadData();
    }

    _initRangeButtons() {
        const group = document.querySelector('[role="radiogroup"]');
        const btns = group ? [...group.querySelectorAll('[role="radio"]')] : [];
        btns.forEach((btn, i) => {
            btn.addEventListener('click', () => this._selectRange(btn));
            btn.addEventListener('keydown', (e) => {
                        let idx = btns.indexOf(document.activeElement);
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            idx = (idx + 1) % btns.length;
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                            e.preventDefault();
                            idx = (idx - 1 + btns.length) % btns.length;
                        } else if (e.key === 'Home') {
                            e.preventDefault();
                            idx = 0;
                        } else if (e.key === 'End') {
                            e.preventDefault();
                            idx = btns.length - 1;
                        } else return;
                        this._selectRange(btns[idx]);
                        btns[idx].focus();
                    });
        });
    }

    _selectRange(btn) {
        const group = btn.closest('[role="radiogroup"]');
        if (!group) return;
        group.querySelectorAll('[role="radio"]').forEach(b => {
            b.setAttribute('aria-checked', 'false');
            b.tabIndex = -1;
        });
        btn.setAttribute('aria-checked', 'true');
        btn.tabIndex = 0;
        const range = parseInt(btn.dataset.range);
        this.activeRange = isNaN(range) ? 365 : range;
        this.loadData();
    }

    async loadData() {
        const days = this.activeRange;
        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;

        try {
            const data = await Utils.apiFetch(url);
            this.data = data.prices.map(([timestamp, price]) => ({ timestamp, price }));
            this.render();
        } catch (err) {
            this.data = this.generateFallbackData(days);
            this.render();
            Utils.showToast({ title: 'Chart Offline', message: 'Could not fetch chart data. Showing estimated chart.', type: 'warning' });
        }
    }

    generateFallbackData(days) {
        const data = [];
        const now = Date.now();
        const points = days <= 7 ? 168 : days <= 30 ? 180 : days <= 90 ? 180 : 365;
        let price = 67000 + Math.random() * 5000;

        for (let i = points; i >= 0; i--) {
            const timestamp = now - (i / points) * days * 24 * 60 * 60 * 1000;
            price += (Math.random() - 0.48) * 500;
            if (price < 30000) price = 30000 + Math.random() * 2000;
            if (price > 120000) price = 120000 - Math.random() * 2000;
            data.push({ timestamp, price: Math.round(price * 100) / 100 });
        }
        return data;
    }

    render() {
        if (!this.data || this.data.length === 0) return;

        const width = 800, height = 320;
        const padding = { top: 20, right: 16, bottom: 28, left: 8 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const prices = this.data.map(d => d.price);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const range = maxP - minP || 1;

        this._cache = { minP, maxP, range, chartW, chartH, padding, width, height };

        const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartW;
        const yScale = (v) => padding.top + chartH - ((v - minP) / range) * chartH;

        // Build path
        let lineD = '';
        let areaD = '';
        this.data.forEach((d, i) => {
            const x = xScale(i);
            const y = yScale(d.price);
            const cmd = i === 0 ? 'M' : 'L';
            lineD += cmd + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
            areaD += cmd + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        });

        const lastX = xScale(this.data.length - 1);
        areaD += 'L' + lastX.toFixed(1) + ' ' + (padding.top + chartH) + ' ';
        areaD += 'L' + xScale(0).toFixed(1) + ' ' + (padding.top + chartH) + ' Z';

        this.line.setAttribute('d', lineD);
        this.area.setAttribute('d', areaD);

        // Axis labels
        this.axisLabels.innerHTML = '';
        const labelCount = this.activeRange <= 7 ? 7 : this.activeRange <= 30 ? 6 : 5;
        const step = Math.floor((this.data.length - 1) / (labelCount - 1));

        for (let i = 0; i < labelCount; i++) {
            const idx = Math.min(i * step, this.data.length - 1);
            const d = this.data[idx];
            const x = xScale(idx);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x.toFixed(1));
            text.setAttribute('y', (height - 6).toFixed(1));
            text.setAttribute('text-anchor', 'middle');
            text.textContent = Utils.formatShortDate(d.timestamp);
            this.axisLabels.appendChild(text);
        }

    }

    _handleHover(e) {
        if (!this.tooltip || !this.tooltipDate || !this.tooltipPrice || !this.data) return;
        const cache = this._cache;
        if (!cache) return;
        const { minP, maxP, range, chartW, chartH, padding, width, height } = cache;
        const rect = this.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relX = (mouseX / rect.width) * width;
        const idx = Math.round((relX - padding.left) / chartW * (this.data.length - 1));
        const clamped = Math.max(0, Math.min(this.data.length - 1, idx));
        const point = this.data[clamped];
        if (!point) return;

        const cx = padding.left + (clamped / (this.data.length - 1)) * chartW;
        const cy = padding.top + chartH - ((point.price - minP) / range) * chartH;

        this.tooltipDate.textContent = Utils.formatFullDate(point.timestamp);
        this.tooltipPrice.textContent = Utils.formatPrice(point.price);

        const tooltipW = this._tooltipW || (this._tooltipW = this.tooltip.offsetWidth || 160);
        const tooltipH = this._tooltipH || (this._tooltipH = this.tooltip.offsetHeight || 60);
        let left = (cx / width) * rect.width - tooltipW / 2;
        if (left < 4) left = 4;
        if (left + tooltipW > rect.width - 4) left = rect.width - tooltipW - 4;
        const cyRendered = (cy / height) * rect.height;
        const topPos = Math.max(4, cyRendered - tooltipH - 12);
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = topPos + 'px';
        this.tooltip.classList.add('is-visible');
    }
}

// ── Alert Management ────────────────────────────────────
const ALERTS_KEY = 'btc-alerts';

function getAlerts() {
    return Utils.storage.get(ALERTS_KEY, []);
}

function saveAlerts(alerts) {
    Utils.storage.set(ALERTS_KEY, alerts);
    updateAlertsBadge(alerts.length);
}

function addAlert(alert) {
    const alerts = getAlerts();
    alert.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    alert.createdAt = new Date().toISOString();
    alert.active = true;
    alerts.push(alert);
    saveAlerts(alerts);
    renderAlerts();
    return alert;
}

function removeAlert(id) {
    const alerts = getAlerts().filter(a => a.id !== id);
    saveAlerts(alerts);
    renderAlerts();
}

function updateAlertsBadge(count) {
    document.querySelectorAll('#alerts-count').forEach(el => {
        el.textContent = count;
        el.hidden = count === 0;
    });
}

function renderAlerts() {
    const list = document.getElementById('alerts-list');
    const emptyState = document.getElementById('alerts-empty');
    if (!list) return;

    const alerts = getAlerts();

    list.querySelectorAll('.alert-item').forEach(el => el.remove());

    if (alerts.length === 0) {
        if (emptyState) emptyState.hidden = false;
        updateAlertsBadge(0);
        return;
    }

    if (emptyState) emptyState.hidden = true;

    alerts.forEach(alert => {
        const item = document.createElement('div');
        item.className = 'alert-item';

        const info = document.createElement('div');
        info.className = 'alert-item__info';

        const price = document.createElement('span');
        price.className = 'alert-item__price ' + (alert.condition === 'above' ? 'text-success' : 'text-error');

        const condIcon = alert.condition === 'above' ? '\u2191' : '\u2193';
        price.textContent = condIcon + ' ' + Utils.formatPrice(parseFloat(alert.price));

        const meta = document.createElement('span');
        meta.className = 'alert-item__meta';
        meta.textContent = alert.condition === 'above' ? 'Above' : 'Below';
        meta.textContent += ' ' + alert.asset + ' \u00B7 ' + Utils.formatDate(alert.createdAt);

        info.appendChild(price);
        info.appendChild(meta);
        item.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'alert-item__actions';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn--icon btn--ghost text-muted';
        delBtn.setAttribute('aria-label', 'Remove alert');
        const _svgNS = 'http://www.w3.org/2000/svg';
        const _svg = document.createElementNS(_svgNS, 'svg');
        _svg.setAttribute('aria-hidden', 'true');
        _svg.setAttribute('focusable', 'false');
        _svg.setAttribute('width', '14');
        _svg.setAttribute('height', '14');
        _svg.setAttribute('viewBox', '0 0 24 24');
        _svg.setAttribute('fill', 'none');
        _svg.setAttribute('stroke', 'currentColor');
        _svg.setAttribute('stroke-width', '2');
        _svg.setAttribute('stroke-linecap', 'round');
        _svg.setAttribute('stroke-linejoin', 'round');
        const _pline = document.createElementNS(_svgNS, 'polyline');
        _pline.setAttribute('points', '3 6 5 6 21 6');
        const _path = document.createElementNS(_svgNS, 'path');
        _path.setAttribute('d', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2');
        _svg.appendChild(_pline);
        _svg.appendChild(_path);
        delBtn.appendChild(_svg);
        delBtn.addEventListener('click', () => removeAlert(alert.id));
        actions.appendChild(delBtn);

        item.appendChild(actions);
        list.appendChild(item);
    });

    updateAlertsBadge(alerts.length);
}

// ── Market Data Table ───────────────────────────────────

function _createCell(tag, className, content) {
    const cell = document.createElement(tag);
    if (className) cell.className = className;
    if (content instanceof Node) {
        cell.appendChild(content);
    } else {
        cell.textContent = content;
    }
    return cell;
}

function _createNameCell(name, symbol) {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    const nameSpan = Utils.createElement('span', 'font-semibold');
    nameSpan.textContent = name;
    const symbolSpan = Utils.createElement('span', 'text-muted text-xs');
    symbolSpan.textContent = symbol;
    div.appendChild(nameSpan);
    div.appendChild(symbolSpan);
    return _createCell('td', '', div);
}

async function loadMarketTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;

    try {
        const data = await Utils.apiFetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h%2C7d'
        );

        tbody.innerHTML = '';
        data.forEach((coin, i) => {
            const tr = document.createElement('tr');
            const change24h = coin.price_change_percentage_24h_in_currency;
            const change7d = coin.price_change_percentage_7d_in_currency;

            tr.appendChild(_createCell('td', '', String(i + 1)));
            tr.appendChild(_createNameCell(coin.name, coin.symbol.toUpperCase()));
            tr.appendChild(_createCell('td', 'font-mono font-medium', Utils.formatPrice(coin.current_price)));
            tr.appendChild(_createCell('td', 'font-mono ' + (change24h >= 0 ? 'data-table__positive' : 'data-table__negative'), Utils.formatPercent(change24h)));
            tr.appendChild(_createCell('td', 'font-mono ' + (change7d >= 0 ? 'data-table__positive' : 'data-table__negative'), Utils.formatPercent(change7d)));
            tr.appendChild(_createCell('td', 'font-mono', Utils.formatCurrency(coin.market_cap)));
            tr.appendChild(_createCell('td', 'font-mono', Utils.formatCurrency(coin.total_volume)));
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '';
        loadOfflineMarketData(tbody);
    }
}

function loadOfflineMarketData(tbody) {
    const coins = [
        { name: 'Bitcoin', symbol: 'BTC', price: 67432.18, change24h: 2.34, change7d: 5.67, cap: 1320000000000, vol: 42000000000 },
        { name: 'Ethereum', symbol: 'ETH', price: 3456.78, change24h: -1.23, change7d: 3.45, cap: 415000000000, vol: 18500000000 },
        { name: 'Tether', symbol: 'USDT', price: 1.00, change24h: 0.01, change7d: 0.02, cap: 95000000000, vol: 52000000000 },
        { name: 'BNB', symbol: 'BNB', price: 578.90, change24h: 1.45, change7d: -2.10, cap: 89000000000, vol: 2100000000 },
        { name: 'Solana', symbol: 'SOL', price: 142.35, change24h: 5.67, change7d: 12.34, cap: 62000000000, vol: 3800000000 },
        { name: 'XRP', symbol: 'XRP', price: 0.6234, change24h: -0.45, change7d: 1.23, cap: 34000000000, vol: 1500000000 },
        { name: 'USDC', symbol: 'USDC', price: 1.00, change24h: 0.00, change7d: 0.01, cap: 33000000000, vol: 4800000000 },
        { name: 'Cardano', symbol: 'ADA', price: 0.4567, change24h: 3.21, change7d: 8.90, cap: 16000000000, vol: 890000000 },
        { name: 'Dogecoin', symbol: 'DOGE', price: 0.1234, change24h: -2.34, change7d: 15.67, cap: 17500000000, vol: 1200000000 },
        { name: 'Avalanche', symbol: 'AVAX', price: 35.67, change24h: 4.56, change7d: 22.34, cap: 13000000000, vol: 670000000 },
    ];

    tbody.innerHTML = '';
    coins.forEach((coin, i) => {
        const tr = document.createElement('tr');
        tr.appendChild(_createCell('td', '', String(i + 1)));
        tr.appendChild(_createNameCell(coin.name, coin.symbol.toUpperCase()));
        tr.appendChild(_createCell('td', 'font-mono font-medium', Utils.formatPrice(coin.price)));
        tr.appendChild(_createCell('td', 'font-mono ' + (coin.change24h >= 0 ? 'data-table__positive' : 'data-table__negative'), Utils.formatPercent(coin.change24h)));
        tr.appendChild(_createCell('td', 'font-mono ' + (coin.change7d >= 0 ? 'data-table__positive' : 'data-table__negative'), Utils.formatPercent(coin.change7d)));
        tr.appendChild(_createCell('td', 'font-mono', Utils.formatCurrency(coin.cap)));
        tr.appendChild(_createCell('td', 'font-mono', Utils.formatCurrency(coin.vol)));
        tbody.appendChild(tr);
    });
}

// ── News Feed ───────────────────────────────────────────
async function loadNews() {
    const feed = document.getElementById('news-feed');
    if (!feed) return;

    const newsItems = [
        { title: 'Bitcoin Hash Rate Hits New All-Time High Amid Institutional Adoption', source: 'CoinDesk', time: '2 hours ago' },
        { title: 'SEC Approves Multiple Spot Bitcoin ETF Options for Major Exchanges', source: 'Bloomberg', time: '4 hours ago' },
        { title: 'El Salvador Reports $85M Profit on Bitcoin Investments Since 2021', source: 'Reuters', time: '6 hours ago' },
        { title: 'Bitcoin Layer-2 Solutions See 300% Growth in Total Value Locked', source: 'The Block', time: '8 hours ago' },
        { title: 'MicroStrategy Adds 5,000 BTC to Holdings, Now Holds Over 250,000 Bitcoin', source: 'CoinTelegraph', time: '12 hours ago' },
        { title: 'Federal Reserve Rate Decision: Impact on Crypto Markets Analyzed', source: 'CNBC', time: '14 hours ago' },
    ];

    feed.innerHTML = '';
    newsItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'news-item';
        const titleEl = document.createElement('span');
        titleEl.className = 'news-item__title';
        titleEl.textContent = item.title;
        div.appendChild(titleEl);

        const meta = document.createElement('div');
        meta.className = 'news-item__meta';
        const source = document.createElement('span');
        source.textContent = item.source;
        const time = document.createElement('span');
        time.textContent = item.time;
        meta.appendChild(source);
        meta.appendChild(time);
        div.appendChild(meta);
        feed.appendChild(div);
    });
}

// ── Init Components ─────────────────────────────────────
function initComponents() {
    initModals();
    initDropdowns();

    const chart = new PriceChart('chart-container');

    renderAlerts();
    loadMarketTable();
    loadNews();

    // Alert modal save button
    const saveBtn = document.getElementById('alert-save-btn');
    const alertPriceInput = document.getElementById('alert-price');
    if (saveBtn && alertPriceInput) {
        saveBtn.addEventListener('click', () => {
            const price = alertPriceInput.value.trim();
            if (!price || isNaN(price) || parseFloat(price) <= 0) {
                Utils.showToast({ title: 'Invalid price', message: 'Please enter a valid target price.', type: 'error' });
                return;
            }
            const asset = document.getElementById('alert-asset')?.value || 'bitcoin';
            const condition = document.getElementById('alert-condition')?.value || 'above';
            addAlert({ asset, condition, price });
            closeModal(document.getElementById('alert-modal'));
            alertPriceInput.value = '';
            Utils.showToast({ title: 'Alert created', message: 'You will be notified when BTC hits ' + Utils.formatPrice(parseFloat(price)), type: 'success' });
        });

        alertPriceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
    }

}

// ── Exports ─────────────────────────────────────────────
window.Components = {
    initComponents,
    openModal,
    closeModal,
    PriceChart,
    addAlert,
    removeAlert,
    getAlerts,
};