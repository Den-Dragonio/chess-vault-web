// auth-shared.js — авторизація для бібліотеки + ініціалізація Firebase

const firebaseConfig = {
    apiKey: "AIzaSyDUG7SSTj-iU_3rYEueN47uzfotv-q9YKI",
    authDomain: "chess-lib.firebaseapp.com",
    projectId: "chess-lib",
    storageBucket: "chess-lib.firebasestorage.app",
    messagingSenderId: "379371526786",
    appId: "1:379371526786:web:0af0d17c42c7ba16e2f29b",
    measurementId: "G-67D80FFP24"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
window.auth = auth;
window.db = firebase.firestore();

function bindLoginTrigger() {
    const el = document.getElementById('login-trigger');
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html?auth=login'; };
}
function bindRegTrigger() {
    const el = document.getElementById('reg-trigger');
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html?auth=reg'; };
}

function updateSharedAuthUI(user) {
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
                logoutEl.onclick = async (e) => {
                    e.preventDefault();
                    await auth.signOut();
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
                    window.location.href = 'index.html?auth=login';
                }
            }
        });
    }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Завантаження збережених налаштувань теми та мови з Firestore
        try {
            const prefSnap = await window.db.collection('user_preferences').doc(user.uid).get();
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
                window.db.collection('users').doc(user.uid).set({
                    last_active_at: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
            }
        } catch (_) {}
    }
    updateSharedAuthUI(user);
});

window.addEventListener('chessVaultLanguageChanged', () => {
    updateSharedAuthUI(auth.currentUser);
});

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

