// =============================================
// 1. FIREBASE + FIRESTORE
// =============================================
const firebaseConfig = {
    apiKey: "AIzaSyDUG7SSTj-iU_3rYEueN47uzfotv-q9YKI",
    authDomain: "chess-lib.firebaseapp.com",
    projectId: "chess-lib",
    storageBucket: "chess-lib.firebasestorage.app",
    messagingSenderId: "379371526786",
    appId: "1:379371526786:web:0af0d17c42c7ba16e2f29b",
    measurementId: "G-67D80FFP24"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
window.auth = auth;
window.db = db;

function toFakeEmail(username) {
    return username.toLowerCase().trim().replace(/\s+/g, '_') + '@chess-lib.local';
}

// =============================================
// 2. ФОН — ШАХОВІ КООРДИНАТИ
// =============================================
const chessFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const chessRanks = ['1', '2', '3', '4', '5', '6', '7', '8'];
const chessSquares = [];
for (const f of chessFiles) for (const r of chessRanks) chessSquares.push(f + r);

const pieceTypes = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
let currentPieces = { 'giant-left': { type: '', color: 'black' }, 'giant-right': { type: '', color: 'white' } };

const grid = document.getElementById('bg-grid-container');
const cells = [];
if (grid) {
    for (let i = 0; i < 150; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.innerText = chessSquares[Math.floor(Math.random() * chessSquares.length)];
        const d = {
            el: cell, x: Math.random() * 100, y: Math.random() * 250 - 150,
            rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 0.2,
            speed: 0.005 + Math.random() * 0.01
        };
        cell.style.left = `${d.x}vw`;
        grid.appendChild(cell);
        cells.push(d);
    }
}

let mouseX = -500, mouseY = -500;
function animate() {
    cells.forEach(item => {
        item.y += item.speed; item.rotation += item.rotSpeed;
        if (item.y > 110) {
            item.y = -20; item.x = Math.random() * 100;
            item.el.style.left = `${item.x}vw`;
            item.el.innerText = chessSquares[Math.floor(Math.random() * chessSquares.length)];
        }
        const rect = item.el.getBoundingClientRect();
        const dx = mouseX - (rect.left + rect.width / 2);
        const dy = mouseY - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        let tx = 0, ty = 0, scale = 1, opacity = 0.1;
        if (dist < 250) {
            const f = (250 - dist) / 250;
            tx = dx * f * 0.4; ty = dy * f * 0.4; scale = 1 + f * 0.3; opacity = 0.1 + f * 0.3;
        }
        item.el.style.top = `${item.y}vh`;
        item.el.style.transform = `translate(${tx}px,${ty}px) scale(${scale}) rotate(${item.rotation}deg)`;
        item.el.style.color = `rgba(0,0,0,${opacity})`;
    });
    requestAnimationFrame(animate);
}
window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
animate();

// =============================================
// 3. ВЕЛИКІ ФІГУРИ
// =============================================
function spawnPiece(id) {
    const container = document.getElementById(id);
    if (!container) return;
    const side = id.includes('left') ? 'left' : 'right';
    const otherId = side === 'left' ? 'giant-right' : 'giant-left';
    const newColor = currentPieces[id].color === 'white' ? 'black' : 'white';
    let newType;
    do { newType = pieceTypes[Math.floor(Math.random() * 6)]; }
    while (newType === currentPieces[otherId].type);
    currentPieces[id] = { type: newType, color: newColor };
    const img = document.createElement('img');
    img.src = `img/${newColor}_${newType}.png`;
    img.onerror = () => { img.src = `img/${newColor}_${newType}.jpg`; };
    if (newType === 'knight') {
        if (side === 'left' && newColor === 'white') img.className = 'flipped';
        if (side === 'right' && newColor === 'black') img.className = 'flipped';
    }
    container.innerHTML = '';
    container.appendChild(img);
    container.className = `giant-container ${side} state-appear`;
    setTimeout(() => {
        container.classList.remove('state-appear');
        container.classList.add(side === 'left' ? 'state-fall-left' : 'state-fall-right');
        setTimeout(() => spawnPiece(id), 6000);
    }, Math.random() * 10000 + 15000);
}
spawnPiece('giant-left');
spawnPiece('giant-right');

// =============================================
// 4. МОДАЛКИ
// =============================================
const loginModal = document.getElementById('login-modal');
const regModal = document.getElementById('reg-modal');

function openModal(m) {
    if (typeof m === 'string') {
        m = document.getElementById(m.endsWith('-modal') ? m : m + '-modal');
    }
    if (m) m.style.display = 'flex';
}

function closeModal(m) {
    if (typeof m === 'string') {
        m = document.getElementById(m.endsWith('-modal') ? m : m + '-modal');
    }
    if (m) {
        m.style.display = 'none';
        const e1 = document.getElementById('auth-error');
        const e2 = document.getElementById('reg-error');
        if (e1) e1.textContent = '';
        if (e2) e2.textContent = '';
        hasAttemptedReg = false;
        const sheet = document.getElementById('reg-rules-cheat-sheet');
        if (sheet) sheet.style.display = 'none';
        const regInput = document.getElementById('reg-name');
        if (regInput) regInput.classList.remove('input-error');
    }
}

function bindLoginTrigger() {
    const el = document.getElementById('login-trigger');
    if (el) el.onclick = e => { e.preventDefault(); openModal(loginModal); };
}
function bindRegTrigger() {
    const el = document.getElementById('reg-trigger');
    if (el) el.onclick = e => { e.preventDefault(); openModal(regModal); };
}
bindLoginTrigger();
bindRegTrigger();

document.getElementById('close-login').onclick = () => closeModal(loginModal);
document.getElementById('close-reg').onclick = () => closeModal(regModal);
document.getElementById('switch-to-reg').onclick = e => { e.preventDefault(); closeModal(loginModal); openModal(regModal); };
document.getElementById('switch-to-login').onclick = e => { e.preventDefault(); closeModal(regModal); openModal(loginModal); };
window.onclick = e => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target); };
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        if (loginModal && loginModal.style.display === 'flex') closeModal(loginModal);
        if (regModal && regModal.style.display === 'flex') closeModal(regModal);
    }
});

