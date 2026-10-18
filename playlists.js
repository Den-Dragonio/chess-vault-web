/* ====================================================
   CHESS VAULT — PLAYLISTS MODULE
   - Bookshelf UI on Profile page
   - 1st item: "+ Новий плейлист" translucent card (pixel-perfect rotation)
   - Pinned: "⭐ Улюблені" and "📖 Читати потім"
   - User-created custom playlists
   - Playlist Modal with view / edit mode:
     * Edit button toggles Edit Mode
     * Custom playlists can be deleted or renamed; defaults cannot be deleted
     * Add books via live search over window.CHESS_BOOKS_CACHE
     * Remove books via prominent delete button
   - Synchronous instant load from localStorage + Firestore sync
   ==================================================== */

const PL_DEFAULT_CONFIG = [
    { id: 'favorites',  icon: '⭐', name_uk: 'Улюблені',     name_en: 'Favorites',  isDefault: true, books: [] },
    { id: 'read-later', icon: '📖', name_uk: 'Читати потім', name_en: 'Read Later', isDefault: true, books: [] }
];

let _plCurrentUid = null;
let _plUserPlaylists = [];
let _plActiveModalPlaylistId = null;
let _plModalIsEditing = false;

// =============================================
// HELPERS
// =============================================
function plGetDb() {
    return window.db || (typeof db !== 'undefined' ? db : null);
}

function plGetUser() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            const u = firebase.auth().currentUser;
            if (u) return u;
        }
    } catch (_) {}
    if (window.auth && window.auth.currentUser) return window.auth.currentUser;
    return null;
}

function plIsEn() {
    return window.i18n && window.i18n.currentLang === 'en';
}

function plEsc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function plStorageKey(uid) {
    return 'chess_vault_playlists_' + (uid || 'guest');
}

function plLoadFromLocalStorage(uid) {
    try {
        const raw = localStorage.getItem(plStorageKey(uid));
        if (raw) {
            let parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed = parsed.map(p => {
                    if (p.id === 'watch-later' || p.id === 'read-later') {
                        return {
                            ...p,
                            id: 'read-later',
                            icon: '📖',
                            name_uk: 'Читати потім',
                            name_en: 'Read Later',
                            name: plIsEn() ? 'Read Later' : 'Читати потім'
                        };
                    }
                    if (p.id === 'favorites') {
                        return {
                            ...p,
                            icon: '⭐',
                            name_uk: 'Улюблені',
                            name_en: 'Favorites',
                            name: plIsEn() ? 'Favorites' : 'Улюблені'
                        };
                    }
                    return p;
                });
                return parsed;
            }
        }
    } catch (_) {}
    return JSON.parse(JSON.stringify(PL_DEFAULT_CONFIG));
}

function plSaveToLocalStorage(uid, playlists) {
    try {
        localStorage.setItem(plStorageKey(uid), JSON.stringify(playlists));
    } catch (_) {}
}

function plWithTimeout(promise, ms = 3500) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
    ]);
}

// =============================================
// STATE & SYNC
// =============================================
function plInitForUser(user) {
    const uid = user ? user.uid : 'guest';
    _plCurrentUid = uid;
    _plUserPlaylists = plLoadFromLocalStorage(uid);

    for (const def of PL_DEFAULT_CONFIG) {
        if (!_plUserPlaylists.some(p => p.id === def.id)) {
            _plUserPlaylists.push(JSON.parse(JSON.stringify(def)));
        }
    }

    _plUserPlaylists.sort((a, b) => {
        if (a.id === 'favorites') return -1;
        if (b.id === 'favorites') return 1;
        if (a.id === 'read-later') return -1;
        if (b.id === 'read-later') return 1;
        return 0;
    });

    if (user && user.uid) {
        plSyncFromFirestore(user.uid).catch(() => {});
    }
}

