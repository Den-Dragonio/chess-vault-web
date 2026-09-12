// dark-mode-init.js — завантажується в <head>, до рендеру сторінки
// За замовчуванням для неавторизованих: 'system' (на основі prefers-color-scheme ОС)
(function () {
    try {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else if (theme === 'light') {
                document.documentElement.classList.remove('dark');
            } else {
                // system
                if (prefersDark.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        }

        var theme = localStorage.getItem('chess_theme') || 'system';
        applyTheme(theme);

        // Слухач зміни системної теми ОС в режимі 'system'
        if (prefersDark.addEventListener) {
            prefersDark.addEventListener('change', function (e) {
                var current = localStorage.getItem('chess_theme') || 'system';
                if (current === 'system') {
                    if (e.matches) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                }
            });
        }

        window.applyTheme = applyTheme;
    } catch (e) { /* silent fail */ }
})();

