/* ==============================================
   CHESS VAULT — CHAMPIONS LOGIC & MODAL
   1 рядок на 1 людину, квадратні портрети
   Модалка 1 в 1 як для книги з переходом на модалку твору
   ============================================== */

document.addEventListener('DOMContentLoaded', () => {
    initChampionsSection();
});

function initChampionsSection() {
    if (typeof WORLD_CHAMPIONS_DATA === 'undefined') {
        console.warn('WORLD_CHAMPIONS_DATA is not loaded');
        return;
    }

    renderChampionsList();
    setupChampionModal();
}

// Допоміжна функція для прапора
function getFlagHtml(champ) {
    if (!champ.flag) return '';
    if (champ.flag.endsWith('.svg') || champ.flag.includes('/')) {
        return `<img src="${champ.flag}" alt="${champ.country || ''}" class="champ-flag-img">`;
    }
    return `<span class="champ-flag-emoji">${champ.flag}</span>`;
}

// 1. РЕНДЕР СПИСКУ ЧЕМПІОНІВ (1 рядок на 1 людину)
function renderChampionsList() {
    const listContainer = document.getElementById('champions-list');
    if (!listContainer) return;

    listContainer.innerHTML = WORLD_CHAMPIONS_DATA.map(champ => {
        const authorPillClass = champ.authorBooksCount > 0 ? 'has-books' : '';
        const aboutPillClass = champ.aboutBooksCount > 0 ? 'has-books' : '';
        const flagHtml = getFlagHtml(champ);
        const countryHtml = champ.country ? `<span class="champ-country">${flagHtml} <span>${champ.country}</span></span><span class="champ-dot">•</span>` : '';

        return `
            <div class="champion-row" data-champ-id="${champ.id}">
                <div class="champ-row-portrait-wrap">
                    <img src="${champ.portrait}" alt="${champ.name}" class="champ-row-portrait" loading="lazy" onerror="this.src='img/black_king.png'">
                </div>
                <div class="champ-row-main">
                    <h4 class="champ-row-name">${champ.name}</h4>
                    <div class="champ-row-reign">
                        ${countryHtml}
                        <span>👑 ${champ.years}</span>
                    </div>
                </div>
                <div class="champ-row-stats">
                    <span class="champ-pill ${authorPillClass}" title="Книг авторства">
                        ✍️ ${champ.authorBooksCount} авт.
                    </span>
                    <span class="champ-pill ${aboutPillClass}" title="Книг про нього або збірок партій">
                        📖 ${champ.aboutBooksCount} про нього
                    </span>
                </div>
                <span class="champ-row-arrow">›</span>
            </div>
        `;
    }).join('');

    // Прив'язка кліку до рядків
    listContainer.querySelectorAll('.champion-row[data-champ-id]').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.getAttribute('data-champ-id');
            const champ = WORLD_CHAMPIONS_DATA.find(c => c.id === id);
            if (champ) {
                openChampionModal(champ);
            }
        });
    });
}

// 2. МОДАЛЬНЕ ВІКНО ЧЕМПІОНА
let championModalOverlay = null;

function setupChampionModal() {
    championModalOverlay = document.getElementById('champion-modal-overlay');
    if (!championModalOverlay) return;

    const closeBtn = document.getElementById('champion-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeChampionModal);
    }

    championModalOverlay.addEventListener('click', (e) => {
        if (e.target === championModalOverlay) {
            closeChampionModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Якщо відкрита модалка книги, закриваємо спочатку її
            const bookOverlay = document.getElementById('book-detail-overlay');
            if (bookOverlay && bookOverlay.classList.contains('active')) {
                if (typeof closeBookModal === 'function') closeBookModal();
                return;
            }
            if (championModalOverlay.classList.contains('active')) {
                closeChampionModal();
            }
        }
    });
}

