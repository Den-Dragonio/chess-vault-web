// analytics.js — Легковесна веб-аналітика для відстеження джерел трафіку Chess Vault
// Завантажується в <head> на всіх сторінках та фіксує перший візит неавторизованого користувача.

(function () {
    const STORAGE_KEY = 'chess_vault_attribution';
    const COOKIE_KEY = 'chess_vault_attribution';
    const DIRECT_ENTRY = 'Прямой заход / Закладки';

    // Безпечна робота з cookies (фолбек для приватного режиму Safari або якщо localStorage недоступний)
    function setCookie(name, value, days) {
        try {
            const expires = new Date(Date.now() + days * 864e5).toUTCString();
            document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) +
                '; expires=' + expires + '; path=/; SameSite=Lax';
        } catch (_) {}
    }

    function getCookie(name) {
        try {
            const prefix = encodeURIComponent(name) + '=';
            const parts = document.cookie.split(';');
            for (let i = 0; i < parts.length; i++) {
                let c = parts[i].trim();
                if (c.indexOf(prefix) === 0) {
                    return decodeURIComponent(c.substring(prefix.length));
                }
            }
        } catch (_) {}
        return null;
    }

    // Безпечне читання збережених даних атрибуції
    function readStoredAttribution() {
        let raw = null;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (_) {}

        if (!raw) {
            raw = getCookie(COOKIE_KEY);
        }

        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (_) {}
        }
        return null;
    }

    // Безпечне збереження даних атрибуції
    function saveAttribution(data) {
        try {
            const jsonStr = JSON.stringify(data);
            try {
                localStorage.setItem(STORAGE_KEY, jsonStr);
            } catch (_) {}
            setCookie(COOKIE_KEY, jsonStr, 90); // Зберігаємо 90 днів
        } catch (_) {}
    }

    // Перевірка, чи користувач вже авторизований на сайті
    function isUserAlreadyAuthenticated() {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
                if (firebase.auth && firebase.auth().currentUser) {
                    return true;
                }
            }
            // Перевірка наявності збереженої сесії Firebase Auth у localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.indexOf('firebase:authUser:') === 0) {
                    const item = localStorage.getItem(k);
                    if (item && item !== 'null') {
                        return true;
                    }
                }
            }
        } catch (_) {}
        return false;
    }

    // Визначення джерела переходу (document.referrer)
    function resolveReferrer() {
        try {
            const ref = (typeof document !== 'undefined' && document.referrer) ? document.referrer.trim() : '';
            if (!ref) {
                return DIRECT_ENTRY;
            }
            try {
                const refUrl = new URL(ref);
                // Якщо перехід відбувся між сторінками самого сайту — фіксуємо як прямий захід
                if (window.location && refUrl.origin === window.location.origin) {
                    return DIRECT_ENTRY;
                }
            } catch (_) {}
            return ref;
        } catch (_) {
            return DIRECT_ENTRY;
        }
    }

    // Отримання UTM-міток з URL
    function parseUtmTags() {
        const utm = {
            utm_source: null,
            utm_medium: null,
            utm_campaign: null
        };
        try {
            if (window.location && window.location.search) {
                const params = new URLSearchParams(window.location.search);
                const s = params.get('utm_source');
                const m = params.get('utm_medium');
                const c = params.get('utm_campaign');
                if (s) utm.utm_source = s.trim();
                if (m) utm.utm_medium = m.trim();
                if (c) utm.utm_campaign = c.trim();
            }
        } catch (_) {}
        return utm;
    }

    // Визначення часового поясу (географічна орієнтація без GPS)
    function getTimezone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch (_) {
            return 'UTC';
        }
    }

    // Визначення типу пристрою (mobile, tablet, desktop)
    function getDeviceType() {
        try {
            const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
            if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
                return 'tablet';
            }
            if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) {
                return 'mobile';
            }
            return 'desktop';
        } catch (_) {
            return 'desktop';
        }
    }

    // Визначення операційної системи
    function getPlatform() {
        try {
            const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
            if (/windows/i.test(ua)) return 'Windows';
            if (/macintosh|mac os x/i.test(ua)) return 'macOS';
            if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
            if (/android/i.test(ua)) return 'Android';
            if (/linux/i.test(ua)) return 'Linux';
            return 'Other';
        } catch (_) {
            return 'Other';
        }
    }

    // Мова системи/браузера
    function getBrowserLanguage() {
        try {
            return (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) ? navigator.language : 'en';
        } catch (_) {
            return 'en';
        }
    }

    // Роздільна здатність екрану
    function getScreenResolution() {
        try {
            if (typeof window !== 'undefined' && window.screen) {
                return `${window.screen.width}x${window.screen.height}`;
            }
        } catch (_) {}
        return null;
    }

    // Фіксація атрибуції при першому вході неавторизованого користувача
    function trackFirstVisit() {
        try {
            // Якщо атрибуція вже зафіксована раніше — не перезаписуємо її
            if (readStoredAttribution()) {
                return;
            }

            // Якщо користувач уже авторизований — ігноруємо
            if (isUserAlreadyAuthenticated()) {
                return;
            }

            const utm = parseUtmTags();
            const referrer = resolveReferrer();
            const landingPage = (window.location && window.location.href) ? window.location.href : '';

            const attributionData = {
                referrer: referrer,
                utm_source: utm.utm_source,
                utm_medium: utm.utm_medium,
                utm_campaign: utm.utm_campaign,
                landing_page: landingPage,
                timezone: getTimezone(),
                device: getDeviceType(),
                platform: getPlatform(),
                language: getBrowserLanguage(),
                screen: getScreenResolution(),
                first_visited_at: new Date().toISOString()
            };

            saveAttribution(attributionData);

            // Асинхронно збагачуємо атрибуцію GeoIP
            const fetchGeo = (typeof getClientGeoIp === 'function') ? getClientGeoIp() : (typeof window !== 'undefined' && window.getClientGeoIp ? window.getClientGeoIp() : null);
            if (fetchGeo && fetchGeo.then) {
                fetchGeo.then(geo => {
                    if (geo) {
                        const cur = readStoredAttribution() || attributionData;
                        cur.ip = geo.ip || cur.ip;
                        cur.country = geo.country || cur.country;
                        cur.city = geo.city || cur.city;
                        cur.country_flag = geo.country_flag || cur.country_flag;
                        saveAttribution(cur);
                    }
                }).catch(() => {});
            }
        } catch (_) {}
    }

    // Запускаємо негайно при завантаженні скрипта
    trackFirstVisit();

    // Експортуємо глобальний інтерфейс для script.js та взаємодії
    window.cvAnalytics = {
        getAttribution: function () {
            let data = readStoredAttribution();
            if (!data) {
                // Фолбек у разі, якщо читання сховища не повернуло об'єкт
                const utm = parseUtmTags();
                data = {
                    referrer: resolveReferrer(),
                    utm_source: utm.utm_source,
                    utm_medium: utm.utm_medium,
                    utm_campaign: utm.utm_campaign,
                    landing_page: (window.location && window.location.href) ? window.location.href : '',
                    timezone: getTimezone(),
                    device: getDeviceType(),
                    platform: getPlatform(),
                    language: getBrowserLanguage(),
                    screen: getScreenResolution(),
                    first_visited_at: new Date().toISOString()
                };
            }
            try {
                const geoStored = localStorage.getItem('cv_client_geoip');
                if (geoStored) {
                    const g = JSON.parse(geoStored);
                    if (g.ip && !data.ip) data.ip = g.ip;
                    if (g.country && !data.country) data.country = g.country;
                    if (g.city && !data.city) data.city = g.city;
                    if (g.country_flag && !data.country_flag) data.country_flag = g.country_flag;
                }
            } catch (_) {}
            return data;
        },
        clearAttribution: function () {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (_) {}
            try {
                document.cookie = encodeURIComponent(COOKIE_KEY) + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
            } catch (_) {}
        },
        resolveReferrer: resolveReferrer,
        parseUtmTags: parseUtmTags,
        getTimezone: getTimezone,
        getDeviceType: getDeviceType,
        getPlatform: getPlatform,
        getBrowserLanguage: getBrowserLanguage
    };
})();
