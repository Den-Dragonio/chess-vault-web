const ARCHIVE_ID = '1971_20260223';
let allBooks = [];
let sortDirections = { author: 1, year: 1, pages: 1, sizeRaw: 1 };
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
        const response = await fetch(`https://archive.org/metadata/${ARCHIVE_ID}?_=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        const ALLOWED = ['.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx'];
        const files = data.files.filter(f => ALLOWED.some(ext => f.name.toLowerCase().endsWith(ext)));

        allBooks = files.map(f => {
            const fileName = f.name.replace(/\.[^/.]+$/, '');
            const match = fileName.match(/(.*?)\s*-\s*(.*)\s*\((\d{4})\)/);
            const bookId = f.name;
            const pages = (window.CHESS_PAGE_COUNTS && (window.CHESS_PAGE_COUNTS[bookId] || window.CHESS_PAGE_COUNTS[bookId.toLowerCase()]))
                || (window.CHESS_DESCRIPTIONS && (window.CHESS_DESCRIPTIONS[bookId]?.pages || window.CHESS_DESCRIPTIONS[bookId.toLowerCase()]?.pages))
                || null;
            return {
                author: match ? match[1].trim() : fileName.split('-')[0].trim(),
                title: match ? match[2].trim() : fileName,
                year: match ? match[3] : '---',
                pages: pages ? parseInt(pages, 10) : null,
                format: f.name.split('.').pop(),
                sizeDisplay: (f.size / 1024 / 1024).toFixed(2) + ' MB',
                sizeRaw: parseInt(f.size),
                url: `https://archive.org/download/${ARCHIVE_ID}/${f.name}`,
                id: f.name
            };
        });
        // Ініціалізуємо колекції (розділи гри та авторів)
        if (typeof initCollections === 'function') {
            initCollections(allBooks);
        } else {
            renderTable(allBooks);
        }

        // Фоновий авто-скрапер: обробляємо нові книги (яких ще немає в кеші)
        if (typeof autoScrapeNewBooks === 'function') {
            autoScrapeNewBooks(allBooks).catch(e => console.warn('autoScrape error:', e));
        }

        // — Статистика —
        const totalCount = allBooks.length;
        const totalBytes = allBooks.reduce((sum, b) => sum + (b.sizeRaw || 0), 0);
        const totalGB = totalBytes / 1024 / 1024 / 1024;
        const sizeStr = totalGB >= 1
            ? totalGB.toFixed(2) + ' ГБ'
            : (totalBytes / 1024 / 1024).toFixed(0) + ' МБ';
        const statsEl = document.getElementById('lib-stats');
        if (statsEl) statsEl.textContent = `📚 ${totalCount} файлів · 💾 ${sizeStr}`;
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
        container.innerHTML = `<tr><td colspan="7" class="loading-row">📭 Нічого не знайдено</td></tr>`;
        return;
    }
    container.innerHTML = books.map((b, idx) => `
        <tr data-book-idx="${idx}" style="cursor:pointer">
            <td class="col-author">${b.author}</td>
            <td class="col-title">${b.title}</td>
            <td class="col-year">${b.year}</td>
            <td class="col-pages">${b.pages ? b.pages + ' с.' : '—'}</td>
            <td class="col-format"><span class="badge format-${b.format}">${b.format}</span></td>
            <td class="col-size">${b.sizeDisplay}</td>
            <td class="col-action">
                <button class="download-link download-btn-js"
                        data-url="${b.url}"
                        data-title="${b.title.replace(/"/g, '&quot;')}"
                        data-author="${b.author.replace(/"/g, '&quot;')}"
                        data-id="${b.id.replace(/"/g, '&quot;')}"
                        data-format="${b.format}"
                        data-size="${b.sizeDisplay}">
                    <span>⬇</span><span>Скачати</span>
                </button>
            </td>
        </tr>
    `).join('');

    // Прив'язуємо обробники до кнопок скачування
    container.querySelectorAll('.download-btn-js').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // не відкривати модал при кліку на кнопку
            onDownloadClick(btn);
        });
    });

    // Клік по рядку → відкрити модальне вікно з деталями книги
    container.querySelectorAll('tr[data-book-idx]').forEach(row => {
        row.addEventListener('click', () => {
            const idx = parseInt(row.dataset.bookIdx, 10);
            if (!isNaN(idx) && books[idx]) {
                openBookModal(books[idx]);
            }
        });
    });
}

// =============================================
// НАТИСКАННЯ "СКАЧАТИ"
// =============================================
async function onDownloadClick(btn) {
    if (typeof window.onDownloadClick === 'function') {
        return window.onDownloadClick(btn);
    }
}

function showLibToast(msg, type = 'ok') {
    if (typeof window.showToast === 'function') {
        return window.showToast(msg, type);
    }
    let tc = document.getElementById('toast-container');
    if (!tc) {
        tc = document.createElement('div');
        tc.id = 'toast-container';
        document.body.appendChild(tc);
    }
    const t = document.createElement('div');
    const isWarn = type === 'warn';
    const isError = type === 'error';
    t.className = `toast ${isWarn ? 'toast-warn' : (isError ? 'toast-error' : '')}`.trim();
    const icon = isWarn ? '⚠️' : (isError ? '❌' : '✅');
    t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
    tc.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-out');
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 3500);
}
window.showLibToast = showLibToast;

// =============================================
// ПОШУК ТА СОРТУВАННЯ
// =============================================
document.getElementById('lib-search-input').addEventListener('input', e => {
    if (typeof renderFilteredBooks === 'function') {
        renderFilteredBooks();
    } else {
        const q = e.target.value.toLowerCase();
        renderTable(allBooks.filter(b =>
            b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.year.includes(q)
        ));
    }
});

function sortBooks(key) {
    sortDirections[key] *= -1;
    const dir = sortDirections[key];
    const sorter = (a, b) => {
        let valA = a[key];
        let valB = b[key];
        if (key === 'pages') {
            valA = valA || 0;
            valB = valB || 0;
            return (valA - valB) * dir;
        }
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    };
    allBooks.sort(sorter);
    if (typeof collectionsState !== 'undefined' && collectionsState.allBooks) {
        collectionsState.allBooks.sort(sorter);
    }
    if (typeof renderFilteredBooks === 'function') {
        renderFilteredBooks();
    } else {
        renderTable(allBooks);
    }
}

fetchArchiveData();