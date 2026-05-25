// ── Utils: Debounce ─────────────────────────────────────
function debounce(fn, delay = 300) {
    let timer;
    function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    }
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
}

// ── Utils: Throttle ─────────────────────────────────────
function throttle(fn, limit = 100) {
    let lastCall = 0;
    return function (...args) {
        const now = performance.now();
        if (now - lastCall < limit) return;
        lastCall = now;
        fn.apply(this, args);
    };
}

// ── Utils: Storage ──────────────────────────────────────
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
        try { localStorage.removeItem(key); } catch { /* silent */ }
    },
    has(key) {
        try { return localStorage.getItem(key) !== null; }
        catch { return false; }
    }
};

// ── Utils: Formatting ───────────────────────────────────
function formatCurrency(value, decimals = 2) {
    if (value == null || isNaN(value)) return '$ —';
    const abs = Math.abs(value);
    if (abs >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return '$' + value.toFixed(decimals);
}

function formatPrice(value) {
    if (value == null || isNaN(value)) return '$ —';
    if (value >= 1000) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (value >= 1) return '$' + value.toFixed(2);
    return '$' + value.toFixed(6);
}

function formatPercent(value) {
    if (value == null || isNaN(value)) return '—';
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

function formatLargeNumber(value) {
    if (value == null || isNaN(value)) return '—';
    const v = Number(value);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toString();
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Utils: Reduced Motion ──────────────────────────────
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Utils: DOM helpers ──────────────────────────────────
function $(selector, context = document) {
    return context.querySelector(selector);
}

function $$(selector, context = document) {
    return [...context.querySelectorAll(selector)];
}

function createElement(tag, classes = '', attrs = {}) {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

// ── Utils: API fetch wrapper ────────────────────────────
class ApiError extends Error {
    constructor(message, { status, url, data } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
        this.data = data;
    }
}

async function apiFetch(url, { timeout = 10000, signal: externalSignal, ...options } = {}) {
    const controller = new AbortController();
    if (externalSignal) {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const timer = setTimeout(() => controller.abort(), timeout);
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
            throw new ApiError('Request timed out', { url });
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

// ── Utils: Toast notification ───────────────────────────
const MAX_TOASTS = 5;
function showToast({ title, message = '', type = 'info', duration = 4000 }) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    while (region.children.length >= MAX_TOASTS) {
        region.firstChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + type;

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
    const _svg = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(_svg, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const line1 = document.createElementNS(_svg, 'line');
    line1.setAttribute('x1', '18'); line1.setAttribute('y1', '6');
    line1.setAttribute('x2', '6'); line1.setAttribute('y2', '18');
    const line2 = document.createElementNS(_svg, 'line');
    line2.setAttribute('x1', '6'); line2.setAttribute('y1', '6');
    line2.setAttribute('x2', '18'); line2.setAttribute('y2', '18');
    svg.appendChild(line1);
    svg.appendChild(line2);
    closeBtn.appendChild(svg);
    toast.appendChild(closeBtn);

    const remove = () => {
        toast.classList.add('is-leaving');
        if (!prefersReducedMotion()) {
            toast.style.animation = 'toast-out var(--duration-base) var(--ease-in) forwards';
            toast.addEventListener('animationend', () => { if (toast.parentNode) toast.remove(); }, { once: true });
        } else {
            toast.remove();
        }
    };

    closeBtn.addEventListener('click', remove);
    region.appendChild(toast);

    if (duration > 0) {
        setTimeout(remove, duration);
    }
}

// ── Utils: Theme ────────────────────────────────────────
const STORAGE_KEY = 'theme-preference';

function getTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* silent */ }
}

function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    document.querySelectorAll('#theme-toggle').forEach(btn => {
        btn.setAttribute('aria-pressed', String(next === 'dark'));
        btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
    return next;
}

// ── Exports ─────────────────────────────────────────────
window.Utils = {
    debounce,
    throttle,
    storage,
    formatCurrency,
    formatPrice,
    formatPercent,
    formatLargeNumber,
    formatDate,
    formatTime,
    formatShortDate,
    formatFullDate,
    prefersReducedMotion,
    $,
    $$,
    createElement,
    apiFetch,
    ApiError,
    showToast,
    getTheme,
    applyTheme,
    toggleTheme,
};