// Автоматичне відкриття модалки при вході через посилання з іншої сторінки (?auth=login / ?auth=reg)
try {
    const urlAuth = new URLSearchParams(window.location.search).get('auth');
    if (urlAuth === 'login' || window.location.hash === '#login') {
        openModal(loginModal);
    } else if (urlAuth === 'reg' || window.location.hash === '#reg') {
        openModal(regModal);
    }
} catch (_) {}

// =============================================
// 5. ПОМИЛКИ FIREBASE
// =============================================
// =============================================
function translateError(code) {
    const t = (k) => window.i18n ? window.i18n.t(k) : k;
    const map = {
        'auth/user-not-found': t('auth_invalid_cred'),
        'auth/wrong-password': t('auth_invalid_cred'),
        'auth/invalid-credential': t('auth_invalid_cred'),
        'auth/email-already-in-use': t('auth_email_taken'),
        'auth/weak-password': t('auth_weak_pass'),
        'auth/too-many-requests': t('auth_too_many'),
    };
    return map[code] || t('auth_generic_err');
}

function showToast(msg, type = 'ok', actionText = null, onAction = null) {
    let tc = document.getElementById('toast-container');
    if (!tc) {
        tc = document.createElement('div');
        tc.id = 'toast-container';
        document.body.appendChild(tc);
    }
    const t = document.createElement('div');
    const isWarn = type === 'warn' || type === 'warning';
    const isError = type === 'error';
    t.className = `toast ${isWarn ? 'toast-warn' : (isError ? 'toast-error' : '')}`.trim();
    const icon = isWarn ? '⚠️' : (isError ? '❌' : '✅');

    let actionHtml = '';
    if (actionText) {
        actionHtml = `<a href="#" class="toast-action-btn">${actionText}</a>`;
    }

    t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg"><span>${msg}</span>${actionHtml}</span>`;
    tc.appendChild(t);

    if (actionText && typeof onAction === 'function') {
        const btn = t.querySelector('.toast-action-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                onAction();
            });
        }
    }

    setTimeout(() => {
        t.classList.add('toast-out');
        setTimeout(() => {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 400);
    }, 4500);
}
window.showToast = showToast;

