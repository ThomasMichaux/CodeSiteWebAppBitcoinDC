(function () {
    'use strict';

    function debounce(fn, delay = 300) {
        let timer;
        function debounced(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        }
        debounced.cancel = () => clearTimeout(timer);
        return debounced;
    }

    const storage = {
        get(key, fallback = null) {
            try {
                const item = localStorage.getItem(key);
                return item !== null ? JSON.parse(item) : fallback;
            } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch { return false; }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch { }
        },
        has(key) {
            try { return localStorage.getItem(key) !== null; }
            catch { return false; }
        }
    };

    function isNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function formatCurrency(value, decimals = 2) {
        if (!isNumber(value)) return '$ —';
        const abs = Math.abs(value);
        if (abs >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
        if (abs >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
        return '$' + value.toFixed(decimals);
    }

    function formatPrice(value) {
        if (!isNumber(value)) return '$ —';
        if (Math.abs(value) >= 1000) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (Math.abs(value) >= 1) return '$' + value.toFixed(2);
        return '$' + value.toFixed(6);
    }

    function formatPercent(value) {
        if (!isNumber(value)) return '—';
        return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
    }

    function formatLargeNumber(value) {
        if (!isNumber(value)) return '—';
        const abs = Math.abs(value);
        if (abs >= 1e9) return (value / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        return value.toString();
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatShortDate(ms) {
        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatFullDate(ms) {
        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
            d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function formatClockTime(date = new Date()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function createElement(tag, classes = '', attrs = {}) {
        const el = document.createElement(tag);
        if (classes) el.className = classes;
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function createIcon(size, shapes) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        shapes.forEach(([tag, attrs]) => {
            const shape = document.createElementNS(SVG_NS, tag);
            Object.entries(attrs).forEach(([k, v]) => shape.setAttribute(k, v));
            svg.appendChild(shape);
        });
        return svg;
    }

    class ApiError extends Error {
        constructor(message, { status = 0, url, data } = {}) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.url = url;
            this.data = data;
        }
    }

    async function apiFetch(url, { timeout = 10000, signal: externalSignal, ...options } = {}) {
        const controller = new AbortController();
        let timedOut = false;

        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) controller.abort();
            else externalSignal.addEventListener('abort', onExternalAbort);
        }

        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        try {
            const { headers: customHeaders, ...fetchOptions } = options;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json', ...customHeaders },
                signal: controller.signal,
                ...fetchOptions,
            });
            const contentType = response.headers.get('Content-Type') ?? '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();
            if (!response.ok) {
                throw new ApiError(
                    data?.message || data?.error || `HTTP ${response.status}`,
                    { status: response.status, url, data }
                );
            }
            return data;
        } catch (err) {
            if (err.name === 'AbortError') {
                throw timedOut
                    ? new ApiError('Request timed out', { url })
                    : new ApiError('Request cancelled', { url });
            }
            throw err;
        } finally {
            clearTimeout(timer);
            if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
        }
    }

    const MAX_TOASTS = 5;

    function showToast({ title, message = '', type = 'info', duration = 4000, key = null }) {
        const region = document.getElementById('toast-region');
        if (!region) return null;

        if (key && region.querySelector(`[data-toast-key="${CSS.escape(key)}"]`)) return null;

        while (region.children.length >= MAX_TOASTS) {
            region.firstChild.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        if (key) toast.dataset.toastKey = key;

        const body = document.createElement('div');
        body.className = 'toast__body';
        const titleEl = document.createElement('p');
        titleEl.className = 'toast__title';
        titleEl.textContent = title;
        body.appendChild(titleEl);
        if (message) {
            const msgEl = document.createElement('p');
            msgEl.className = 'toast__message';
            msgEl.textContent = message;
            body.appendChild(msgEl);
        }
        toast.appendChild(body);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn btn--icon btn--ghost';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.appendChild(createIcon(16, [
            ['line', { x1: '18', y1: '6', x2: '6', y2: '18' }],
            ['line', { x1: '6', y1: '6', x2: '18', y2: '18' }],
        ]));
        toast.appendChild(closeBtn);

        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            toast.classList.add('is-leaving');
            if (prefersReducedMotion()) {
                toast.remove();
                return;
            }
            toast.style.animation = 'toast-out var(--duration-base) var(--ease-in) forwards';
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        };

        closeBtn.addEventListener('click', remove);
        region.appendChild(toast);

        if (duration > 0) setTimeout(remove, duration);

        return toast;
    }

    const STORAGE_KEY = 'theme-preference';

    function getTheme() {
        const root = document.documentElement.dataset.theme;
        if (root === 'dark' || root === 'light') return root;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'dark' || stored === 'light') return stored;
        } catch { }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme, { persist = true } = {}) {
        document.documentElement.dataset.theme = theme;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch { }
        }
    }

    function hasStoredTheme() {
        try { return localStorage.getItem(STORAGE_KEY) !== null; }
        catch { return false; }
    }

    function toggleTheme() {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return next;
    }

    window.Utils = {
        debounce,
        storage,
        isNumber,
        formatCurrency,
        formatPrice,
        formatPercent,
        formatLargeNumber,
        formatDate,
        formatShortDate,
        formatFullDate,
        formatClockTime,
        prefersReducedMotion,
        createElement,
        createIcon,
        apiFetch,
        ApiError,
        showToast,
        getTheme,
        applyTheme,
        hasStoredTheme,
        toggleTheme,
        THEME_STORAGE_KEY: STORAGE_KEY,
    };
})();