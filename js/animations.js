let _revealObserver = null;

function initScrollReveal() {
    const els = document.querySelectorAll('[data-reveal], [data-reveal-stagger] > *');
    if (els.length === 0) return;

    if (Utils.prefersReducedMotion()) {
        els.forEach(el => el.classList.add('is-visible'));
        return;
    }

    if (_revealObserver) _revealObserver.disconnect();

    _revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => _revealObserver.observe(el));
}

// ── Staggered Entry ─────────────────────────────────────
function staggeredEntry(containerSelector, itemSelector, staggerDelay = 80) {
    if (Utils.prefersReducedMotion()) return;
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const items = container.querySelectorAll(itemSelector);
    items.forEach((item, i) => {
        item.style.setProperty('animation-delay', (i * staggerDelay) + 'ms', 'important');
        item.classList.add('animate-fade-in-up');
    });
}

// ── Number Tween ────────────────────────────────────────
const _animFrames = new WeakMap();

function animateNumber(el, target, { duration = 600, prefix = '', suffix = '', decimals = 0 } = {}) {
    const old = _animFrames.get(el);
    if (old) cancelAnimationFrame(old);

    const currentVal = parseFloat(el.textContent.replace(/[^0-9.\-]/g, '')) || 0;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = currentVal + (target - currentVal) * eased;
        el.textContent = prefix + current.toFixed(decimals) + suffix;
        if (progress < 1) {
            _animFrames.set(el, requestAnimationFrame(update));
        } else {
            _animFrames.delete(el);
        }
    }

    _animFrames.set(el, requestAnimationFrame(update));
}

// ── Exports ─────────────────────────────────────────────
window.Animations = {
    initScrollReveal,
    staggeredEntry,
    animateNumber,
};