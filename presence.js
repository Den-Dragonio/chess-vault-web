// presence.js — Відстеження активності користувачів (Online Status / Heartbeat) та GeoIP
// Забезпечує актуальний статус "Онлайн зараз" та фіксацію IP / локації користувачів

(function () {
    let cachedGeoIp = null;

    // Отримання GeoIP клієнта (IP, місто, країна, прапор) з кешуванням у localStorage на 12 годин
    async function getClientGeoIp() {
        if (cachedGeoIp) return cachedGeoIp;

        try {
            const stored = localStorage.getItem('cv_client_geoip');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() - (parsed._ts || 0) < 12 * 3600 * 1000) {
                    cachedGeoIp = parsed;
                    return parsed;
                }
            }
        } catch (_) {}

        function getFlagEmoji(countryCode) {
            if (!countryCode || countryCode.length !== 2) return '🌐';
            try {
                const codePoints = countryCode
                    .toUpperCase()
                    .split('')
                    .map(char => 127397 + char.charCodeAt(0));
                return String.fromCodePoint(...codePoints);
            } catch (_) {
                return '🌐';
            }
        }

        // Спроба 1: ipwho.is (повертає повну гео-інформацію та emoji прапора)
        try {
            const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data && (data.ip || data.country)) {
                    cachedGeoIp = {
                        ip: data.ip || '',
                        country: data.country || '',
                        country_code: data.country_code || '',
                        city: data.city || '',
                        country_flag: (data.flag && data.flag.emoji) ? data.flag.emoji : getFlagEmoji(data.country_code),
                        _ts: Date.now()
                    };
                    try { localStorage.setItem('cv_client_geoip', JSON.stringify(cachedGeoIp)); } catch (_) {}
                    return cachedGeoIp;
                }
            }
        } catch (e) {
            console.warn('ipwho.is fetch failed:', e);
        }

        // Спроба 2: api.db-ip.com (альтернативний повноцінний GeoIP)
        try {
            const res2 = await fetch('https://api.db-ip.com/v2/free/self', { cache: 'no-store' });
            if (res2.ok) {
                const data2 = await res2.json();
                if (data2 && data2.ipAddress) {
                    cachedGeoIp = {
                        ip: data2.ipAddress,
                        country: data2.countryName || '',
                        country_code: data2.countryCode || '',
                        city: data2.city || '',
                        country_flag: getFlagEmoji(data2.countryCode),
                        _ts: Date.now()
                    };
                    try { localStorage.setItem('cv_client_geoip', JSON.stringify(cachedGeoIp)); } catch (_) {}
                    return cachedGeoIp;
                }
            }
        } catch (_) {}

        // Спроба 3 (фолбек на чистий IP): api.ipify.org
        try {
            const res3 = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
            if (res3.ok) {
                const d3 = await res3.json();
                if (d3 && d3.ip) {
                    cachedGeoIp = {
                        ip: d3.ip,
                        country: '',
                        country_code: '',
                        city: '',
                        country_flag: '🌐',
                        _ts: Date.now()
                    };
                    try { localStorage.setItem('cv_client_geoip', JSON.stringify(cachedGeoIp)); } catch (_) {}
                    return cachedGeoIp;
                }
            }
        } catch (_) {}

        return null;
    }
    window.getClientGeoIp = getClientGeoIp;

    let lastPresencePing = 0;

    // Оновлення мітки активності (Heartbeat) у Firestore
    async function trackUserPresence(user) {
        if (!user) return;
        const db = window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null);
        if (!db) return;

        const now = Date.now();
        // Захист від занадто частих записів: не частіше ніж раз на 60 секунд на вкладку
        if (now - lastPresencePing < 60 * 1000) return;
        lastPresencePing = now;

        try {
            const username = user.displayName || (user.email ? user.email.split('@')[0] : 'user');
            const geo = await getClientGeoIp();
            const currentPage = (window.location.pathname.split('/').pop() || 'index.html');

            const payload = {
                uid: user.uid,
                username: username,
                last_active_at: firebase.firestore.FieldValue.serverTimestamp(),
                last_page: currentPage
            };

            if (geo) {
                if (geo.ip) payload.ip = geo.ip;
                if (geo.country) payload.country = geo.country;
                if (geo.country_code) payload.country_code = geo.country_code;
                if (geo.city) payload.city = geo.city;
                if (geo.country_flag) payload.country_flag = geo.country_flag;
            }

            try {
                payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                const ua = navigator.userAgent || '';
                const plat = navigator.platform || '';
                let detectedPlat = 'Десктоп';
                if (/iphone|ipad|ipod/i.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1)) detectedPlat = 'iOS';
                else if (/macintosh|mac os x|macintel|darwin|mac/i.test(ua) || /mac/i.test(plat)) detectedPlat = 'macOS';
                else if (/windows|win32|win64/i.test(ua) || /win/i.test(plat)) detectedPlat = 'Windows';
                else if (/android/i.test(ua)) detectedPlat = 'Android';
                else if (/linux/i.test(ua) || /linux/i.test(plat)) detectedPlat = 'Linux';

                payload.device = (/Mobi|Android|iPhone|iPad/i.test(ua) || detectedPlat === 'iOS' || detectedPlat === 'Android') ? 'mobile' : 'desktop';
                payload.platform = detectedPlat;
            } catch (_) {}

            // Оновлюємо users doc (за UID)
            db.collection('users').doc(user.uid).set(payload, { merge: true }).catch(() => {});

            // Оновлюємо usernames doc (за нікнеймом)
            if (username && username !== user.uid) {
                db.collection('usernames').doc(username.toLowerCase().replace(/\s+/g, '_')).set(payload, { merge: true }).catch(() => {});
            }

            // Оновлюємо user_preferences doc (якщо існує)
            db.collection('user_preferences').doc(user.uid).set({
                last_active_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(() => {});
        } catch (err) {
            console.warn('Presence ping failed:', err);
        }
    }
    window.trackUserPresence = trackUserPresence;

    // Автоматична ініціалізація слухача авторизації
    function initPresenceWatcher() {
        if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
            setTimeout(initPresenceWatcher, 150);
            return;
        }

        const auth = window.auth || firebase.auth();
        auth.onAuthStateChanged(user => {
            if (user) {
                // Миттєвий пінг при переході/відкритті сторінки
                trackUserPresence(user);

                // Періодичний heartbeat кожні 90 секунд (поки вкладка відкрита та активна)
                if (!window._presenceHeartbeatInterval) {
                    window._presenceHeartbeatInterval = setInterval(() => {
                        if (!document.hidden && auth.currentUser) {
                            trackUserPresence(auth.currentUser);
                        }
                    }, 90 * 1000);
                }
            } else {
                if (window._presenceHeartbeatInterval) {
                    clearInterval(window._presenceHeartbeatInterval);
                    window._presenceHeartbeatInterval = null;
                }
            }
        });

        // Повернення користувача на вкладку (пінг якщо минуло > 60 сек)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && auth.currentUser) {
                trackUserPresence(auth.currentUser);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPresenceWatcher);
    } else {
        initPresenceWatcher();
    }
})();
