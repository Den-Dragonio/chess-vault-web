// dark-mode-init.js — завантажується в <head>, до рендеру сторінки
// Пріоритет: 1) налаштування системи  2) поточний час (20:00–07:00 = темна)
(function () {
    try {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        var prefersLight = window.matchMedia('(prefers-color-scheme: light)');

        if (prefersDark.matches) {
            // Система явно хоче темну — CSS @media сам справляється
            // але додаємо клас щоб javascript теж міг реагувати
            document.documentElement.classList.add('dark');
        } else if (!prefersLight.matches) {
            // Немає явних налаштувань → перевіряємо час
            var h = new Date().getHours();
            if (h >= 20 || h < 7) {
                document.documentElement.classList.add('dark');
            }
        }
    } catch (e) { /* silent fail */ }
})();
