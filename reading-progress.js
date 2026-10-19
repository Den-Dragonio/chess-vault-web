/* ====================================================
   CHESS VAULT — READING PROGRESS MODULE
   - Tracks online reading progress (current page, total pages, percentage, timestamp)
   - Synchronous local cache via localStorage
   - Asynchronous 2-way sync with Firebase Firestore:
     user_reading/{uid}/books/{bookId}
   - Filters currently reading list by condition: (currentPage >= 10)
   ==================================================== */

(function () {
    const STORAGE_KEY_PREFIX = 'chess_vault_reading_progress_';

    function getStorageKey(uid) {
        return STORAGE_KEY_PREFIX + (uid || 'guest');
    }

    function getDb() {
        return window.db || (typeof firebase !== 'undefined' && firebase.apps?.length ? firebase.firestore() : null);
    }

    function getUser() {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps?.length) {
                const u = firebase.auth().currentUser;
                if (u) return u;
            }
        } catch (_) {}
        if (window.auth && window.auth.currentUser) return window.auth.currentUser;
        return null;
    }

    function safeId(id) {
        if (!id) return 'unknown_' + Date.now();
        return String(id).trim().replace(/[\/\#\$\.\[\]]/g, '_');
    }

    function loadLocal(uid) {
        try {
            const raw = localStorage.getItem(getStorageKey(uid));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
        return [];
    }

    function saveLocal(uid, list) {
        try {
            localStorage.setItem(getStorageKey(uid), JSON.stringify(list));
        } catch (_) {}
    }

    const ReadingProgress = {
        /**
         * Save reading progress for a book
         * @param {string|null} uid 
         * @param {Object} data - { id, title, author, coverUrl, url, format, currentPage, totalPages, notesCount, bookmarksCount }
         */
        async saveProgress(uid, data) {
            if (!data || !data.id) return null;
            const currentUid = uid || (getUser() ? getUser().uid : 'guest');
            const list = loadLocal(currentUid);

            const bookId = String(data.id).trim();
            const total = parseInt(data.totalPages) || 1;
            const current = Math.min(Math.max(1, parseInt(data.currentPage) || 1), total);
            const percentage = Math.round((current / total) * 100);
            const now = Date.now();

            const record = {
                id: bookId,
                title: data.title || bookId,
                author: data.author || '—',
                coverUrl: data.coverUrl || '',
                url: data.url || '',
                format: (data.format || 'pdf').toLowerCase(),
                currentPage: current,
                totalPages: total,
                percentage: percentage,
                updatedAt: now,
                notesCount: data.notesCount || 0,
                bookmarksCount: data.bookmarksCount || 0
            };

            const idx = list.findIndex(b => String(b.id).trim() === bookId);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...record };
            } else {
                list.unshift(record);
            }

            saveLocal(currentUid, list);
            window.dispatchEvent(new CustomEvent('chessVaultReadingProgressUpdated', { detail: record }));

            // Firestore sync in background if authenticated
            if (currentUid && currentUid !== 'guest') {
                const firestore = getDb();
                if (firestore) {
                    try {
                        const docRef = firestore
                            .collection('user_reading').doc(currentUid)
                            .collection('books').doc(safeId(bookId));

                        await docRef.set({
                            ...record,
                            serverUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    } catch (err) {
                        console.warn('[ReadingProgress] Firestore sync error:', err.message || err);
                    }
                }
            }

            return record;
        },

        /**
         * Get reading progress for a specific book
         */
        getProgress(uid, bookId) {
            if (!bookId) return null;
            const currentUid = uid || (getUser() ? getUser().uid : 'guest');
            const list = loadLocal(currentUid);
            const cleanId = String(bookId).trim();
            return list.find(b => String(b.id).trim() === cleanId) || null;
        },

        /**
         * Get all books with progress
         */
        getAll(uid) {
            const currentUid = uid || (getUser() ? getUser().uid : 'guest');
            const list = loadLocal(currentUid);
            return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        },

        /**
         * Filter books that count as "Currently Reading" (currentPage >= 10)
         */
        getCurrentlyReading(uid) {
            const list = this.getAll(uid);
            return list.filter(b => (parseInt(b.currentPage) || 0) >= 10);
        },

        /**
         * Sync progress from Firestore on login / profile load
         */
        async syncFromFirestore(uid) {
            if (!uid || uid === 'guest') return this.getAll(uid);
            const firestore = getDb();
            if (!firestore) return this.getAll(uid);

            try {
                const snap = await firestore
                    .collection('user_reading').doc(uid)
                    .collection('books')
                    .orderBy('updatedAt', 'desc')
                    .get();

                if (!snap.empty) {
                    const cloudList = [];
                    snap.forEach(doc => {
                        const d = doc.data();
                        cloudList.push({
                            id: d.id || doc.id,
                            title: d.title || '—',
                            author: d.author || '—',
                            coverUrl: d.coverUrl || '',
                            url: d.url || '',
                            format: d.format || 'pdf',
                            currentPage: parseInt(d.currentPage) || 1,
                            totalPages: parseInt(d.totalPages) || 1,
                            percentage: parseInt(d.percentage) || 0,
                            updatedAt: d.updatedAt || Date.now(),
                            notesCount: d.notesCount || 0,
                            bookmarksCount: d.bookmarksCount || 0
                        });
                    });

                    // Merge with local storage (favor higher updatedAt)
                    const localList = loadLocal(uid);
                    const mergedMap = new Map();
                    localList.forEach(b => mergedMap.set(b.id, b));
                    cloudList.forEach(b => {
                        const existing = mergedMap.get(b.id);
                        if (!existing || (b.updatedAt || 0) >= (existing.updatedAt || 0)) {
                            mergedMap.set(b.id, b);
                        }
                    });

                    const finalList = Array.from(mergedMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    saveLocal(uid, finalList);
                    window.dispatchEvent(new CustomEvent('chessVaultReadingProgressUpdated'));
                    return finalList;
                }
            } catch (err) {
                console.warn('[ReadingProgress] Sync from Firestore error:', err.message || err);
            }
            return this.getAll(uid);
        }
    };

    window.ReadingProgress = ReadingProgress;
})();