async function plSyncFromFirestore(uid) {
    const firestore = plGetDb();
    if (!firestore || !uid || uid === 'guest') return;

    try {
        const docRef = firestore.collection('user_preferences').doc(uid);
        const snap = await plWithTimeout(docRef.get(), 4000);

        if (snap && snap.exists) {
            const data = snap.data();
            if (data && Array.isArray(data.playlists) && data.playlists.length > 0) {
                _plUserPlaylists = data.playlists.map(p => {
                    if (p.id === 'watch-later' || p.id === 'read-later') {
                        return { ...p, id: 'read-later', icon: '📖', name_uk: 'Читати потім', name_en: 'Read Later' };
                    }
                    return p;
                });
                for (const def of PL_DEFAULT_CONFIG) {
                    if (!_plUserPlaylists.some(p => p.id === def.id)) {
                        _plUserPlaylists.push(JSON.parse(JSON.stringify(def)));
                    }
                }
                _plUserPlaylists.sort((a, b) => {
                    if (a.id === 'favorites') return -1;
                    if (b.id === 'favorites') return 1;
                    if (a.id === 'read-later') return -1;
                    if (b.id === 'read-later') return 1;
                    return 0;
                });
                plSaveToLocalStorage(uid, _plUserPlaylists);
                if (document.getElementById('playlists-section')) {
                    plRenderProfileHTML();
                }
                return;
            }
        }
        await plSyncToFirestore(uid);
    } catch (err) {
        console.warn('[Playlists] Firestore sync warning:', err.message || err);
    }
}

async function plSyncToFirestore(uid) {
    const firestore = plGetDb();
    if (!firestore || !uid || uid === 'guest') return;

    try {
        const docRef = firestore.collection('user_preferences').doc(uid);
        const cleanList = _plUserPlaylists.map(pl => ({
            id: pl.id || 'pl_' + Date.now(),
            icon: pl.icon || '📋',
            name: pl.name || pl.name_uk || 'Плейлист',
            name_uk: pl.name_uk || pl.name || 'Плейлист',
            name_en: pl.name_en || pl.name || 'Playlist',
            isDefault: !!pl.isDefault,
            books: (pl.books || []).map(b => ({
                id: b.id || '',
                title: b.title || '',
                author: b.author || '',
                format: b.format || 'pdf',
                sizeDisplay: b.sizeDisplay || '—',
                url: b.url || '',
                year: b.year || '---',
                addedAt: b.addedAt || Date.now()
            }))
        }));

        await plWithTimeout(docRef.set({ playlists: cleanList }, { merge: true }), 4000);
    } catch (err) {
        console.warn('[Playlists] Firestore save error:', err.message || err);
    }
}

function plGetPlaylists() {
    if (!_plUserPlaylists || _plUserPlaylists.length === 0) {
        const u = plGetUser();
        plInitForUser(u);
    }
    return _plUserPlaylists;
}

// =============================================
// CRUD
// =============================================
async function plAddBookToPlaylist(playlistId, book) {
    const u = plGetUser();
    if (!u) {
        plPromptLogin();
        return false;
    }

    const playlists = plGetPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return false;

    if (!pl.books) pl.books = [];
    const bookId = (book.id || book.title || '').trim().toLowerCase();
    const exists = pl.books.some(b => (b.id || b.title || '').trim().toLowerCase() === bookId);
    if (exists) return false;

    pl.books.unshift({
        id: book.id || '',
        title: book.title || book.id || 'Без назви',
        author: book.author || '—',
        format: (book.format || 'pdf').toLowerCase(),
        sizeDisplay: book.sizeDisplay || '—',
        url: book.url || '',
        year: book.year || '---',
        addedAt: Date.now()
    });

    plSaveToLocalStorage(u.uid, playlists);
    plSyncToFirestore(u.uid).catch(() => {});

    if (_plActiveModalPlaylistId === playlistId) {
        plRenderPlaylistModalContent(pl);
    }
    plRenderProfileHTML();
    return true;
}

async function plRemoveBookFromPlaylist(playlistId, bookId) {
    const u = plGetUser();
    const playlists = plGetPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || !pl.books) return;

    const bId = String(bookId).trim().toLowerCase();
    pl.books = pl.books.filter(b => (b.id || b.title || '').trim().toLowerCase() !== bId);

    const uid = u ? u.uid : 'guest';
    plSaveToLocalStorage(uid, playlists);
    if (u) plSyncToFirestore(u.uid).catch(() => {});

    if (_plActiveModalPlaylistId === playlistId) {
        plRenderPlaylistModalContent(pl);
    }
    plRenderProfileHTML();
}

