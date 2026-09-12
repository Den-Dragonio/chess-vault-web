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
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html'; };
}
function bindRegTrigger() {
    const el = document.getElementById('reg-trigger');
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html'; };
}

function updateSharedAuthUI(user) {
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
            document.getElementById('logout-btn').onclick = async (e) => {
                e.preventDefault();
                await auth.signOut();
            };
        }
    } else {
        if (accBtn) accBtn.textContent = `${t('nav_account')} ▾`;
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
            }
        } catch (err) {
            console.warn('Could not load user preferences:', err);
        }
    }
    updateSharedAuthUI(user);
});

window.addEventListener('chessVaultLanguageChanged', () => {
    updateSharedAuthUI(auth.currentUser);
});

