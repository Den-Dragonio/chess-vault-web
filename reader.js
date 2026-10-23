/* ========================================================
   CHESS VAULT — ONLINE READER ENGINE (reader.js)
   - Multi-format document loading (PDF, DjVu, DOCX)
   - Native iframe & embedded viewers (bypasses CORS restrictions)
   - Drag & drop / Local file picker fallback
   - Per-user per-book workspace persistence in Firestore & localStorage:
     * Custom Chessboard position (FEN), moves sequence, turn & orientation
     * Page bookmarks & notes (up to 1000 characters)
     * Reading progress (currentPage, totalPages, percentage)
   - Text selection chess move parser (SAN & Cyrillic)
   - Board editor (Endgames & custom positions)
   ======================================================== */

(function () {
    'use strict';

    // 1. URL & BOOK PARAMETERS
    const urlParams = new URLSearchParams(window.location.search);
    const bookParam = {
        id: urlParams.get('id') || 'book_' + Date.now(),
        file: urlParams.get('file') || '',
        title: urlParams.get('title') || 'Шахова книга',
        author: urlParams.get('author') || '—',
        format: (urlParams.get('format') || 'pdf').toLowerCase(),
        startPage: parseInt(urlParams.get('page')) || 1
    };

    // DOM ELEMENTS
    const dom = {
        topbarTitle: document.getElementById('topbar-book-title'),
        topbarAuthor: document.getElementById('topbar-book-author'),
        btnBack: document.getElementById('btn-back'),
        btnToggleHighlight: document.getElementById('btn-toggle-highlight'),
        btnAddBookmark: document.getElementById('btn-add-bookmark'),
        syncStatusPill: document.getElementById('sync-status-pill'),
        btnPrevPage: document.getElementById('btn-prev-page'),
        btnNextPage: document.getElementById('btn-next-page'),
        inputCurrentPage: document.getElementById('input-current-page'),
        labelTotalPages: document.getElementById('label-total-pages'),
        labelPercentage: document.getElementById('label-percentage'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        btnZoomReset: document.getElementById('btn-zoom-reset'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnToggleDockSide: document.getElementById('btn-toggle-dock-side'),
        dockSideLabel: document.getElementById('dock-side-label'),
        btnToggleTheme: document.getElementById('btn-toggle-theme'),
        btnFullscreen: document.getElementById('btn-fullscreen'),
        workspace: document.getElementById('reader-workspace'),
        viewport: document.getElementById('reader-viewport'),
        loading: document.getElementById('reader-loading'),
        loadingText: document.getElementById('loading-status-text'),
        docFrame: document.getElementById('reader-doc-frame'),
        djvuWrap: document.getElementById('reader-djvu-wrap'),
        djvuMount: document.getElementById('djvu-viewer-mount'),
        contentWrap: document.getElementById('reader-content-wrap'),
        dropBar: document.getElementById('reader-file-drop-bar'),
        inputLocalFile: document.getElementById('input-local-file'),
        btnPickLocal: document.getElementById('btn-pick-local'),
        dock: document.getElementById('reader-dock'),
        btnToggleDockCollapse: document.getElementById('btn-toggle-dock-collapse'),
        dockCollapseArrow: document.getElementById('dock-collapse-arrow'),
        btnDockQuickSide: document.getElementById('btn-dock-quick-side'),
        dockTabs: document.querySelectorAll('.reader-dock-tab'),
        dockViews: {
            board: document.getElementById('view-board'),
            bookmarks: document.getElementById('view-bookmarks'),
            notes: document.getElementById('view-notes')
        },
        tabBadgeBookmarks: document.getElementById('tab-badge-bookmarks'),
        tabBadgeNotes: document.getElementById('tab-badge-notes'),
        // Board elements
        boardWrapper: document.getElementById('board-wrapper'),
        chessGrid: document.getElementById('chess-grid'),
        btnBoardFirst: document.getElementById('btn-board-first'),
        btnBoardPrev: document.getElementById('btn-board-prev'),
        btnBoardNext: document.getElementById('btn-board-next'),
        btnBoardLast: document.getElementById('btn-board-last'),
        btnBoardFlip: document.getElementById('btn-board-flip'),
        boardMovesLog: document.getElementById('board-moves-log'),
        // Editor elements
        paletteBtns: document.querySelectorAll('.palette-btn'),
        btnEditorClear: document.getElementById('btn-editor-clear'),
        btnEditorStart: document.getElementById('btn-editor-start'),
        btnEditorTurn: document.getElementById('btn-editor-turn'),
        editorSideIndicator: document.getElementById('editor-side-indicator'),
        // Bookmarks & Notes
        bookmarksList: document.getElementById('bookmarks-list'),
        noteInput: document.getElementById('note-input'),
        noteCharCounter: document.getElementById('note-char-counter'),
        btnSaveNote: document.getElementById('btn-save-note'),
        notesList: document.getElementById('notes-list'),
        // Selection toolbar
        selectionToolbar: document.getElementById('selection-toolbar'),
        selBtnChess: document.getElementById('sel-btn-chess'),
        selBtnHighlight: document.getElementById('sel-btn-highlight'),
        selBtnNote: document.getElementById('sel-btn-note'),
        selBtnCopy: document.getElementById('sel-btn-copy')
    };

    // READER STATE
    const state = {
        currentPage: bookParam.startPage,
        totalPages: 100,
        zoom: 1.0,
        pdfDoc: null,
        isHighlightActive: false,
        dockSide: localStorage.getItem('chess_vault_reader_dock_side') || 'right',
        isDockCollapsed: localStorage.getItem('chess_vault_reader_dock_collapsed') === 'true',
        activeTab: 'board',
        selectedText: '',
        currentUser: null,
        bookmarks: [],
        notes: [],
        highlights: []
    };

    // CHESS STATE
    const chessState = {
        game: null, // Chess instance
        boardFlipped: false,
        selectedSquare: null,
        moveHistory: [],
        currentMoveIndex: -1,
        editorActivePiece: null,
        editorTurn: 'w',
        customPositionFEN: null
    };

    const PIECE_SYMBOLS = {
        p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
        P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔'
    };

    // ========================================================
    // 2. INITIALIZATION
    // ========================================================
    function init() {
        document.title = `${bookParam.title} — Онлайн Читалка | Chess Vault`;
        dom.topbarTitle.textContent = bookParam.title;
        dom.topbarAuthor.textContent = bookParam.author;

        applyDockSide(state.dockSide);
        applyDockCollapsed(state.isDockCollapsed);

        initChessGame();

        // 1. Спочатку завантажуємо локальний стан воркспейсу юзера для цієї книги
        loadUserBookWorkspace();

        // 2. Слухаємо Firebase Auth для персональної хмарної синхронізації
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                state.currentUser = user;
                if (user) {
                    loadUserBookWorkspaceFromFirestore(user.uid);
                }
            });
        }

        bindEvents();
        loadDocument();
    }

    // ========================================================
    // 3. DOCUMENT LOADERS (PDF, DjVu, DOCX + Local Drag & Drop)
    // ========================================================
    function loadDocument() {
        const fileUrl = bookParam.file;
        let format = bookParam.format;

        // Auto-detect format from file extension if needed
        if (!format || format === '---') {
            const ext = fileUrl.split('.').pop().toLowerCase();
            if (ext) format = ext;
        }

        // Завжди показуємо підказку для відкриття локального файлу при бажанні
        if (dom.dropBar) dom.dropBar.style.display = 'flex';

        if (!fileUrl) {
            showDocError('Посилання на файл в електронному архіві відсутнє (книга у черзі на оцифрування).');
            return;
        }

        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Завантаження документа (${format.toUpperCase()})...`;

        if (format === 'pdf') {
            loadPdfDirect(fileUrl);
        } else if (format === 'djvu') {
            loadDjvuDirect(fileUrl);
        } else if (format === 'docx' || format === 'doc') {
            loadDocxDirect(fileUrl);
        } else {
            // Default to PDF direct iframe
            loadPdfDirect(fileUrl);
        }
    }

    // PDF LOADER: Uses native browser PDF viewer via Iframe (Zero CORS restrictions)
    function loadPdfDirect(url) {
        if (!url) {
            showDocError('Посилання на файл PDF відсутнє.');
            return;
        }

        dom.docFrame.style.display = 'block';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';

        // Direct embed with starting page anchor
        const frameSrc = url.includes('#') ? url : `${url}#page=${state.currentPage}&toolbar=1&navpanes=0`;
        dom.docFrame.src = frameSrc;

        dom.docFrame.onload = () => {
            dom.loading.style.display = 'none';
            showSyncToast('📄 PDF документ підвантажено успішно');
        };

        // Fallback timer if onload doesn't fire due to browser plugin
        setTimeout(() => {
            if (dom.loading.style.display !== 'none') {
                dom.loading.style.display = 'none';
            }
        }, 1500);

        // Estimate total pages from page_counts or cache
        if (window.CHESS_PAGE_COUNTS && window.CHESS_PAGE_COUNTS[bookParam.id]) {
            state.totalPages = window.CHESS_PAGE_COUNTS[bookParam.id];
            dom.labelTotalPages.textContent = state.totalPages;
            dom.inputCurrentPage.max = state.totalPages;
        }

        updatePageUI();
    }

    // DjVu LOADER: Uses DjVu.js Viewer or Embedded Archive Reader
    function loadDjvuDirect(url) {
        if (!url) {
            showDocError('Посилання на файл DjVu відсутнє.');
            return;
        }

        // Check if DjVu.js Viewer library is loaded
        if (typeof DjVu !== 'undefined' && DjVu.Viewer && dom.djvuMount) {
            dom.docFrame.style.display = 'none';
            dom.contentWrap.style.display = 'none';
            dom.djvuWrap.style.display = 'block';

            try {
                dom.djvuMount.innerHTML = '';
                const viewer = new DjVu.Viewer();
                viewer.render(dom.djvuMount);
                viewer.loadDocumentByUrl(url);

                dom.loading.style.display = 'none';
                showSyncToast('📖 DjVu документ підвантажено в онлайн-переглядачі');
                return;
            } catch (err) {
                console.warn('DjVu.Viewer direct URL load warning:', err);
            }
        }

        // Fallback: Embed via Archive.org BookReader / stream
        const archiveEmbedUrl = url.replace('/download/', '/embed/');
        dom.docFrame.style.display = 'block';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';

        dom.docFrame.src = archiveEmbedUrl;
        dom.docFrame.onload = () => {
            dom.loading.style.display = 'none';
        };
        setTimeout(() => { dom.loading.style.display = 'none'; }, 2000);

        updatePageUI();
    }

    // DOCX LOADER: via mammoth.js
    async function loadDocxDirect(url) {
        try {
            if (typeof mammoth === 'undefined') throw new Error('Mammoth.js не знайдено');
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const arrayBuffer = await resp.arrayBuffer();

            const result = await mammoth.convertToHtml({ arrayBuffer });
            dom.loading.style.display = 'none';
            dom.docFrame.style.display = 'none';
            if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
            dom.contentWrap.style.display = 'block';

            dom.contentWrap.innerHTML = `
                <div class="reader-docx-container">
                    ${result.value}
                </div>
            `;

            const totalChars = (result.value.replace(/<[^>]*>/g, '') || '').length;
            state.totalPages = Math.max(1, Math.round(totalChars / 2200));
            dom.labelTotalPages.textContent = state.totalPages;
            dom.inputCurrentPage.max = state.totalPages;

            updatePageUI();
            saveUserBookWorkspace();
        } catch (err) {
            console.warn('Docx direct load error, using frame fallback:', err);
            loadPdfDirect(url);
        }
    }

    // LOCAL FILE LOADER (Drag-and-Drop or File Picker)
    function handleLocalFileSelected(file) {
        if (!file) return;
        const fname = file.name.toLowerCase();
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Читання локального файлу ${file.name}...`;

        const reader = new FileReader();

        if (fname.endsWith('.pdf')) {
            reader.onload = (e) => {
                const blob = new Blob([e.target.result], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                dom.docFrame.src = blobUrl;
                dom.docFrame.style.display = 'block';
                if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
                if (dom.contentWrap) dom.contentWrap.style.display = 'none';
                dom.loading.style.display = 'none';
                showSyncToast(`📂 Локальний PDF "${file.name}" завантажено!`);
            };
            reader.readAsArrayBuffer(file);
        } else if (fname.endsWith('.djvu')) {
            reader.onload = (e) => {
                if (typeof DjVu !== 'undefined' && DjVu.Viewer && dom.djvuMount) {
                    dom.djvuMount.innerHTML = '';
                    const viewer = new DjVu.Viewer();
                    viewer.render(dom.djvuMount);
                    viewer.loadDocument(e.target.result);
                    dom.djvuWrap.style.display = 'block';
                    dom.docFrame.style.display = 'none';
                    if (dom.contentWrap) dom.contentWrap.style.display = 'none';
                    dom.loading.style.display = 'none';
                    showSyncToast(`📂 Локальний DjVu "${file.name}" відкрито!`);
                } else {
                    dom.loading.style.display = 'none';
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (fname.endsWith('.docx')) {
            reader.onload = async (e) => {
                if (typeof mammoth !== 'undefined') {
                    const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result });
                    dom.loading.style.display = 'none';
                    dom.docFrame.style.display = 'none';
                    if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
                    dom.contentWrap.style.display = 'block';
                    dom.contentWrap.innerHTML = `<div class="reader-docx-container">${result.value}</div>`;
                    showSyncToast(`📂 Локальний DOCX відкрито!`);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    // ========================================================
    // 4. PER-USER & PER-BOOK WORKSPACE PERSISTENCE
    // ========================================================
    function getWorkspaceKey(uid) {
        return `chess_vault_workspace_${uid || 'guest'}_${bookParam.id}`;
    }

    function saveUserBookWorkspace() {
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        const percent = Math.min(100, Math.max(1, Math.round((state.currentPage / state.totalPages) * 100)));

        const workspaceData = {
            bookId: bookParam.id,
            title: bookParam.title,
            author: bookParam.author,
            url: bookParam.file,
            format: bookParam.format,
            currentPage: state.currentPage,
            totalPages: state.totalPages,
            percentage: percent,
            boardFEN: chessState.game ? chessState.game.fen() : null,
            boardMoves: chessState.moveHistory || [],
            boardMoveIndex: chessState.currentMoveIndex,
            boardFlipped: chessState.boardFlipped,
            boardTurn: chessState.editorTurn,
            bookmarks: state.bookmarks || [],
            notes: state.notes || [],
            highlights: state.highlights || [],
            dockSide: state.dockSide,
            updatedAt: Date.now()
        };

        // 1. Миттєве збереження в LocalStorage для поточного користувача
        try {
            localStorage.setItem(getWorkspaceKey(uid), JSON.stringify(workspaceData));
        } catch (_) {}

        // 2. Оновлення ReadingProgress (якщо >= 10 сторінок — рахується у «Зараз читаю» в профілі)
        if (window.ReadingProgress) {
            window.ReadingProgress.saveProgress(uid, {
                id: bookParam.id,
                title: bookParam.title,
                author: bookParam.author,
                url: bookParam.file,
                format: bookParam.format,
                currentPage: state.currentPage,
                totalPages: state.totalPages,
                notesCount: state.notes.length,
                bookmarksCount: state.bookmarks.length
            });
        }

        // 3. Збереження в хмару Firestore окремо для цього користувача
        if (state.currentUser && window.db) {
            window.db.collection('user_reading').doc(state.currentUser.uid)
                .collection('books').doc(bookParam.id)
                .set(workspaceData, { merge: true })
                .then(() => {
                    showSyncIndicator('✅ Збережено в хмарі');
                })
                .catch(err => console.warn('Workspace sync error:', err));
        } else {
            showSyncIndicator('💾 Збережено локально');
        }
    }

    function loadUserBookWorkspace() {
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        try {
            const raw = localStorage.getItem(getWorkspaceKey(uid));
            if (raw) {
                const data = JSON.parse(raw);
                applyWorkspaceData(data);
            }
        } catch (_) {}
    }

    async function loadUserBookWorkspaceFromFirestore(uid) {
        if (!uid || !window.db) return;
        try {
            const snap = await window.db.collection('user_reading').doc(uid)
                .collection('books').doc(bookParam.id).get();
            if (snap.exists) {
                const data = snap.data();
                applyWorkspaceData(data);
                // Оновлюємо локальний кеш
                localStorage.setItem(getWorkspaceKey(uid), JSON.stringify(data));
            }
        } catch (err) {
            console.warn('Could not load user workspace from firestore:', err);
        }
    }

    function applyWorkspaceData(data) {
        if (!data) return;

        // Restore reading page
        if (data.currentPage && !urlParams.get('page')) {
            state.currentPage = data.currentPage;
            if (dom.inputCurrentPage) dom.inputCurrentPage.value = state.currentPage;
        }
        if (data.totalPages) {
            state.totalPages = data.totalPages;
            if (dom.labelTotalPages) dom.labelTotalPages.textContent = state.totalPages;
        }

        // Restore bookmarks & notes
        if (Array.isArray(data.bookmarks)) state.bookmarks = data.bookmarks;
        if (Array.isArray(data.notes)) state.notes = data.notes;
        if (Array.isArray(data.highlights)) state.highlights = data.highlights;
        renderBookmarksList();
        renderNotesList();

        // Restore Chessboard state (FEN, moves, turn, orientation)
        if (chessState.game) {
            if (data.boardFEN && data.boardFEN !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
                try {
                    chessState.game.load(data.boardFEN);
                } catch (_) {}
            }
            if (Array.isArray(data.boardMoves)) {
                chessState.moveHistory = data.boardMoves;
                chessState.currentMoveIndex = (typeof data.boardMoveIndex === 'number') ? data.boardMoveIndex : data.boardMoves.length - 1;
            }
            if (typeof data.boardFlipped === 'boolean') {
                chessState.boardFlipped = data.boardFlipped;
            }
            if (data.boardTurn) {
                chessState.editorTurn = data.boardTurn;
                if (dom.editorSideIndicator) {
                    dom.editorSideIndicator.textContent = chessState.editorTurn === 'w' ? 'Хід: ⚪ Білі' : 'Хід: ⚫ Чорні';
                }
            }

            updateMovesLogUI();
            renderChessBoard();
        }

        if (data.dockSide) {
            applyDockSide(data.dockSide);
        }

        updatePageUI();
    }

    function showSyncIndicator(text) {
        if (!dom.syncStatusPill) return;
        dom.syncStatusPill.textContent = text;
        dom.syncStatusPill.style.color = '#22c55e';
        setTimeout(() => {
            if (dom.syncStatusPill) {
                dom.syncStatusPill.textContent = '☁️ Автозбереження';
                dom.syncStatusPill.style.color = '';
            }
        }, 2200);
    }

    // ========================================================
    // 5. PAGE NAVIGATION & UI
    // ========================================================
    function goToPage(page) {
        const p = Math.min(Math.max(1, parseInt(page) || 1), state.totalPages);
        state.currentPage = p;
        updatePageUI();

        // Update iframe anchor if in PDF mode
        if (dom.docFrame && dom.docFrame.style.display !== 'none' && dom.docFrame.src) {
            const base = dom.docFrame.src.split('#')[0];
            dom.docFrame.src = `${base}#page=${p}&toolbar=1&navpanes=0`;
        }

        saveUserBookWorkspace();
    }

    function updatePageUI() {
        if (dom.inputCurrentPage) dom.inputCurrentPage.value = state.currentPage;
        if (dom.btnPrevPage) dom.btnPrevPage.disabled = state.currentPage <= 1;
        if (dom.btnNextPage) dom.btnNextPage.disabled = state.currentPage >= state.totalPages;

        const percent = Math.min(100, Math.max(1, Math.round((state.currentPage / state.totalPages) * 100)));
        if (dom.labelPercentage) dom.labelPercentage.textContent = `${percent}%`;
    }

    // ========================================================
    // 6. CHESSBOARD & BOARD EDITOR
    // ========================================================
    function initChessGame() {
        if (typeof Chess === 'undefined') {
            console.warn('chess.js not loaded');
            return;
        }

        chessState.game = new Chess();
        renderChessBoard();
    }

    function renderChessBoard() {
        if (!chessState.game) return;
        dom.chessGrid.innerHTML = '';

        const board = chessState.game.board();
        const ranks = chessState.boardFlipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
        const files = chessState.boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

        for (const r of ranks) {
            for (const f of files) {
                const squareName = String.fromCharCode(97 + f) + (r + 1);
                const isLight = (r + f) % 2 !== 0;

                const sqDiv = document.createElement('div');
                sqDiv.className = `chess-square ${isLight ? 'light' : 'dark'}`;
                sqDiv.dataset.square = squareName;

                if (chessState.selectedSquare === squareName) {
                    sqDiv.classList.add('selected');
                }

                const piece = board[7 - r][f];
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    pieceSpan.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                    pieceSpan.textContent = PIECE_SYMBOLS[key] || '';
                    sqDiv.appendChild(pieceSpan);
                }

                sqDiv.addEventListener('click', () => handleSquareClick(squareName));
                dom.chessGrid.appendChild(sqDiv);
            }
        }
    }

    function handleSquareClick(square) {
        // A) Якщо активна фігура в редакторі -> ставимо/видаляємо її
        if (chessState.editorActivePiece) {
            placePieceInEditor(square, chessState.editorActivePiece);
            saveUserBookWorkspace();
            return;
        }

        // B) Звичайний режим гри ходами
        if (!chessState.selectedSquare) {
            const piece = chessState.game.get(square);
            if (piece) {
                chessState.selectedSquare = square;
                renderChessBoard();
                highlightPossibleMoves(square);
            }
        } else {
            const from = chessState.selectedSquare;
            const to = square;

            if (from === to) {
                chessState.selectedSquare = null;
                renderChessBoard();
                return;
            }

            const move = chessState.game.move({
                from: from,
                to: to,
                promotion: 'q'
            });

            chessState.selectedSquare = null;

            if (move) {
                chessState.moveHistory.push(move.san);
                chessState.currentMoveIndex = chessState.moveHistory.length - 1;
                updateMovesLogUI();
                renderChessBoard();
                saveUserBookWorkspace();
            } else {
                const piece = chessState.game.get(square);
                if (piece) {
                    chessState.selectedSquare = square;
                    renderChessBoard();
                    highlightPossibleMoves(square);
                } else {
                    renderChessBoard();
                }
            }
        }
    }

    function highlightPossibleMoves(square) {
        const moves = chessState.game.moves({ square: square, verbose: true });
        moves.forEach(m => {
            const el = dom.chessGrid.querySelector(`[data-square="${m.to}"]`);
            if (el) {
                if (m.captured) el.classList.add('possible-capture');
                else el.classList.add('possible-move');
            }
        });
    }

    function placePieceInEditor(square, pieceKey) {
        const color = pieceKey === pieceKey.toUpperCase() ? 'w' : 'b';
        const type = pieceKey.toLowerCase();

        const current = chessState.game.get(square);
        if (current && current.type === type && current.color === color) {
            chessState.game.remove(square);
        } else {
            chessState.game.put({ type, color }, square);
        }

        renderChessBoard();
    }

    function clearChessBoard() {
        if (!chessState.game) return;
        chessState.game.clear();
        chessState.moveHistory = [];
        chessState.currentMoveIndex = -1;
        updateMovesLogUI();
        renderChessBoard();
        saveUserBookWorkspace();
        showSyncToast('🗑️ Дошку очищено для ендшпілю');
    }

    function resetToStartingPosition() {
        if (!chessState.game) return;
        chessState.game.reset();
        chessState.moveHistory = [];
        chessState.currentMoveIndex = -1;
        updateMovesLogUI();
        renderChessBoard();
        saveUserBookWorkspace();
        showSyncToast('♟️ Початкову розстановку відновлено');
    }

    function toggleEditorTurn() {
        chessState.editorTurn = chessState.editorTurn === 'w' ? 'b' : 'w';
        if (dom.editorSideIndicator) {
            dom.editorSideIndicator.textContent = chessState.editorTurn === 'w' ? 'Хід: ⚪ Білі' : 'Хід: ⚫ Чорні';
        }
        saveUserBookWorkspace();
        showSyncToast(`Черга ходу: ${chessState.editorTurn === 'w' ? 'Білі' : 'Чорні'}`);
    }

    // ========================================================
    // 7. NOTATION PARSER & REPLAY
    // ========================================================
    function parseChessMovesFromText(rawText) {
        if (!rawText) return [];

        let clean = rawText
            .replace(/[ОO0]-[ОO0]-[ОO0]/g, 'O-O-O')
            .replace(/[ОO0]-[ОO0]/g, 'O-O')
            .replace(/Кр/gi, 'K')
            .replace(/Ф/g, 'Q')
            .replace(/Л/g, 'R')
            .replace(/С/g, 'B')
            .replace(/К/g, 'N')
            .replace(/п/g, '')
            .replace(/[:xх]/g, 'x')
            .replace(/\b\d+\s*\.{1,3}/g, ' ');

        const tokens = clean.split(/\s+/).filter(t => t.trim().length > 0);
        const validMoves = [];
        const testGame = new Chess();

        for (const token of tokens) {
            const sanitized = token.replace(/[\!\?\#\+\,]/g, '').trim();
            if (!sanitized) continue;
            try {
                const m = testGame.move(sanitized, { sloppy: true });
                if (m) validMoves.push(m.san);
            } catch (_) {}
        }

        return validMoves;
    }

    function loadMovesToBoard(movesArray) {
        if (!movesArray || movesArray.length === 0) {
            showSyncToast('У виділеному тексті не знайдено шахових ходів.', 'warn');
            return;
        }

        chessState.game.reset();
        chessState.moveHistory = [];

        for (const san of movesArray) {
            try {
                const m = chessState.game.move(san, { sloppy: true });
                if (m) chessState.moveHistory.push(m.san);
            } catch (_) {
                break;
            }
        }

        chessState.currentMoveIndex = chessState.moveHistory.length - 1;
        updateMovesLogUI();
        renderChessBoard();
        switchDockTab('board');
        saveUserBookWorkspace();
        showSyncToast(`♟️ Завантажено ${chessState.moveHistory.length} ходів на дошку!`);
    }

    function updateMovesLogUI() {
        dom.boardMovesLog.innerHTML = '';
        if (chessState.moveHistory.length === 0) {
            dom.boardMovesLog.innerHTML = '<span style="color: var(--reader-text-muted); font-size: 0.75rem;">Виділіть ходи в книзі або перетягніть фігуру.</span>';
            return;
        }

        chessState.moveHistory.forEach((san, idx) => {
            const span = document.createElement('span');
            span.className = 'move-token';
            if (idx === chessState.currentMoveIndex) span.classList.add('current');
            const moveNum = Math.floor(idx / 2) + 1;
            const prefix = (idx % 2 === 0) ? `${moveNum}. ` : '';
            span.textContent = `${prefix}${san}`;
            span.addEventListener('click', () => jumpToMove(idx));
            dom.boardMovesLog.appendChild(span);
        });
    }

    function jumpToMove(targetIndex) {
        chessState.game.reset();
        for (let i = 0; i <= targetIndex; i++) {
            chessState.game.move(chessState.moveHistory[i]);
        }
        chessState.currentMoveIndex = targetIndex;
        updateMovesLogUI();
        renderChessBoard();
        saveUserBookWorkspace();
    }

    // ========================================================
    // 8. BOOKMARKS & NOTES MANAGEMENT
    // ========================================================
    function addBookmarkCurrentPage() {
        const curPage = state.currentPage;
        if (state.bookmarks.some(b => b.page === curPage)) {
            showSyncToast(`Сторінка ${curPage} вже є в закладках.`, 'warn');
            return;
        }

        state.bookmarks.push({
            page: curPage,
            title: `Сторінка ${curPage}`,
            createdAt: Date.now()
        });

        renderBookmarksList();
        saveUserBookWorkspace();
        showSyncToast(`🔖 Сторінку ${curPage} збережено у ваші закладки!`);
    }

    function renderBookmarksList() {
        dom.tabBadgeBookmarks.textContent = `(${state.bookmarks.length})`;
        dom.bookmarksList.innerHTML = '';

        if (state.bookmarks.length === 0) {
            dom.bookmarksList.innerHTML = `
                <div class="empty-view-state">
                    <span class="icon">🔖</span>
                    <p>Закладок поки немає.<br>Натисніть <b>"Закладка"</b> у верхньому меню, щоб зберегти сторінку.</p>
                </div>
            `;
            return;
        }

        state.bookmarks.sort((a, b) => a.page - b.page).forEach((bm, idx) => {
            const div = document.createElement('div');
            div.className = 'bookmark-item';
            div.innerHTML = `
                <div class="bookmark-left">
                    <span class="bookmark-page-badge">Стор. ${bm.page}</span>
                    <span class="bookmark-title">${escapeHtml(bm.title)}</span>
                </div>
                <button type="button" class="bookmark-del-btn" title="Видалити закладку">✕</button>
            `;

            div.querySelector('.bookmark-left').addEventListener('click', () => goToPage(bm.page));
            div.querySelector('.bookmark-del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                state.bookmarks.splice(idx, 1);
                renderBookmarksList();
                saveUserBookWorkspace();
                showSyncToast('Закладку видалено');
            });

            dom.bookmarksList.appendChild(div);
        });
    }

    function addNote() {
        const text = (dom.noteInput.value || '').trim();
        if (!text) {
            showSyncToast('Введіть текст нотатки.', 'warn');
            return;
        }

        if (text.length > 1000) {
            showSyncToast('Максимальна довжина нотатки — 1000 символів.', 'warn');
            return;
        }

        const newNote = {
            id: 'note_' + Date.now(),
            page: state.currentPage,
            quote: state.selectedText ? state.selectedText.slice(0, 150) : '',
            text: text,
            createdAt: Date.now()
        };

        state.notes.unshift(newNote);
        dom.noteInput.value = '';
        dom.noteCharCounter.textContent = '0 / 1000';
        state.selectedText = '';

        renderNotesList();
        saveUserBookWorkspace();
        showSyncToast(`📝 Нотатку збережено для сторінки ${state.currentPage}!`);
    }

    function renderNotesList() {
        dom.tabBadgeNotes.textContent = `(${state.notes.length})`;
        dom.notesList.innerHTML = '';

        if (state.notes.length === 0) {
            dom.notesList.innerHTML = `
                <div class="empty-view-state">
                    <span class="icon">📝</span>
                    <p>Нотаток поки немає.<br>Запишіть свої коментарі до книги (до 1000 симв.).</p>
                </div>
            `;
            return;
        }

        state.notes.forEach((note, idx) => {
            const div = document.createElement('div');
            div.className = 'note-item';

            const d = new Date(note.createdAt);
            const dateStr = `${d.getDate()}.${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

            div.innerHTML = `
                <div class="note-item-header">
                    <span class="note-page-tag" style="cursor: pointer;">Стор. ${note.page}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="note-date">${dateStr}</span>
                        <button type="button" class="bookmark-del-btn btn-del-note" title="Видалити нотатку">✕</button>
                    </div>
                </div>
                ${note.quote ? `<div class="note-quote">"${escapeHtml(note.quote)}"</div>` : ''}
                <div class="note-content">${escapeHtml(note.text)}</div>
            `;

            div.querySelector('.note-page-tag').addEventListener('click', () => goToPage(note.page));
            div.querySelector('.btn-del-note').addEventListener('click', (e) => {
                e.stopPropagation();
                state.notes.splice(idx, 1);
                renderNotesList();
                saveUserBookWorkspace();
                showSyncToast('Нотатку видалено');
            });

            dom.notesList.appendChild(div);
        });
    }

    // ========================================================
    // 9. DOCK CONTROLS & TABS (Left / Right & Collapse)
    // ========================================================
    function applyDockSide(side) {
        state.dockSide = side === 'left' ? 'left' : 'right';
        localStorage.setItem('chess_vault_reader_dock_side', state.dockSide);

        dom.workspace.classList.remove('dock-left', 'dock-right');
        dom.workspace.classList.add(`dock-${state.dockSide}`);

        dom.dockSideLabel.textContent = state.dockSide === 'left' ? 'Праворуч' : 'Ліворуч';
    }

    function toggleDockSide() {
        applyDockSide(state.dockSide === 'left' ? 'right' : 'left');
        saveUserBookWorkspace();
    }

    function applyDockCollapsed(collapsed) {
        state.isDockCollapsed = Boolean(collapsed);
        localStorage.setItem('chess_vault_reader_dock_collapsed', String(state.isDockCollapsed));

        if (state.isDockCollapsed) {
            dom.dock.classList.add('collapsed');
            dom.dockCollapseArrow.textContent = state.dockSide === 'right' ? '◂' : '▸';
        } else {
            dom.dock.classList.remove('collapsed');
            dom.dockCollapseArrow.textContent = state.dockSide === 'right' ? '▸' : '◂';
        }
    }

    function toggleDockCollapsed() {
        applyDockCollapsed(!state.isDockCollapsed);
    }

    function switchDockTab(tabName) {
        state.activeTab = tabName;
        dom.dockTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

        Object.keys(dom.dockViews).forEach(k => {
            dom.dockViews[k].classList.toggle('active', k === tabName);
        });

        if (state.isDockCollapsed) {
            applyDockCollapsed(false);
        }
    }

    // ========================================================
    // 10. TEXT SELECTION & FLOATING TOOLBAR
    // ========================================================
    function handleTextSelection() {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';

        if (!text || text.length < 2) {
            dom.selectionToolbar.style.display = 'none';
            return;
        }

        state.selectedText = text;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        dom.selectionToolbar.style.top = `${Math.max(10, rect.top - 46)}px`;
        dom.selectionToolbar.style.left = `${rect.left + rect.width / 2}px`;
        dom.selectionToolbar.style.display = 'flex';
    }

    // ========================================================
    // 11. EVENT LISTENERS
    // ========================================================
    function bindEvents() {
        dom.btnPrevPage.addEventListener('click', () => goToPage(state.currentPage - 1));
        dom.btnNextPage.addEventListener('click', () => goToPage(state.currentPage + 1));
        dom.inputCurrentPage.addEventListener('change', () => goToPage(dom.inputCurrentPage.value));

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') goToPage(state.currentPage - 1);
            if (e.key === 'ArrowRight') goToPage(state.currentPage + 1);
        });

        dom.btnToggleDockSide.addEventListener('click', toggleDockSide);
        dom.btnDockQuickSide.addEventListener('click', toggleDockSide);
        dom.btnToggleDockCollapse.addEventListener('click', toggleDockCollapsed);

        dom.dockTabs.forEach(tab => {
            tab.addEventListener('click', () => switchDockTab(tab.dataset.tab));
        });

        dom.btnAddBookmark.addEventListener('click', addBookmarkCurrentPage);
        dom.btnSaveNote.addEventListener('click', addNote);
        dom.noteInput.addEventListener('input', () => {
            dom.noteCharCounter.textContent = `${dom.noteInput.value.length} / 1000`;
        });

        // Board Replay
        dom.btnBoardFirst.addEventListener('click', () => jumpToMove(-1));
        dom.btnBoardPrev.addEventListener('click', () => jumpToMove(Math.max(-1, chessState.currentMoveIndex - 1)));
        dom.btnBoardNext.addEventListener('click', () => jumpToMove(Math.min(chessState.moveHistory.length - 1, chessState.currentMoveIndex + 1)));
        dom.btnBoardLast.addEventListener('click', () => jumpToMove(chessState.moveHistory.length - 1));
        dom.btnBoardFlip.addEventListener('click', () => {
            chessState.boardFlipped = !chessState.boardFlipped;
            renderChessBoard();
            saveUserBookWorkspace();
        });

        // Board Editor
        dom.paletteBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.piece;
                if (chessState.editorActivePiece === p) {
                    chessState.editorActivePiece = null;
                    btn.classList.remove('active');
                } else {
                    dom.paletteBtns.forEach(b => b.classList.remove('active'));
                    chessState.editorActivePiece = p;
                    btn.classList.add('active');
                    showSyncToast(`Вибрано фігуру: ${PIECE_SYMBOLS[p]}`);
                }
            });
        });

        dom.btnEditorClear.addEventListener('click', clearChessBoard);
        dom.btnEditorStart.addEventListener('click', resetToStartingPosition);
        dom.btnEditorTurn.addEventListener('click', toggleEditorTurn);

        // Selection toolbar
        document.addEventListener('mouseup', handleTextSelection);

        dom.selBtnChess.addEventListener('click', () => {
            const moves = parseChessMovesFromText(state.selectedText);
            loadMovesToBoard(moves);
            dom.selectionToolbar.style.display = 'none';
        });

        dom.selBtnHighlight.addEventListener('click', () => {
            showSyncToast('Текст виділено!');
            dom.selectionToolbar.style.display = 'none';
        });

        dom.selBtnNote.addEventListener('click', () => {
            switchDockTab('notes');
            dom.noteInput.focus();
            dom.selectionToolbar.style.display = 'none';
        });

        dom.selBtnCopy.addEventListener('click', () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(state.selectedText);
                showSyncToast('📋 Текст скопійовано');
            }
            dom.selectionToolbar.style.display = 'none';
        });

        // Local file picker
        if (dom.btnPickLocal && dom.inputLocalFile) {
            dom.btnPickLocal.addEventListener('click', () => dom.inputLocalFile.click());
            dom.inputLocalFile.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleLocalFileSelected(file);
            });
        }

        // Drag & drop file support
        dom.viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.viewport.style.outline = '2px dashed var(--reader-accent)';
        });
        dom.viewport.addEventListener('dragleave', () => {
            dom.viewport.style.outline = 'none';
        });
        dom.viewport.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.viewport.style.outline = 'none';
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleLocalFileSelected(file);
        });

        // Fullscreen & Theme
        dom.btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });

        dom.btnToggleTheme.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            const next = isDark ? 'light' : 'dark';
            localStorage.setItem('chess_theme', next);
            if (window.applyTheme) window.applyTheme(next);
            else document.documentElement.classList.toggle('dark', next === 'dark');
        });
    }

    // UTILITIES
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showSyncToast(msg, type = 'ok') {
        const t = document.createElement('div');
        t.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e2029;
            color: #fff;
            padding: 10px 20px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            font-size: 0.86rem;
            font-weight: 600;
            z-index: 9999;
            pointer-events: none;
            transition: opacity 0.3s;
        `;
        if (type === 'warn') {
            t.style.borderColor = '#f59e0b';
            t.style.color = '#fbbf24';
        }
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }

    function showDocError(msg) {
        dom.loading.style.display = 'none';
        if (dom.contentWrap) {
            dom.contentWrap.style.display = 'block';
            const hasDirectFile = Boolean(bookParam.file);
            dom.contentWrap.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">${hasDirectFile ? '⚠️' : '⏳'}</div>
                    <h3 style="margin-bottom: 8px;">${hasDirectFile ? 'Не вдалося автоматично відкрити книгу' : 'Книга очікує завантаження в онлайн-архів (Том 2)'}</h3>
                    <p style="color: var(--reader-text-muted); max-width: 480px; margin: 0 auto 16px;">
                        ${hasDirectFile ? escapeHtml(msg) : 'Цей том очікує синхронізації з сервером. Ви вже зараз можете читати його локальну копію або тренуватися на шахівниці праворуч.'}
                    </p>
                    ${hasDirectFile ? `
                        <a href="${bookParam.file}" target="_blank" class="btn-add-note" style="text-decoration: none; padding: 8px 16px;">
                            🔗 Відкрити файл напряму
                        </a>
                    ` : `
                        <button onclick="document.getElementById('input-local-file').click()" class="btn-add-note" style="padding: 10px 20px; font-size: 0.95rem; cursor: pointer; border: none; border-radius: 8px;">
                            📂 Відкрити локальний файл з диска
                        </button>
                    `}
                </div>
            `;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
