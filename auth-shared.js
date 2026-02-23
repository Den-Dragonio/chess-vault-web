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

function bindLoginTrigger() {
    const el = document.getElementById('login-trigger');
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html'; };
}
function bindRegTrigger() {
    const el = document.getElementById('reg-trigger');
    if (el) el.onclick = (e) => { e.preventDefault(); window.location.href = 'index.html'; };
}

auth.onAuthStateChanged((user) => {
    const accBtn = document.getElementById('acc-btn');
    const accDropdown = document.getElementById('acc-dropdown');
    const myAccountLink = document.getElementById('nav-my-account');

    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        if (accBtn) accBtn.textContent = `👤 ${name} ▾`;
        if (myAccountLink) myAccountLink.style.display = 'inline';
        if (accDropdown) {
            accDropdown.innerHTML = `<a href="#" id="logout-btn">🚪 Вийти</a>`;
            document.getElementById('logout-btn').onclick = async (e) => {
                e.preventDefault();
                await auth.signOut();
            };
        }
    } else {
        if (accBtn) accBtn.textContent = 'Аккаунт ▾';
        if (myAccountLink) myAccountLink.style.display = 'none';
        if (accDropdown) {
            accDropdown.innerHTML = `
                <a href="#" id="login-trigger">🔑 Вхід</a>
                <a href="#" id="reg-trigger">📝 Реєстрація</a>
            `;
            bindLoginTrigger();
            bindRegTrigger();
        }
    }
});
