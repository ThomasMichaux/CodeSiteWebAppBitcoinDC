// ── Theme Toggle ────────────────────────────────────────
function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const current = Utils.getTheme();
    btn.setAttribute('aria-pressed', String(current === 'dark'));
    btn.setAttribute('aria-label', current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');

    btn.addEventListener('click', () => Utils.toggleTheme());

    const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    function onThemeChange(e) {
        if (!localStorage.getItem('theme-preference')) {
            document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
            btn.setAttribute('aria-pressed', String(e.matches));
        }
    }
    darkModeMedia.addEventListener('change', onThemeChange);
}

// ── Search ──────────────────────────────────────────────
function initSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', Utils.debounce((e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) return;

        // Search through the market table
        const rows = document.querySelectorAll('#market-table-body tr');
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(2)')?.textContent?.toLowerCase() || '';
            row.style.display = name.includes(query) ? '' : 'none';
        });
    }, 300));

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

// ── Update Time Display ────────────────────────────────
let _updateTimer;
function initUpdateTime() {
    const el = document.getElementById('last-update-time');
    if (!el) return;

    function update() {
        el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    update();
    if (_updateTimer) clearInterval(_updateTimer);
    _updateTimer = setInterval(update, 30000);
}

// ── Navigation Active State ────────────────────────────
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

// ── Sidebar Toggle ────────────────────────────────────
function initSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const shell = document.getElementById('app-shell');
    if (!toggle || !sidebar) return;

    function isMobile() {
        return window.innerWidth < 768;
    }

    function setSidebarFocusable(open) {
        const focusable = sidebar.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
        focusable.forEach(el => {
            if (open) {
                el.removeAttribute('tabindex');
            } else {
                el.setAttribute('tabindex', '-1');
            }
        });
        if (open) {
            sidebar.removeAttribute('aria-hidden');
        } else {
            sidebar.setAttribute('aria-hidden', 'true');
        }
    }

    function openSidebarMobile() {
        sidebar.classList.add('is-open');
        backdrop?.classList.add('is-visible');
        setSidebarFocusable(true);
    }

    function closeSidebarMobile() {
        sidebar.classList.remove('is-open');
        backdrop?.classList.remove('is-visible');
        setSidebarFocusable(false);
        toggle.focus();
    }

    function toggleSidebar() {
        if (isMobile()) {
            if (sidebar.classList.contains('is-open')) {
                closeSidebarMobile();
            } else {
                openSidebarMobile();
            }
        } else {
            shell?.classList.toggle('sidebar-collapsed');
        }
    }

    toggle.addEventListener('click', toggleSidebar);

    // Search wrapper click expands sidebar on desktop/tablet
    const searchWrapper = document.querySelector('.search-wrapper');
    searchWrapper?.addEventListener('click', () => {
        if (getComputedStyle(sidebar).position !== 'fixed') {
            shell?.classList.remove('sidebar-collapsed');
        }
    });

    // Close sidebar on backdrop click (mobile)
    backdrop?.addEventListener('click', () => {
        closeSidebarMobile();
    });

    // Handle resize: sync mobile/desktop states
    let wasMobile = isMobile();
    const handleResize = Utils.debounce(() => {
        const nowMobile = isMobile();
        if (nowMobile !== wasMobile) {
            wasMobile = nowMobile;
            if (nowMobile) {
                // Switching to mobile — ensure sidebar is hidden, remove collapsed
                closeSidebarMobile();
                shell?.classList.remove('sidebar-collapsed');
            } else {
                // Switching to desktop — reset mobile states
                sidebar.classList.remove('is-open');
                backdrop?.classList.remove('is-visible');
                setSidebarFocusable(true);
            }
        }
    }, 100);
    window.addEventListener('resize', handleResize);

    // Keyboard: Escape closes sidebar on mobile
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMobile() && sidebar.classList.contains('is-open')) {
            closeSidebarMobile();
        }
    });

    // Initialise closed state on mobile
    if (isMobile()) {
        closeSidebarMobile();
    }
}

// ── Placeholder Links ──────────────────────────────────
function initPlaceholderLinks() {
    const links = document.querySelectorAll('.app-footer__links a, .section-header__action, .logo');
    links.forEach(link => {
        link.addEventListener('click', (e) => e.preventDefault());
    });
}

// ── Init Layout ────────────────────────────────────────
function initLayout() {
    initThemeToggle();
    initSearch();
    initSidebarToggle();
    initUpdateTime();
    initNavigation();
    initPlaceholderLinks();
}

window.Layout = {
    initLayout,
};