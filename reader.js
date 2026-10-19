/* ========================================================
   CHESS VAULT — ONLINE READER ENGINE (reader.js)
   - Multi-format rendering (PDF, DjVu, DOCX)
   - Real-time reading progress calculation & Firestore sync
   - Interactive Chessboard with chess.js & Board Editor
   - Text selection chess move parser (SAN & Cyrillic)
   - Page bookmarking & Annotations (max 1000 chars)
   - Collapsible & switchable dock (Left / Right side)
   - Stockfish engine integration architecture
   ======================================================== */

(function () {
    'use strict';

    // 1. URL & PARAMETERS PARSING
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
        contentWrap: document.getElementById('reader-content-wrap'),
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
        totalPages: 1,
        zoom: 1.0,
        pdfDoc: null,
        isRendering: false,
        pageNumPending: null,
        isHighlightActive: false,
        dockSide: localStorage.getItem('chess_vault_reader_dock_side') || 'right',
        isDockCollapsed: localStorage.getItem('chess_vault_reader_dock_collapsed') === 'true',
        activeTab: 'board',
        selectedText: '',
        currentUser: null,
        bookmarks: [],
        notes: []
    };

    // CHESS STATE
    const chessState = {
        game: null, // instance of Chess()
        boardFlipped: false,
        selectedSquare: null,
        moveHistory: [], // array of SAN strings or moves
        currentMoveIndex: -1,
        editorActivePiece: null, // selected piece to place: 'P', 'N', 'p', etc.
        editorTurn: 'w', // 'w' or 'b'
        customPositionFEN: null
    };

    // PIECE UNICODE MAPPING
    const PIECE_SYMBOLS = {
        p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
        P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔'
    };

    // 2. INITIALIZATION
    function init() {
        // Set document title & topbar
        document.title = `${bookParam.title} — Онлайн Читалка | Chess Vault`;
        dom.topbarTitle.textContent = bookParam.title;
        dom.topbarAuthor.textContent = bookParam.author;

        // Apply saved dock side & collapsed state
        applyDockSide(state.dockSide);
        applyDockCollapsed(state.isDockCollapsed);

        // Init Chess Game
        initChessGame();

        // Load annotations
        loadAnnotations();

        // Listen for Auth changes
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                state.currentUser = user;
                if (user && window.ReadingProgress) {
                    window.ReadingProgress.syncFromFirestore(user.uid).then(() => {
                        const saved = window.ReadingProgress.getProgress(user.uid, bookParam.id);
                        if (saved && saved.currentPage > state.currentPage && !urlParams.get('page')) {
                            goToPage(saved.currentPage);
                        }
                    }).catch(() => {});
                }
                loadAnnotationsFromFirestore();
            });
        }

        // Bind UI events
        bindEvents();

        // Load Document
        loadDocument();
    }

    // ========================================================
    // 3. DOCUMENT LOADERS (PDF, DOCX, DjVu)
    // ========================================================
    async function loadDocument() {
        const fileUrl = bookParam.file;
        const format = bookParam.format;

        if (!fileUrl) {
            showError('Файл книги не вказано або посилання відсутнє.');
            return;
        }

        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Завантаження (${format.toUpperCase()})...`;

        try {
            if (format === 'pdf') {
                await loadPdfDocument(fileUrl);
            } else if (format === 'docx') {
                await loadDocxDocument(fileUrl);
            } else if (format === 'djvu') {
                await loadDjvuDocument(fileUrl);
            } else {
                // Fallback: try PDF
                await loadPdfDocument(fileUrl);
            }
        } catch (err) {
            console.error('Error loading document:', err);
            showError(`Помилка завантаження книги: ${err.message || 'Не вдалося відкрити файл'}.`);
        }
    }

    // PDF LOADER via pdf.js
    async function loadPdfDocument(url) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('Бібліотека PDF.js не завантажена');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        try {
            const loadingTask = pdfjsLib.getDocument({
                url: url,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true
            });

            state.pdfDoc = await loadingTask.promise;
            state.totalPages = state.pdfDoc.numPages;
            dom.labelTotalPages.textContent = state.totalPages;
            dom.inputCurrentPage.max = state.totalPages;

            dom.loading.style.display = 'none';

            // Ensure startPage is valid
            const target = Math.min(Math.max(1, state.currentPage), state.totalPages);
            goToPage(target);
        } catch (e) {
            // Check if CORS or network error, provide friendly fallback
            throw new Error('CORS або мережева помилка завантаження PDF. ' + (e.message || ''));
        }
    }

    // RENDER CURRENT PDF PAGE
    async function renderPdfPage(pageNumber) {
        if (!state.pdfDoc) return;
        state.isRendering = true;

        try {
            const page = await state.pdfDoc.getPage(pageNumber);
            dom.contentWrap.innerHTML = '';

            const viewport = page.getViewport({ scale: state.zoom * 1.4 });

            // Create page container
            const pageContainer = document.createElement('div');
            pageContainer.className = 'reader-page-container';
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;

            // Canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageContainer.appendChild(canvas);

            // Text Layer
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            pageContainer.appendChild(textLayerDiv);

            dom.contentWrap.appendChild(pageContainer);

            // Render Canvas
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            await page.render(renderContext).promise;

            // Render Text Layer for text selection & move parsing
            const textContent = await page.getTextContent();
            if (pdfjsLib.renderTextLayer) {
                pdfjsLib.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: viewport,
                    textDivs: []
                });
            }

            state.isRendering = false;
            if (state.pageNumPending !== null) {
                const next = state.pageNumPending;
                state.pageNumPending = null;
                renderPdfPage(next);
            }
        } catch (err) {
            console.error('Error rendering page:', err);
            state.isRendering = false;
        }

        // Update progress tracking
        saveCurrentProgress();
    }

    // DOCX LOADER via mammoth.js
    async function loadDocxDocument(url) {
        if (typeof mammoth === 'undefined') {
            throw new Error('Бібліотека Mammoth.js не знайдена');
        }

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();

        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        dom.loading.style.display = 'none';

        const docxContainer = document.createElement('div');
        docxContainer.className = 'reader-docx-container';
        docxContainer.innerHTML = result.value;
        dom.contentWrap.innerHTML = '';
        dom.contentWrap.appendChild(docxContainer);

        // Approximate pages by character length (roughly 2200 chars per page)
        const totalChars = (result.value.replace(/<[^>]*>/g, '') || '').length;
        state.totalPages = Math.max(1, Math.round(totalChars / 2200));
        dom.labelTotalPages.textContent = state.totalPages;
        dom.inputCurrentPage.max = state.totalPages;

        // Listen for scroll to track progress
        dom.viewport.addEventListener('scroll', () => {
            const scrollRatio = dom.viewport.scrollTop / (dom.viewport.scrollHeight - dom.viewport.clientHeight || 1);
            const computedPage = Math.min(state.totalPages, Math.max(1, Math.round(scrollRatio * state.totalPages)));
            if (computedPage !== state.currentPage) {
                state.currentPage = computedPage;
                updatePageUI();
                saveCurrentProgress();
            }
        });

        updatePageUI();
        saveCurrentProgress();
    }

    // DjVu LOADER FALLBACK
    async function loadDjvuDocument(url) {
        dom.loading.style.display = 'none';

        const fallback = document.createElement('div');
        fallback.className = 'reader-docx-container';
        fallback.style.textAlign = 'center';
        fallback.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 16px;">📚</div>
            <h2 style="margin-bottom: 12px;">DjVu Документ: ${escapeHtml(bookParam.title)}</h2>
            <p style="color: var(--reader-text-muted); max-width: 520px; margin: 0 auto 24px; line-height: 1.5;">
                Формат DjVu підтримується для читання та вивчення з нашою міні-шахівницею та редактором ходів.
                Ви можете завантажити оригінал для локального перегляду або використовувати шахівницю праворуч для вивчення варіантів.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <a href="${url}" download class="btn-add-note" style="text-decoration: none; padding: 10px 20px; font-size: 0.9rem;">
                    📥 Завантажити DjVu файл
                </a>
            </div>
        `;
        dom.contentWrap.innerHTML = '';
        dom.contentWrap.appendChild(fallback);

        state.totalPages = 100; // default estimated
        dom.labelTotalPages.textContent = state.totalPages;
        updatePageUI();
        saveCurrentProgress();
    }

    // ========================================================
    // 4. PAGE NAVIGATION & PROGRESS SAVING
    // ========================================================
    function goToPage(page) {
        const p = Math.min(Math.max(1, parseInt(page) || 1), state.totalPages);
        state.currentPage = p;

        updatePageUI();

        if (state.pdfDoc) {
            if (state.isRendering) {
                state.pageNumPending = p;
            } else {
                renderPdfPage(p);
            }
        } else {
            saveCurrentProgress();
        }
    }

    function updatePageUI() {
        dom.inputCurrentPage.value = state.currentPage;
        dom.btnPrevPage.disabled = state.currentPage <= 1;
        dom.btnNextPage.disabled = state.currentPage >= state.totalPages;

        const percent = Math.min(100, Math.max(1, Math.round((state.currentPage / state.totalPages) * 100)));
        dom.labelPercentage.textContent = `${percent}%`;
    }

    function saveCurrentProgress() {
        if (!window.ReadingProgress) return;
        const uid = state.currentUser ? state.currentUser.uid : null;

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

    // ========================================================
    // 5. INTERACTIVE CHESSBOARD & BOARD EDITOR
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

        const board = chessState.game.board(); // 8x8 array: board[rank][file]
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

                // Check piece on square
                const piece = board[7 - r][f];
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    pieceSpan.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                    pieceSpan.textContent = PIECE_SYMBOLS[key] || '';
                    sqDiv.appendChild(pieceSpan);
                }

                // Square click handler (Move or Editor)
                sqDiv.addEventListener('click', () => handleSquareClick(squareName));

                dom.chessGrid.appendChild(sqDiv);
            }
        }
    }

    function handleSquareClick(square) {
        // A) If Editor Piece is selected in palette -> place or remove piece
        if (chessState.editorActivePiece) {
            placePieceInEditor(square, chessState.editorActivePiece);
            return;
        }

        // B) Normal Move Gameplay Mode
        if (!chessState.selectedSquare) {
            // Select piece to move
            const piece = chessState.game.get(square);
            if (piece) {
                chessState.selectedSquare = square;
                renderChessBoard();
                highlightPossibleMoves(square);
            }
        } else {
            // Try to make a move to clicked square
            const from = chessState.selectedSquare;
            const to = square;

            if (from === to) {
                // Deselect
                chessState.selectedSquare = null;
                renderChessBoard();
                return;
            }

            const move = chessState.game.move({
                from: from,
                to: to,
                promotion: 'q' // default auto-promote to queen
            });

            chessState.selectedSquare = null;

            if (move) {
                // Move was valid
                chessState.moveHistory.push(move.san);
                chessState.currentMoveIndex = chessState.moveHistory.length - 1;
                updateMovesLogUI();
                renderChessBoard();
            } else {
                // If clicked another friendly piece, select that instead
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
                if (m.captured) {
                    el.classList.add('possible-capture');
                } else {
                    el.classList.add('possible-move');
                }
            }
        });
    }

    // ========================================================
    // 6. BOARD EDITOR ACTIONS (Endgame / Custom Positions)
    // ========================================================
    function placePieceInEditor(square, pieceKey) {
        // Read current FEN or recreate board
        const color = pieceKey === pieceKey.toUpperCase() ? 'w' : 'b';
        const type = pieceKey.toLowerCase();

        // Clear square if clicking with same piece
        const current = chessState.game.get(square);
        if (current && current.type === type && current.color === color) {
            chessState.game.remove(square);
        } else {
            chessState.game.put({ type: type, color: color }, square);
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
        showToast('Дошку очищено. Виберіть фігури з палітри для розстановки.');
    }

    function resetToStartingPosition() {
        if (!chessState.game) return;
        chessState.game.reset();
        chessState.moveHistory = [];
        chessState.currentMoveIndex = -1;
        updateMovesLogUI();
        renderChessBoard();
        showToast('Початкову розстановку відновлено.');
    }

    function toggleEditorTurn() {
        chessState.editorTurn = chessState.editorTurn === 'w' ? 'b' : 'w';
        dom.editorSideIndicator.textContent = chessState.editorTurn === 'w' ? 'Хід: ⚪ Білі' : 'Хід: ⚫ Чорні';
        showToast(`Черга ходу: ${chessState.editorTurn === 'w' ? 'Білі' : 'Чорні'}`);
    }

    // ========================================================
    // 7. CHESS NOTATION PARSER (Cyrillic & Standard SAN)
    // ========================================================
    function parseChessMovesFromText(rawText) {
        if (!rawText) return [];

        // 1. Normalize Cyrillic piece notations to standard algebraic:
        // Кр -> K (King)
        // Ф -> Q (Queen)
        // Л -> R (Rook)
        // С -> B (Bishop)
        // К -> N (Knight)
        // 0-0 or О-О -> O-O
        let clean = rawText
            .replace(/[ОO0]-[ОO0]-[ОO0]/g, 'O-O-O')
            .replace(/[ОO0]-[ОO0]/g, 'O-O')
            .replace(/Кр/gi, 'K')
            .replace(/Ф/g, 'Q')
            .replace(/Л/g, 'R')
            .replace(/С/g, 'B')
            .replace(/К/g, 'N')
            .replace(/п/g, '')
            .replace(/[:xх]/g, 'x');

        // 2. Remove move numbers (e.g. "1.", "2...", "12.")
        clean = clean.replace(/\b\d+\s*\.{1,3}/g, ' ');

        // 3. Extract tokens
        const tokens = clean.split(/\s+/).filter(t => t.trim().length > 0);
        const validMoves = [];

        // Test moves against a test game
        const testGame = new Chess();
        for (const token of tokens) {
            // Strip punctuation like !, ?, etc.
            const sanitized = token.replace(/[\!\?\#\+\,]/g, '').trim();
            if (!sanitized) continue;

            try {
                const m = testGame.move(sanitized, { sloppy: true });
                if (m) {
                    validMoves.push(m.san);
                }
            } catch (_) {}
        }

        return validMoves;
    }

    function loadMovesToBoard(movesArray) {
        if (!movesArray || movesArray.length === 0) {
            showToast('У виділеному тексті не знайдено шахових ходів.', 'warn');
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

        // Switch to board tab
        switchDockTab('board');
        showToast(`♟️ Завантажено ${chessState.moveHistory.length} ходів на дошку!`);
    }

    function updateMovesLogUI() {
        dom.boardMovesLog.innerHTML = '';
        if (chessState.moveHistory.length === 0) {
            dom.boardMovesLog.innerHTML = '<span style="color: var(--reader-text-muted); font-size: 0.75rem;">Немає ходів. Виділіть ходи в тексті книги або перетягніть фігуру.</span>';
            return;
        }

        chessState.moveHistory.forEach((san, idx) => {
            const span = document.createElement('span');
            span.className = 'move-token';
            if (idx === chessState.currentMoveIndex) {
                span.classList.add('current');
            }
            // Add move number
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
    }

    // ========================================================
    // 8. BOOKMARKS & NOTES MANAGEMENT
    // ========================================================
    function getAnnotationsStorageKey() {
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        return `chess_vault_annotations_${uid}_${bookParam.id}`;
    }

    function loadAnnotations() {
        try {
            const raw = localStorage.getItem(getAnnotationsStorageKey());
            if (raw) {
                const data = JSON.parse(raw);
                state.bookmarks = data.bookmarks || [];
                state.notes = data.notes || [];
            }
        } catch (_) {}

        renderBookmarksList();
        renderNotesList();
    }

    function saveAnnotations() {
        const payload = {
            bookmarks: state.bookmarks,
            notes: state.notes,
            updatedAt: Date.now()
        };

        try {
            localStorage.setItem(getAnnotationsStorageKey(), JSON.stringify(payload));
        } catch (_) {}

        renderBookmarksList();
        renderNotesList();

        // Sync with Firestore if authenticated
        if (state.currentUser && window.db) {
            window.db.collection('user_reading').doc(state.currentUser.uid)
                .collection('annotations').doc(bookParam.id)
                .set(payload, { merge: true })
                .catch(err => console.warn('Annotations firestore sync err:', err));
        }

        saveCurrentProgress();
    }

    async function loadAnnotationsFromFirestore() {
        if (!state.currentUser || !window.db) return;
        try {
            const snap = await window.db.collection('user_reading').doc(state.currentUser.uid)
                .collection('annotations').doc(bookParam.id).get();
            if (snap.exists) {
                const data = snap.data();
                if (data.bookmarks) state.bookmarks = data.bookmarks;
                if (data.notes) state.notes = data.notes;
                saveAnnotations();
            }
        } catch (_) {}
    }

    function addBookmarkCurrentPage() {
        const curPage = state.currentPage;
        if (state.bookmarks.some(b => b.page === curPage)) {
            showToast(`Сторінка ${curPage} вже є в закладках.`, 'warn');
            return;
        }

        state.bookmarks.push({
            page: curPage,
            title: `Сторінка ${curPage}`,
            createdAt: Date.now()
        });

        saveAnnotations();
        showToast(`🔖 Сторінку ${curPage} додано в закладки!`);
    }

    function renderBookmarksList() {
        dom.tabBadgeBookmarks.textContent = `(${state.bookmarks.length})`;
        dom.bookmarksList.innerHTML = '';

        if (state.bookmarks.length === 0) {
            dom.bookmarksList.innerHTML = `
                <div class="empty-view-state">
                    <span class="icon">🔖</span>
                    <p>Закладок поки немає.<br>Натисніть кнопку <b>"Закладка"</b> у верхньому меню, щоб зберегти сторінку.</p>
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

            div.querySelector('.bookmark-left').addEventListener('click', () => {
                goToPage(bm.page);
            });

            div.querySelector('.bookmark-del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                state.bookmarks.splice(idx, 1);
                saveAnnotations();
                showToast(`Закладку видалено.`);
            });

            dom.bookmarksList.appendChild(div);
        });
    }

    function addNote() {
        const text = (dom.noteInput.value || '').trim();
        if (!text) {
            showToast('Введіть текст нотатки.', 'warn');
            return;
        }

        if (text.length > 1000) {
            showToast('Максимальна довжина нотатки — 1000 символів.', 'warn');
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

        saveAnnotations();
        showToast(`📝 Нотатку до сторінки ${state.currentPage} збережено!`);
    }

    function renderNotesList() {
        dom.tabBadgeNotes.textContent = `(${state.notes.length})`;
        dom.notesList.innerHTML = '';

        if (state.notes.length === 0) {
            dom.notesList.innerHTML = `
                <div class="empty-view-state">
                    <span class="icon">📝</span>
                    <p>Нотаток поки немає.<br>Запишіть свої думки або виділіть цитату з книги.</p>
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
                    <span class="note-page-tag">Стор. ${note.page}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="note-date">${dateStr}</span>
                        <button type="button" class="bookmark-del-btn btn-del-note" title="Видалити нотатку">✕</button>
                    </div>
                </div>
                ${note.quote ? `<div class="note-quote">"${escapeHtml(note.quote)}"</div>` : ''}
                <div class="note-content">${escapeHtml(note.text)}</div>
            `;

            div.querySelector('.note-page-tag').addEventListener('click', () => {
                goToPage(note.page);
            });

            div.querySelector('.btn-del-note').addEventListener('click', (e) => {
                e.stopPropagation();
                state.notes.splice(idx, 1);
                saveAnnotations();
                showToast(`Нотатку видалено.`);
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

        // If dock was collapsed, expand it when tab is switched
        if (state.isDockCollapsed) {
            applyDockCollapsed(false);
        }
    }

    // ========================================================
    // 10. TEXT SELECTION & FLOATING TOOLBAR
    // ========================================================
    function handleTextSelection(e) {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';

        if (!text || text.length < 2) {
            dom.selectionToolbar.style.display = 'none';
            return;
        }

        state.selectedText = text;

        // Position toolbar above selection
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        dom.selectionToolbar.style.top = `${Math.max(10, rect.top - 46)}px`;
        dom.selectionToolbar.style.left = `${rect.left + rect.width / 2}px`;
        dom.selectionToolbar.style.display = 'flex';
    }

    // ========================================================
    // 11. EVENT LISTENERS BINDING
    // ========================================================
    function bindEvents() {
        // Page navigation
        dom.btnPrevPage.addEventListener('click', () => goToPage(state.currentPage - 1));
        dom.btnNextPage.addEventListener('click', () => goToPage(state.currentPage + 1));
        dom.inputCurrentPage.addEventListener('change', () => goToPage(dom.inputCurrentPage.value));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') goToPage(state.currentPage - 1);
            if (e.key === 'ArrowRight') goToPage(state.currentPage + 1);
        });

        // Zoom
        dom.btnZoomIn.addEventListener('click', () => {
            state.zoom = Math.min(2.5, state.zoom + 0.15);
            goToPage(state.currentPage);
        });
        dom.btnZoomOut.addEventListener('click', () => {
            state.zoom = Math.max(0.6, state.zoom - 0.15);
            goToPage(state.currentPage);
        });
        dom.btnZoomReset.addEventListener('click', () => {
            state.zoom = 1.0;
            goToPage(state.currentPage);
        });

        // Dock side & collapse
        dom.btnToggleDockSide.addEventListener('click', toggleDockSide);
        dom.btnDockQuickSide.addEventListener('click', toggleDockSide);
        dom.btnToggleDockCollapse.addEventListener('click', toggleDockCollapsed);

        // Dock Tabs
        dom.dockTabs.forEach(tab => {
            tab.addEventListener('click', () => switchDockTab(tab.dataset.tab));
        });

        // Highlight toggle
        dom.btnToggleHighlight.addEventListener('click', () => {
            state.isHighlightActive = !state.isHighlightActive;
            dom.btnToggleHighlight.classList.toggle('active', state.isHighlightActive);
            showToast(state.isHighlightActive ? '🖍️ Режим виділення увімкнено' : 'Режим виділення вимкнено');
        });

        // Bookmark button
        dom.btnAddBookmark.addEventListener('click', addBookmarkCurrentPage);

        // Notes
        dom.btnSaveNote.addEventListener('click', addNote);
        dom.noteInput.addEventListener('input', () => {
            dom.noteCharCounter.textContent = `${dom.noteInput.value.length} / 1000`;
        });

        // Chessboard Navigation
        dom.btnBoardFirst.addEventListener('click', () => jumpToMove(-1));
        dom.btnBoardPrev.addEventListener('click', () => jumpToMove(Math.max(-1, chessState.currentMoveIndex - 1)));
        dom.btnBoardNext.addEventListener('click', () => jumpToMove(Math.min(chessState.moveHistory.length - 1, chessState.currentMoveIndex + 1)));
        dom.btnBoardLast.addEventListener('click', () => jumpToMove(chessState.moveHistory.length - 1));
        dom.btnBoardFlip.addEventListener('click', () => {
            chessState.boardFlipped = !chessState.boardFlipped;
            renderChessBoard();
        });

        // Board Editor Actions
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
                    showToast(`Вибрано фігуру для розміщення: ${PIECE_SYMBOLS[p]}`);
                }
            });
        });

        dom.btnEditorClear.addEventListener('click', clearChessBoard);
        dom.btnEditorStart.addEventListener('click', resetToStartingPosition);
        dom.btnEditorTurn.addEventListener('click', toggleEditorTurn);

        // Selection Toolbar actions
        document.addEventListener('mouseup', handleTextSelection);

        dom.selBtnChess.addEventListener('click', () => {
            const moves = parseChessMovesFromText(state.selectedText);
            loadMovesToBoard(moves);
            dom.selectionToolbar.style.display = 'none';
        });

        dom.selBtnHighlight.addEventListener('click', () => {
            showToast('Текст виділено!');
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
                showToast('📋 Текст скопійовано в буфер');
            }
            dom.selectionToolbar.style.display = 'none';
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

    function showToast(msg, type = 'ok') {
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

    function showError(msg) {
        dom.loading.style.display = 'none';
        dom.contentWrap.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ef4444;">
                <div style="font-size: 3rem; margin-bottom: 12px;">⚠️</div>
                <h3 style="margin-bottom: 8px;">Не вдалося відкрити книгу</h3>
                <p style="color: var(--reader-text-muted); max-width: 480px; margin: 0 auto 16px;">${escapeHtml(msg)}</p>
                <a href="${bookParam.file}" target="_blank" class="btn-add-note" style="text-decoration: none; padding: 8px 16px;">
                    Відкрити файл напряму
                </a>
            </div>
        `;
    }

    // Start on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
