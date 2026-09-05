(function () {
    'use strict';

    const MOON_ICON = [
        ['path', { d: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z' }],
    ];

    const SUN_ICON = [
        ['circle', { cx: '12', cy: '12', r: '5' }],
        ['line', { x1: '12', y1: '1', x2: '12', y2: '3' }],
        ['line', { x1: '12', y1: '21', x2: '12', y2: '23' }],
        ['line', { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }],
        ['line', { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }],
        ['line', { x1: '1', y1: '12', x2: '3', y2: '12' }],
        ['line', { x1: '21', y1: '12', x2: '23', y2: '12' }],
        ['line', { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }],
        ['line', { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' }],
    ];

    function initThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        function paint(theme) {
            const isDark = theme === 'dark';
            btn.setAttribute('aria-pressed', String(isDark));
            btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
            btn.replaceChildren(Utils.createIcon(20, isDark ? SUN_ICON : MOON_ICON));
        }

        paint(Utils.getTheme());

        btn.addEventListener('click', () => paint(Utils.toggleTheme()));

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (Utils.hasStoredTheme()) return;
            const theme = e.matches ? 'dark' : 'light';
            Utils.applyTheme(theme, { persist: false });
            paint(theme);
        });
    }

    let _searchQuery = '';

    function applySearchFilter() {
        document.querySelectorAll('#market-table-body tr').forEach(row => {
            const haystack = row.dataset.search || row.textContent.toLowerCase();
            row.hidden = _searchQuery !== '' && !haystack.includes(_searchQuery);
        });
    }

    function initSearch() {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', Utils.debounce((e) => {
            _searchQuery = e.target.value.trim().toLowerCase();
            applySearchFilter();
        }, 200));

        searchInput.addEventListener('search', () => {
            _searchQuery = searchInput.value.trim().toLowerCase();
            applySearchFilter();
        });

        document.addEventListener('market-table:rendered', applySearchFilter);

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });
    }

    function setLastUpdate(date) {
        const el = document.getElementById('last-update-time');
        if (!el) return;

        if (!date) {
            el.textContent = '—';
            el.removeAttribute('datetime');
            return;
        }
        el.textContent = Utils.formatClockTime(date);
        el.setAttribute('datetime', date.toISOString());
    }

    function initNavigation() {
        const links = document.querySelectorAll('[data-nav-item]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                links.forEach(l => l.removeAttribute('aria-current'));
                link.setAttribute('aria-current', 'page');
            });
        });
    }

    function initSidebarToggle() {
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const shell = document.getElementById('app-shell');
        if (!toggle || !sidebar) return;

        const supportsInert = 'inert' in HTMLElement.prototype;

        function isMobile() {
            return window.innerWidth < 768;
        }

        function setSidebarHidden(hidden) {
            if (supportsInert) {
                sidebar.inert = hidden;
                return;
            }
            if (hidden) sidebar.setAttribute('aria-hidden', 'true');
            else sidebar.removeAttribute('aria-hidden');
            sidebar.querySelectorAll('a, button, input, select, textarea').forEach(el => {
                if (hidden) el.setAttribute('tabindex', '-1');
                else el.removeAttribute('tabindex');
            });
        }

        function openSidebarMobile() {
            sidebar.classList.add('is-open');
            backdrop?.classList.add('is-visible');
            setSidebarHidden(false);
            toggle.setAttribute('aria-expanded', 'true');
            sidebar.querySelector('a, button')?.focus();
        }

        function closeSidebarMobile({ restoreFocus = false } = {}) {
            sidebar.classList.remove('is-open');
            backdrop?.classList.remove('is-visible');
            setSidebarHidden(true);
            toggle.setAttribute('aria-expanded', 'false');
            if (restoreFocus) toggle.focus();
        }

        toggle.addEventListener('click', () => {
            if (isMobile()) {
                if (sidebar.classList.contains('is-open')) closeSidebarMobile({ restoreFocus: true });
                else openSidebarMobile();
            } else {
                const collapsed = shell?.classList.toggle('sidebar-collapsed');
                toggle.setAttribute('aria-expanded', String(!collapsed));
            }
        });

        backdrop?.addEventListener('click', () => closeSidebarMobile({ restoreFocus: true }));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMobile() && sidebar.classList.contains('is-open')) {
                closeSidebarMobile({ restoreFocus: true });
            }
        });

        let wasMobile = isMobile();
        window.addEventListener('resize', Utils.debounce(() => {
            const nowMobile = isMobile();
            if (nowMobile === wasMobile) return;
            wasMobile = nowMobile;

            if (nowMobile) {
                shell?.classList.remove('sidebar-collapsed');
                closeSidebarMobile();
            } else {
                sidebar.classList.remove('is-open');
                backdrop?.classList.remove('is-visible');
                setSidebarHidden(false);
                toggle.setAttribute('aria-expanded', 'true');
            }
        }, 150));

        if (isMobile()) closeSidebarMobile();
        else toggle.setAttribute('aria-expanded', 'true');
    }

    function initPlaceholderLinks() {
        document.querySelectorAll('.app-footer__links a, .logo').forEach(link => {
            link.addEventListener('click', (e) => e.preventDefault());
        });
    }

    function initLayout() {
        initThemeToggle();
        initSearch();
        initSidebarToggle();
        initNavigation();
        initPlaceholderLinks();
        setLastUpdate(null);
    }

    window.Layout = {
        initLayout,
        setLastUpdate,
        applySearchFilter,
    };
})();