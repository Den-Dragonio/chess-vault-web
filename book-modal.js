/* ==============================================
   BOOK MODAL JS — Chess Vault
   Стратегія пошуку метаданих:
   1. Firestore cache
   2. Open Library з транслітерацією імен (кирилиця → латиниця)
   3. Graceful fallback з базовими даними
   ============================================== */

const ARCHIVE_ID_MODAL = '1971_20260223';

const FORMAT_COLORS = {
    pdf: '#ff4757', djvu: '#2f3542', epub: '#8e44ad',
    cbr: '#e67e22', cbz: '#e67e22', txt: '#27ae60',
    doc: '#2980b9', docx: '#2980b9', chm: '#ffa502'
};
const CACHE_TTL_DAYS = 60;
const SCRAPE_DELAY_MS = 500;

// =============================================
// ТАБЛИЦЯ ТРАНСЛІТЕРАЦІЇ — шахові автори
// Ключ: кирилиця (з архіву), Значення: латиниця для пошуку в OL
// =============================================
const AUTHOR_TRANSLITERATE = {
    'Авербах': 'Averbakh',
    'Авербах, Бейлин': 'Averbakh Beilin',
    'Авербах, Верховский': 'Averbakh',
    'Авербах, Котов, Юдович': 'Averbakh Kotov',
    'Авербах,Тайманов': 'Averbakh Taimanov',
    'Алаторцев': 'Alatortsev',
    'Алехин': 'Alekhine',
    'Алёхин': 'Alekhine',
    'Багиров': 'Bagirov',
    'Батуринский': 'Baturinsky',
    'Белявский': 'Beliavsky',
    'Богданович': 'Bogdanovich',
    'Боголюбов': 'Bogoljubow',
    'Болеславский': 'Boleslavsky',
    'Бологан': 'Bologan',
    'Бондаревский': 'Bondarevsky',
    'Ботвинник': 'Botvinnik',
    'Бронштейн': 'Bronstein',
    'Васюков': 'Vasyukov',
    'Волчок': 'Volchok',
    'Геллер': 'Geller',
    'Гуфельд': 'Gufeld',
    'Дворецкий': 'Dvoretsky',
    'Долматов': 'Dolmatov',
    'Иливицкий': 'Ilivitsky',
    'Каспаров': 'Kasparov',
    'Кваша': 'Kvasha',
    'Керес': 'Keres',
    'Корчной': 'Korchnoi',
    'Костиков': 'Kostikov',
    'Котов': 'Kotov',
    'Кузьминых': 'Kuzminykh',
    'Купрейчик': 'Kupreichik',
    'Ларсен': 'Larsen',
    'Липницкий': 'Lipnitsky',
    'Лутиков': 'Lutikov',
    'Макогонов': 'Makogonov',
    'Матанович': 'Matanovic',
    'Михальчишин': 'Mikhalchishin',
    'Нежметдинов': 'Nezhmeditnov',
    'Нимцович': 'Nimzowitsch',
    'Нимцо-вич': 'Nimzowitsch',
    'Панченко': 'Panchenko',
    'Петросян': 'Petrosian',
    'Полугаевский': 'Polugaevsky',
    'Портиш': 'Portisch',
    'Романовский': 'Romanovsky',
    'Романов': 'Romanov',
    'Рудольф': 'Rudolf',
    'Рыбка': 'Rybka',
    'Смыслов': 'Smyslov',
    'Спасский': 'Spassky',
    'Таль': 'Tal',
    'Тайманов': 'Taimanov',
    'Тимман': 'Timman',
    'Тихонов': 'Tikhonov',
    'Фишер': 'Fischer',
    'Фурман': 'Furman',
    'Харитонов': 'Kharitonov',
    'Цешковский': 'Tseshkovsky',
    'Чистяков': 'Chistyakov',
    'Шамкович': 'Shamkovich',
    'Шахматная федерация': 'Chess Federation',
    'Штейн': 'Stein',
    'Эйве': 'Euwe',
    'Юдович': 'Yudovich',
};

// Транслітерація загального призначення (для авторів не в таблиці)
const CYRILLIC_MAP = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu',
    'я':'ya',
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh',
    'З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O',
    'П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts',
    'Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu',
    'Я':'Ya',
    // Ukrainian
    'і':'i','ї':'yi','є':'ye','І':'I','Ї':'Yi','Є':'Ye',
};