async function plCreateCustomPlaylist(name, icon = '📋') {
    const u = plGetUser();
    if (!u) {
        plPromptLogin();
        return null;
    }

    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    const newId = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newPl = {
        id: newId,
        icon: icon || '📋',
        name: trimmed,
        name_uk: trimmed,
        name_en: trimmed,
        isDefault: false,
        books: []
    };

    _plUserPlaylists.push(newPl);
    plSaveToLocalStorage(u.uid, _plUserPlaylists);
    plSyncToFirestore(u.uid).catch(() => {});
    return newId;
}

async function plRenamePlaylist(playlistId, newName) {
    const u = plGetUser();
    const playlists = plGetPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || pl.isDefault) return;

    const trimmed = (newName || '').trim();
    if (!trimmed) return;

    pl.name = trimmed;
    pl.name_uk = trimmed;
    pl.name_en = trimmed;

    const uid = u ? u.uid : 'guest';
    plSaveToLocalStorage(uid, playlists);
    if (u) plSyncToFirestore(u.uid).catch(() => {});

    if (_plActiveModalPlaylistId === playlistId) {
        plRenderPlaylistModalContent(pl);
    }
    plRenderProfileHTML();
}

async function plDeletePlaylist(playlistId) {
    const u = plGetUser();
    let playlists = plGetPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || pl.isDefault) return;

    _plUserPlaylists = playlists.filter(p => p.id !== playlistId);
    const uid = u ? u.uid : 'guest';
    plSaveToLocalStorage(uid, _plUserPlaylists);
    if (u) plSyncToFirestore(u.uid).catch(() => {});

    plClosePlaylistModal();
    plRenderProfileHTML();
}

function plPromptLogin() {
    const isEn = plIsEn();
    const msg = isEn ? 'Please log in to save books to playlists!' : 'Будь ласка, увійдіть в аккаунт, щоб зберігати книги в плейлисти!';
    if (typeof showToast === 'function') {
        showToast(msg, 'warn');
    } else {
        alert(msg);
    }
    const loginTrigger = document.getElementById('login-trigger');
    if (loginTrigger) {
        loginTrigger.click();
    }
}

// =============================================
// BOOKSHELF UI RENDERING (PROFILE PAGE)
// =============================================
function plRenderProfileSection(optionalUser) {
    const user = optionalUser || plGetUser();
    plInitForUser(user);
    plRenderProfileHTML();
}

