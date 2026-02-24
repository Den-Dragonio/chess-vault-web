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
function translateError(code) {
    const map = {
        'auth/user-not-found': 'Користувач з таким логіном не знайдений.',
        'auth/wrong-password': 'Невірний пароль.',
        'auth/invalid-credential': 'Невірний логін або пароль.',
        'auth/email-already-in-use': 'Цей логін вже зайнятий.',
        'auth/weak-password': 'Пароль занадто короткий (мін. 6 символів).',
        'auth/too-many-requests': 'Забагато спроб. Спробуйте пізніше.',
    };
    return map[code] || 'Помилка. Спробуйте ще раз.';
}

function showToast(msg, type = 'ok') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = type === 'error' ? 'rgba(200,50,50,0.9)' : 'rgba(0,0,0,0.85)';
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// =============================================
// 6. ВХІД
// =============================================
document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    if (!username) { errEl.textContent = 'Введіть логін.'; return; }
    try {
        await auth.signInWithEmailAndPassword(toFakeEmail(username), password);
        closeModal(loginModal);
        showToast(`✅ Ласкаво просимо, ${username}!`);
    } catch (err) { errEl.textContent = translateError(err.code); }
});

// =============================================
// 7. РЕЄСТРАЦІЯ
// =============================================
document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.textContent = '';
    if (!username) { errEl.textContent = 'Введіть логін.'; return; }
    if (username.length < 3) { errEl.textContent = 'Логін занадто короткий (мін. 3 символи).'; return; }
    try {
        const cred = await auth.createUserWithEmailAndPassword(toFakeEmail(username), password);
        await cred.user.updateProfile({ displayName: username });

        // Привітання в стрічці новин на головній
        try {
            const db = firebase.firestore();
            await db.collection('news').add({
                text: `🎉 ${username} приєднався до Chess Vault! Ласкаво просимо!`,
                timestamp: firebase.firestore.Timestamp.now(),
                type: 'welcome'
            });
        } catch (_) { /* не критично */ }

        closeModal(regModal);
        showToast(`🎉 Аккаунт створено! Ласкаво просимо, ${username}!`);
    } catch (err) { errEl.textContent = translateError(err.code); }
});

// =============================================
// 8. СТАН АВТОРИЗАЦІЇ → хедер
// =============================================
auth.onAuthStateChanged(user => {
    const accBtn = document.getElementById('acc-btn');
    const accDropdown = document.getElementById('acc-dropdown');
    const myAccountLink = document.getElementById('nav-my-account');

    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        if (accBtn) accBtn.textContent = `👤 ${name} ▾`;
        if (myAccountLink) myAccountLink.style.display = 'inline';
        if (accDropdown) {
            accDropdown.innerHTML = `<a href="#" id="logout-btn">🚪 Вийти</a>`;
            document.getElementById('logout-btn').onclick = async e => {
                e.preventDefault();
                await auth.signOut();
                showToast('До побачення!');
            };
        }
    } else {
        if (accBtn) accBtn.textContent = 'Аккаунт ▾';
        if (myAccountLink) myAccountLink.style.display = 'none';
        if (accDropdown) {
            accDropdown.innerHTML = `
                <a href="#" id="login-trigger">🔑 Вхід</a>
                <a href="#" id="reg-trigger">📝 Реєстрація</a>`;
            bindLoginTrigger();
            bindRegTrigger();
        }
    }
});

// =============================================
// 9. ЖИВІ НОВИНИ з Firestore (тільки Firestore, без хардкоду)
// =============================================
function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderNewsList(docs) {
    const list = document.getElementById('news-list-dynamic');
    if (!list) return;
    if (docs.length === 0) {
        list.innerHTML = '<div class="news-item"><p>Новин поки немає...</p></div>';
        return;
    }
    list.innerHTML = docs.map(d => {
        const data = d.data();
        const isDownload = data.type === 'download';
        return `
            <div class="news-item${isDownload ? ' news-item-download' : ''}">
                <span class="news-date">${formatDate(data.timestamp)}</span>
                <p>${data.text}</p>
            </div>`;
    }).join('');
}

// Сідуємо системні новини в Firestore (з фіксованими ID — не дублюються)
async function seedSystemNews() {
    const systemNews = [
        { id: 'section-b', text: 'Було додано розділ "Б" (Автори на літеру Б) до Бібліотеки.', date: new Date('2026-02-23') },
        { id: 'section-a', text: 'Було додано розділ "А" (Автори на літеру А) до Бібліотеки.', date: new Date('2026-02-23') },
    ];
    for (const item of systemNews) {
        const ref = db.collection('news').doc(item.id);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                text: item.text,
                timestamp: firebase.firestore.Timestamp.fromDate(item.date),
                type: 'system'
            });
            console.log('[Seed] Додано системну новину:', item.id);
        }
    }
}
seedSystemNews();

// Підписка в реальному часі — всі новини, новіші зверху
db.collection('news')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .onSnapshot(snap => renderNewsList(snap.docs), () => renderNewsList([]));


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