// =============================================
// 6. ВХІД
// =============================================
document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    const t = (k, p) => window.i18n ? window.i18n.t(k, p) : k;
    if (!username) { errEl.textContent = t('auth_err_empty_username'); return; }
    try {
        const cred = await auth.signInWithEmailAndPassword(toFakeEmail(username), password);
        if (window.cvAnalytics) {
            window.cvAnalytics.clearAttribution();
        }
        try {
            if (cred && cred.user) {
                if (window.trackUserPresence) {
                    window.trackUserPresence(cred.user);
                }
                db.collection('users').doc(cred.user.uid).set({
                    last_active_at: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
                db.collection('user_preferences').doc(cred.user.uid).set({
                    last_active_at: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
            }
        } catch (_) {}
        closeModal(loginModal);
        showToast(t('auth_welcome', { username: username }));
    } catch (err) { errEl.textContent = translateError(err.code); }
});

let hasAttemptedReg = false;

function updateRegCheatSheetUI(valResult, isTaken = false) {
    const sheet = document.getElementById('reg-rules-cheat-sheet');
    const nameInput = document.getElementById('reg-name');
    if (!sheet) return;

    if (!hasAttemptedReg) {
        sheet.style.display = 'none';
        if (nameInput) nameInput.classList.remove('input-error');
        return;
    }

    sheet.style.display = 'block';

    const ruleLetters = document.getElementById('rule-letters');
    const ruleLength = document.getElementById('rule-length');
    const ruleUnique = document.getElementById('rule-unique');

    const stateLetters = document.getElementById('state-letters');
    const stateLength = document.getElementById('state-length');
    const stateUnique = document.getElementById('state-unique');

    // 1. Правило: тільки англійські літери
    if (ruleLetters && stateLetters) {
        if (valResult.ruleLetters) {
            ruleLetters.className = 'rule-passed';
            stateLetters.textContent = '✅';
        } else {
            ruleLetters.className = 'rule-failed';
            stateLetters.textContent = '❌';
        }
    }

    // 2. Правило: максимум 14 символів
    if (ruleLength && stateLength) {
        if (valResult.ruleLength) {
            ruleLength.className = 'rule-passed';
            stateLength.textContent = '✅';
        } else {
            ruleLength.className = 'rule-failed';
            stateLength.textContent = '❌';
        }
    }

    // 3. Правило: унікальний логін
    if (ruleUnique && stateUnique) {
        if (isTaken) {
            ruleUnique.className = 'rule-failed';
            stateUnique.textContent = '❌';
        } else if (valResult.valid) {
            ruleUnique.className = 'rule-passed';
            stateUnique.textContent = '✅';
        } else {
            ruleUnique.className = '';
            stateUnique.textContent = '⚪';
        }
    }

    if (nameInput) {
        if (valResult.valid && !isTaken) {
            nameInput.classList.remove('input-error');
        } else {
            nameInput.classList.add('input-error');
        }
    }
}

// Живе оновлення шпаргалки під час введення (активується ТІЛЬКИ після першої невдалої спроби)
const regNameInputEl = document.getElementById('reg-name');
if (regNameInputEl) {
    regNameInputEl.addEventListener('input', () => {
        if (hasAttemptedReg) {
            const raw = regNameInputEl.value.trim();
            const val = window.validateChessUsername ? window.validateChessUsername(raw) : { valid: true, ruleLetters: true, ruleLength: true };
            updateRegCheatSheetUI(val, false);
            const errEl = document.getElementById('reg-error');
            if (errEl) errEl.textContent = val.error || '';
        }
    });
}

function validateUsernameStrict(username) {
    if (window.validateChessUsername) {
        const res = window.validateChessUsername(username);
        return res.valid ? null : res.error;
    }
    return null;
}

// =============================================
// 7. РЕЄСТРАЦІЯ
// =============================================
document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('reg-name');
    const username = nameInput.value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.textContent = '';
    const t = (k, p) => window.i18n ? window.i18n.t(k, p) : k;

    // Жорстка валідація логіна: тільки англ літери, макс 14 символів
    const valResult = window.validateChessUsername ? window.validateChessUsername(username) : { valid: true, ruleLetters: true, ruleLength: true };
    if (!valResult.valid) {
        hasAttemptedReg = true;
        updateRegCheatSheetUI(valResult, false);
        errEl.textContent = valResult.error;
        nameInput.focus();
        return;
    }

    try {
        // Перевірка індивідуальності (унікальності) логіну в базі
        try {
            const snap = await db.collection('usernames').doc(username.toLowerCase()).get();
            if (snap.exists) {
                hasAttemptedReg = true;
                updateRegCheatSheetUI(valResult, true);
                errEl.textContent = t('auth_err_taken');
                nameInput.focus();
                return;
            }
        } catch (_) {}

        const cred = await auth.createUserWithEmailAndPassword(toFakeEmail(username), password);
        await cred.user.updateProfile({ displayName: username });

        // Успішна реєстрація - ховаємо шпаргалку
        hasAttemptedReg = false;
        updateRegCheatSheetUI({ valid: true, ruleLetters: true, ruleLength: true }, false);

        // Отримуємо збережені дані веб-аналітики першого заходу
        const attribution = (window.cvAnalytics && window.cvAnalytics.getAttribution()) || {
            referrer: (typeof document !== 'undefined' && document.referrer ? document.referrer.trim() : '') || 'Прямой заход / Закладки',
            utm_source: null,
            landing_page: window.location.href
        };

        const referrer = attribution.referrer || 'Прямой заход / Закладки';
        const utmSource = attribution.utm_source || null;
        const utmMedium = attribution.utm_medium || null;
        const utmCampaign = attribution.utm_campaign || null;
        const landingPage = attribution.landing_page || window.location.href;
        const timezone = attribution.timezone || 'UTC';
        const device = attribution.device || 'desktop';
        const platform = attribution.platform || 'Other';
        const browserLanguage = attribution.language || 'en';
        const screenRes = attribution.screen || null;

        // Отримуємо GeoIP (IP, місто, країна, прапор)
        let geoInfo = null;
        if (window.getClientGeoIp) {
            try { geoInfo = await window.getClientGeoIp(); } catch (_) {}
        }
        const userIp = (geoInfo && geoInfo.ip) || attribution.ip || null;
        const userCountry = (geoInfo && geoInfo.country) || attribution.country || null;
        const userCity = (geoInfo && geoInfo.city) || attribution.city || null;
        const userCountryFlag = (geoInfo && geoInfo.country_flag) || attribution.country_flag || null;

        // Зберігаємо веб-аналітику в профіль користувача (колекція 'users')
        try {
            await db.collection('users').doc(cred.user.uid).set({
                uid: cred.user.uid,
                username: username,
                referrer: referrer,
                utm_source: utmSource,
                landing_page: landingPage,
                timezone: timezone,
                device: device,
                platform: platform,
                browser_language: browserLanguage,
                screen: screenRes,
                downloads_count: 0,
                ip: userIp,
                country: userCountry,
                city: userCity,
                country_flag: userCountryFlag,
                last_active_at: firebase.firestore.FieldValue.serverTimestamp(),
                ...(utmMedium ? { utm_medium: utmMedium } : {}),
                ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (_) {}

        // Фіксуємо унікальний логін
        try {
            await db.collection('usernames').doc(username.toLowerCase().replace(/\s+/g, '_')).set({
                uid: cred.user.uid,
                username: username,
                referrer: referrer,
                utm_source: utmSource,
                landing_page: landingPage,
                timezone: timezone,
                device: device,
                platform: platform,
                ip: userIp,
                country: userCountry,
                city: userCity,
                country_flag: userCountryFlag,
                last_active_at: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (_) {}

        // Зберігаємо дефолтні налаштування користувача (поточну мову, тему та дані атрибуції)
        try {
            await db.collection('user_preferences').doc(cred.user.uid).set({
                language: window.i18n ? window.i18n.getLanguage() : 'en',
                theme: localStorage.getItem('chess_theme') || 'system',
                dateFormat: window.i18n ? window.i18n.getDateFormat() : (localStorage.getItem('chess_date_format') || 'DD/MM/YYYY'),
                referrer: referrer,
                utm_source: utmSource,
                landing_page: landingPage,
                timezone: timezone,
                device: device,
                platform: platform,
                downloads_count: 0,
                ip: userIp,
                country: userCountry,
                city: userCity,
                country_flag: userCountryFlag,
                last_active_at: firebase.firestore.FieldValue.serverTimestamp(),
                ...(utmMedium ? { utm_medium: utmMedium } : {}),
                ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (_) {}

        // Привітання в стрічці новин на головній
        try {
            await db.collection('news').add({
                text: `🎉 ${username} приєднався до Chess Vault! Ласкаво просимо!`,
                timestamp: firebase.firestore.Timestamp.now(),
                type: 'welcome'
            });
        } catch (_) { /* не критично */ }

        // Відстежуємо присутність
        if (window.trackUserPresence) {
            window.trackUserPresence(cred.user);
        }

        // Очищаємо атрибуцію після успішної реєстрації
        if (window.cvAnalytics) {
            window.cvAnalytics.clearAttribution();
        }

        closeModal(regModal);
    } catch (err) {
        hasAttemptedReg = true;
        if (err.code === 'auth/email-already-in-use') {
            updateRegCheatSheetUI(valResult, true);
            errEl.textContent = t('auth_err_taken');
        } else {
            errEl.textContent = translateError(err.code);
        }
        nameInput.focus();
    }
});

// =============================================
// 8. СТАН АВТОРИЗАЦІЇ → хедер
// =============================================
function updateHeaderAuthUI(user) {
    const accBtn = document.getElementById('acc-btn');
    const accDropdown = document.getElementById('acc-dropdown');
    const myAccountLink = document.getElementById('nav-my-account');
    const adminLink = document.getElementById('nav-admin-link');
    const authTabWrap = accBtn ? accBtn.closest('.auth-tab-wrap') : null;
    const t = (k) => window.i18n ? window.i18n.t(k) : k;

    const isAdmin = window.isChessAdmin && window.isChessAdmin(user);
    if (adminLink) {
        adminLink.style.display = isAdmin ? '' : 'none';
    }

    if (user) {
        document.body.classList.add('user-logged-in');
        if (authTabWrap) authTabWrap.classList.add('logged-in');

        const name = user.displayName || user.email.split('@')[0];
        if (accBtn) {
            accBtn.innerHTML = `
                <span class="nav-text nav-text-desktop">👤 ${name}</span>
                <span class="nav-arrow"> ▾</span>
            `;
        }
        if (myAccountLink) {
            myAccountLink.style.display = '';
            const accText = myAccountLink.querySelector('.nav-text');
            if (accText) accText.textContent = t('nav_my_account');
        }
        if (accDropdown) {
            accDropdown.innerHTML = `
                <a href="#" id="logout-btn">🚪 ${t('nav_logout')}</a>
            `;
            const logoutEl = document.getElementById('logout-btn');
            if (logoutEl) {
                logoutEl.onclick = async e => {
                    e.preventDefault();
                    await auth.signOut();
                    showToast(t('auth_bye'));
                };
            }
        }
    } else {
        document.body.classList.remove('user-logged-in');
        if (authTabWrap) authTabWrap.classList.remove('logged-in');

        if (accBtn) {
            accBtn.innerHTML = `
                <span class="nav-icon">🔑</span>
                <span class="nav-text nav-text-desktop" data-i18n="nav_account">${t('nav_account')}</span>
                <span class="nav-text nav-text-mobile" data-i18n="nav_login">${t('nav_login')}</span>
                <span class="nav-arrow"> ▾</span>
            `;
        }
        if (myAccountLink) myAccountLink.style.display = 'none';
        if (accDropdown) {
            accDropdown.innerHTML = `
                <a href="#" id="login-trigger">🔑 ${t('nav_login')}</a>
                <a href="#" id="reg-trigger">📝 ${t('nav_register')}</a>
            `;
            bindLoginTrigger();
            bindRegTrigger();
        }
    }

    if (accBtn && !accBtn.dataset.mobileBound) {
        accBtn.dataset.mobileBound = 'true';
        accBtn.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!auth || !auth.currentUser) {
                    e.preventDefault();
                    e.stopPropagation();
                    openModal(loginModal);
                }
            }
        });
    }
}

auth.onAuthStateChanged(async user => {
    if (user) {
        // Підтягуємо налаштування мови та теми з Firestore
        try {
            const prefSnap = await db.collection('user_preferences').doc(user.uid).get();
            if (prefSnap.exists) {
                const prefs = prefSnap.data();
                if (prefs.theme) {
                    localStorage.setItem('chess_theme', prefs.theme);
                    if (window.applyTheme) window.applyTheme(prefs.theme);
                }
                if (prefs.language && window.i18n) {
                    window.i18n.setLanguage(prefs.language, false);
                }
                if (prefs.dateFormat && window.i18n) {
                    window.i18n.setDateFormat(prefs.dateFormat, false);
                }
            }
        } catch (err) {
            console.warn('Could not load user preferences:', err);
        }

        // Оновлення мітки активності (heartbeat)
        try {
            const now = Date.now();
            const lastPing = parseInt(sessionStorage.getItem('cv_last_active_ping') || '0', 10);
            if (now - lastPing > 3 * 60 * 1000) {
                sessionStorage.setItem('cv_last_active_ping', String(now));
                db.collection('users').doc(user.uid).set({
                    last_active_at: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
            }
        } catch (_) {}
    }
    updateHeaderAuthUI(user);
});

window.addEventListener('chessVaultLanguageChanged', () => {
    updateHeaderAuthUI(auth.currentUser);
});

// =============================================
// 9. ЖИВІ НОВИНИ з Firestore (тільки Firestore, без хардкоду)
// =============================================
function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return window.formatAppDate ? window.formatAppDate(d) : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

function renderNewsList(docs) {
    const list = document.getElementById('news-list-dynamic');
    if (!list) return;
    if (docs.length === 0) {
        const emptyText = (window.i18n && window.i18n.t) ? window.i18n.t('home_news_empty') : 'Новин поки немає...';
        list.innerHTML = `<div class="news-item"><p>${emptyText}</p></div>`;
        return;
    }
    const currentLang = (window.i18n && window.i18n.currentLang) ? window.i18n.currentLang : 'en';
    list.innerHTML = docs.map(d => {
        const data = d.data();
        const isDownload = data.type === 'download';
        const text = (currentLang === 'uk' ? (data.text_uk || data.text) : (data.text_en || data.text)) || data.text;
        return `
            <div class="news-item${isDownload ? ' news-item-download' : ''}">
                <span class="news-date">${formatDate(data.timestamp)}</span>
                <p>${text}</p>
            </div>`;
    }).join('');
}

// Сідуємо системні новини в Firestore (з фіксованими ID — не дублюються)
async function seedSystemNews() {
    const systemNews = [
        { 
            id: 'english-language-added',
            text: 'Додано англійську мову інтерфейсу! Тепер у налаштуваннях профілю можна обирати мову (English / Українська).',
            text_uk: 'Додано англійську мову інтерфейсу! Тепер у налаштуваннях профілю можна обирати мову (English / Українська).',
            text_en: 'English language added! You can now switch between English and Ukrainian in your account settings.',
            date: new Date()
        },
        { 
            id: 'dark-system-themes-added',
            text: 'Оновлено теми оформлення: додано повноцінну темну тему та синхронізацію з системною темою вашого пристрою.',
            text_uk: 'Оновлено теми оформлення: додано повноцінну темну тему та синхронізацію з системною темою вашого пристрою.',
            text_en: 'Themes updated: Dark theme and automatic system theme sync are now available in settings.',
            date: new Date(Date.now() - 1000)
        },
        { 
            id: 'library-transfer-completed', 
            text: 'Шахову бібліотеку повністю перенесено в сховище Internet Archive — усі 1879 рідкісних книг збережено та доступно для вивчення!',
            text_uk: 'Шахову бібліотеку повністю перенесено в сховище Internet Archive — усі 1879 рідкісних книг збережено та доступно для вивчення!',
            text_en: 'Chess library migration completed! All 1,879 rare books and treatises are safely archived and ready to explore.',
            date: new Date(Date.now() - 2000) 
        },
        { 
            id: 'champions-gallery-added', 
            text: 'Додано інтерактивну залу та повний список чемпіонів світу з шахів — від Вільгельма Стейніца до Дін Ліженя з біографіями та цікавими фактами!',
            text_uk: 'Додано інтерактивну залу та повний список чемпіонів світу з шахів — від Вільгельма Стейніца до Дін Ліженя з біографіями та цікавими фактами!',
            text_en: 'World Chess Champions gallery added! Explore all 22 official world champions from Wilhelm Steinitz to Ding Liren with rich biographies and facts.',
            date: new Date(Date.now() - 3000) 
        },
        { 
            id: 'section-b', 
            text: 'Було додано розділ "Б" (Автори на літеру Б) до Бібліотеки.',
            text_uk: 'Було додано розділ "Б" (Автори на літеру Б) до Бібліотеки.',
            text_en: 'Section "B" (Authors starting with B) has been added to the Library.',
            date: new Date('2026-02-23') 
        },
        { 
            id: 'section-a', 
            text: 'Було додано розділ "А" (Автори на літеру А) до Бібліотеки.',
            text_uk: 'Було додано розділ "А" (Автори на літеру А) до Бібліотеки.',
            text_en: 'Section "A" (Authors starting with A) has been added to the Library.',
            date: new Date('2026-02-23') 
        },
    ];
    for (const item of systemNews) {
        const ref = db.collection('news').doc(item.id);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                text: item.text,
                text_uk: item.text_uk,
                text_en: item.text_en,
                timestamp: firebase.firestore.Timestamp.fromDate(item.date),
                type: 'system'
            });
            console.log('[Seed] Додано системну новину:', item.id);
        } else {
            // Оновлюємо переклади, якщо новина вже існує
            await ref.set({
                text: item.text,
                text_uk: item.text_uk,
                text_en: item.text_en,
            }, { merge: true });
        }
    }
}
seedSystemNews();

// Збереження списку документів новин для рендеру при перемиканні мови
let latestNewsDocs = [];
window.addEventListener('chessVaultLanguageChanged', () => {
    if (latestNewsDocs.length > 0) {
        renderNewsList(latestNewsDocs);
    }
});
window.addEventListener('chessVaultDateFormatChanged', () => {
    if (latestNewsDocs.length > 0) {
        renderNewsList(latestNewsDocs);
    }
});

// Підписка в реальному часі — всі новини, новіші зверху
db.collection('news')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .onSnapshot(snap => {
        latestNewsDocs = snap.docs;
        renderNewsList(snap.docs);
    }, () => renderNewsList([]));


// =============================================
// 10. ТОП ЗАВАНТАЖЕНЬ з Firestore
// =============================================
function renderTopBooks(docs) {
    const ol = document.getElementById('top-books-list');
    if (!ol) return;
    const filled = docs.filter(d => (d.data().count || 0) > 0).slice(0, 5);
    if (filled.length === 0) {
        ol.innerHTML = '<li>Поки порожньо...</li>' + '<li>-</li>'.repeat(4);
        return;
    }
    const items = filled.map(d => {
        const data = d.data();
        const count = data.count || 0;
        return `<li>${data.title} <span class="top-count">(${count})</span></li>`;
    });
    while (items.length < 5) items.push('<li>-</li>');
    ol.innerHTML = items.join('');
}

db.collection('downloads')
    .orderBy('count', 'desc')
    .limit(5)
    .onSnapshot(snap => renderTopBooks(snap.docs), () => {
        const ol = document.getElementById('top-books-list');
        if (ol) ol.innerHTML = '<li>Поки порожньо...</li>' + '<li>-</li>'.repeat(4);
    });

// =============================================
// 11. ПЛАВАЮЧА КНОПКА «НАГОРУ»
// =============================================
function initScrollToTop() {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;

    // З'являється акуратно, коли користувач прокручує понад 450px
    window.addEventListener('scroll', () => {
        if (window.scrollY > 450) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    }, { passive: true });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollToTop);
} else {
    initScrollToTop();
}

// Закриття мобільного меню при кліку поза ним або на посилання
document.addEventListener('click', (e) => {
    const nav = document.querySelector('.nav-menu');
    if (!nav || !nav.classList.contains('open')) return;
    if (e.target.closest('.hamburger')) return;
    const isInsideNav = nav.contains(e.target);
    const isLink = e.target.closest('a');
    if (!isInsideNav || isLink) {
        nav.classList.remove('open');
    }
});