function plRenderProfileHTML() {
    const container = document.getElementById('playlists-section');
    if (!container) return;

    const isEn = plIsEn();
    const titleText = isEn ? '📚 My Book Playlists' : '📚 Мої плейлисти';
    const subtitleText = isEn
        ? '💡 Click a playlist to view its books or manage your collection'
        : '💡 Натисніть на плейлист, щоб відкрити список книг або налаштувати підбірку';
    const newPlaylistText = isEn ? 'New Playlist' : 'Новий плейлист';

    const playlists = plGetPlaylists();

    let html = `
        <div class="pl-shelf-header">
            <div>
                <h2 class="pl-shelf-title">${titleText}</h2>
                <p class="pl-shelf-subtitle">${subtitleText}</p>
            </div>
        </div>

        <div class="pl-shelf-wrapper">
            <div class="pl-shelf-grid">
                <!-- 1. ПЕРША ЗЛІВА: НАПІВПРОЗОРА КАРТКА "+ НОВИЙ ПЛЕЙЛИСТ" -->
                <div class="pl-shelf-card pl-card-create" id="pl-shelf-card-create" title="${isEn ? 'Create new playlist' : 'Створити новий плейлист'}">
                    <div class="pl-create-icon-wrap">
                        <span class="pl-create-plus-icon"></span>
                    </div>
                    <span class="pl-create-label">${newPlaylistText}</span>
                </div>
    `;

    // 2. Закріплені ("Улюблені", "Читати потім") та кастомні плейлисти
    for (const pl of playlists) {
        const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
        const bookCount = (pl.books || []).length;
        const booksWord = isEn
            ? (bookCount === 1 ? 'book' : 'books')
            : (bookCount === 1 ? 'книга' : (bookCount >= 2 && bookCount <= 4 ? 'книги' : 'книг'));
        const isPinned = !!pl.isDefault;

        html += `
            <div class="pl-shelf-card ${isPinned ? 'pl-card-pinned' : 'pl-card-custom'}" data-pl-id="${plEsc(pl.id)}">
                ${isPinned ? `
                    <span class="pl-card-pin-badge" title="${isEn ? 'Pinned playlist' : 'Закріплений плейлист'}">📌</span>
                ` : ''}
                <div class="pl-card-icon">${pl.icon || '📋'}</div>
                <div class="pl-card-name" title="${plEsc(displayName)}">${plEsc(displayName)}</div>
                <div class="pl-card-count">${bookCount} ${booksWord}</div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Listeners: Create
    const createCard = document.getElementById('pl-shelf-card-create');
    if (createCard) createCard.onclick = plShowCreateDialog;

    // Listeners: Open playlist modal
    container.querySelectorAll('.pl-shelf-card:not(.pl-card-create)').forEach(card => {
        card.onclick = () => {
            const plId = card.dataset.plId;
            _plModalIsEditing = false;
            plOpenPlaylistModal(plId);
        };
    });
}

// =============================================
// PLAYLIST BOOKS MODAL (WITH EDIT & ADD MODE)
// =============================================
function plOpenPlaylistModal(playlistId) {
    const pl = plGetPlaylists().find(p => p.id === playlistId);
    if (!pl) return;
    _plActiveModalPlaylistId = playlistId;

    let overlay = document.getElementById('pl-books-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pl-books-modal-overlay';
        overlay.className = 'pl-modal-overlay';
        document.body.appendChild(overlay);
    }

    overlay.style.display = 'flex';
    plRenderPlaylistModalContent(pl);

    overlay.onclick = (e) => {
        if (e.target === overlay) plClosePlaylistModal();
    };
}

function plClosePlaylistModal() {
    const overlay = document.getElementById('pl-books-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    _plActiveModalPlaylistId = null;
    _plModalIsEditing = false;
}

function plRenderPlaylistModalContent(pl) {
    const overlay = document.getElementById('pl-books-modal-overlay');
    if (!overlay) return;

    const isEn = plIsEn();
    const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
    const books = pl.books || [];
    const booksWord = isEn
        ? (books.length === 1 ? 'book' : 'books')
        : (books.length === 1 ? 'книга' : (books.length >= 2 && books.length <= 4 ? 'книги' : 'книг'));
    const isDefault = !!pl.isDefault;
    const isEditing = _plModalIsEditing;

    // Edit action button text
    const editBtnLabel = isEditing ? (isEn ? '✓ Done' : '✓ Готово') : (isEn ? '✏️ Edit' : '✏️ Редагувати');

    // Add Book block (only visible in edit mode)
    let addBookHTML = '';
    if (isEditing) {
        addBookHTML = `
            <div class="pl-modal-add-box">
                <div class="pl-modal-add-input-wrap">
                    <span class="pl-modal-search-icon">🔍</span>
                    <input type="text" id="pl-modal-search-input" class="pl-modal-search-field"
                           placeholder="${isEn ? 'Search by title or author to add book...' : 'Почніть вводити назву або автора книги для додавання...'}" autocomplete="off">
                </div>
                <div id="pl-modal-search-dropdown" class="pl-modal-search-dropdown" style="display:none;"></div>
            </div>
        `;
    }

    // Books list
    let booksHtml = '';
    if (books.length === 0) {
        booksHtml = `
            <div class="pl-modal-empty">
                <span class="pl-modal-empty-icon">📭</span>
                <p class="pl-modal-empty-text">${isEn ? 'No books in this playlist yet.' : 'У цьому плейлисті ще немає книг.'}</p>
                <p class="pl-modal-empty-sub">${isEn ? 'Click "Edit" above to search and add books directly here, or use "Add to Playlist" on any book card!' : 'Натисніть кнопку «Редагувати» вгорі, щоб знайти та додати книги, або тисніть «Додати в плейлист» у модалці книги!'}</p>
            </div>
        `;
    } else {
        booksHtml = `<div class="pl-modal-books-list">`;
        for (const book of books) {
            const format = (book.format || 'pdf').toUpperCase();
            const safeBookId = plEsc(book.id || book.title || '');
            booksHtml += `
                <div class="pl-modal-book-row ${isEditing ? 'pl-modal-row-editing' : ''}" data-book-id="${safeBookId}">
                    <div class="pl-modal-book-info" data-book-data="${plEsc(JSON.stringify(book))}">
                        <div class="pl-modal-book-title-wrap">
                            <span class="pl-modal-book-title">📖 ${plEsc(book.title || book.id || '—')}</span>
                            <span class="pl-modal-book-badge">${format}</span>
                        </div>
                        <div class="pl-modal-book-meta">
                            <span class="pl-modal-book-author">✍️ ${plEsc(book.author || '—')}</span>
                            ${book.year && book.year !== '---' ? `<span class="pl-modal-book-year">📅 ${plEsc(book.year)}</span>` : ''}
                            <span class="pl-modal-book-size">💾 ${plEsc(book.sizeDisplay || '—')}</span>
                        </div>
                    </div>
                    <div class="pl-modal-book-actions">
                        ${isEditing ? `
                            <button type="button" class="pl-modal-book-remove pl-remove-active" data-pl-id="${plEsc(pl.id)}" data-book-id="${safeBookId}" title="${isEn ? 'Remove from playlist' : 'Видалити з плейлиста'}">✕ ${isEn ? 'Remove' : 'Видалити'}</button>
                        ` : `
                            <button type="button" class="pl-modal-book-remove" data-pl-id="${plEsc(pl.id)}" data-book-id="${safeBookId}" title="${isEn ? 'Remove' : 'Видалити'}">✕</button>
                        `}
                    </div>
                </div>
            `;
        }
        booksHtml += `</div>`;
    }

    overlay.innerHTML = `
        <div class="pl-modal-card">
            <div class="pl-modal-header">
                <div class="pl-modal-header-left">
                    <span class="pl-modal-icon">${pl.icon || '📋'}</span>
                    <div>
                        ${isEditing && !isDefault ? `
                            <div class="pl-modal-rename-wrap">
                                <input type="text" id="pl-modal-rename-input" class="pl-modal-rename-field" value="${plEsc(displayName)}" maxlength="40">
                                <button type="button" id="pl-modal-rename-save-btn" class="pl-modal-rename-save">💾</button>
                            </div>
                        ` : `
                            <h3 class="pl-modal-title">${plEsc(displayName)}</h3>
                        `}
                        <span class="pl-modal-count-badge">${books.length} ${booksWord}</span>
                    </div>
                </div>
                <div class="pl-modal-header-actions">
                    <!-- Кнопка Редагувати (доступна завжди) -->
                    <button type="button" class="pl-modal-tool-btn ${isEditing ? 'pl-modal-tool-active' : ''}" id="pl-modal-edit-btn" title="${editBtnLabel}">
                        ${editBtnLabel}
                    </button>
                    <!-- Кнопка Видалити (ТІЛЬКИ для кастомних, заборонено для "Улюблені" та "Читати потім") -->
                    ${!isDefault ? `
                        <button type="button" class="pl-modal-tool-btn pl-modal-tool-danger" id="pl-modal-delete-btn" title="${isEn ? 'Delete playlist' : 'Видалити плейлист'}">
                            🗑️ ${isEn ? 'Delete' : 'Видалити'}
                        </button>
                    ` : ''}
                    <button type="button" class="pl-modal-close-btn" id="pl-modal-close" title="${isEn ? 'Close' : 'Закрити'}">✕</button>
                </div>
            </div>

            <div class="pl-modal-body">
                ${addBookHTML}
                ${booksHtml}
            </div>
        </div>
    `;

    // Modal Close
    document.getElementById('pl-modal-close').onclick = plClosePlaylistModal;

    // Edit Toggle
    const editBtn = document.getElementById('pl-modal-edit-btn');
    if (editBtn) {
        editBtn.onclick = () => {
            _plModalIsEditing = !_plModalIsEditing;
            plRenderPlaylistModalContent(pl);
        };
    }

    // Delete Button (custom playlists only)
    const deleteBtn = document.getElementById('pl-modal-delete-btn');
    if (deleteBtn && !isDefault) {
        deleteBtn.onclick = () => plShowDeleteConfirm(pl.id);
    }

    // Rename Save
    const renameSaveBtn = document.getElementById('pl-modal-rename-save-btn');
    if (renameSaveBtn) {
        renameSaveBtn.onclick = async () => {
            const renameInput = document.getElementById('pl-modal-rename-input');
            if (renameInput && renameInput.value.trim()) {
                await plRenamePlaylist(pl.id, renameInput.value.trim());
                if (typeof showToast === 'function') {
                    showToast(isEn ? 'Playlist renamed!' : 'Плейлист перейменовано!', 'ok');
                }
            }
        };
    }

    // Setup live search for adding books in Edit mode
    if (isEditing) {
        plSetupModalBookSearch(pl);
    }

    // Book click in non-edit mode -> open book detail modal
    overlay.querySelectorAll('.pl-modal-book-info').forEach(info => {
        info.onclick = () => {
            if (_plModalIsEditing) return;
            try {
                const bookData = JSON.parse(info.dataset.bookData);
                if (typeof openBookModal === 'function') {
                    openBookModal(bookData);
                } else if (typeof openBookModalFromData === 'function') {
                    openBookModalFromData(bookData);
                }
            } catch (_) {}
        };
    });

    // Remove book click
    overlay.querySelectorAll('.pl-modal-book-remove').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const plId = btn.dataset.plId;
            const bookId = btn.dataset.bookId;
            await plRemoveBookFromPlaylist(plId, bookId);
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Book removed' : 'Книгу видалено', 'ok');
            }
        };
    });
}

function plSetupModalBookSearch(pl) {
    const input = document.getElementById('pl-modal-search-input');
    const dropdown = document.getElementById('pl-modal-search-dropdown');
    if (!input || !dropdown) return;

    const allBooks = (window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) ? window.CHESS_BOOKS_CACHE : [];
    const isEn = plIsEn();

    input.oninput = () => {
        const query = (input.value || '').trim().toLowerCase();
        if (query.length < 2) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }

        const currentBookIds = new Set((pl.books || []).map(b => (b.id || b.title || '').trim().toLowerCase()));

        // Filter books
        const matches = [];
        for (const b of allBooks) {
            const title = (b.title || b.id || '').toLowerCase();
            const author = (b.author || '').toLowerCase();
            if (title.includes(query) || author.includes(query)) {
                matches.push(b);
                if (matches.length >= 8) break;
            }
        }

        if (matches.length === 0) {
            dropdown.innerHTML = `<div class="pl-search-no-res">${isEn ? 'No books found' : 'Книг не знайдено'}</div>`;
            dropdown.style.display = 'block';
            return;
        }

        let resHtml = '';
        for (const b of matches) {
            const bId = (b.id || b.title || '').trim().toLowerCase();
            const alreadyIn = currentBookIds.has(bId);
            const format = (b.format || 'pdf').toUpperCase();

            resHtml += `
                <div class="pl-search-item ${alreadyIn ? 'pl-search-item-added' : ''}" data-book-json="${plEsc(JSON.stringify(b))}">
                    <div class="pl-search-item-info">
                        <span class="pl-search-item-title">📖 ${plEsc(b.title || b.id || '—')}</span>
                        <span class="pl-search-item-author">${plEsc(b.author || '—')} (${format})</span>
                    </div>
                    <div class="pl-search-item-action">
                        ${alreadyIn ? `
                            <span class="pl-search-added-badge">✓ ${isEn ? 'In playlist' : 'У списку'}</span>
                        ` : `
                            <button type="button" class="pl-search-add-btn">+ ${isEn ? 'Add' : 'Додати'}</button>
                        `}
                    </div>
                </div>
            `;
        }
        dropdown.innerHTML = resHtml;
        dropdown.style.display = 'block';

        // Attach clicks
        dropdown.querySelectorAll('.pl-search-add-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const item = btn.closest('.pl-search-item');
                try {
                    const bookData = JSON.parse(item.dataset.bookJson);
                    const added = await plAddBookToPlaylist(pl.id, bookData);
                    if (added) {
                        if (typeof showToast === 'function') {
                            showToast(isEn ? `Added "${bookData.title}"!` : `Додано "${bookData.title}"!`, 'ok');
                        }
                    }
                } catch (_) {}
            };
        });
    };

    // Close dropdown on click outside
    document.addEventListener('click', function _closeSearchDropdown(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// =============================================
// DIALOGS
// =============================================
function plShowCreateDialog() {
    const isEn = plIsEn();
    plShowInputModal({
        title: isEn ? 'Create New Playlist' : 'Створити новий плейлист',
        placeholder: isEn ? 'Playlist name...' : 'Назва плейлиста...',
        confirmText: isEn ? 'Create' : 'Створити',
        onConfirm: async (name) => {
            if (!name || !name.trim()) return;
            const newId = await plCreateCustomPlaylist(name.trim());
            if (newId) {
                if (typeof showToast === 'function') {
                    showToast(isEn ? `Playlist "${name.trim()}" created!` : `Плейлист "${name.trim()}" створено!`, 'ok');
                }
                plRenderProfileHTML();
                _plModalIsEditing = true; // Open directly in edit mode so user can add books!
                plOpenPlaylistModal(newId);
            }
        }
    });
}

function plShowRenameDialog(playlistId) {
    const isEn = plIsEn();
    const pl = plGetPlaylists().find(p => p.id === playlistId);
    if (!pl) return;
    const currentName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);

    plShowInputModal({
        title: isEn ? 'Rename Playlist' : 'Перейменувати плейлист',
        placeholder: isEn ? 'New name...' : 'Нова назва...',
        defaultValue: currentName,
        confirmText: isEn ? 'Save' : 'Зберегти',
        onConfirm: async (name) => {
            if (!name || !name.trim()) return;
            await plRenamePlaylist(playlistId, name.trim());
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Playlist renamed!' : 'Плейлист перейменовано!', 'ok');
            }
        }
    });
}

function plShowDeleteConfirm(playlistId) {
    const isEn = plIsEn();
    const pl = plGetPlaylists().find(p => p.id === playlistId);
    if (!pl || pl.isDefault) return; // Prevent deleting defaults
    const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);

    plShowInputModal({
        title: isEn ? 'Delete Playlist' : 'Видалити плейлист',
        message: isEn
            ? `Are you sure you want to delete "${displayName}"? All books in it will be removed.`
            : `Ви впевнені, що хочете видалити "${displayName}"? Всі книги у ньому будуть видалені.`,
        confirmText: isEn ? 'Delete' : 'Видалити',
        confirmDanger: true,
        noInput: true,
        onConfirm: async () => {
            await plDeletePlaylist(playlistId);
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Playlist deleted' : 'Плейлист видалено', 'ok');
            }
        }
    });
}

function plShowInputModal({ title, placeholder, defaultValue, confirmText, message, confirmDanger, noInput, onConfirm }) {
    const existing = document.getElementById('pl-input-modal-overlay');
    if (existing) existing.remove();

    const isEn = plIsEn();
    const cancelText = isEn ? 'Cancel' : 'Скасувати';

    const overlay = document.createElement('div');
    overlay.id = 'pl-input-modal-overlay';
    overlay.className = 'pl-input-overlay';
    overlay.innerHTML = `
        <div class="pl-input-card">
            <h3 class="pl-input-title">${plEsc(title)}</h3>
            ${message ? `<p class="pl-input-message">${plEsc(message)}</p>` : ''}
            ${!noInput ? `<input type="text" class="pl-input-field" id="pl-input-field" placeholder="${plEsc(placeholder || '')}" value="${plEsc(defaultValue || '')}" maxlength="50">` : ''}
            <div class="pl-input-buttons">
                <button type="button" class="pl-input-cancel-btn" id="pl-input-cancel">${cancelText}</button>
                <button type="button" class="pl-input-confirm-btn ${confirmDanger ? 'pl-input-danger' : ''}" id="pl-input-confirm">${plEsc(confirmText)}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('pl-input-field');
    if (input) {
        setTimeout(() => { input.focus(); input.select(); }, 50);
    }

    const close = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.getElementById('pl-input-cancel').onclick = close;

    const doConfirm = async () => {
        const val = input ? input.value : '';
        close();
        if (onConfirm) await onConfirm(val);
    };

    document.getElementById('pl-input-confirm').onclick = doConfirm;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') doConfirm();
            if (e.key === 'Escape') close();
        };
    }
}