function openChampionModal(champ) {
    if (!championModalOverlay) return;

    const modalBody = document.getElementById('champion-modal-body');
    if (!modalBody) return;

    const numDisplay = typeof champ.number === 'number' 
        ? `${champ.number}-й Чемпіон Світу` 
        : `Чемпіон Світу (${champ.number})`;

    const factsHtml = champ.facts.map(f => `<li>${f}</li>`).join('');

    // Генерація списку авторських книг
    let authorBooksHtml = '<p class="chm-empty-books">У сховищі поки немає окремих видань авторства.</p>';
    if (champ.authorBooks && champ.authorBooks.length > 0) {
        authorBooksHtml = `
            <div class="chm-books-scroll-list">
                ${champ.authorBooks.map(b => `
                    <button type="button" class="chm-book-item" data-book-filename="${encodeURIComponent(b)}">
                        <span class="chm-book-title">📄 ${escapeHtml(b)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    // Генерація списку книг про нього
    let aboutBooksHtml = '<p class="chm-empty-books">У сховищі поки немає окремих книг про цього шахіста.</p>';
    if (champ.aboutBooks && champ.aboutBooks.length > 0) {
        aboutBooksHtml = `
            <div class="chm-books-scroll-list">
                ${champ.aboutBooks.map(b => `
                    <button type="button" class="chm-book-item" data-book-filename="${encodeURIComponent(b)}">
                        <span class="chm-book-title">📖 ${escapeHtml(b)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    modalBody.innerHTML = `
        <!-- ВЕРХНЯ ЧАСТИНА: фото 200x280 (як обкладинка книги) + інформація -->
        <div class="chm-top">
            <div class="chm-photo-wrap">
                <img src="${champ.portrait}" alt="${champ.name}" class="chm-photo" onerror="this.src='img/black_king.png'">
            </div>
            <div class="chm-hero-info">
                <div class="chm-badge-row">
                    <span class="chm-number-badge">👑 ${numDisplay}</span>
                    ${champ.country ? `<span class="chm-country-badge">${getFlagHtml(champ)} <span>${champ.country}</span></span>` : ''}
                </div>
                <h2 class="chm-name">${champ.name}</h2>
                <div class="chm-reign-badge">
                    <span>Час правління: <strong>${champ.years}</strong></span>
                </div>
                <div class="chm-counts-summary">
                    ${champ.peakEloDisplay ? `
                    <div class="chm-count-pill">
                        <span>⚡ Піковий рейтинг:</span>
                        <strong class="chm-elo-val">${champ.peakEloDisplay}</strong>
                    </div>` : ''}
                    <div class="chm-count-pill">
                        <span>✍️ Авторських книг:</span>
                        <strong>${champ.authorBooksCount}</strong>
                    </div>
                    <div class="chm-count-pill">
                        <span>📖 Книг про нього:</span>
                        <strong>${champ.aboutBooksCount}</strong>
                    </div>
                </div>
            </div>
        </div>

        <!-- ОПИС ТА ЦІКАВІ ФАКТИ -->
        <div class="chm-section">
            <h3 class="chm-section-title">📖 Про шахіста</h3>
            <p class="chm-bio-text">${champ.bio}</p>
        </div>

        <div class="chm-section">
            <h3 class="chm-section-title">⚡ Цікаві факти</h3>
            <ul class="chm-facts-list">
                ${factsHtml}
            </ul>
        </div>

        <!-- СПИСКИ КНИГ З ПРЯМИМ ПЕРЕХОДОМ НА МОДАЛКУ ТВОРУ -->
        <div class="chm-books-columns">
            <div class="chm-books-block">
                <h3 class="chm-section-title">✍️ Книги авторства (${champ.authorBooksCount})</h3>
                ${authorBooksHtml}
            </div>

            <div class="chm-books-block">
                <h3 class="chm-section-title">📖 Книги про нього та матчі (${champ.aboutBooksCount})</h3>
                ${aboutBooksHtml}
            </div>
        </div>
    `;

    // Прив'язуємо клік на книги → відкриваємо модалку книги (1 в 1 як у My Account / Бібліотеці)
    modalBody.querySelectorAll('.chm-book-item[data-book-filename]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filename = decodeURIComponent(btn.getAttribute('data-book-filename'));
            openBookModalFromFilename(filename);
        });
    });

    championModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeChampionModal() {
    if (!championModalOverlay) return;
    championModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 3. ВІДКРИТТЯ МОДАЛКИ КНИГИ З ІМЕНІ ФАЙЛУ (як на сторінці Мій Аккаунт)
function openBookModalFromFilename(filename) {
    if (!filename) return;

    const cleanName = filename.replace(/\.[^/.]+$/, '');
    const match = cleanName.match(/(.*?)\s*-\s*(.*)\s*\((\d{4})\)/);
    let author = '—';
    let title = cleanName;
    let year = '---';

    if (match) {
        author = match[1].trim();
        title = match[2].trim();
        year = match[3];
    } else {
        const parts = cleanName.split(/\s*-\s*/);
        if (parts.length > 1) {
            author = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }
    }

    const format = filename.split('.').pop().toLowerCase() || 'pdf';
    const pages = (window.CHESS_PAGE_COUNTS && (window.CHESS_PAGE_COUNTS[filename] || window.CHESS_PAGE_COUNTS[filename.toLowerCase()]))
        || (window.CHESS_DESCRIPTIONS && (window.CHESS_DESCRIPTIONS[filename]?.pages || window.CHESS_DESCRIPTIONS[filename.toLowerCase()]?.pages))
        || null;

    const cachedBook = window.CHESS_BOOKS_CACHE && window.CHESS_BOOKS_CACHE.find(b => b.id === filename || b.id.toLowerCase() === filename.toLowerCase());
    const sizeDisplay = cachedBook ? cachedBook.sizeDisplay : '—';
    const sizeRaw = cachedBook ? cachedBook.sizeRaw : 0;

    const bookObj = {
        id: filename,
        title: title || (cachedBook ? cachedBook.title : cleanName),
        author: author || (cachedBook ? cachedBook.author : ''),
        year: year !== '---' ? year : (cachedBook ? cachedBook.year : '---'),
        pages: pages ? parseInt(pages, 10) : (cachedBook ? cachedBook.pages : null),
        format: format,
        sizeDisplay: sizeDisplay,
        sizeRaw: sizeRaw,
        url: `https://archive.org/download/1971_20260223/${encodeURIComponent(filename)}`
    };

    if (typeof openBookModal === 'function') {
        openBookModal(bookObj);
    } else {
        console.error('openBookModal is not defined. Make sure book-modal.js is loaded.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.closeChampionModal = closeChampionModal;
window.openBookModalFromFilename = openBookModalFromFilename;
