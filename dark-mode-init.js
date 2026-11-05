// dark-mode-init.js — завантажується в <head>, до рендеру сторінки
(function () {
    try {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        function cloudTimeMs(value) {
            if (!value) return 0;
            if (typeof value === 'number') return value;
            if (typeof value.toMillis === 'function') return value.toMillis();
            if (typeof value.seconds === 'number') return value.seconds * 1000;
            return 0;
        }

        function applyTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            } else if (theme === 'light') {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
            } else if (prefersDark.matches) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
            }
        }

        function persistThemeChoice(theme) {
            localStorage.setItem('chess_theme', theme);
            localStorage.setItem('chess_theme_ts', String(Date.now()));
            applyTheme(theme);
        }

        function applyThemeFromCloud(cloudTheme, cloudUpdatedAt) {
            if (!cloudTheme) return;
            var local = localStorage.getItem('chess_theme');
            var localTs = parseInt(localStorage.getItem('chess_theme_ts') || '0', 10);
            var cloudTs = cloudTimeMs(cloudUpdatedAt);
            if (local && localTs && (!cloudTs || localTs >= cloudTs)) {
                applyTheme(local);
                return;
            }
            localStorage.setItem('chess_theme', cloudTheme);
            if (cloudTs) localStorage.setItem('chess_theme_ts', String(cloudTs));
            applyTheme(cloudTheme);
        }

        applyTheme(localStorage.getItem('chess_theme') || 'system');

        if (prefersDark.addEventListener) {
            prefersDark.addEventListener('change', function (e) {
                var current = localStorage.getItem('chess_theme') || 'system';
                if (current === 'system') {
                    document.documentElement.classList.toggle('dark', e.matches);
                    document.documentElement.classList.toggle('light', !e.matches);
                }
            });
        }

        window.applyTheme = applyTheme;
        window.persistThemeChoice = persistThemeChoice;
        window.applyThemeFromCloud = applyThemeFromCloud;

        window.addEventListener('pageshow', function () {
            applyTheme(localStorage.getItem('chess_theme') || 'system');
        });

        window.addEventListener('storage', function (e) {
            if (e.key === 'chess_theme' || e.key === 'chess_theme_ts') {
                applyTheme(localStorage.getItem('chess_theme') || 'system');
            }
        });

        var hint = localStorage.getItem('cv_auth_hint');
        if (hint === 'user' || hint === 'admin') {
            document.documentElement.classList.add('auth-hint-in');
            if (hint === 'admin') document.documentElement.classList.add('auth-hint-admin');
        }

        window.setAuthHint = function (user, isAdmin) {
            if (user) {
                localStorage.setItem('cv_auth_hint', isAdmin ? 'admin' : 'user');
                document.documentElement.classList.add('auth-hint-in');
                document.documentElement.classList.toggle('auth-hint-admin', !!isAdmin);
            } else {
                localStorage.removeItem('cv_auth_hint');
                document.documentElement.classList.remove('auth-hint-in', 'auth-hint-admin');
            }
        };

        var bootCss = document.createElement('style');
        bootCss.setAttribute('data-cv-boot', '1');
        bootCss.textContent = [
            '.main-header{opacity:1!important;visibility:visible!important;}',
            'html.auth-hint-in #nav-my-account{display:flex!important;}',
            'html.auth-hint-admin #nav-admin-link{display:flex!important;}',
            'html.dark .main-header{background:rgba(12,12,20,.92);}'
        ].join('');
        document.documentElement.appendChild(bootCss);
    } catch (e) { /* silent fail */ }
})();
