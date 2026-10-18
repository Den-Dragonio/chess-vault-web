/* ====================================================
   CHESS VAULT — PLAYLISTS MODULE
   Firestore structure:
     users/{uid}/playlists/{playlistId}
       → { name, icon, isDefault, createdAt, updatedAt }
     users/{uid}/playlists/{playlistId}/books/{bookDocId}
       → { title, author, id, format, sizeDisplay, url, addedAt }
   ==================================================== */

const PLAYLISTS_DEFAULT = [
    { id: 'watch-later', icon: '🕐', nameKey: 'pl_watch_later', name_uk: 'На потім', name_en: 'Watch Later' },
    { id: 'favorites',   icon: '⭐', nameKey: 'pl_favorites',   name_uk: 'Улюблені',  name_en: 'Favorites'   },
];

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
function plT(key, fallback, vars) {
    if (window.i18n) {
        const t = window.i18n.t(key, vars);
        if (t && t !== key) return t;
    }
    if (vars) {
        let s = fallback;
        for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
        return s;
    }
    return fallback;
}
function plEsc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function plSafeBookId(book) {
    const raw = book?.id || book?.title || 'unknown';
    return String(raw).replace(/[/\\#?%]/g, '_').slice(0, 200);
}

// =============================================
// FIRESTORE OPERATIONS
// =============================================
async function plEnsureDefaults(uid) {
    const firestore = plGetDb();
    if (!firestore || !uid) return;
    const col = firestore.collection('users').doc(uid).collection('playlists');
    for (const def of PLAYLISTS_DEFAULT) {
        const ref = col.doc(def.id);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                name: plIsEn() ? def.name_en : def.name_uk,
                name_uk: def.name_uk,
                name_en: def.name_en,
                icon: def.icon,
                isDefault: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

async function plGetAll(uid) {
    const firestore = plGetDb();
    if (!firestore || !uid) return [];
    const snap = await firestore.collection('users').doc(uid).collection('playlists')
        .orderBy('createdAt', 'asc').get();
    const arr = [];
    snap.forEach(doc => {
        const d = doc.data();
        arr.push({ id: doc.id, ...d });
    });
    return arr;
}

async function plGetBooks(uid, playlistId) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId) return [];
    const snap = await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .collection('books').orderBy('addedAt', 'desc').get();
    const books = [];
    snap.forEach(doc => {
        books.push({ _docId: doc.id, ...doc.data() });
    });
    return books;
}

async function plAddBook(uid, playlistId, book) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId || !book) return false;
    const bookDocId = plSafeBookId(book);
    const bookRef = firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .collection('books').doc(bookDocId);
    const existing = await bookRef.get();
    if (existing.exists) return false; // already in playlist
    await bookRef.set({
        title: book.title || '',
        author: book.author || '',
        id: book.id || '',
        format: book.format || 'pdf',
        sizeDisplay: book.sizeDisplay || '—',
        url: book.url || '',
        year: book.year || '---',
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Update playlist timestamp
    await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    return true;
}

async function plRemoveBook(uid, playlistId, bookDocId) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId || !bookDocId) return;
    await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .collection('books').doc(bookDocId).delete();
    await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function plCreatePlaylist(uid, name, icon) {
    const firestore = plGetDb();
    if (!firestore || !uid || !name) return null;
    const ref = await firestore.collection('users').doc(uid).collection('playlists').add({
        name: name.trim(),
        name_uk: name.trim(),
        name_en: name.trim(),
        icon: icon || '📋',
        isDefault: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function plRenamePlaylist(uid, playlistId, newName) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId || !newName) return;
    await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .update({
            name: newName.trim(),
            name_uk: newName.trim(),
            name_en: newName.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
}

async function plDeletePlaylist(uid, playlistId) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId) return;
    // Delete all books in the playlist first
    const booksSnap = await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .collection('books').get();
    const batch = firestore.batch();
    booksSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(firestore.collection('users').doc(uid).collection('playlists').doc(playlistId));
    await batch.commit();
}

async function plGetBookCount(uid, playlistId) {
    const firestore = plGetDb();
    if (!firestore || !uid || !playlistId) return 0;
    const snap = await firestore.collection('users').doc(uid)
        .collection('playlists').doc(playlistId)
        .collection('books').get();
    return snap.size;
}

// =============================================
// PROFILE PAGE — PLAYLIST SECTION RENDER
// =============================================
let _plCurrentlyOpenId = null;
let _plAllPlaylists = [];

async function plRenderProfileSection() {
    const container = document.getElementById('playlists-section');
    if (!container) return;
    const user = plGetUser();
    if (!user) return;

    await plEnsureDefaults(user.uid);
    _plAllPlaylists = await plGetAll(user.uid);

    const isEn = plIsEn();
    const titleText = isEn ? '📋 My Playlists' : '📋 Мої Плейлисти';
    const addBtnText = isEn ? '+ New Playlist' : '+ Новий плейлист';
    const emptyText = isEn ? 'No playlists yet' : 'Плейлистів ще немає';

    let html = `
        <div class="pl-header">
            <h2 class="pl-title">${titleText}</h2>
            <button class="pl-add-btn" id="pl-add-btn">${addBtnText}</button>
        </div>
    `;

    if (_plAllPlaylists.length === 0) {
        html += `<p class="pl-empty">${emptyText}</p>`;
    } else {
        html += `<div class="pl-list" id="pl-list">`;
        for (const pl of _plAllPlaylists) {
            const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
            const bookCount = await plGetBookCount(user.uid, pl.id);
            const isOpen = _plCurrentlyOpenId === pl.id;
            const booksWord = isEn ? (bookCount === 1 ? 'book' : 'books') : (bookCount === 1 ? 'книга' : (bookCount >= 2 && bookCount <= 4 ? 'книги' : 'книг'));

            html += `
                <div class="pl-item ${isOpen ? 'pl-item-open' : ''}" data-pl-id="${plEsc(pl.id)}">
                    <div class="pl-item-header" data-pl-id="${plEsc(pl.id)}">
                        <div class="pl-item-left">
                            <span class="pl-item-icon">${pl.icon || '📋'}</span>
                            <span class="pl-item-name">${plEsc(displayName)}</span>
                            <span class="pl-item-count">${bookCount} ${booksWord}</span>
                        </div>
                        <div class="pl-item-actions">
                            ${!pl.isDefault ? `
                                <button class="pl-item-action-btn pl-rename-btn" data-pl-id="${plEsc(pl.id)}" title="${isEn ? 'Rename' : 'Перейменувати'}">✏️</button>
                                <button class="pl-item-action-btn pl-delete-btn" data-pl-id="${plEsc(pl.id)}" title="${isEn ? 'Delete' : 'Видалити'}">🗑️</button>
                            ` : ''}
                            <span class="pl-item-chevron">${isOpen ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    <div class="pl-item-books" id="pl-books-${plEsc(pl.id)}" style="display: ${isOpen ? 'block' : 'none'};">
                        <div class="pl-books-loading">${isEn ? 'Loading...' : 'Завантаження...'}</div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    // Attach event listeners
    // Toggle playlist books
    container.querySelectorAll('.pl-item-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.pl-item-action-btn')) return;
            const plId = header.dataset.plId;
            plToggleBooks(plId);
        });
    });

    // Add new playlist
    const addBtn = document.getElementById('pl-add-btn');
    if (addBtn) addBtn.addEventListener('click', plShowCreateDialog);

    // Rename
    container.querySelectorAll('.pl-rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            plShowRenameDialog(btn.dataset.plId);
        });
    });

    // Delete
    container.querySelectorAll('.pl-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            plShowDeleteConfirm(btn.dataset.plId);
        });
    });
}

async function plToggleBooks(playlistId) {
    const booksContainer = document.getElementById(`pl-books-${playlistId}`);
    if (!booksContainer) return;
    const item = booksContainer.closest('.pl-item');
    const chevron = item?.querySelector('.pl-item-chevron');

    if (booksContainer.style.display === 'none' || !booksContainer.style.display) {
        _plCurrentlyOpenId = playlistId;
        booksContainer.style.display = 'block';
        if (item) item.classList.add('pl-item-open');
        if (chevron) chevron.textContent = '▲';
        await plRenderBooks(playlistId);
    } else {
        _plCurrentlyOpenId = null;
        booksContainer.style.display = 'none';
        if (item) item.classList.remove('pl-item-open');
        if (chevron) chevron.textContent = '▼';
    }
}

async function plRenderBooks(playlistId) {
    const user = plGetUser();
    if (!user) return;
    const booksContainer = document.getElementById(`pl-books-${playlistId}`);
    if (!booksContainer) return;

    const isEn = plIsEn();
    const books = await plGetBooks(user.uid, playlistId);

    if (books.length === 0) {
        booksContainer.innerHTML = `<p class="pl-books-empty">${isEn ? 'No books in this playlist yet' : 'У цьому плейлисті ще немає книг'}</p>`;
        // Also update the count badge in the header
        const item = booksContainer.closest('.pl-item');
        const countBadge = item?.querySelector('.pl-item-count');
        if (countBadge) countBadge.textContent = `0 ${isEn ? 'books' : 'книг'}`;
        return;
    }

    let html = `<div class="pl-books-list">`;
    for (const book of books) {
        const format = (book.format || 'pdf').toUpperCase();
        html += `
            <div class="pl-book-row" data-book-doc-id="${plEsc(book._docId)}">
                <div class="pl-book-info" data-book-json='${plEsc(JSON.stringify(book))}'>
                    <span class="pl-book-title">📖 ${plEsc(book.title || book.id || '—')}</span>
                    <span class="pl-book-author">${plEsc(book.author || '—')}</span>
                </div>
                <div class="pl-book-actions">
                    <span class="pl-book-format">${format}</span>
                    <button class="pl-book-remove-btn" data-pl-id="${plEsc(playlistId)}" data-book-doc-id="${plEsc(book._docId)}" title="${isEn ? 'Remove' : 'Видалити'}">✕</button>
                </div>
            </div>
        `;
    }
    html += `</div>`;
    booksContainer.innerHTML = html;

    // Update count badge
    const item = booksContainer.closest('.pl-item');
    const countBadge = item?.querySelector('.pl-item-count');
    if (countBadge) {
        const booksWord = isEn ? (books.length === 1 ? 'book' : 'books') : (books.length === 1 ? 'книга' : (books.length >= 2 && books.length <= 4 ? 'книги' : 'книг'));
        countBadge.textContent = `${books.length} ${booksWord}`;
    }

    // Click on book opens modal
    booksContainer.querySelectorAll('.pl-book-info').forEach(info => {
        info.addEventListener('click', () => {
            try {
                const bookData = JSON.parse(info.dataset.bookJson);
                if (typeof openBookModal === 'function') {
                    openBookModal(bookData);
                }
            } catch (_) {}
        });
    });

    // Remove book button
    booksContainer.querySelectorAll('.pl-book-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const plId = btn.dataset.plId;
            const bookDocId = btn.dataset.bookDocId;
            await plRemoveBook(user.uid, plId, bookDocId);
            const isEn = plIsEn();
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Book removed from playlist' : 'Книгу видалено з плейлиста', 'ok');
            }
            await plRenderBooks(plId);
        });
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
            const user = plGetUser();
            if (!user) return;
            await plCreatePlaylist(user.uid, name.trim(), '📋');
            if (typeof showToast === 'function') {
                showToast(isEn ? `Playlist "${name.trim()}" created!` : `Плейлист "${name.trim()}" створено!`, 'ok');
            }
            await plRenderProfileSection();
        }
    });
}

function plShowRenameDialog(playlistId) {
    const isEn = plIsEn();
    const pl = _plAllPlaylists.find(p => p.id === playlistId);
    const currentName = pl ? (isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name)) : '';
    plShowInputModal({
        title: isEn ? 'Rename Playlist' : 'Перейменувати плейлист',
        placeholder: isEn ? 'New name...' : 'Нова назва...',
        defaultValue: currentName,
        confirmText: isEn ? 'Save' : 'Зберегти',
        onConfirm: async (name) => {
            if (!name || !name.trim()) return;
            const user = plGetUser();
            if (!user) return;
            await plRenamePlaylist(user.uid, playlistId, name.trim());
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Playlist renamed!' : 'Плейлист перейменовано!', 'ok');
            }
            await plRenderProfileSection();
        }
    });
}

function plShowDeleteConfirm(playlistId) {
    const isEn = plIsEn();
    const pl = _plAllPlaylists.find(p => p.id === playlistId);
    const displayName = pl ? (isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name)) : '';

    plShowInputModal({
        title: isEn ? 'Delete Playlist' : 'Видалити плейлист',
        message: isEn
            ? `Are you sure you want to delete "${displayName}"? All books in it will be removed.`
            : `Ви впевнені, що хочете видалити "${displayName}"? Всі книги у ньому будуть видалені.`,
        confirmText: isEn ? 'Delete' : 'Видалити',
        confirmDanger: true,
        noInput: true,
        onConfirm: async () => {
            const user = plGetUser();
            if (!user) return;
            await plDeletePlaylist(user.uid, playlistId);
            if (_plCurrentlyOpenId === playlistId) _plCurrentlyOpenId = null;
            if (typeof showToast === 'function') {
                showToast(isEn ? 'Playlist deleted' : 'Плейлист видалено', 'ok');
            }
            await plRenderProfileSection();
        }
    });
}

function plShowInputModal({ title, placeholder, defaultValue, confirmText, message, confirmDanger, noInput, onConfirm }) {
    // Remove any existing modal
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
            ${!noInput ? `<input type="text" class="pl-input-field" id="pl-input-field" placeholder="${plEsc(placeholder || '')}" value="${plEsc(defaultValue || '')}" maxlength="50" autofocus>` : ''}
            <div class="pl-input-buttons">
                <button class="pl-input-cancel-btn" id="pl-input-cancel">${cancelText}</button>
                <button class="pl-input-confirm-btn ${confirmDanger ? 'pl-input-danger' : ''}" id="pl-input-confirm">${plEsc(confirmText)}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Focus input
    const input = document.getElementById('pl-input-field');
    if (input) {
        setTimeout(() => { input.focus(); input.select(); }, 50);
    }

    // Handle events
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('pl-input-cancel').addEventListener('click', close);
    document.getElementById('pl-input-confirm').addEventListener('click', async () => {
        const val = input ? input.value : '';
        close();
        if (onConfirm) await onConfirm(val);
    });
    if (input) {
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const val = input.value;
                close();
                if (onConfirm) await onConfirm(val);
            }
            if (e.key === 'Escape') close();
        });
    }
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// =============================================
// BOOK MODAL — "ADD TO PLAYLIST" DROPDOWN
// =============================================
async function plRenderAddToPlaylistButton(book) {
    const user = plGetUser();
    if (!user) return '';

    await plEnsureDefaults(user.uid);
    const playlists = await plGetAll(user.uid);
    const isEn = plIsEn();
    const btnLabel = isEn ? '📋 Add to Playlist' : '📋 Додати в плейлист';

    let optionsHtml = '';
    for (const pl of playlists) {
        const displayName = isEn ? (pl.name_en || pl.name) : (pl.name_uk || pl.name);
        optionsHtml += `<div class="pl-dropdown-option" data-pl-id="${plEsc(pl.id)}">${pl.icon || '📋'} ${plEsc(displayName)}</div>`;
    }

    const newPlaylistLabel = isEn ? '+ New Playlist...' : '+ Новий плейлист...';
    optionsHtml += `<div class="pl-dropdown-option pl-dropdown-new">${newPlaylistLabel}</div>`;

    return `
        <div class="pl-add-to-wrap" id="pl-add-to-wrap">
            <button class="bd-btn-playlist" id="bd-playlist-btn">${btnLabel}</button>
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

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown on outside click
    document.addEventListener('click', function _plCloseDropdown(e) {
        if (!wrap.contains(e.target)) {
            dropdown.style.display = 'none';
            document.removeEventListener('click', _plCloseDropdown);
        }
    });

    // Playlist options
    dropdown.querySelectorAll('.pl-dropdown-option:not(.pl-dropdown-new)').forEach(opt => {
        opt.addEventListener('click', async () => {
            dropdown.style.display = 'none';
            const user = plGetUser();
            if (!user) return;
            const plId = opt.dataset.plId;
            const isEn = plIsEn();
            const added = await plAddBook(user.uid, plId, book);
            if (added) {
                const plName = opt.textContent.trim();
                showToast(isEn ? `Added to "${plName}"` : `Додано до "${plName}"`, 'ok');
            } else {
                showToast(isEn ? 'Already in this playlist' : 'Вже у цьому плейлисті', 'warn');
            }
        });
    });

    // "New Playlist" option
    const newOpt = dropdown.querySelector('.pl-dropdown-new');
    if (newOpt) {
        newOpt.addEventListener('click', () => {
            dropdown.style.display = 'none';
            const isEn = plIsEn();
            plShowInputModal({
                title: isEn ? 'Create & Add' : 'Створити та додати',
                placeholder: isEn ? 'Playlist name...' : 'Назва плейлиста...',
                confirmText: isEn ? 'Create' : 'Створити',
                onConfirm: async (name) => {
                    if (!name || !name.trim()) return;
                    const user = plGetUser();
                    if (!user) return;
                    const newId = await plCreatePlaylist(user.uid, name.trim(), '📋');
                    if (newId) {
                        await plAddBook(user.uid, newId, book);
                        showToast(isEn ? `Created "${name.trim()}" and added book!` : `Створено "${name.trim()}" і додано книгу!`, 'ok');
                    }
                }
            });
        });
    }
}

// =============================================
// EXPORTS
// =============================================
window.plRenderProfileSection = plRenderProfileSection;
window.plRenderAddToPlaylistButton = plRenderAddToPlaylistButton;
window.plAttachModalListeners = plAttachModalListeners;
window.plEnsureDefaults = plEnsureDefaults;
