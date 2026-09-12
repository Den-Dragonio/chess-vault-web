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
if (grid) {
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
}

// =============================================
// СТЕЖЕННЯ ЗА АВТОРИЗАЦІЄЮ
// =============================================
auth.onAuthStateChanged(user => { currentUser = user; });

// =============================================
// =============================================
// СТАТИСТИКА ТА ДОПОМІЖНІ ФУНКЦІЇ
// =============================================
function updateLibraryStats(books) {
    const totalCount = books.length;
    const totalBytes = books.reduce((sum, b) => sum + (b.sizeRaw || 0), 0);
    const totalGB = totalBytes / 1024 / 1024 / 1024;
    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const unitGB = isEn ? 'GB' : 'ГБ';
    const unitMB = isEn ? 'MB' : 'МБ';
    const sizeStr = totalGB >= 1
        ? totalGB.toFixed(2) + ' ' + unitGB
        : (totalBytes / 1024 / 1024).toFixed(0) + ' ' + unitMB;
    const statsEl = document.getElementById('lib-stats');
    const filesLabel = isEn ? 'files' : 'файлів';
    if (statsEl) statsEl.textContent = `📚 ${totalCount} ${filesLabel} · 💾 ${sizeStr}`;
}

function applyUrlSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
        const searchInput = document.getElementById('lib-search-input');
        if (searchInput) {
            searchInput.value = searchParam;
            if (typeof renderFilteredBooks === 'function') {
                renderFilteredBooks();
            } else {
                searchInput.dispatchEvent(new Event('input'));
            }
        }
    }
}

function getLocalCachedBooks() {
    // 1. Попередньо скомпільований кеш з books-cache.js (швидкість 0 мс)
    if (window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE) && window.CHESS_BOOKS_CACHE.length > 0) {
        return window.CHESS_BOOKS_CACHE;
    }
    // 2. Локальне сховище браузера (localStorage)
    try {
        const stored = localStorage.getItem('chess_vault_books_cache');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Помилка читання localStorage:', e);
    }
    return null;
}

// =============================================
// ЗАВАНТАЖЕННЯ ДАНИХ З INTERNET ARCHIVE (ТОМ 1 + ТОМ 2)
// =============================================
const ARCHIVE_ITEMS = [
    { id: '1971_20260223', name: 'Том 1' },
    { id: '1971_20260223_vol2', name: 'Том 2' }
];

