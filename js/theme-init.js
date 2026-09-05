(function () {
    var root = document.documentElement;

    var preferred = 'light';
    try {
        preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) { }

    var stored = null;
    try {
        stored = localStorage.getItem('theme-preference');
    } catch (e) { }

    root.dataset.theme = (stored === 'dark' || stored === 'light') ? stored : preferred;
    root.classList.remove('no-js');
})();