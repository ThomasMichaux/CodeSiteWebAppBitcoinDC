(function () {
    'use strict';

    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    function focusablesIn(root) {
        return [...root.querySelectorAll(FOCUSABLE_SELECTOR)]
            .filter(el => !el.hidden && el.getClientRects().length > 0);
    }

    function restartAnimation(el, animation) {
        if (!el) return;
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = animation;
    }

    const _modalState = new WeakMap();

    function initModals() {
        document.querySelectorAll('[data-modal]').forEach(trigger => {
            const modal = document.getElementById(trigger.dataset.modal);
            if (!modal) return;
            trigger.addEventListener('click', () => openModal(modal, trigger));
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.querySelectorAll('[data-modal-close]').forEach(el => {
                el.addEventListener('click', () => closeModal(modal));
            });
        });
    }

    function openModal(modal, trigger = null) {
        if (_modalState.has(modal)) return;

        const state = {
            prevOverflow: document.body.style.overflow,
            prevPaddingRight: document.body.style.paddingRight,
            trigger: trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null),
            onKeydown: null,
        };
        _modalState.set(modal, state);

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }

        modal.hidden = false;

        if (!Utils.prefersReducedMotion()) {
            restartAnimation(modal.querySelector('.modal__container'), 'modal-slide-up var(--duration-base) var(--ease-out)');
            restartAnimation(modal.querySelector('.modal__backdrop'), 'modal-fade-in var(--duration-base) var(--ease-out)');
        }

        focusablesIn(modal)[0]?.focus();

        state.onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeModal(modal);
                return;
            }
            if (e.key !== 'Tab') return;
            const items = focusablesIn(modal);
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        modal.addEventListener('keydown', state.onKeydown);
    }

    function closeModal(modal) {
        const state = _modalState.get(modal);
        if (!state) return;
        _modalState.delete(modal);

        let done = false;
        function hide() {
            if (done) return;
            done = true;
            modal.hidden = true;
            document.body.style.overflow = state.prevOverflow;
            document.body.style.paddingRight = state.prevPaddingRight;
            modal.removeEventListener('keydown', state.onKeydown);
            if (state.trigger && document.contains(state.trigger)) state.trigger.focus();
        }

        if (Utils.prefersReducedMotion()) {
            hide();
            return;
        }

        const container = modal.querySelector('.modal__container');
        const backdrop = modal.querySelector('.modal__backdrop');
        if (container) container.style.animation = 'modal-slide-up var(--duration-base) var(--ease-in) reverse';
        if (backdrop) backdrop.style.animation = 'modal-fade-in var(--duration-base) var(--ease-in) reverse';

        modal.addEventListener('animationend', hide, { once: true });
        setTimeout(hide, 500);
    }

    function initDropdowns() {
        document.querySelectorAll('[aria-haspopup="menu"]').forEach(trigger => {
            const menu = document.getElementById(trigger.getAttribute('aria-controls'));
            if (!menu) return;

            function open() {
                menu.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
                menu.querySelector('[role="menuitem"]:not([disabled])')?.focus();
            }

            function close({ restoreFocus = false } = {}) {
                if (menu.hidden) return;
                menu.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
                if (restoreFocus) trigger.focus();
            }

            trigger.addEventListener('click', () => {
                if (menu.hidden) open(); else close({ restoreFocus: true });
            });

            menu.addEventListener('keydown', (e) => {
                const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
                if (items.length === 0) return;
                const idx = items.indexOf(document.activeElement);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    items[idx === -1 ? 0 : (idx + 1) % items.length].focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    items[idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length].focus();
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    items[0].focus();
                } else if (e.key === 'End') {
                    e.preventDefault();
                    items[items.length - 1].focus();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close({ restoreFocus: true });
                } else if (e.key === 'Tab') {
                    close();
                } else if ((e.key === 'Enter' || e.key === ' ') && idx !== -1) {
                    e.preventDefault();
                    items[idx].click();
                    close({ restoreFocus: true });
                }
            });

            document.addEventListener('click', (e) => {
                if (menu.hidden) return;
                if (trigger.contains(e.target) || menu.contains(e.target)) return;
                close();
            });
        });
    }

    const CHART_RANGES = {
        '1': { days: '1', label: 'last 24 hours', labelCount: 6 },
        '7': { days: '7', label: 'last 7 days', labelCount: 7 },
        '30': { days: '30', label: 'last 30 days', labelCount: 6 },
        '90': { days: '90', label: 'last 90 days', labelCount: 5 },
        '365': { days: '365', label: 'last year', labelCount: 5 },
        'all': { days: 'max', label: 'all time', labelCount: 5 },
    };

    class PriceChart {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            this.svg = this.container.querySelector('#price-chart');
            this.line = this.svg?.querySelector('#chart-line');
            this.area = this.svg?.querySelector('#chart-area');
            this.accessibleTitle = this.svg?.querySelector('#chart-a11y-title');
            this.tooltip = this.container.querySelector('#chart-tooltip');
            this.tooltipDate = this.container.querySelector('#chart-tooltip-date');
            this.tooltipPrice = this.container.querySelector('#chart-tooltip-price');
            this.axisLabels = this.svg?.querySelector('#chart-labels');

            if (!this.svg || !this.line || !this.area) return;

            this.rangeKey = '7';
            this.data = [];
            this._cache = null;

            this.svg.addEventListener('mousemove', (e) => this._handleHover(e));
            this.svg.addEventListener('mouseleave', () => {
                this.tooltip?.classList.remove('is-visible');
            });

            this._loadDataDebounced = Utils.debounce(() => this.loadData(), 250);
            this._initRangeButtons();
            this.loadData();
        }

        _initRangeButtons() {
            const group = this.container.closest('.card')?.querySelector('[role="radiogroup"]');
            if (!group) return;

            const btns = [...group.querySelectorAll('[role="radio"]')];
            this._rangeButtons = btns;

            btns.forEach(btn => {
                btn.addEventListener('click', () => this._selectRange(btn));
                btn.addEventListener('keydown', (e) => {
                    let idx = btns.indexOf(document.activeElement);
                    if (idx === -1) return;

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
                    } else {
                        return;
                    }

                    this._selectRange(btns[idx], { debounce: true });
                    btns[idx].focus();
                });
            });
        }

        _selectRange(btn, { debounce = false } = {}) {
            const key = btn.dataset.range;
            if (!CHART_RANGES[key]) return;

            (this._rangeButtons || []).forEach(b => {
                b.setAttribute('aria-checked', 'false');
                b.tabIndex = -1;
            });
            btn.setAttribute('aria-checked', 'true');
            btn.tabIndex = 0;

            if (key === this.rangeKey) return;
            this.rangeKey = key;

            if (debounce) this._loadDataDebounced();
            else this.loadData();
        }

        get range() {
            return CHART_RANGES[this.rangeKey];
        }

        async loadData() {
            const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart'
                + `?vs_currency=usd&days=${encodeURIComponent(this.range.days)}`;

            try {
                const data = await Utils.apiFetch(url);
                const prices = Array.isArray(data?.prices) ? data.prices : [];
                if (prices.length === 0) throw new Utils.ApiError('Empty chart payload', { url });

                this.data = prices.map(([timestamp, price]) => ({ timestamp, price }));
                this.isEstimated = false;
                this.render();
            } catch (err) {
                if (this.data.length > 0) {
                    Utils.showToast({
                        title: 'Chart not updated',
                        message: 'Could not reach CoinGecko. Showing the last chart that loaded.',
                        type: 'warning',
                        key: 'chart-stale',
                    });
                    return;
                }
                this.data = this.generateFallbackData();
                this.isEstimated = true;
                this.render();
                Utils.showToast({
                    title: 'Chart unavailable',
                    message: 'Could not reach CoinGecko. The shape below is simulated, not real market data.',
                    type: 'warning',
                    key: 'chart-offline',
                });
            }
        }

        generateFallbackData() {
            const days = this.rangeKey === 'all' ? 4000 : Number(this.rangeKey);
            const points = days <= 7 ? 168 : days <= 90 ? 180 : 365;
            const now = Date.now();
            const data = [];
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
            if (this.data.length === 0) return;

            const width = 800;
            const height = 320;
            const padding = { top: 20, right: 16, bottom: 28, left: 8 };
            const chartW = width - padding.left - padding.right;
            const chartH = height - padding.top - padding.bottom;

            const prices = this.data.map(d => d.price);
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            const range = maxP - minP || 1;
            const lastIndex = Math.max(this.data.length - 1, 1);

            this._cache = { minP, range, chartW, chartH, padding, width, height };

            const xScale = (i) => padding.left + (i / lastIndex) * chartW;
            const yScale = (v) => padding.top + chartH - ((v - minP) / range) * chartH;

            let lineD = '';
            this.data.forEach((d, i) => {
                lineD += (i === 0 ? 'M' : 'L') + xScale(i).toFixed(1) + ' ' + yScale(d.price).toFixed(1) + ' ';
            });

            const baseline = (padding.top + chartH).toFixed(1);
            const areaD = lineD
                + 'L' + xScale(lastIndex).toFixed(1) + ' ' + baseline + ' '
                + 'L' + xScale(0).toFixed(1) + ' ' + baseline + ' Z';

            this.line.setAttribute('d', lineD.trim());
            this.area.setAttribute('d', areaD);

            this._renderAxisLabels(xScale);
            this._updateAccessibleTitle(minP, maxP);
        }

        _renderAxisLabels(xScale) {
            if (!this.axisLabels) return;
            this.axisLabels.replaceChildren();

            const labelCount = Math.min(this.range.labelCount, this.data.length);
            if (labelCount < 2) return;

            const step = (this.data.length - 1) / (labelCount - 1);
            const height = this._cache.height;

            for (let i = 0; i < labelCount; i++) {
                const idx = Math.min(Math.round(i * step), this.data.length - 1);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', xScale(idx).toFixed(1));
                text.setAttribute('y', (height - 6).toFixed(1));
                text.setAttribute('text-anchor', i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle');
                text.textContent = Utils.formatShortDate(this.data[idx].timestamp);
                this.axisLabels.appendChild(text);
            }
        }

        _updateAccessibleTitle(minP, maxP) {
            if (!this.accessibleTitle) return;

            const first = this.data[0].price;
            const last = this.data[this.data.length - 1].price;
            const change = first ? ((last - first) / first) * 100 : 0;

            this.accessibleTitle.textContent = this.isEstimated
                ? `Simulated Bitcoin price chart, ${this.range.label}. Real market data is unavailable.`
                : `Bitcoin price, ${this.range.label}. Low ${Utils.formatPrice(minP)}, `
                + `high ${Utils.formatPrice(maxP)}, currently ${Utils.formatPrice(last)}, `
                + `${Utils.formatPercent(change)} across the period.`;
        }

        _handleHover(e) {
            if (!this.tooltip || !this.tooltipDate || !this.tooltipPrice || !this._cache) return;

            const { minP, range, chartW, chartH, padding, width, height } = this._cache;
            const rect = this.svg.getBoundingClientRect();
            if (rect.width === 0) return;

            const lastIndex = Math.max(this.data.length - 1, 1);
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const idx = Math.round((relX - padding.left) / chartW * lastIndex);
            const point = this.data[Math.max(0, Math.min(lastIndex, idx))];
            if (!point) return;

            this.tooltipDate.textContent = Utils.formatFullDate(point.timestamp);
            this.tooltipPrice.textContent = Utils.formatPrice(point.price);

            const cx = padding.left + (Math.max(0, Math.min(lastIndex, idx)) / lastIndex) * chartW;
            const cy = padding.top + chartH - ((point.price - minP) / range) * chartH;

            const tooltipW = this.tooltip.offsetWidth || 160;
            const tooltipH = this.tooltip.offsetHeight || 60;

            let left = (cx / width) * rect.width - tooltipW / 2;
            left = Math.max(4, Math.min(left, rect.width - tooltipW - 4));

            const top = Math.max(4, (cy / height) * rect.height - tooltipH - 12);

            this.tooltip.style.left = left + 'px';
            this.tooltip.style.top = top + 'px';
            this.tooltip.classList.add('is-visible');
        }
    }

    const ALERTS_KEY = 'btc-alerts';

    function getAlerts() {
        const stored = Utils.storage.get(ALERTS_KEY, []);
        return Array.isArray(stored) ? stored : [];
    }

    function saveAlerts(alerts) {
        Utils.storage.set(ALERTS_KEY, alerts);
    }

    function addAlert({ condition, price }) {
        const alerts = getAlerts();
        const alert = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            asset: 'bitcoin',
            condition,
            price,
            createdAt: new Date().toISOString(),
            active: true,
        };
        alerts.push(alert);
        saveAlerts(alerts);
        renderAlerts();
        return alert;
    }

    function removeAlert(id) {
        saveAlerts(getAlerts().filter(a => a.id !== id));
        renderAlerts();
    }

    function checkAlerts(price) {
        if (!Utils.isNumber(price)) return;

        const alerts = getAlerts();
        let triggered = false;

        alerts.forEach(alert => {
            if (!alert.active) return;
            const target = Number(alert.price);
            if (!Number.isFinite(target)) return;

            const hit = alert.condition === 'above' ? price >= target : price <= target;
            if (!hit) return;

            alert.active = false;
            alert.triggeredAt = new Date().toISOString();
            triggered = true;

            Utils.showToast({
                title: 'Alert triggered',
                message: `Bitcoin went ${alert.condition} ${Utils.formatPrice(target)} — now ${Utils.formatPrice(price)}.`,
                type: 'success',
                duration: 10000,
                key: 'alert-' + alert.id,
            });
        });

        if (triggered) {
            saveAlerts(alerts);
            renderAlerts();
        }
    }

    function updateAlertsBadge(count) {
        document.querySelectorAll('#alerts-count').forEach(el => {
            el.textContent = String(count);
            el.hidden = count === 0;
        });
    }

    function renderAlerts() {
        const list = document.getElementById('alerts-list');
        const emptyState = document.getElementById('alerts-empty');
        if (!list) return;

        const alerts = getAlerts();
        list.querySelectorAll('.alert-item').forEach(el => el.remove());

        updateAlertsBadge(alerts.filter(a => a.active).length);

        if (alerts.length === 0) {
            if (emptyState) emptyState.hidden = false;
            return;
        }
        if (emptyState) emptyState.hidden = true;

        alerts.forEach(alert => {
            const item = Utils.createElement('div', 'alert-item' + (alert.active ? '' : ' alert-item--triggered'));

            const info = Utils.createElement('div', 'alert-item__info');

            const price = Utils.createElement('span', 'alert-item__price');
            price.textContent = (alert.condition === 'above' ? '↑ ' : '↓ ') + Utils.formatPrice(Number(alert.price));
            info.appendChild(price);

            const meta = Utils.createElement('span', 'alert-item__meta');
            meta.textContent = (alert.condition === 'above' ? 'Above' : 'Below')
                + ' · set ' + Utils.formatDate(alert.createdAt);
            info.appendChild(meta);

            item.appendChild(info);

            const actions = Utils.createElement('div', 'alert-item__actions');

            if (!alert.active) {
                const badge = Utils.createElement('span', 'badge badge--success');
                badge.textContent = 'Triggered';
                actions.appendChild(badge);
            }

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn--icon btn--ghost';
            delBtn.setAttribute('aria-label', 'Remove alert for ' + Utils.formatPrice(Number(alert.price)));
            delBtn.appendChild(Utils.createIcon(14, [
                ['polyline', { points: '3 6 5 6 21 6' }],
                ['path', { d: 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' }],
            ]));
            delBtn.addEventListener('click', () => removeAlert(alert.id));
            actions.appendChild(delBtn);

            item.appendChild(actions);
            list.appendChild(item);
        });
    }

    function changeCellClass(value) {
        if (!Utils.isNumber(value)) return 'font-mono text-muted';
        return 'font-mono ' + (value >= 0 ? 'data-table__positive' : 'data-table__negative');
    }

    function createCell(className, content) {
        const cell = document.createElement('td');
        if (className) cell.className = className;
        if (content instanceof Node) cell.appendChild(content);
        else cell.textContent = content;
        return cell;
    }

    function createNameCell(name, symbol) {
        const div = Utils.createElement('div', 'flex items-center gap-2');
        const nameSpan = Utils.createElement('span', 'font-semibold');
        nameSpan.textContent = name;
        const symbolSpan = Utils.createElement('span', 'text-muted text-xs');
        symbolSpan.textContent = symbol;
        div.appendChild(nameSpan);
        div.appendChild(document.createTextNode(' '));
        div.appendChild(symbolSpan);
        return createCell('', div);
    }

    function renderMarketRows(tbody, coins) {
        tbody.replaceChildren();
        coins.forEach((coin, i) => {
            const tr = document.createElement('tr');
            tr.dataset.search = (coin.name + ' ' + coin.symbol).toLowerCase();
            tr.appendChild(createCell('', String(i + 1)));
            tr.appendChild(createNameCell(coin.name, coin.symbol.toUpperCase()));
            tr.appendChild(createCell('font-mono font-medium', Utils.formatPrice(coin.price)));
            tr.appendChild(createCell(changeCellClass(coin.change24h), Utils.formatPercent(coin.change24h)));
            tr.appendChild(createCell(changeCellClass(coin.change7d), Utils.formatPercent(coin.change7d)));
            tr.appendChild(createCell('font-mono', Utils.formatCurrency(coin.cap)));
            tr.appendChild(createCell('font-mono', Utils.formatCurrency(coin.vol)));
            tbody.appendChild(tr);
        });
        document.dispatchEvent(new CustomEvent('market-table:rendered'));
    }

    const OFFLINE_MARKET_DATA = [
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

    let _marketLoaded = false;

    function setMarketStatus(state) {
        const badge = document.getElementById('market-status');
        if (!badge) return;
        if (state === 'sample') {
            badge.className = 'badge badge--neutral';
            badge.textContent = 'Sample data';
        } else {
            badge.className = 'badge badge--success';
            badge.textContent = 'Live';
        }
    }

    async function loadMarketTable() {
        const tbody = document.getElementById('market-table-body');
        if (!tbody) return;

        try {
            const data = await Utils.apiFetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc'
                + '&per_page=10&page=1&sparkline=false&price_change_percentage=24h%2C7d'
            );
            if (!Array.isArray(data) || data.length === 0) throw new Utils.ApiError('Empty market payload');

            renderMarketRows(tbody, data.map(coin => ({
                name: coin.name,
                symbol: coin.symbol,
                price: coin.current_price,
                change24h: coin.price_change_percentage_24h_in_currency,
                change7d: coin.price_change_percentage_7d_in_currency,
                cap: coin.market_cap,
                vol: coin.total_volume,
            })));
            _marketLoaded = true;
            setMarketStatus('live');
        } catch (err) {
            if (_marketLoaded) return;
            renderMarketRows(tbody, OFFLINE_MARKET_DATA);
            setMarketStatus('sample');
            Utils.showToast({
                title: 'Market table unavailable',
                message: 'Could not reach CoinGecko. The table below is sample data, not live prices.',
                type: 'warning',
                key: 'market-offline',
            });
        }
    }

    const SAMPLE_NEWS = [
        { title: 'Bitcoin Hash Rate Hits New All-Time High Amid Institutional Adoption', source: 'CoinDesk' },
        { title: 'SEC Approves Multiple Spot Bitcoin ETF Options for Major Exchanges', source: 'Bloomberg' },
        { title: 'El Salvador Reports $85M Profit on Bitcoin Investments Since 2021', source: 'Reuters' },
        { title: 'Bitcoin Layer-2 Solutions See 300% Growth in Total Value Locked', source: 'The Block' },
        { title: 'MicroStrategy Adds 5,000 BTC to Holdings, Now Holds Over 250,000 Bitcoin', source: 'CoinTelegraph' },
        { title: 'Federal Reserve Rate Decision: Impact on Crypto Markets Analyzed', source: 'CNBC' },
    ];

    function renderNews() {
        const feed = document.getElementById('news-feed');
        if (!feed) return;

        feed.replaceChildren();
        SAMPLE_NEWS.forEach(item => {
            const article = Utils.createElement('article', 'news-item');

            const title = Utils.createElement('h3', 'news-item__title');
            title.textContent = item.title;
            article.appendChild(title);

            const meta = Utils.createElement('p', 'news-item__meta');
            meta.textContent = item.source;
            article.appendChild(meta);

            feed.appendChild(article);
        });
    }

    let _chart = null;

    function initAlertForm() {
        const saveBtn = document.getElementById('alert-save-btn');
        const priceInput = document.getElementById('alert-price');
        const conditionInput = document.getElementById('alert-condition');
        const errorEl = document.getElementById('alert-price-error');
        const group = priceInput?.closest('.form-group');
        if (!saveBtn || !priceInput || !conditionInput) return;

        function clearError() {
            group?.classList.remove('has-error');
            priceInput.removeAttribute('aria-invalid');
            if (errorEl) errorEl.textContent = '';
        }

        function showError(message) {
            group?.classList.add('has-error');
            priceInput.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = message;
            priceInput.focus();
        }

        priceInput.addEventListener('input', clearError);

        saveBtn.addEventListener('click', () => {
            const raw = priceInput.value.trim();
            if (!raw) {
                showError('Enter a target price.');
                return;
            }
            if (!/^\d*\.?\d+$/.test(raw)) {
                showError('Use digits only, for example 72000 or 72000.50.');
                return;
            }
            const price = Number(raw);
            if (!Number.isFinite(price) || price <= 0) {
                showError('The target price must be greater than zero.');
                return;
            }

            const condition = conditionInput.value === 'below' ? 'below' : 'above';
            addAlert({ condition, price });

            clearError();
            priceInput.value = '';
            closeModal(document.getElementById('alert-modal'));

            Utils.showToast({
                title: 'Alert created',
                message: `You'll be notified while this page is open if Bitcoin goes ${condition} ${Utils.formatPrice(price)}.`,
                type: 'success',
            });
        });

        priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            }
        });
    }

    function initComponents() {
        initModals();
        initDropdowns();
        initAlertForm();

        _chart = new PriceChart('chart-container');

        renderAlerts();
        renderNews();
        loadMarketTable();
    }

    window.Components = {
        initComponents,
        openModal,
        closeModal,
        PriceChart,
        addAlert,
        removeAlert,
        getAlerts,
        checkAlerts,
        loadMarketTable,
        get chart() { return _chart; },
    };
})();