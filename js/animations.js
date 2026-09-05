(function () {
    'use strict';

    const REVEAL_SELECTOR = '[data-reveal]:not(.is-visible), [data-reveal-stagger] > :not(.is-visible)';

    let _revealObserver = null;

    function initScrollReveal() {
        const pending = document.querySelectorAll(REVEAL_SELECTOR);
        if (pending.length === 0) return;

        if (Utils.prefersReducedMotion()) {
            pending.forEach(el => el.classList.add('is-visible'));
            return;
        }

        if (!_revealObserver) {
            _revealObserver = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                });
            }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
        }

        pending.forEach(el => _revealObserver.observe(el));
    }

    const _animFrames = new WeakMap();
    const _lastValues = new WeakMap();

    function animateNumber(el, target, { duration = 600, format = String } = {}) {
        if (!el) return;

        const pending = _animFrames.get(el);
        if (pending) {
            cancelAnimationFrame(pending);
            _animFrames.delete(el);
        }

        if (!Utils.isNumber(target)) {
            _lastValues.delete(el);
            el.textContent = format(target);
            return;
        }

        const previous = _lastValues.get(el);
        _lastValues.set(el, target);

        if (!Utils.isNumber(previous) || previous === target || Utils.prefersReducedMotion()) {
            el.textContent = format(target);
            return;
        }

        const start = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = format(previous + (target - previous) * eased);
            if (progress < 1) {
                _animFrames.set(el, requestAnimationFrame(step));
            } else {
                _animFrames.delete(el);
                el.textContent = format(target);
            }
        }

        _animFrames.set(el, requestAnimationFrame(step));
    }

    window.Animations = {
        initScrollReveal,
        animateNumber,
    };
})();