// =============================================
// BOOK DETAIL MODAL — "ADD TO PLAYLIST" BUTTON
// =============================================
function plGetModalButtonHTML(book) {
    const isEn = plIsEn();
    const btnLabel = isEn ? '📋 Add to Playlist' : '📋 Додати в плейлист';
    const playlists = plGetPlaylists();

    let optionsHtml = '';
    for (const pl of playlists) {
        const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
        optionsHtml += `<div class="pl-dropdown-option" data-pl-id="${plEsc(pl.id)}">${pl.icon || '📋'} ${plEsc(displayName)}</div>`;
    }

    const newPlaylistLabel = isEn ? '+ New Playlist...' : '+ Новий плейлист...';
    optionsHtml += `<div class="pl-dropdown-option pl-dropdown-new">${newPlaylistLabel}</div>`;

    return `
        <div class="pl-add-to-wrap" id="pl-add-to-wrap">
            <button type="button" class="bd-btn-playlist" id="bd-playlist-btn">${btnLabel}</button>
            <div class="pl-dropdown" id="pl-dropdown" style="display:none;">
                ${optionsHtml}
            </div>
        </div>
    `;
}

function plAttachModalListeners(book) {
    const wrap = document.getElementById('pl-add-to-wrap');
    if (!wrap) return;
    const btn = document.getElementById('bd-playlist-btn');
    const dropdown = document.getElementById('pl-dropdown');
    if (!btn || !dropdown) return;

    btn.onclick = (e) => {
        e.stopPropagation();
        const user = plGetUser();
        if (!user) {
            plPromptLogin();
            return;
        }

        const isEn = plIsEn();
        const playlists = plGetPlaylists();
        let optionsHtml = '';
        for (const pl of playlists) {
            const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
            const bookId = (book.id || book.title || '').trim().toLowerCase();
            const isIn = (pl.books || []).some(b => (b.id || b.title || '').trim().toLowerCase() === bookId);
            const checkMark = isIn ? ' ✓' : '';
            optionsHtml += `<div class="pl-dropdown-option ${isIn ? 'pl-already-in' : ''}" data-pl-id="${plEsc(pl.id)}">${pl.icon || '📋'} ${plEsc(displayName)}${checkMark}</div>`;
        }
        optionsHtml += `<div class="pl-dropdown-option pl-dropdown-new">${isEn ? '+ New Playlist...' : '+ Новий плейлист...'}</div>`;
        dropdown.innerHTML = optionsHtml;

        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        plAttachDropdownOptionListeners(book, dropdown);
    };

    document.addEventListener('click', function _closePlDropdown(e) {
        if (!wrap.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function plAttachDropdownOptionListeners(book, dropdown) {
    dropdown.querySelectorAll('.pl-dropdown-option:not(.pl-dropdown-new)').forEach(opt => {
        opt.onclick = async (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            const plId = opt.dataset.plId;
            const isEn = plIsEn();
            const pl = plGetPlaylists().find(p => p.id === plId);
            const plName = pl ? (isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name)) : '';

            const added = await plAddBookToPlaylist(plId, book);
            if (added) {
                if (typeof showToast === 'function') {
                    showToast(isEn ? `Added to "${plName}"!` : `Додано до "${plName}"!`, 'ok');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast(isEn ? `Already in "${plName}"` : `Вже у списку "${plName}"`, 'warn');
                }
            }
        };
    });

    const newOpt = dropdown.querySelector('.pl-dropdown-new');
    if (newOpt) {
        newOpt.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            const isEn = plIsEn();
            plShowInputModal({
                title: isEn ? 'Create & Add Book' : 'Створити та додати книгу',
                placeholder: isEn ? 'Playlist name...' : 'Назва плейлиста...',
                confirmText: isEn ? 'Create' : 'Створити',
                onConfirm: async (name) => {
                    if (!name || !name.trim()) return;
                    const newId = await plCreateCustomPlaylist(name.trim());
                    if (newId) {
                        await plAddBookToPlaylist(newId, book);
                        if (typeof showToast === 'function') {
                            showToast(isEn ? `Created "${name.trim()}" and added book!` : `Створено "${name.trim()}" і додано книгу!`, 'ok');
                        }
                    }
                }
            });
        };
    }
}

// Global exports
window.plRenderProfileSection = plRenderProfileSection;
window.plGetModalButtonHTML = plGetModalButtonHTML;
window.plAttachModalListeners = plAttachModalListeners;
window.plInitForUser = plInitForUser;
window.plOpenPlaylistModal = plOpenPlaylistModal;
window.plClosePlaylistModal = plClosePlaylistModal;
