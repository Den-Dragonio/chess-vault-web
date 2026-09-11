// dark-mode-init.js — завантажується в <head>, до рендеру сторінки
// Пріоритет: 1) збережене налаштування користувача  2) налаштування системи  3) час доби
(function () {
    try {
        var theme = localStorage.getItem('chess_theme') || 'system';
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (theme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // system
            if (prefersDark.matches) {
                document.documentElement.classList.add('dark');
            } else {
                var h = new Date().getHours();
                if (h >= 20 || h < 7) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        }
    } catch (e) { /* silent fail */ }
})();