async function fetchArchiveData() {
    // ЕТАП 1: Миттєво відображаємо збережений каталог (0 секунд затримки)
    const cached = getLocalCachedBooks();
    let hasLoadedCache = false;

    if (cached && cached.length > 0) {
        allBooks = cached;
        hasLoadedCache = true;
        if (typeof initCollections === 'function') {
            initCollections(allBooks);
        } else {
            renderTable(allBooks);
        }
        updateLibraryStats(allBooks);
        applyUrlSearch();
    }

    // ЕТАП 2: Опитуємо всі доступні томи Internet Archive паралельно
    try {
        const fetchResults = await Promise.allSettled(
            ARCHIVE_ITEMS.map(async (vol) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 7000);
                try {
                    const response = await fetch(`https://archive.org/metadata/${vol.id}?_=${Date.now()}`, {
                        signal: controller.signal,
                        headers: { 'Accept': 'application/json' }
                    });
                    clearTimeout(timeoutId);
                    if (!response.ok) return { volId: vol.id, files: [] };
                    const data = await response.json();
                    if (!data || !Array.isArray(data.files)) return { volId: vol.id, files: [] };
                    return { volId: vol.id, files: data.files };
                } catch (e) {
                    clearTimeout(timeoutId);
                    return { volId: vol.id, files: [] };
                }
            })
        );

        const ALLOWED = ['.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx'];
        const booksMap = new Map();

        // 1. Спочатку заповнюємо вже завантаженими з кешу, щоб нічого не втратити
        if (hasLoadedCache && Array.isArray(cached)) {
            cached.forEach(b => {
                if (b && b.id) booksMap.set(b.id.toLowerCase(), b);
            });
        }

        // 2. Додаємо/оновлюємо дані з усіх відповідей серверів
        let anyNetworkSuccess = false;
        fetchResults.forEach(res => {
            if (res.status === 'fulfilled' && res.value && res.value.files && res.value.files.length > 0) {
                anyNetworkSuccess = true;
                const volId = res.value.volId;
                const validFiles = res.value.files.filter(f => ALLOWED.some(ext => f.name.toLowerCase().endsWith(ext)));

                validFiles.forEach(f => {
                    const fileName = f.name.replace(/\.[^/.]+$/, '');
                    const match = fileName.match(/(.*?)\s*-\s*(.*)\s*\((\d{4})\)/);
                    const bookId = f.name;
                    const pages = (window.CHESS_PAGE_COUNTS && (window.CHESS_PAGE_COUNTS[bookId] || window.CHESS_PAGE_COUNTS[bookId.toLowerCase()]))
                        || (window.CHESS_DESCRIPTIONS && (window.CHESS_DESCRIPTIONS[bookId]?.pages || window.CHESS_DESCRIPTIONS[bookId.toLowerCase()]?.pages))
                        || null;

                    const bookObj = {
                        author: match ? match[1].trim() : fileName.split('-')[0].trim(),
                        title: match ? match[2].trim() : fileName,
                        year: match ? match[3] : '---',
                        pages: pages ? parseInt(pages, 10) : null,
                        format: f.name.split('.').pop().toLowerCase(),
                        sizeDisplay: (f.size / 1024 / 1024).toFixed(2) + ' MB',
                        sizeRaw: parseInt(f.size) || 0,
                        url: `https://archive.org/download/${volId}/${f.name}`,
                        id: f.name,
                        archiveVolume: volId
                    };
                    booksMap.set(bookId.toLowerCase(), bookObj);
                });
            }
        });

        const unifiedBooks = Array.from(booksMap.values());

        if (unifiedBooks.length > 0) {
            // Зберігаємо актуальний об'єднаний каталог
            try {
                localStorage.setItem('chess_vault_books_cache', JSON.stringify(unifiedBooks));
            } catch (e) {}

            const countChanged = unifiedBooks.length !== allBooks.length;
            allBooks = unifiedBooks;

            if (!hasLoadedCache || countChanged) {
                if (typeof initCollections === 'function') {
                    initCollections(allBooks);
                } else {
                    renderTable(allBooks);
                }
                updateLibraryStats(allBooks);
                applyUrlSearch();
            }
        }

        // Фоновий авто-скрапер для нових книг
        if (typeof autoScrapeNewBooks === 'function') {
            autoScrapeNewBooks(allBooks).catch(e => console.warn('autoScrape error:', e));
        }

    } catch (err) {
        console.warn('Помилка фонового опитування архівів:', err.message);
        if (hasLoadedCache && allBooks.length > 0) {
            console.log(`ℹ️ Каталог успішно завантажено з автономного кешу (${allBooks.length} книг).`);
            return;
        }

        const body = document.getElementById('books-table-body');
        if (body) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-row" style="padding: 40px 20px; text-align: center;">
                        <div style="font-size: 1.3rem; margin-bottom: 8px;">⚠️ Сервери Internet Archive тимчасово недоступні (перевантаження)</div>
                        <div style="font-size: 0.95rem; opacity: 0.7; margin-bottom: 16px;">Помилка: ${err.message || '502 Bad Gateway / Offline'}</div>
                        <button onclick="fetchArchiveData()" class="sort-btn" style="padding: 8px 20px; cursor: pointer; font-size: 1rem;">🔄 Спробувати знову</button>
                    </td>
                </tr>
            `;
        }
    }
}

// =============================================
// РЕНДЕР ТАБЛИЦІ
// =============================================
function renderTable(books) {
    const container = document.getElementById('books-table-body');
    if (!container) return;
    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const noBooksMsg = window.i18n ? window.i18n.t('lib_no_books') : 'Нічого не знайдено';
    const dlText = isEn ? 'Download' : 'Скачати';
    const pageSuffix = isEn ? ' p.' : ' с.';

    if (books.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="loading-row">📭 ${noBooksMsg}</td></tr>`;
        return;
    }
    container.innerHTML = books.map((b, idx) => `
        <tr data-book-idx="${idx}" style="cursor:pointer">
            <td class="col-author">${b.author}</td>
            <td class="col-title">${b.title}</td>
            <td class="col-year">${b.year}</td>
            <td class="col-pages">${b.pages ? b.pages + pageSuffix : '—'}</td>
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
                    <span>⬇</span><span>${dlText}</span>
                </button>
            </td>
        </tr>
    `).join('');

    // Прив'язуємо обробники до кнопок скачування
    container.querySelectorAll('.download-btn-js').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // не відкривати модал при кліку на кнопку
            if (typeof window.onDownloadClick === 'function') {
                window.onDownloadClick(btn);
            }
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
// СИСТЕМА СПОВІЩЕНЬ БІБЛІОТЕКИ
// =============================================
function showLibToast(msg, type = 'ok', actionText = null, onAction = null) {
    if (typeof window.showToast === 'function') {
        return window.showToast(msg, type, actionText, onAction);
    }
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

window.addEventListener('chessVaultLanguageChanged', () => {
    if (typeof renderFilteredBooks === 'function') {
        renderFilteredBooks();
    } else if (allBooks && allBooks.length > 0) {
        renderTable(allBooks);
    }
    if (allBooks && allBooks.length > 0) {
        updateLibraryStats(allBooks);
    }
});

fetchArchiveData();