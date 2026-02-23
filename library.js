const ARCHIVE_ID = '1971_20260223';
let allBooks = [];
let sortDirections = { author: 1, year: 1, sizeRaw: 1 };
let currentUser = null;

// =============================================
// FIREBASE — compat SDK (вже ініціалізовано в auth-shared.js)
// =============================================
const db = firebase.firestore();

// =============================================
// ФОН — ШАХОВІ КООРДИНАТИ
// =============================================
const chessFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const chessRanks = ['1', '2', '3', '4', '5', '6', '7', '8'];
const chessSquares = [];
for (const f of chessFiles) for (const r of chessRanks) chessSquares.push(f + r);

const grid = document.getElementById('bg-grid-container');
const cells = [];
for (let i = 0; i < 150; i++) {
    const c = document.createElement('div');
    c.className = 'grid-cell';
    c.innerText = chessSquares[Math.floor(Math.random() * chessSquares.length)];
    const data = { el: c, x: Math.random() * 100, y: Math.random() * 250 - 150, speed: 0.008 + Math.random() * 0.01 };
    c.style.left = data.x + 'vw';
    grid.appendChild(c);
    cells.push(data);
}
function animate() {
    cells.forEach(c => {
        c.y += c.speed;
        if (c.y > 110) { c.y = -20; c.el.innerText = chessSquares[Math.floor(Math.random() * chessSquares.length)]; }
        c.el.style.top = c.y + 'vh';
    });
    requestAnimationFrame(animate);
}
animate();

// =============================================
// СТЕЖЕННЯ ЗА АВТОРИЗАЦІЄЮ
// =============================================
auth.onAuthStateChanged(user => { currentUser = user; });

// =============================================
// ЗАВАНТАЖЕННЯ ДАНИХ З ARCHIVE.ORG
// =============================================
async function fetchArchiveData() {
    try {
        const response = await fetch(`https://archive.org/metadata/${ARCHIVE_ID}`);
        const data = await response.json();
        const files = data.files.filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.djvu'));

        allBooks = files.map(f => {
            const fileName = f.name.replace(/\.[^/.]+$/, '');
            const match = fileName.match(/(.*?)\s*-\s*(.*)\s*\((\d{4})\)/);
            return {
                author: match ? match[1].trim() : fileName.split('-')[0].trim(),
                title: match ? match[2].trim() : fileName,
                year: match ? match[3] : '---',
                format: f.name.split('.').pop(),
                sizeDisplay: (f.size / 1024 / 1024).toFixed(2) + ' MB',
                sizeRaw: parseInt(f.size),
                url: `https://archive.org/download/${ARCHIVE_ID}/${f.name}`,
                id: f.name
            };
        });
        renderTable(allBooks);
    } catch (err) {
        console.error('Помилка завантаження:', err);
        const body = document.getElementById('books-table-body');
        if (body) body.innerHTML = `<tr><td colspan="6" class="loading-row">❌ Помилка завантаження.</td></tr>`;
    }
}

// =============================================
// РЕНДЕР ТАБЛИЦІ
// =============================================
function renderTable(books) {
    const container = document.getElementById('books-table-body');
    if (!container) return;
    if (books.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="loading-row">📭 Нічого не знайдено</td></tr>`;
        return;
    }
    container.innerHTML = books.map(b => `
        <tr>
            <td class="col-author">${b.author}</td>
            <td class="col-title">${b.title}</td>
            <td class="col-year">${b.year}</td>
            <td><span class="badge format-${b.format}">${b.format}</span></td>
            <td class="col-size">${b.sizeDisplay}</td>
            <td>
                <button class="download-link download-btn-js"
                        data-url="${b.url}"
                        data-title="${b.title.replace(/"/g, '&quot;')}"
                        data-author="${b.author.replace(/"/g, '&quot;')}">
                    ⬇ Скачати
                </button>
            </td>
        </tr>
    `).join('');

    // Прив'язуємо обробники до кнопок
    container.querySelectorAll('.download-btn-js').forEach(btn => {
        btn.addEventListener('click', () => onDownloadClick(btn));
    });
}

// =============================================
// НАТИСКАННЯ "СКАЧАТИ"
// =============================================
async function onDownloadClick(btn) {
    const user = currentUser;

    // — Захист: незареєстровані не качають —
    if (!user) {
        showLibToast('🔒 Щоб скачати книгу — увійдіть в аккаунт!', 'warn');
        return;
    }

    const url = btn.dataset.url;
    const title = btn.dataset.title;
    const author = btn.dataset.author;
    const bookId = encodeURIComponent(title).slice(0, 80); // ключ документа
    const userName = user.displayName || user.email.split('@')[0];
    const now = firebase.firestore.Timestamp.now();

    // Відкриваємо файл
    window.open(url, '_blank');

    // — Пишемо в Firestore паралельно —
    try {
        const batch = db.batch();

        // 1. Глобальний лічильник книги
        const globalRef = db.collection('downloads').doc(bookId);
        batch.set(globalRef, {
            title, author,
            count: firebase.firestore.FieldValue.increment(1),
            lastUser: userName,
            lastAt: now
        }, { merge: true });

        // 2. Історія скачань юзера
        const userRef = db.collection('user_downloads').doc(user.uid).collection('history').doc();
        batch.set(userRef, { title, author, url, downloadedAt: now });

        // 3. Новина
        const newsRef = db.collection('news').doc();
        batch.set(newsRef, {
            text: `📥 ${userName} завантажив "${title}"`,
            timestamp: now,
            type: 'download'
        });

        await batch.commit();
    } catch (e) {
        console.error('Firestore write error:', e);
    }
}

function showLibToast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:9999;
        padding:14px 22px; border-radius:12px; font-family:inherit;
        backdrop-filter:blur(10px); box-shadow:0 8px 20px rgba(0,0,0,0.2);
        background:${type === 'warn' ? 'rgba(200,80,30,0.92)' : 'rgba(0,0,0,0.85)'};
        color:#fff; font-size:1rem;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// =============================================
// ПОШУК ТА СОРТУВАННЯ
// =============================================
document.getElementById('lib-search-input').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderTable(allBooks.filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.year.includes(q)
    ));
});

function sortBooks(key) {
    sortDirections[key] *= -1;
    allBooks.sort((a, b) => {
        if (a[key] < b[key]) return -1 * sortDirections[key];
        if (a[key] > b[key]) return 1 * sortDirections[key];
        return 0;
    });
    renderTable(allBooks);
}

fetchArchiveData();