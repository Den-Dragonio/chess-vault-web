// admin.js — Логіка аналітичної панелі адміністратора Chess Vault

(function () {
    const auth = window.auth || firebase.auth();
    const db = window.db || firebase.firestore();

    let allUsers = [];
    let allDownloads = [];
    let allActivities = [];

    function toFakeEmail(username) {
        return username.toLowerCase().trim().replace(/\s+/g, '_') + '@chess-lib.local';
    }

    // ========================================================
    // 1. АВТОРИЗАЦІЯ В АДМІН-ПАНЕЛІ ТА ПЕРЕВІРКА ПРАВ
    // ========================================================
    // Список дозволених логінів адміністраторів (виключно головний адмін)
    const ALLOWED_ADMINS = [
        'admin',
        'админ'
    ];

    function isAdminUser(user) {
        if (!user) return false;
        if (typeof window.isChessAdmin === 'function') {
            return window.isChessAdmin(user);
        }
        const name = (user.displayName || (user.email ? user.email.split('@')[0] : '')).toLowerCase().trim();
        const email = (user.email || '').toLowerCase().trim();
        return ALLOWED_ADMINS.some(adm => {
            const a = adm.toLowerCase().trim();
            return name === a || email === `${a}@chess-lib.local` || email === a;
        });
    }

    const barrierWrap = document.getElementById('auth-barrier-wrap');
    const dashboardWrap = document.getElementById('admin-dashboard-wrap');
    const loginForm = document.getElementById('admin-login-form');
    const authErr = document.getElementById('admin-auth-err');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const adminLabel = document.getElementById('current-admin-label');
    const refreshBtn = document.getElementById('refresh-data-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authErr.textContent = '';
        const userVal = document.getElementById('admin-user').value.trim();
        const passVal = document.getElementById('admin-pass').value;

        if (!userVal || !passVal) {
            authErr.textContent = 'Введіть логін та пароль';
            return;
        }

        try {
            // Спроба входу через псевдо-email або прямий email
            const email = userVal.includes('@') ? userVal : toFakeEmail(userVal);
            const cred = await auth.signInWithEmailAndPassword(email, passVal);
            if (!isAdminUser(cred.user)) {
                await auth.signOut();
                authErr.textContent = '❌ Доступ заборонено: обліковий запис не має прав адміністратора.';
            }
        } catch (err) {
            console.error('Admin login error:', err);
            authErr.textContent = 'Невірні облікові дані або помилка доступу (' + (err.message || err.code) + ')';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
    });

    refreshBtn.addEventListener('click', () => {
        refreshBtn.textContent = '⏳ Оновлення...';
        loadAllDashboardData().finally(() => {
            setTimeout(() => { refreshBtn.textContent = '🔄 Оновити'; }, 600);
        });
    });

    auth.onAuthStateChanged((user) => {
        if (user) {
            if (isAdminUser(user)) {
                barrierWrap.style.display = 'none';
                dashboardWrap.style.display = 'block';
                const name = user.displayName || user.email.split('@')[0];
                adminLabel.textContent = `👤 ${name}`;
                loadAllDashboardData();
            } else {
                dashboardWrap.style.display = 'none';
                barrierWrap.style.display = 'block';
                const name = user.displayName || user.email.split('@')[0];
                authErr.innerHTML = `❌ Доступ заборонено. Користувач <strong>${esc(name)}</strong> не має прав адміністратора. Панель доступна виключно головному адміністратору (<strong>admin</strong>).<br><a href="#" id="force-logout-link" style="color:#d4af37;text-decoration:underline;margin-top:8px;display:inline-block;">Увійти як admin</a>`;
                const forceLink = document.getElementById('force-logout-link');
                if (forceLink) {
                    forceLink.onclick = async (e) => {
                        e.preventDefault();
                        await auth.signOut();
                    };
                }
            }
        } else {
            dashboardWrap.style.display = 'none';
            barrierWrap.style.display = 'block';
        }
    });

    // ========================================================
    // 2. ЗАВАНТАЖЕННЯ ТА ЗВЕДЕННЯ ДАНИХ (Data Aggregation)
    // ========================================================
    async function loadAllDashboardData() {
        try {
            // Запити до всіх джерел даних паралельно, включно з GeoIP клієнта
            const [usernamesSnap, usersSnap, prefsSnap, downloadsSnap, newsSnap, currentGeo] = await Promise.all([
                db.collection('usernames').get().catch(err => { console.warn('usernames fetch warning:', err); return { docs: [] }; }),
                db.collection('users').get().catch(err => { console.warn('users fetch warning:', err); return { docs: [] }; }),
                db.collection('user_preferences').get().catch(err => { console.warn('prefs fetch warning:', err); return { docs: [] }; }),
                db.collection('downloads').get().catch(err => { console.warn('downloads fetch warning:', err); return { docs: [] }; }),
                db.collection('news').get().catch(err => { console.warn('news fetch warning:', err); return { docs: [] }; }),
                (window.getClientGeoIp ? window.getClientGeoIp().catch(() => null) : Promise.resolve(null))
            ]);

            // Об'єднання користувачів з усіх доступних джерел (usernames, users, preferences, news, downloads)
            const userMap = new Map();

            function getOrCreateUser(username, uid = null) {
                const normName = (username || '').trim();
                const key = (normName || uid || 'unknown').toLowerCase();

                // Шукаємо за ім'ям або за UID
                for (const [k, u] of userMap.entries()) {
                    if ((normName && u.username.toLowerCase() === normName.toLowerCase()) || (uid && u.uid === uid)) {
                        if (uid && (!u.uid || u.uid.startsWith('usr_'))) u.uid = uid;
                        if (normName && (!u.username || u.username === u.uid)) u.username = normName;
                        return u;
                    }
                }

                const newUser = {
                    uid: uid || ('usr_' + key.replace(/\s+/g, '_')),
                    username: normName || uid || 'Користувач',
                    createdAt: null,
                    referrer: 'Прямой заход / Закладки',
                    utm_source: null,
                    utm_medium: null,
                    utm_campaign: null,
                    landing_page: null,
                    timezone: 'UTC',
                    device: 'desktop',
                    platform: null,
                    ip: null,
                    country: null,
                    city: null,
                    country_flag: null,
                    downloads_count: 0,
                    last_active_at: null,
                    downloaded_books: []
                };
                userMap.set(key, newUser);
                return newUser;
            }

            // 1. Джерело: usernames
            usernamesSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                const uName = data.username || doc.id;
                const u = getOrCreateUser(uName, data.uid || doc.id);
                if (data.createdAt) u.createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (data.last_active_at) {
                    const lDate = data.last_active_at.toDate ? data.last_active_at.toDate() : new Date(data.last_active_at);
                    if (!u.last_active_at || lDate > u.last_active_at) u.last_active_at = lDate;
                }
                if (data.ip) u.ip = data.ip;
                if (data.country) u.country = data.country;
                if (data.city) u.city = data.city;
                if (data.country_flag) u.country_flag = data.country_flag;
                if (data.referrer) u.referrer = data.referrer;
                if (data.utm_source) u.utm_source = data.utm_source;
                if (data.landing_page) u.landing_page = data.landing_page;
                if (data.timezone) u.timezone = data.timezone;
                if (data.device) u.device = data.device;
                if (data.platform) u.platform = data.platform;
            });

            // 2. Джерело: users
            usersSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                const u = getOrCreateUser(data.username, data.uid || doc.id);
                if (data.username) u.username = data.username;
                if (data.createdAt && !u.createdAt) u.createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (data.last_active_at) {
                    const lDate = data.last_active_at.toDate ? data.last_active_at.toDate() : new Date(data.last_active_at);
                    if (!u.last_active_at || lDate > u.last_active_at) u.last_active_at = lDate;
                }
                if (data.ip) u.ip = data.ip;
                if (data.country) u.country = data.country;
                if (data.city) u.city = data.city;
                if (data.country_flag) u.country_flag = data.country_flag;
                if (data.downloads_count) u.downloads_count = Math.max(u.downloads_count, data.downloads_count);
                if (data.referrer && (!u.referrer || u.referrer === 'Прямой заход / Закладки')) u.referrer = data.referrer;
                if (data.utm_source) u.utm_source = data.utm_source;
                if (data.utm_medium) u.utm_medium = data.utm_medium;
                if (data.utm_campaign) u.utm_campaign = data.utm_campaign;
                if (data.landing_page) u.landing_page = data.landing_page;
                if (data.timezone) u.timezone = data.timezone;
                if (data.device) u.device = data.device;
                if (data.platform) u.platform = data.platform;
            });

            // 3. Джерело: user_preferences
            prefsSnap.docs.forEach(doc => {
                const uid = doc.id;
                const data = doc.data() || {};
                const u = getOrCreateUser(data.username, uid);
                if (data.createdAt && !u.createdAt) u.createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (data.last_active_at) {
                    const lDate = data.last_active_at.toDate ? data.last_active_at.toDate() : new Date(data.last_active_at);
                    if (!u.last_active_at || lDate > u.last_active_at) u.last_active_at = lDate;
                }
                if (data.ip && !u.ip) u.ip = data.ip;
                if (data.country && !u.country) u.country = data.country;
                if (data.city && !u.city) u.city = data.city;
                if (data.country_flag && !u.country_flag) u.country_flag = data.country_flag;
                if (data.referrer && (!u.referrer || u.referrer === 'Прямой заход / Закладки')) u.referrer = data.referrer;
                if (data.utm_source && !u.utm_source) u.utm_source = data.utm_source;
                if (data.landing_page && !u.landing_page) u.landing_page = data.landing_page;
                if (data.timezone && !u.timezone) u.timezone = data.timezone;
                if (data.device && !u.device) u.device = data.device;
                if (data.downloads_count) u.downloads_count = Math.max(u.downloads_count, data.downloads_count);
            });

            // 4. Джерело: news (реєстрації та активності завантаження)
            newsSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                const text = data.text || '';
                const ts = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : null;

                // Подія реєстрації: "🎉 {username} приєднався до Chess Vault! Ласкаво просимо!"
                const welcomeMatch = text.match(/🎉\s+([^\s]+)\s+приєднався/i);
                if (welcomeMatch && welcomeMatch[1]) {
                    const uName = welcomeMatch[1].trim();
                    const u = getOrCreateUser(uName);
                    if (ts && (!u.createdAt || ts < u.createdAt)) {
                        u.createdAt = ts;
                    }
                }

                // Подія скачування: "📥 {username} завантажив "{bookTitle}""
                const downloadMatch = text.match(/📥\s+([^\s]+)\s+завантажив\s+"([^"]+)"/i);
                if (downloadMatch && downloadMatch[1]) {
                    const uName = downloadMatch[1].trim();
                    const bookTitle = downloadMatch[2] ? downloadMatch[2].trim() : 'Книга';
                    const u = getOrCreateUser(uName);
                    if (ts && (!u.last_active_at || ts > u.last_active_at)) {
                        u.last_active_at = ts;
                    }
                    if (ts && (!u.createdAt || ts < u.createdAt)) {
                        u.createdAt = ts;
                    }
                    const exists = u.downloaded_books.some(b => b.title.toLowerCase() === bookTitle.toLowerCase());
                    if (!exists) {
                        u.downloaded_books.push({
                            title: bookTitle,
                            author: '—',
                            format: 'DJVU/PDF',
                            downloadedAt: ts,
                            count: 1
                        });
                    }
                    u.downloads_count = Math.max(u.downloads_count, u.downloaded_books.length);
                }
            });

            // 5. Джерело: downloads (книги з полями lastUser)
            allDownloads = downloadsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            allDownloads.forEach(b => {
                const lastUser = (b.lastUser || '').trim();
                const ts = b.lastAt ? (b.lastAt.toDate ? b.lastAt.toDate() : new Date(b.lastAt)) : null;
                const bookTitle = b.title || b.id;
                const bookAuthor = b.author || '—';

                if (lastUser && lastUser !== '—') {
                    const u = getOrCreateUser(lastUser);
                    if (ts && (!u.last_active_at || ts > u.last_active_at)) {
                        u.last_active_at = ts;
                    }
                    if (ts && (!u.createdAt || ts < u.createdAt)) {
                        u.createdAt = ts;
                    }
                    const exists = u.downloaded_books.some(item => item.title.toLowerCase() === bookTitle.toLowerCase());
                    if (!exists) {
                        u.downloaded_books.push({
                            title: bookTitle,
                            author: bookAuthor,
                            format: 'DJVU/PDF',
                            downloadedAt: ts,
                            count: b.count || 1
                        });
                    }
                    u.downloads_count = Math.max(u.downloads_count, u.downloaded_books.length);
                }
            });

            // Гарантуємо наявність запису головного адміністратора admin
            const adm = getOrCreateUser('admin');
            if (!adm.createdAt) adm.createdAt = new Date('2026-02-23T20:30:00Z');

            // Якщо поточний авторизований користувач переглядає адмінку - позначаємо його активним та присвоюємо IP/гео/платформу
            const currentAuth = firebase.auth().currentUser;
            const myClientPlatform = getClientPlatform();
            if (currentAuth) {
                const curEmail = (currentAuth.email || '').toLowerCase();
                const curName = (currentAuth.displayName || (currentAuth.email ? currentAuth.email.split('@')[0] : '')).toLowerCase();

                userMap.forEach(u => {
                    const uName = (u.username || '').toLowerCase();
                    const isCurrent = (u.uid === currentAuth.uid) ||
                        (curName && uName === curName) ||
                        (uName === 'admin' && (curName === 'admin' || curEmail.includes('admin') || curEmail.includes('chess-lib.local')));

                    if (isCurrent) {
                        u.last_active_at = new Date();
                        u.platform = myClientPlatform;
                        u.device = (/mobile|tablet/i.test(myClientPlatform) || (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent))) ? 'mobile' : 'desktop';
                        if (currentGeo) {
                            if (currentGeo.ip) u.ip = currentGeo.ip;
                            if (currentGeo.country) u.country = currentGeo.country;
                            if (currentGeo.city) u.city = currentGeo.city;
                            if (currentGeo.country_flag) u.country_flag = currentGeo.country_flag;
                        }
                    }
                });

                // Гарантуємо запис IP, платформи та геоданих поточного адміна у Firestore
                const geoPayload = {
                    last_active_at: firebase.firestore.FieldValue.serverTimestamp(),
                    platform: myClientPlatform,
                    device: (/mobile|tablet/i.test(myClientPlatform) || (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent))) ? 'mobile' : 'desktop'
                };
                if (currentGeo && currentGeo.ip) {
                    geoPayload.ip = currentGeo.ip;
                    geoPayload.country = currentGeo.country || '';
                    geoPayload.city = currentGeo.city || '';
                    geoPayload.country_flag = currentGeo.country_flag || '';
                }
                db.collection('users').doc(currentAuth.uid).set(geoPayload, { merge: true }).catch(() => {});
                db.collection('usernames').doc('admin').set(geoPayload, { merge: true }).catch(() => {});
                if (curName && curName !== 'admin') {
                    db.collection('usernames').doc(curName).set(geoPayload, { merge: true }).catch(() => {});
                }
            }

            // Заповнення відсутніх дат реєстрації (НЕ підміняємо last_active_at датою реєстрації!)
            userMap.forEach(u => {
                if (!u.createdAt) u.createdAt = u.last_active_at || new Date();
            });

            allUsers = Array.from(userMap.values());

            // 6. Останні події для стрічки активності
            allActivities = newsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? (doc.data().timestamp.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)) : new Date()
            }));

            // Сортуємо активності за часом (від нових)
            allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            // Рендеринг інтерфейсу
            renderKPIs();
            populateSourceFilter();
            renderUsersTable();
            renderTrafficBreakdown();
            renderTopBooks();
            renderActivityFeed();

        } catch (err) {
            console.error('Error loading dashboard data:', err);
        }
    }

    // ========================================================
    // 3. РОЗРАХУНОК KPI ТА МЕТРИК
    // ========================================================
    function renderKPIs() {
        const totalUsersEl = document.getElementById('kpi-total-users');
        const newUsersSubEl = document.getElementById('kpi-new-users-sub');
        const totalDownloadsEl = document.getElementById('kpi-total-downloads');
        const topSourceEl = document.getElementById('kpi-top-source');
        const sourceSubEl = document.getElementById('kpi-source-sub');
        const activeUsersEl = document.getElementById('kpi-active-users');

        // Всього користувачів
        const totalUsers = allUsers.length;
        totalUsersEl.textContent = totalUsers;

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

        const newToday = allUsers.filter(u => u.createdAt && u.createdAt >= oneDayAgo).length;
        const new7Days = allUsers.filter(u => u.createdAt && u.createdAt >= sevenDaysAgo).length;
        newUsersSubEl.innerHTML = `<strong>+${newToday}</strong> сьогодні • <strong>+${new7Days}</strong> за 7 днів`;

        // Всього скачувань
        const sumDownloads = allDownloads.reduce((acc, b) => acc + (b.count || 0), 0);
        totalDownloadsEl.textContent = sumDownloads;

        // Топ джерело трафіку
        const sourceCounts = {};
        allUsers.forEach(u => {
            const cat = classifySource(u);
            sourceCounts[cat.label] = (sourceCounts[cat.label] || 0) + 1;
        });

        let topSource = 'Прямий захід';
        let topCount = 0;
        Object.entries(sourceCounts).forEach(([src, count]) => {
            if (count > topCount) {
                topCount = count;
                topSource = src;
            }
        });

        const topShare = totalUsers > 0 ? Math.round((topCount / totalUsers) * 100) : 0;
        topSourceEl.textContent = topSource;
        sourceSubEl.textContent = `${topCount} користувачів (${topShare}% від усіх)`;

        // Активні за останні 7 днів
        const activeCount = allUsers.filter(u => {
            const t = u.last_active_at || u.createdAt;
            return t && t >= sevenDaysAgo;
        }).length;
        activeUsersEl.textContent = activeCount;
    }

    // Класифікація каналу залучення
    function classifySource(user) {
        const utm = (user.utm_source || '').toLowerCase();
        const ref = (user.referrer || '').toLowerCase();

        if (utm.includes('telegram') || ref.includes('t.me') || ref.includes('telegram')) {
            return { type: 'telegram', label: 'Telegram', badgeClass: 'badge-telegram', icon: '✈️' };
        }
        if (utm.includes('google') || ref.includes('google')) {
            return { type: 'google', label: 'Google', badgeClass: 'badge-google', icon: '🔍' };
        }
        if (utm.includes('reddit') || ref.includes('reddit')) {
            return { type: 'reddit', label: 'Reddit', badgeClass: 'badge-reddit', icon: '🤖' };
        }
        if (utm.includes('twitter') || utm.includes('x') || ref.includes('twitter') || ref.includes('t.co')) {
            return { type: 'twitter', label: 'Twitter / X', badgeClass: 'badge-other', icon: '🐦' };
        }
        if (!ref || ref === 'прямой заход / закладки' || ref.includes('прямой')) {
            return { type: 'direct', label: 'Прямий захід', badgeClass: 'badge-direct', icon: '🔗' };
        }
        return { type: 'other', label: (user.utm_source || 'Реферал').substring(0, 15), badgeClass: 'badge-other', icon: '🌐' };
    }

    // ========================================================
    // 4. ТАБЛИЦЯ КОРИСТУВАЧІВ (CRM)
    // ========================================================
    const searchInput = document.getElementById('user-search-input');
    const filterDevice = document.getElementById('filter-device');
    const filterSource = document.getElementById('filter-source');
    const filterSort = document.getElementById('filter-sort');

    searchInput.addEventListener('input', renderUsersTable);
    filterDevice.addEventListener('change', renderUsersTable);
    filterSource.addEventListener('change', renderUsersTable);
    filterSort.addEventListener('change', renderUsersTable);

    function populateSourceFilter() {
        const select = document.getElementById('filter-source');
        const sources = new Set();
        allUsers.forEach(u => sources.add(classifySource(u).label));
        select.innerHTML = '<option value="all">Всі канали трафіку</option>' +
            Array.from(sources).map(s => `<option value="${s}">${s}</option>`).join('');
    }

    function renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        const badge = document.getElementById('users-count-badge');

        const query = searchInput.value.toLowerCase().trim();
        const devFilter = filterDevice.value;
        const srcFilter = filterSource.value;
        const sortMode = filterSort.value;

        let filtered = allUsers.filter(u => {
            // Пошук
            if (query) {
                const uname = (u.username || '').toLowerCase();
                const ref = (u.referrer || '').toLowerCase();
                const utm = (u.utm_source || '').toLowerCase();
                const tz = (u.timezone || '').toLowerCase();
                const plat = (u.platform || '').toLowerCase();
                if (!uname.includes(query) && !ref.includes(query) && !utm.includes(query) && !tz.includes(query) && !plat.includes(query)) {
                    return false;
                }
            }
            // Фільтр пристрою
            if (devFilter !== 'all') {
                if (devFilter === 'mobile' && u.device !== 'mobile' && u.device !== 'tablet') return false;
                if (devFilter === 'desktop' && u.device === 'mobile') return false;
            }
            // Фільтр каналу
            if (srcFilter !== 'all') {
                const s = classifySource(u);
                if (s.label !== srcFilter) return false;
            }
            return true;
        });

        // Сортування
        filtered.sort((a, b) => {
            if (sortMode === 'downloads') {
                return (b.downloads_count || 0) - (a.downloads_count || 0);
            }
            if (sortMode === 'active') {
                const tA = a.last_active_at ? a.last_active_at.getTime() : 0;
                const tB = b.last_active_at ? b.last_active_at.getTime() : 0;
                return tB - tA;
            }
            // newest
            const tA = a.createdAt ? a.createdAt.getTime() : 0;
            const tB = b.createdAt ? b.createdAt.getTime() : 0;
            return tB - tA;
        });

        badge.textContent = `${filtered.length} з ${allUsers.length}`;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading-state">Користувачів за обраними критеріями не знайдено</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(u => {
            const avatar = (u.username || 'U').charAt(0).toUpperCase();
            const source = classifySource(u);
            const dateStr = u.createdAt ? formatDate(u.createdAt) : 'Невідомо';
            const devIcon = (u.device === 'mobile' || u.device === 'tablet') ? '📱' : '💻';
            
            // Локація користувача (місто, країна, прапор)
            const flag = u.country_flag || '🌐';
            let locText = 'Локація невідома';
            if (u.city && u.country) {
                locText = `${u.city}, ${u.country}`;
            } else if (u.country) {
                locText = u.country;
            } else if (u.timezone) {
                locText = u.timezone.split('/').pop().replace(/_/g, ' ');
            }
            
            const ipBadge = u.ip 
                ? `<span class="user-ip-badge" title="IP: ${esc(u.ip)}">${esc(u.ip)}</span>` 
                : `<span style="color:#64748b;font-size:0.72rem;">IP невідомий</span>`;

            let platName = formatPlatformName(u.platform);
            if (!platName) {
                platName = (u.device === 'mobile' || u.device === 'tablet') ? 'Мобільний' : 'Десктоп';
            }
            const devText = `${devIcon} ${platName}`;

            const landing = u.landing_page ? `<a href="${esc(u.landing_page)}" target="_blank" class="landing-url-link" title="${esc(u.landing_page)}">${formatLandingUrl(u.landing_page)}</a>` : '<span style="color:#586069;">-</span>';
            const dlCount = u.downloads_count || 0;
            const rank = window.getUserRank ? window.getUserRank(u, dlCount, u.createdAt) : { fullLabel: '♟ Member', badgeClass: 'badge-member', badgeStyle: '' };

            return `
                <tr>
                    <td>
                        <div class="user-info-cell">
                            <div class="user-avatar">${avatar}</div>
                            <div>
                                <div class="user-name-text">
                                    <span>${esc(u.username)}</span>
                                    <span class="user-rank-pill ${rank.badgeClass}" style="${rank.badgeStyle}">${rank.fullLabel}</span>
                                </div>
                                <div class="user-sub-text">UID: ${esc(u.uid.substring(0, 8))}...</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge-tag ${source.badgeClass}">
                            <span>${source.icon}</span> ${esc(source.label)}
                        </span>
                        ${u.utm_campaign ? `<div style="font-size:0.7rem;color:#8b949e;margin-top:4px;">кампанія: ${esc(u.utm_campaign)}</div>` : ''}
                    </td>
                    <td>${landing}</td>
                    <td>
                        <div class="user-geo-cell">
                            <div class="user-geo-location" title="${esc(locText)}">
                                <span>${flag}</span>
                                <span>${esc(locText)}</span>
                            </div>
                            <div class="user-geo-ip">
                                ${ipBadge}
                                <span class="user-device-sub">${esc(devText)}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge-count">${dlCount}</span></td>
                    <td><span style="font-size: 0.82rem; color: #8b949e;">${dateStr}</span></td>
                    <td>${formatOnlineStatusHtml(u.last_active_at, u.createdAt)}</td>
                    <td>
                        <button class="action-btn-sm" onclick="window.viewUserDownloads('${esc(u.uid)}')">
                            <span>📚</span> Книги
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ========================================================
    // 5. ДІАГРАМИ ТА САЙДБАР (Traffic, Books, Activity)
    // ========================================================
    function renderTrafficBreakdown() {
        const wrap = document.getElementById('traffic-breakdown-list');
        const counts = {};
        allUsers.forEach(u => {
            const s = classifySource(u);
            counts[s.label] = (counts[s.label] || 0) + 1;
        });

        const total = allUsers.length;
        if (total === 0) {
            wrap.innerHTML = '<div class="loading-state">Дані відсутні</div>';
            return;
        }

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        wrap.innerHTML = sorted.map(([label, count]) => {
            const pct = Math.round((count / total) * 100);
            return `
                <div class="traffic-bar-item">
                    <div class="traffic-bar-top">
                        <span class="traffic-bar-label">${esc(label)}</span>
                        <span class="traffic-bar-count">${count} (${pct}%)</span>
                    </div>
                    <div class="traffic-progress-bg">
                        <div class="traffic-progress-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTopBooks() {
        const list = document.getElementById('admin-top-books-list');
        const sorted = [...allDownloads].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8);

        if (sorted.length === 0) {
            list.innerHTML = '<li class="loading-state">Поки немає скачувань</li>';
            return;
        }

        list.innerHTML = sorted.map((b, i) => `
            <li class="top-book-item">
                <div style="min-width:0;">
                    <div class="top-book-title">${i + 1}. ${esc(b.title || b.id)}</div>
                    <div class="top-book-author">${esc(b.author || '—')}</div>
                </div>
                <span class="badge-count">${b.count || 0}</span>
            </li>
        `).join('');
    }

    function renderActivityFeed() {
        const list = document.getElementById('admin-activity-feed');
        if (allActivities.length === 0) {
            list.innerHTML = '<li class="loading-state">Поки немає активності</li>';
            return;
        }

        list.innerHTML = allActivities.slice(0, 12).map(item => {
            const timeStr = item.timestamp ? formatRelativeTime(item.timestamp) : '';
            return `
                <li class="activity-feed-item">
                    <div>${esc(item.text || '')}</div>
                    <div class="activity-feed-time">${timeStr}</div>
                </li>
            `;
        }).join('');
    }

    // ========================================================
    // 6. МОДАЛКА СКАЧУВАНЬ КОНКРЕТНОГО КОРИСТУВАЧА
    // ========================================================
    const modal = document.getElementById('user-details-modal');
    const closeModalBtn = document.getElementById('close-user-modal');

    function closeUserModal() {
        if (modal) modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeUserModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeUserModal(); });

    // Закриття модального вікна по клавіші Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (modal && modal.style.display !== 'none') {
                closeUserModal();
            }
        }
    });

    window.viewUserDownloads = async function (uid) {
        modal.style.display = 'flex';
        const modalTitle = document.getElementById('modal-user-title');
        const modalMeta = document.getElementById('modal-user-meta');
        const modalTableBody = document.getElementById('modal-downloads-body');

        const user = allUsers.find(u => u.uid === uid) || { uid: uid, username: 'Користувач' };
        const uRank = window.getUserRank ? window.getUserRank(user, user.downloads_count || 0, user.createdAt) : null;
        modalTitle.innerHTML = `👤 Книги користувача: ${esc(user.username)} ${uRank ? `<span class="user-rank-pill ${uRank.badgeClass}" style="${uRank.badgeStyle}; margin-left: 8px;">${uRank.fullLabel}</span>` : ''}`;

        const source = classifySource(user);
        const locDetail = (user.city && user.country) 
            ? `${user.country_flag || '🌐'} ${user.city}, ${user.country}` 
            : (user.country ? `${user.country_flag || '🌐'} ${user.country}` : (user.timezone || 'Невідомо'));
        const ipDetail = user.ip ? `<span class="ip-code">${esc(user.ip)}</span>` : '<span style="color:#64748b;">Не зафіксовано</span>';
        let modalPlat = formatPlatformName(user.platform);
        if (!modalPlat) {
            modalPlat = (user.device === 'mobile' || user.device === 'tablet') ? 'Мобільний' : 'Десктоп';
        }

        modalMeta.innerHTML = `
            <div class="user-meta-item">
                <span class="user-meta-label">IP-адреса</span>
                <span class="user-meta-val">${ipDetail}</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Місцезнаходження</span>
                <span class="user-meta-val">${esc(locDetail)}</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Джерело входу</span>
                <span class="user-meta-val">${source.icon} ${source.label}</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Landing Page</span>
                <span class="user-meta-val">${user.landing_page ? formatLandingUrl(user.landing_page) : 'Пряма'}</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Таймзона / ОС</span>
                <span class="user-meta-val">${user.timezone || 'Невідомо'} (${esc(modalPlat)})</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Дата реєстрації</span>
                <span class="user-meta-val">${user.createdAt ? formatDate(user.createdAt) : 'Невідомо'}</span>
            </div>
            <div class="user-meta-item">
                <span class="user-meta-label">Останній онлайн</span>
                <span class="user-meta-val">${formatOnlineStatusHtml(user.last_active_at, user.createdAt)}</span>
            </div>
        `;

        modalTableBody.innerHTML = `<tr><td colspan="5" class="loading-state">⏳ Завантаження історії скачувань...</td></tr>`;

        try {
            let docs = [];
            // Спроба отримати з subcollection history (для нових завантажень)
            if (uid && !uid.startsWith('usr_')) {
                try {
                    const histSnap = await db.collection('user_downloads').doc(uid).collection('history').get();
                    if (!histSnap.empty) {
                        docs = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    }
                } catch (e) {
                    console.warn('history fetch fallback:', e);
                }
            }

            // Fallback: якщо subcollection порожня або відсутня, беремо агреговані книги користувача
            if (docs.length === 0 && user.downloaded_books && user.downloaded_books.length > 0) {
                docs = user.downloaded_books.map(b => ({
                    title: b.title,
                    author: b.author || '—',
                    format: b.format || 'DJVU/PDF',
                    downloadedAt: b.downloadedAt ? (b.downloadedAt.toDate ? b.downloadedAt : { toDate: () => b.downloadedAt }) : null,
                    repeatCount: b.count > 1 ? b.count - 1 : 0
                }));
            }

            if (docs.length === 0) {
                modalTableBody.innerHTML = `<tr><td colspan="5" class="loading-state">📚 Користувач ще не завантажував жодної книги</td></tr>`;
                return;
            }

            // Сортування від нових до старих
            docs.sort((a, b) => {
                const tA = a.downloadedAt ? (a.downloadedAt.toDate ? a.downloadedAt.toDate().getTime() : new Date(a.downloadedAt).getTime()) : 0;
                const tB = b.downloadedAt ? (b.downloadedAt.toDate ? b.downloadedAt.toDate().getTime() : new Date(b.downloadedAt).getTime()) : 0;
                return tB - tA;
            });

            modalTableBody.innerHTML = docs.map(item => {
                const itemDate = item.downloadedAt ? (item.downloadedAt.toDate ? item.downloadedAt.toDate() : new Date(item.downloadedAt)) : null;
                const dDate = itemDate ? formatDate(itemDate) : '—';
                const fmt = (item.format || 'pdf').toUpperCase();
                const repeats = item.repeatCount ? `+${item.repeatCount}` : '—';
                return `
                    <tr>
                        <td style="font-weight: 600; color: #fff;">${esc(item.title || item.id)}</td>
                        <td style="color: #cbd5e1;">${esc(item.author || '—')}</td>
                        <td><span style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:0.75rem;">${esc(fmt)}</span></td>
                        <td style="color: #8b949e;">${dDate}</td>
                        <td><span style="color: var(--accent-green); font-weight: 600;">${repeats}</span></td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('Error fetching user history:', err);
            modalTableBody.innerHTML = `<tr><td colspan="5" class="loading-state" style="color:#f87171;">❌ Помилка читання історії скачувань</td></tr>`;
        }
    };

    // ========================================================
    // 7. ДОПОМІЖНІ УТИЛІТИ ФОРМАТУВАННЯ
    // ========================================================
    function esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(d) {
        try {
            return window.formatAppDate ? window.formatAppDate(d, true) : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
        } catch (_) {
            return String(d);
        }
    }

    function formatRelativeTime(d) {
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Щойно';
        if (diffMins < 60) return `${diffMins} хв тому`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} год тому`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} дн. тому`;
    }

    function formatOnlineStatusHtml(date, createdAt) {
        if (!date) {
            return `
                <div class="online-status-wrap" title="Користувач не заходив після створення акаунту">
                    <span class="online-dot dot-offline"></span>
                    <div>
                        <div class="online-status-text text-offline">Не заходив</div>
                        <div class="online-status-sub">з моменту рег.</div>
                    </div>
                </div>
            `;
        }
        const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
        if (isNaN(d.getTime())) return '<span style="color:#64748b;font-size:0.8rem;">Невідомо</span>';

        const diffMs = Date.now() - d.getTime();
        const fullDateStr = formatDate(d);

        // Перевірка чи дата останнього онлайну збігається з датою реєстрації (активність була лише при реєстрації)
        if (createdAt) {
            const cDate = createdAt instanceof Date ? createdAt : (createdAt.toDate ? createdAt.toDate() : new Date(createdAt));
            if (!isNaN(cDate.getTime()) && Math.abs(d.getTime() - cDate.getTime()) < 2 * 60 * 1000 && diffMs > 5 * 60 * 1000) {
                return `
                    <div class="online-status-wrap" title="Активність зафіксована лише при створенні акаунту: ${fullDateStr}">
                        <span class="online-dot dot-offline"></span>
                        <div>
                            <div class="online-status-text text-offline">При реєстрації</div>
                            <div class="online-status-sub">${fullDateStr}</div>
                        </div>
                    </div>
                `;
            }
        }

        // Онлайн прямо зараз (< 5 хв)
        if (diffMs < 5 * 60 * 1000) {
            return `
                <div class="online-status-wrap" title="Активний на сайті: ${fullDateStr}">
                    <span class="online-dot dot-now"></span>
                    <div>
                        <div class="online-status-text text-now">Онлайн зараз</div>
                        <div class="online-status-sub">активний щойно</div>
                    </div>
                </div>
            `;
        }

        // Нещодавно сьогодні (< 24 год)
        if (diffMs < 24 * 3600 * 1000) {
            return `
                <div class="online-status-wrap" title="Останній візит: ${fullDateStr}">
                    <span class="online-dot dot-recent"></span>
                    <div>
                        <div class="online-status-text text-recent">${formatRelativeTime(d)}</div>
                        <div class="online-status-sub">${fullDateStr}</div>
                    </div>
                </div>
            `;
        }

        // Більше доби тому
        return `
            <div class="online-status-wrap" title="Останній візит: ${fullDateStr}">
                <span class="online-dot dot-offline"></span>
                <div>
                    <div class="online-status-text text-offline">${formatRelativeTime(d)}</div>
                    <div class="online-status-sub">${fullDateStr}</div>
                </div>
            </div>
        `;
    }

    function formatPlatformName(platformStr, userAgentStr = '') {
        const raw = String(platformStr || userAgentStr || '').toLowerCase();
        if (/iphone|ipad|ipod/i.test(raw)) return 'iOS';
        if (/macintosh|mac os x|macintel|darwin|mac/i.test(raw)) return 'macOS';
        if (/windows|win32|win64/i.test(raw)) return 'Windows';
        if (/android/i.test(raw)) return 'Android';
        if (/linux/i.test(raw)) return 'Linux';
        return null;
    }

    function getClientPlatform() {
        try {
            const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
            const plat = (typeof navigator !== 'undefined' && navigator.platform) ? navigator.platform : '';
            return formatPlatformName(plat, ua) || (/Mobi|Android/i.test(ua) ? 'Mobile' : 'Десктоп');
        } catch (_) {
            return 'Десктоп';
        }
    }

    function formatLandingUrl(urlStr) {
        try {
            const u = new URL(urlStr);
            const path = u.pathname.split('/').pop() || '/';
            return path + (u.search ? u.search.substring(0, 25) + '...' : '');
        } catch (_) {
            return urlStr.substring(0, 30);
        }
    }

})();
