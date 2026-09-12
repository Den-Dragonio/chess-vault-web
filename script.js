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

function openModal(m) { m.style.display = 'flex'; }
function closeModal(m) {
    m.style.display = 'none';
    const e1 = document.getElementById('auth-error');
    const e2 = document.getElementById('reg-error');
    if (e1) e1.textContent = '';
    if (e2) e2.textContent = '';
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
        await auth.signInWithEmailAndPassword(toFakeEmail(username), password);
        closeModal(loginModal);
        showToast(t('auth_welcome', { username: username }));
    } catch (err) { errEl.textContent = translateError(err.code); }
});

function validateUsernameStrict(username) {
    const t = (k) => window.i18n ? window.i18n.t(k) : k;
    if (!username) return t('auth_err_empty_username');
    if (username.length <= 3) return t('auth_err_len');
    if (username.length > 20) return t('auth_err_len');
    if (!/^[a-zA-Z0-9 -]+$/.test(username)) {
        return t('auth_err_chars');
    }
    if (!/[a-zA-Z]/.test(username)) {
        return t('auth_err_letter');
    }
    return null;
}

// =============================================
// 7. РЕЄСТРАЦІЯ
// =============================================
document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.textContent = '';
    const t = (k, p) => window.i18n ? window.i18n.t(k, p) : k;
    
    const valErr = validateUsernameStrict(username);
    if (valErr) {
        errEl.textContent = valErr;
        return;
    }

    try {
        // Перевірка унікальності логіну
        try {
            const snap = await db.collection('usernames').doc(username.toLowerCase().replace(/\s+/g, '_')).get();
            if (snap.exists) {
                errEl.textContent = t('auth_err_taken');
                return;
            }
        } catch (_) {}

        const cred = await auth.createUserWithEmailAndPassword(toFakeEmail(username), password);
        await cred.user.updateProfile({ displayName: username });

        // Фіксуємо унікальний логін
        try {
            await db.collection('usernames').doc(username.toLowerCase().replace(/\s+/g, '_')).set({
                uid: cred.user.uid,
                username: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (_) {}

        // Зберігаємо дефолтні налаштування користувача (поточну мову та тему)
        try {
            await db.collection('user_preferences').doc(cred.user.uid).set({
                language: window.i18n ? window.i18n.getLanguage() : 'en',
                theme: localStorage.getItem('chess_theme') || 'system',
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

        closeModal(regModal);
        showToast(t('auth_created', { username: username }));
    } catch (err) { errEl.textContent = translateError(err.code); }
});

// =============================================
// 8. СТАН АВТОРИЗАЦІЇ → хедер
// =============================================
function updateHeaderAuthUI(user) {
    const accBtn = document.getElementById('acc-btn');
    const accDropdown = document.getElementById('acc-dropdown');
    const myAccountLink = document.getElementById('nav-my-account');
    const t = (k) => window.i18n ? window.i18n.t(k) : k;

    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        if (accBtn) accBtn.textContent = `👤 ${name} ▾`;
        if (myAccountLink) {
            myAccountLink.style.display = 'inline';
            myAccountLink.textContent = t('nav_my_account');
        }
        if (accDropdown) {
            accDropdown.innerHTML = `<a href="#" id="logout-btn">🚪 ${t('nav_logout')}</a>`;
            document.getElementById('logout-btn').onclick = async e => {
                e.preventDefault();
                await auth.signOut();
                showToast(t('auth_bye'));
            };
        }
    } else {
        if (accBtn) accBtn.textContent = `${t('nav_account')} ▾`;
        if (myAccountLink) myAccountLink.style.display = 'none';
        if (accDropdown) {
            accDropdown.innerHTML = `
                <a href="#" id="login-trigger">🔑 ${t('nav_login')}</a>
                <a href="#" id="reg-trigger">📝 ${t('nav_register')}</a>`;
            bindLoginTrigger();
            bindRegTrigger();
        }
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
            }
        } catch (err) {
            console.warn('Could not load user preferences:', err);
        }
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
    const lang = (window.i18n && window.i18n.currentLang === 'uk') ? 'uk-UA' : 'en-US';
    return d.toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