function transliterate(str) {
    return str.split('').map(ch => CYRILLIC_MAP[ch] !== undefined ? CYRILLIC_MAP[ch] : ch).join('');
}

function getLatinAuthor(cyrillicAuthor) {
    if (!cyrillicAuthor) return '';
    // Точний збіг в таблиці
    if (AUTHOR_TRANSLITERATE[cyrillicAuthor]) return AUTHOR_TRANSLITERATE[cyrillicAuthor];
    // Частковий збіг (перший автор зі списку через кому)
    const firstAuthor = cyrillicAuthor.split(/[,;]/)[0].trim();
    if (AUTHOR_TRANSLITERATE[firstAuthor]) return AUTHOR_TRANSLITERATE[firstAuthor];
    // Загальна транслітерація
    return transliterate(firstAuthor);
}

function getLatinTitle(cyrillicTitle) {
    if (!cyrillicTitle) return '';
    return transliterate(cyrillicTitle);
}

// =============================================
// ВІДКРИТТЯ / ЗАКРИТТЯ МОДАЛУ
// =============================================
function ensureBookModalElements() {
    let overlay = document.getElementById('book-detail-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'book-detail-overlay';
        overlay.innerHTML = `
            <div id="book-detail-card">
                <button id="book-detail-close">✕</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    if (!overlay.dataset.listenersAttached) {
        overlay.dataset.listenersAttached = '1';
        overlay.addEventListener('click', function (e) {
            if (e.target === this) closeBookModal();
        });
        const closeBtn = overlay.querySelector('#book-detail-close');
        if (closeBtn) closeBtn.addEventListener('click', closeBookModal);
    }
    return overlay;
}

function openBookModal(book) {
    const overlay = ensureBookModalElements();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderModalSkeleton(book);
    loadBookMetadata(book);
}

function closeBookModal() {
    const overlay = document.getElementById('book-detail-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBookModalElements);
} else {
    ensureBookModalElements();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBookModal(); });

// =============================================
// SKELETON
// =============================================
function formatDescriptionText(text) {
    if (!text) return '';
    return text.split(/\n\s*\n/).map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return `<div class="bd-p-bullet">${escHtml(trimmed).replace(/\n/g, '<br>')}</div>`;
        }
        return `<p class="bd-p">${escHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

function getBookPages(book, meta) {
    if (book && book.pages) return book.pages;
    if (meta && meta.pages) return meta.pages;
    const id = book?.id;
    if (id) {
        const idLower = id.toLowerCase();
        if (window.CHESS_PAGE_COUNTS) {
            if (window.CHESS_PAGE_COUNTS[id]) return window.CHESS_PAGE_COUNTS[id];
            if (window.CHESS_PAGE_COUNTS[idLower]) return window.CHESS_PAGE_COUNTS[idLower];
        }
        if (window.CHESS_DESCRIPTIONS) {
            if (window.CHESS_DESCRIPTIONS[id]?.pages) return window.CHESS_DESCRIPTIONS[id].pages;
            if (window.CHESS_DESCRIPTIONS[idLower]?.pages) return window.CHESS_DESCRIPTIONS[idLower].pages;
        }
    }
    return null;
}

async function fetchOnlinePageCount(book) {
    if (!book || !book.title) return null;
    try {
        const cleanTitle = encodeURIComponent(book.title.replace(/[():,\.]/g, ' ').replace(/\s+/g, ' ').trim());
        const cleanAuthor = encodeURIComponent((book.author || '').replace(/[():,\.]/g, ' ').replace(/\s+/g, ' ').trim());
        let q = `intitle:${cleanTitle}`;
        if (cleanAuthor && book.author !== '—') q += `+inauthor:${cleanAuthor}`;
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=2`);
        if (res.ok) {
            const data = await res.json();
            for (const item of (data.items || [])) {
                const pc = item.volumeInfo?.pageCount;
                if (pc && pc > 0) return pc;
            }
        }
    } catch (_) {}
    return null;
}

function checkAndFetchMissingPages(book, knownPages) {
    if (knownPages || getBookPages(book, null)) return;
    fetchOnlinePageCount(book).then(pc => {
        if (pc) {
            if (window.CHESS_PAGE_COUNTS) window.CHESS_PAGE_COUNTS[book.id] = pc;
            const pill = document.getElementById('bd-pages-pill');
            if (pill) {
                pill.textContent = `📖 ${pc} стор.`;
                pill.style.display = 'inline-flex';
            }
        }
    });
}

// =============================================
// SKELETON
// =============================================
function renderModalSkeleton(book) {
    const card = document.getElementById('book-detail-card');
    const fmtColor = FORMAT_COLORS[book.format] || '#888';
    const pages = getBookPages(book, null);
    card.innerHTML = `
        <button id="book-detail-close">✕</button>
        <div class="bd-top">
            <div class="bd-cover-wrap">
                <img class="bd-cover" id="bd-cover-img"
                     src="covers/${encodeURIComponent(book.id.replace(/\.[^/.]+$/, ''))}.jpg"
                     alt="${escHtml(book.title)}"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div class="bd-cover-placeholder" style="display:none">
                    <span class="bd-placeholder-icon">♟</span>
                    <span class="bd-placeholder-text">Пошук обкладинки...</span>
                </div>
            </div>
            <div class="bd-hero">
                <h1 class="bd-title">
                    ${escHtml(book.title)}
                    <span class="bd-format-tag" style="background:${fmtColor}">${book.format.toUpperCase()}</span>
                </h1>
                <p class="bd-author">✍️ ${escHtml(book.author)}</p>
                <div class="bd-meta-row">
                    ${book.year !== '---' ? `<span class="bd-meta-pill">📅 ${book.year}</span>` : ''}
                    <span class="bd-meta-pill">💾 ${book.sizeDisplay}</span>
                    <span class="bd-meta-pill">📄 ${book.format.toUpperCase()}</span>
                    ${pages ? `<span class="bd-meta-pill" id="bd-pages-pill">📖 ${pages} ${(window.i18n && window.i18n.currentLang === 'en' ? 'p.' : 'стор.')}</span>` : `<span class="bd-meta-pill" id="bd-pages-pill" style="display:none"></span>`}
                </div>
                <div class="bd-hero-actions">
                    <button class="bd-btn-download" id="bd-download-btn"
                            data-url="${escHtml(book.url || '')}"
                            data-title="${escHtml(book.title || '')}"
                            data-author="${escHtml(book.author || '')}"
                            data-id="${escHtml(book.id || '')}"
                            data-format="${escHtml(book.format || '')}"
                            data-size="${escHtml(book.sizeDisplay || '')}">${window.i18n ? window.i18n.t('modal_btn_download', { size: book.sizeDisplay || (window.i18n.currentLang === 'en' ? 'file' : 'файл') }) : `⬇ Скачати (${book.sizeDisplay || 'файл'})`}</button>
                </div>
            </div>
        </div>
        <hr class="bd-divider">
        <div>
            <p class="bd-section-label">${window.i18n ? window.i18n.t('modal_section_about') : 'Про книгу'}</p>
            <div class="bd-skeleton">
                <div class="bd-skeleton-line" style="width:95%"></div>
                <div class="bd-skeleton-line" style="width:85%"></div>
                <div class="bd-skeleton-line" style="width:90%"></div>
                <div class="bd-skeleton-line" style="width:60%"></div>
            </div>
        </div>`;
    document.getElementById('book-detail-close').addEventListener('click', closeBookModal);
    document.getElementById('bd-download-btn').addEventListener('click', function () { onDownloadClick(this); });
}

// =============================================
// ЗАВАНТАЖЕННЯ МЕТАДАНИХ
// =============================================
function findDescriptionForBook(book) {
    if (!window.CHESS_DESCRIPTIONS) return null;
    if (book.id && window.CHESS_DESCRIPTIONS[book.id]) {
        return window.CHESS_DESCRIPTIONS[book.id];
    }
    const cleanId = (book.id || '').replace(/\.[^/.]+$/, '').trim().toLowerCase();
    const cleanTitle = (book.title || '').trim().toLowerCase();
    const cleanAuthor = (book.author || '').trim().toLowerCase();

    for (const [key, val] of Object.entries(window.CHESS_DESCRIPTIONS)) {
        const baseKey = key.replace(/\.[^/.]+$/, '').trim().toLowerCase();
        if (cleanId && baseKey === cleanId) return val;
        if (cleanTitle && cleanTitle !== '---' && baseKey.includes(cleanTitle)) {
            if (!cleanAuthor || cleanAuthor === '—' || baseKey.includes(cleanAuthor)) {
                return val;
            }
        }
    }
    return null;
}

async function loadBookMetadata(book) {
    // 0. Локальна база описів (descriptions.js)
    const localMeta = findDescriptionForBook(book);
    if (localMeta) {
        renderModalFull(book, {
            title: book.title,
            author: book.author,
            year: book.year,
            pages: localMeta.pages || null,
            description: localMeta.bookDescription || localMeta.description || '',
            bookDescription: localMeta.bookDescription || localMeta.description || '',
            authorBio: localMeta.authorBio || '',
            source: localMeta.source || 'catalog',
            wikiUrl: localMeta.wikiUrl || null
        });
        checkAndFetchMissingPages(book, localMeta.pages);
        return;
    }

    // 1. Кеш Firestore
    let meta = null;
    const firestoreDb = (typeof db !== 'undefined' && db) || window.db || (typeof firebase !== 'undefined' && firebase.apps?.length ? firebase.firestore() : null);
    try {
        if (firestoreDb) {
            const snap = await firestoreDb.collection('book_metadata').doc(safeDocId(book.id)).get();
            if (snap.exists) {
                const data = snap.data();
                const ageDays = (Date.now() - (data.fetchedAt?.toMillis?.() || 0)) / 86400000;
                if (ageDays < CACHE_TTL_DAYS) meta = data;
            }
        }
    } catch (e) { /* firestore не доступний — продовжуємо */ }

    // 2. Якщо кешу немає — скрапимо
    if (!meta) {
        meta = await fetchBookMeta(book);
        if (meta && firestoreDb) {
            try {
                await firestoreDb.collection('book_metadata').doc(safeDocId(book.id)).set(
                    { ...meta, fetchedAt: firebase.firestore.Timestamp.now() },
                    { merge: true }
                );
            } catch (e) { /* тихо */ }
        }
    }

    renderModalFull(book, meta);
    checkAndFetchMissingPages(book, meta?.pages);
}

// =============================================
// ОСНОВНА ЛОГІКА СКРАПІНГУ
// =============================================
async function fetchBookMeta(book) {
    if (isJournalFile(book)) {
        return { title: book.title, author: book.author, year: book.year, coverUrl: null, description: '', subjects: [], source: 'journal' };
    }

    // Отримуємо латинські варіанти для пошуку
    const latinAuthor = getLatinAuthor(book.author);
    const latinTitle  = getLatinTitle(book.title);

    // Паралельно запускаємо кілька стратегій пошуку
    const searches = [
        // 1. Пошук по латинизованому автору + латинізованій назві
        searchOpenLibrary(latinTitle, latinAuthor),
        // 2. Пошук тільки по автору (частіше дає результат)
        searchOpenLibraryByAuthor(latinAuthor, book.year),
    ];

    const results = await Promise.allSettled(searches);
    const candidates = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

    // Вибираємо найкращий результат (той що має обкладинку + ближчий рік)
    const best = pickBestResult(candidates, book);

    if (best) {
        return {
            title: book.title,       // зберігаємо оригінальну назву (кирилиця)
            author: book.author,     // зберігаємо оригінального автора
            year: book.year,
            coverUrl: best.coverUrl,
            description: best.description || '',
            subjects: best.subjects || [],
            openLibraryKey: best.openLibraryKey || null,
            source: 'openlibrary'
        };
    }

    // Нічого не знайдено
    return {
        title: book.title, author: book.author, year: book.year,
        coverUrl: null, description: '', subjects: [], source: 'notfound'
    };
}

// =============================================
// OPEN LIBRARY — ПОШУК
// =============================================
async function searchOpenLibrary(title, author) {
    if (!title && !author) return null;
    try {
        const q = encodeURIComponent(`${title} ${author}`.trim());
        const url = `https://openlibrary.org/search.json?q=${q}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,subject,language`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.docs?.length) return null;

        // Вибираємо запис з обкладинкою
        const doc = data.docs.find(d => d.cover_i) || data.docs[0];
        return await enrichOpenLibraryDoc(doc);
    } catch (e) { return null; }
}

async function searchOpenLibraryByAuthor(latinAuthor, year) {
    if (!latinAuthor || latinAuthor.length < 3) return null;
    try {
        // Шукаємо по автору + chess (шахова тематика)
        const q = encodeURIComponent(`${latinAuthor} chess`);
        const url = `https://openlibrary.org/search.json?q=${q}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,subject`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.docs?.length) return null;

        // Беремо найближчий рік
        let best = null;
        let bestDiff = Infinity;
        for (const doc of data.docs) {
            if (!doc.cover_i) continue;
            const diff = Math.abs((doc.first_publish_year || 9999) - parseInt(year || 0));
            if (diff < bestDiff) { bestDiff = diff; best = doc; }
        }
        if (!best) best = data.docs.find(d => d.cover_i) || data.docs[0];
        return await enrichOpenLibraryDoc(best);
    } catch (e) { return null; }
}

async function enrichOpenLibraryDoc(doc) {
    if (!doc) return null;

    // Отримуємо опис через Works API
    let description = '';
    if (doc.key) {
        try {
            const wr = await fetch(`https://openlibrary.org${doc.key}.json`);
            if (wr.ok) {
                const work = await wr.json();
                if (work.description) {
                    description = typeof work.description === 'object'
                        ? (work.description.value || '') : String(work.description);
                }
                // Якщо опису немає — беремо excerpts
                if (!description && work.excerpts?.length) {
                    description = work.excerpts[0].excerpt || '';
                }
            }
        } catch (e) { /* пропускаємо */ }
    }

    const coverId = doc.cover_i;
    return {
        coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
        description,
        subjects: (doc.subject || []).slice(0, 10),
        openLibraryKey: doc.key || null,
        olTitle: doc.title,
        olYear: doc.first_publish_year
    };
}

function pickBestResult(candidates, book) {
    if (!candidates.length) return null;
    // Пріоритет: є обкладинка
    const withCover = candidates.filter(c => c.coverUrl);
    if (withCover.length === 0) return candidates[0];
    if (withCover.length === 1) return withCover[0];
    // З кількох — беремо найближчий рік
    const bookYear = parseInt(book.year) || 0;
    return withCover.sort((a, b) =>
        Math.abs((a.olYear || 9999) - bookYear) - Math.abs((b.olYear || 9999) - bookYear)
    )[0];
}

// =============================================
// РЕНДЕР ПОВНОГО МОДАЛУ
// =============================================
function renderModalFull(book, meta) {
    const card = document.getElementById('book-detail-card');
    if (!card) return;

    const fmtColor = FORMAT_COLORS[book.format] || '#888';
    const title   = escHtml(book.title);
    const author  = escHtml(book.author);
    const year    = book.year;
    const desc    = meta?.description || '';
    const subjects = meta?.subjects || [];
    const coverUrl = meta?.coverUrl || null;
    const olKey    = meta?.openLibraryKey || null;
    const source   = meta?.source || 'notfound';
    const isJournal = isJournalFile(book);

    // Обкладинка: спочатку локальна з covers/, потім Open Library, потім заглушка
    const localCoverUrl = `covers/${encodeURIComponent(book.id.replace(/\.[^/.]+$/, ''))}.jpg`;
    const fallbackCoverUrl = coverUrl ? escHtml(coverUrl) : '';

    const coverHTML = `
        <img class="bd-cover" id="bd-cover-img" 
             src="${localCoverUrl}" 
             alt="${title}"
             onerror="if (this.dataset.fallbackTried !== '1' && '${fallbackCoverUrl}') { this.dataset.fallbackTried = '1'; this.src = '${fallbackCoverUrl}'; } else { this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex'; }"
        ><div class="bd-cover-placeholder" style="display:none">
            <span class="bd-placeholder-icon">♟</span>
            <span class="bd-placeholder-text">Обкладинка<br>не знайдена</span>
        </div>`;

    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const topicsLabel = window.i18n ? window.i18n.t('modal_section_topics') : 'Теми';
    const aboutBookLabel = window.i18n ? window.i18n.t('modal_section_about') : 'Про книгу';
    const aboutAuthorLabel = window.i18n ? window.i18n.t('modal_section_author') : 'Про автора';
    const wikiLabel = window.i18n ? window.i18n.t('modal_wiki_link') : 'Стаття у Вікіпедії';
    const journalLabel = window.i18n ? window.i18n.t('modal_journal_tag') : 'Журнал "64"';

    // Теги
    const subjectsHTML = subjects.length > 0
        ? `<hr class="bd-divider"><div>
               <p class="bd-section-label">${topicsLabel}</p>
               <div class="bd-subjects">
                   ${subjects.map(s => `<span class="bd-subject-chip">🏷️ ${escHtml(s)}</span>`).join('')}
               </div>
           </div>` : '';

    // Мітки
    const sourceMap = { 
        openlibrary: '📖 Open Library', 
        journal_catalog: isEn ? '📰 Chess Catalog' : '📰 Шаховий каталог',
        book_ocr: isEn ? '📄 Book Annotation' : '📄 Анотація з книги',
        wikipedia: isEn ? '🌐 Wikipedia' : '🌐 Вікіпедія',
        author_bio: isEn ? '✍️ Author Biography' : '✍️ Біографія автора',
        smart_summary: isEn ? '♟ Chess Reference' : '♟ Шаховий довідник',
        notfound: isEn ? '📄 File' : '📄 Файл' 
    };
    const sourceLabel = sourceMap[source] || (isEn ? '📄 File' : '📄 Файл');
    const journalBadge = isJournal ? `<span class="bd-meta-pill">📰 ${journalLabel}</span>` : '';

    // Опис книги
    const bookDesc = meta?.bookDescription || meta?.description || '';
    const authorBio = meta?.authorBio || '';

    let bookDescHTML;
    if (bookDesc) {
        bookDescHTML = formatDescriptionText(bookDesc);
    } else if (isJournal) {
        const parts = book.id.replace(/\.[^/.]+$/, '').split('-');
        const num = parts[2] ? `№${parseInt(parts[2])}` : '';
        const journalDesc = isEn
            ? `Chess magazine «64» — ${parts[1] || ''}, ${num}. Open the file to review contents and game analyses.`
            : `Шаховий журнал «64» — ${parts[1] || ''} рік, ${num}. Відкрийте файл щоб переглянути вміст та аналізи партій.`;
        bookDescHTML = `<p class="bd-p"><span style="opacity:0.65">${journalDesc}</span></p>`;
    } else {
        const descPreparing = window.i18n ? window.i18n.t('modal_desc_preparing') : 'Опис для цієї книги готується. Ви можете завантажити книгу та ознайомитися з її змістом.';
        bookDescHTML = `<p class="bd-p"><span style="opacity:0.55">${descPreparing}</span></p>`;
    }

    const authorBioHTML = authorBio ? `
        <hr class="bd-divider">
        <div class="bd-section">
            <p class="bd-section-label">✍️ ${aboutAuthorLabel}</p>
            <div class="bd-description bd-author-bio">${formatDescriptionText(authorBio)}</div>
        </div>` : '';

    let extBtnHTML = '';
    if (meta?.wikiUrl) {
        extBtnHTML = `<a class="bd-btn-openlibrary" href="${escHtml(meta.wikiUrl)}" target="_blank" rel="noopener">🌐 ${wikiLabel}</a>`;
    } else if (olKey) {
        extBtnHTML = `<a class="bd-btn-openlibrary" href="https://openlibrary.org${olKey}" target="_blank" rel="noopener">🌐 Open Library</a>`;
    }

    const pages = getBookPages(book, meta);
    const pagesSuffix = isEn ? ' p.' : ' стор.';
    const pagesPill = pages ? `<span class="bd-meta-pill" id="bd-pages-pill">📖 ${pages}${pagesSuffix}</span>` : '';
    const dlBtnLabel = window.i18n ? window.i18n.t('modal_btn_download', { size: book.sizeDisplay || (isEn ? 'file' : 'файл') }) : `⬇ Скачати (${book.sizeDisplay || 'файл'})`;
    const sourceDataText = window.i18n ? window.i18n.t('modal_source_data', { source: sourceLabel }) : `Дані: ${sourceLabel}`;

    card.innerHTML = `
        <button id="book-detail-close">✕</button>
        <div class="bd-top">
            <div class="bd-cover-wrap">${coverHTML}</div>
            <div class="bd-hero">
                <h1 class="bd-title">
                    ${title}
                    <span class="bd-format-tag" style="background:${fmtColor}">${book.format.toUpperCase()}</span>
                </h1>
                <p class="bd-author">✍️ ${author}</p>
                <div class="bd-meta-row">
                    ${year && year !== '---' ? `<span class="bd-meta-pill">📅 ${year}</span>` : ''}
                    <span class="bd-meta-pill">💾 ${book.sizeDisplay}</span>
                    <span class="bd-meta-pill">📄 ${book.format.toUpperCase()}</span>
                    ${pagesPill}
                    ${journalBadge}
                </div>
                <div class="bd-hero-actions">
                    <button class="bd-btn-download" id="bd-download-btn"
                            data-url="${escHtml(book.url || '')}"
                            data-title="${escHtml(book.title || '')}"
                            data-author="${escHtml(book.author || '')}"
                            data-id="${escHtml(book.id || '')}"
                            data-format="${escHtml(book.format || '')}"
                            data-size="${escHtml(book.sizeDisplay || '')}">${dlBtnLabel}</button>
                    ${extBtnHTML}
                </div>
                ${source !== 'notfound' ? `<p class="bd-source-badge">${sourceDataText}</p>` : ''}
            </div>
        </div>
        <hr class="bd-divider">
        <div class="bd-section">
            <p class="bd-section-label">📖 ${aboutBookLabel}</p>
            <div class="bd-description">${bookDescHTML}</div>
        </div>
        ${authorBioHTML}
        ${subjectsHTML}`;

    document.getElementById('book-detail-close').addEventListener('click', closeBookModal);
    document.getElementById('bd-download-btn').addEventListener('click', function () { onDownloadClick(this); });
}

// =============================================
// АВТО-СКРАПЕР ДЛЯ НОВИХ КНИГ (фон)
// =============================================
async function autoScrapeNewBooks(books) {
    if (!books?.length) return;
    const firestoreDb = (typeof db !== 'undefined' && db) || window.db || (typeof firebase !== 'undefined' && firebase.apps?.length ? firebase.firestore() : null);
    if (!firestoreDb) return;

    let cachedIds = new Set();
    try {
        const snap = await firestoreDb.collection('book_metadata').get();
        snap.forEach(doc => cachedIds.add(doc.id));
    } catch (e) { return; }

    const newBooks = books.filter(b => {
        if (cachedIds.has(safeDocId(b.id))) return false;
        // Якщо вже є локальний детальний опис у descriptions.js — не перевантажуємо мережу
        if (typeof findDescriptionForBook === 'function' && findDescriptionForBook(b)) return false;
        return true;
    });

    if (!newBooks.length) return;
    console.log(`[AutoScrape] Знайдено ${newBooks.length} нових книг без описів — фоновий збір...`);

    for (const book of newBooks) {
        await delay(SCRAPE_DELAY_MS);
        const meta = await fetchBookMeta(book);
        if (meta) {
            try {
                await firestoreDb.collection('book_metadata').doc(safeDocId(book.id)).set(
                    { ...meta, fetchedAt: firebase.firestore.Timestamp.now() },
                    { merge: true }
                );
            } catch (e) { /* тихо */ }
        }
    }
}

// =============================================
// УТИЛІТИ
// =============================================
function isJournalFile(book) {
    return /^64-\d{4}-\d+/.test(book.id);
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeDocId(id) {
    return id.replace(/\//g, '__').slice(0, 200);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// СИСТЕМА СПОВІЩЕНЬ (TOAST NOTIFICATIONS)
// =============================================
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

    t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg"><span>${escapeHtmlModal(msg)}</span>${actionHtml}</span>`;
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
window.showLibToast = showToast;

function escapeHtmlModal(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =============================================
// ЗАВАНТАЖЕННЯ КНИГИ ТА ОБЛІК УНІКАЛЬНОСТІ
// =============================================
function getCanonicalBookId(title, filename) {
    const raw = filename ? filename.replace(/\.[^/.]+$/, '') : (title || 'unknown_book');
    return raw.trim().replace(/[/\\#?%]/g, '_').toLowerCase().slice(0, 120);
}

function getAuthUser() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            const u = firebase.auth().currentUser;
            if (u) return u;
        }
    } catch (_) {}
    if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser;
    if (window.auth && window.auth.currentUser) return window.auth.currentUser;
    if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
    if (window.currentUser) return window.currentUser;
    return null;
}

async function onDownloadClick(btn) {
    if (!btn) return;
    const user = getAuthUser();

    const isEn = window.i18n && window.i18n.currentLang === 'en';

    if (!user) {
        const msg = isEn ? 'To download a book, please log in to your account!' : 'Щоб завантажити книгу — будь ласка, увійдіть в аккаунт!';
        const onLogin = () => {
            const loginModal = document.getElementById('login-modal');
            if (loginModal && typeof openModal === 'function') {
                openModal(loginModal);
            } else {
                const loginTrigger = document.getElementById('login-trigger');
                if (loginTrigger) {
                    loginTrigger.click();
                } else {
                    window.location.href = 'index.html';
                }
            }
        };
        showToast(msg, 'warn', isEn ? 'Log In 🔑' : 'Увійти 🔑', onLogin);
        return;
    }

    const url = btn.dataset.url;
    const title = btn.dataset.title || '';
    const author = btn.dataset.author || '';
    const filename = btn.dataset.id || btn.dataset.filename || (url ? decodeURIComponent(url.split('/').pop()) : '');
    const format = btn.dataset.format || (filename || url || '').split('.').pop().toLowerCase() || 'pdf';
    const sizeDisplay = btn.dataset.size || btn.dataset.sizeDisplay || '—';
    const bookDocId = getCanonicalBookId(title, filename);
    const userName = user.displayName || user.email.split('@')[0];
    const now = firebase.firestore.Timestamp.now();

    // 1. Відкриваємо файл для скачування
    if (url) {
        window.open(url, '_blank');
    }

    // 2. Перевіряємо в Firestore, чи це повторне скачування цим користувачем
    try {
        const firestoreDb = (typeof db !== 'undefined' && db) || window.db || (typeof firebase !== 'undefined' && firebase.apps?.length ? firebase.firestore() : null);
        if (!firestoreDb) return;

        const userHistoryRef = firestoreDb.collection('user_downloads').doc(user.uid).collection('history');
        const userBookDocRef = userHistoryRef.doc(bookDocId);

        let isRepeat = false;
        const snap = await userBookDocRef.get();
        if (snap.exists) {
            isRepeat = true;
        } else {
            // Перевіряємо спадкові записи за назвою книги
            const legacyQuery = await userHistoryRef.where('title', '==', title).limit(1).get();
            if (!legacyQuery.empty) {
                isRepeat = true;
            }
        }

        if (isRepeat) {
            await userBookDocRef.set({
                lastDownloadedAt: now,
                repeatCount: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });

            const repeatMsg = isEn ? '📥 Book downloaded again' : '📥 Книгу завантажено знову (повторне завантаження)';
            if (typeof showLibToast === 'function') showLibToast(repeatMsg);
            else if (typeof showToast === 'function') showToast(repeatMsg);
            return;
        }

        // ✅ ПЕРШЕ (УНІКАЛЬНЕ) СКАЧУВАННЯ:
        const batch = firestoreDb.batch();

        // 1. Глобальний лічильник
        const globalRef = firestoreDb.collection('downloads').doc(bookDocId);
        batch.set(globalRef, {
            title,
            author,
            count: firebase.firestore.FieldValue.increment(1),
            lastUser: userName,
            lastAt: now
        }, { merge: true });

        // 2. Запис в історію користувача
        batch.set(userBookDocRef, {
            title,
            author,
            url,
            id: filename || `${title}.${format}`,
            format,
            sizeDisplay,
            bookId: bookDocId,
            downloadedAt: now,
            lastDownloadedAt: now
        }, { merge: true });

        // 3. Новина для стрічки активності
        const newsRef = firestoreDb.collection('news').doc();
        batch.set(newsRef, {
            text: `📥 ${userName} завантажив "${title}"`,
            timestamp: now,
            type: 'download'
        });

        await batch.commit();

        const startMsg = window.i18n ? window.i18n.t('modal_download_success', { title: title || filename }) : `📥 Завантаження розпочато!`;
        if (typeof showLibToast === 'function') showLibToast(startMsg);
        else if (typeof showToast === 'function') showToast(startMsg);

    } catch (e) {
        console.error('Firestore download tracking error:', e);
    }
}

window.onDownloadClick = onDownloadClick;
window.handleBookDownload = onDownloadClick;
window.getCanonicalBookId = getCanonicalBookId;
window.openBookModal = openBookModal;
window.closeBookModal = closeBookModal;
