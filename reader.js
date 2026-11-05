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
    const rawId = (urlParams.get('id') || '').trim();
    const rawFile = (urlParams.get('file') || '').trim();
    const rawTitle = (urlParams.get('title') || '').trim();
    const rawAuthor = (urlParams.get('author') || '').trim();
    const bookParam = {
        id: rawId || (rawTitle ? rawTitle : 'book'),
        file: rawFile,
        title: rawTitle || 'Шахова книга',
        author: rawAuthor || '—',
        format: (urlParams.get('format') || 'pdf').toLowerCase(),
        startPage: parseInt(urlParams.get('page')) || 1
    };
    if (!rawId && rawTitle && window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) {
        const normT = rawTitle.normalize('NFC').toLowerCase();
        const found = window.CHESS_BOOKS_CACHE.find(b => b && b.title && b.title.normalize('NFC').toLowerCase() === normT);
        if (found && found.id) bookParam.id = found.id;
    }


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
        btnReaderSettings: document.getElementById('btn-reader-settings'),
        btnQuickNote: document.getElementById('btn-quick-note'),
        btnTopbarLocal: document.getElementById('btn-topbar-local'),
        settingsModal: document.getElementById('reader-settings-modal'),
        btnCloseSettings: document.getElementById('btn-close-settings'),
        btnDoneSettings: document.getElementById('btn-done-settings'),
        settingDockLeft: document.getElementById('setting-dock-left'),
        settingDockRight: document.getElementById('setting-dock-right'),
        settingEvalFull: document.getElementById('setting-eval-full'),
        settingEvalNumbers: document.getElementById('setting-eval-numbers'),
        settingEvalOff: document.getElementById('setting-eval-off'),
        settingArrowBest: document.getElementById('setting-arrow-best'),
        settingArrowThreat: document.getElementById('setting-arrow-threat'),
        settingBtnFullscreen: document.getElementById('setting-btn-fullscreen'),
        authGateModal: document.getElementById('reader-auth-gate-modal'),
        boardArrowsSvg: document.getElementById('board-arrows-svg'),
        boardArrowsGroup: document.getElementById('board-arrows-group'),
        boardEvalCompactScore: document.getElementById('board-eval-compact-score'),
        workspace: document.getElementById('reader-workspace'),
        viewport: document.getElementById('reader-viewport'),
        loading: document.getElementById('reader-loading'),
        loadingText: document.getElementById('loading-status-text'),
        downloadProgressWrap: document.getElementById('reader-download-progress-wrap'),
        downloadProgressFill: document.getElementById('reader-download-fill'),
        downloadProgressPercent: document.getElementById('reader-download-percent'),
        downloadProgressBytes: document.getElementById('reader-download-bytes'),
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
        // Zoom controls
        btnZoomOut: document.getElementById('btn-zoom-out'),
        labelZoomLevel: document.getElementById('label-zoom-level'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        settingZoomControl: document.getElementById('setting-zoom-control'),
        inputChessMoves: document.getElementById('input-chess-moves'),
        btnPasteMoves: document.getElementById('btn-paste-moves'),
        btnLoadMoves: document.getElementById('btn-load-moves'),
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
        djvuViewer: null,
        djvuViewerUnsub: null,
        djvuFallbackDoc: null,
        djvuFallbackCanvas: null,
        djvuFallbackOcrBody: null,
        djvuRenderToken: 0,
        resolvedCorsUrl: '',
        isHighlightActive: false,
        settings: {
            dockSide: localStorage.getItem('chess_vault_reader_dock_side') || 'right',
            evalMode: localStorage.getItem('chess_vault_reader_eval_mode') || 'full', // 'full' | 'numbers' | 'off'
            arrowBest: localStorage.getItem('chess_vault_reader_arrow_best') !== 'false',
            arrowThreat: localStorage.getItem('chess_vault_reader_arrow_threat') !== 'false'
        },
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
    // ⚡ REAL CHESS POSITION EVALUATION ENGINE (Eval Bar)
    // Evaluates current board advantage: White (+) vs Black (-)
    // ========================================================
    const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    const PAWN_PST = [
        0,  0,  0,  0,  0,  0,  0,  0,
       50, 50, 50, 50, 50, 50, 50, 50,
       10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ];

    const KNIGHT_PST = [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ];

    const BISHOP_PST = [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ];

    const ROOK_PST = [
        0,  0,  0,  0,  0,  0,  0,  0,
        5, 10, 10, 10, 10, 10, 10,  5,
       -5,  0,  0,  0,  0,  0,  0, -5,
       -5,  0,  0,  0,  0,  0,  0, -5,
       -5,  0,  0,  0,  0,  0,  0, -5,
       -5,  0,  0,  0,  0,  0,  0, -5,
       -5,  0,  0,  0,  0,  0,  0, -5,
        0,  0,  0,  5,  5,  0,  0,  0
    ];

    const QUEEN_PST = [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ];

    const KING_PST = [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       20, 20,  0,  0,  0,  0, 20, 20,
       20, 30, 10,  0,  0, 10, 30, 20
    ];

    // ========================================================
    // ⚡ REAL STOCKFISH CHESS ENGINE INTEGRATION (Worker + PST Fallback)
    // ========================================================
    let stockfishWorker = null;
    let stockfishReady = false;
    let lastEvaluatedFEN = null;
    const stockfishState = {
        depth: 0,
        scoreCp: 0,
        scoreMate: null,
        textScore: '0.0',
        whitePercent: 50,
        pvSan: '',
        bestMove: null
    };

    function initStockfish() {
        if (typeof Worker === 'undefined') {
            console.warn('Web Workers not supported, falling back to built-in evaluation.');
            return;
        }
        try {
            stockfishWorker = new Worker('stockfish.js');
            stockfishWorker.onmessage = (event) => {
                const line = typeof event.data === 'string' ? event.data : '';
                if (line === 'readyok' || line.includes('Stockfish')) {
                    stockfishReady = true;
                    requestStockfishEval();
                } else if (line.startsWith('info ') && (line.includes('score cp') || line.includes('score mate'))) {
                    parseStockfishInfo(line);
                } else if (line.startsWith('bestmove ')) {
                    const parts = line.split(/\s+/);
                    const uci = parts[1];
                    if (uci && uci.length >= 4) {
                        stockfishState.bestMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
                        updateBoardArrows();
                    }
                }
            };
            stockfishWorker.postMessage('uci');
            stockfishWorker.postMessage('ucinewgame');
            stockfishWorker.postMessage('isready');
        } catch (err) {
            console.warn('Stockfish Worker init error:', err);
        }
    }

    function requestStockfishEval() {
        if (!chessState.game) return;
        const currentFen = chessState.game.fen();
        if (currentFen === lastEvaluatedFEN) return;
        lastEvaluatedFEN = currentFen;

        stockfishState.depth = 0;
        stockfishState.pvSan = '';

        if (stockfishWorker) {
            stockfishWorker.postMessage('stop');
            stockfishWorker.postMessage('position fen ' + currentFen);
            stockfishWorker.postMessage('go depth 14');
        } else {
            updateEvalBarUI();
            updateBoardArrows();
        }
    }

    function parseStockfishInfo(line) {
        if (!chessState.game) return;

        const depthMatch = line.match(/\bdepth\s+(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        if (depth < stockfishState.depth && depth < 8) return;
        stockfishState.depth = depth;

        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const turn = chessState.game.turn();

        let textScore = '0.0';
        let whitePercent = 50;
        let evalPawns = 0;

        if (mateMatch) {
            const m = parseInt(mateMatch[1], 10);
            stockfishState.scoreMate = m;
            const absM = Math.abs(m);
            if (turn === 'w') {
                textScore = m > 0 ? `+M${absM}` : `-M${absM}`;
                whitePercent = m > 0 ? 100 : 0;
                evalPawns = m > 0 ? 999 : -999;
            } else {
                textScore = m > 0 ? `-M${absM}` : `+M${absM}`;
                whitePercent = m > 0 ? 0 : 100;
                evalPawns = m > 0 ? -999 : 999;
            }
        } else if (cpMatch) {
            stockfishState.scoreMate = null;
            let cp = parseInt(cpMatch[1], 10);
            if (turn === 'b') cp = -cp;
            stockfishState.scoreCp = cp;
            evalPawns = cp / 100;
            if (Math.abs(evalPawns) < 0.05) {
                textScore = '0.0';
            } else if (evalPawns > 0) {
                textScore = `+${evalPawns.toFixed(1)}`;
            } else {
                textScore = `${evalPawns.toFixed(1)}`;
            }
            const winProb = 1 / (1 + Math.pow(10, -evalPawns / 4));
            whitePercent = Math.min(95, Math.max(5, Math.round(winProb * 100)));
        }

        stockfishState.textScore = textScore;
        stockfishState.whitePercent = whitePercent;

        // Parse PV and format into readable SAN notation like Lichess
        const pvIdx = line.indexOf(' pv ');
        if (pvIdx !== -1) {
            const pvStr = line.slice(pvIdx + 4).trim();
            const uciMoves = pvStr.split(/\s+/).slice(0, 8);
            if (uciMoves.length > 0) {
                const first = uciMoves[0];
                if (first.length >= 4) {
                    stockfishState.bestMove = { from: first.slice(0, 2), to: first.slice(2, 4) };
                }

                try {
                    const tempGame = new Chess(chessState.game.fen());
                    const sanMoves = [];
                    for (let i = 0; i < uciMoves.length; i++) {
                        const u = uciMoves[i];
                        if (u.length < 4) break;
                        const from = u.slice(0, 2);
                        const to = u.slice(2, 4);
                        const promotion = u.length > 4 ? u[4] : undefined;
                        const moveTurn = tempGame.turn();
                        const fullMoveNum = Math.floor(tempGame.history().length / 2) + 1;
                        const moveObj = tempGame.move({ from, to, promotion });
                        if (!moveObj) break;

                        if (moveTurn === 'w' || sanMoves.length === 0) {
                            sanMoves.push(`${fullMoveNum}.${moveTurn === 'b' ? '..' : ''} ${moveObj.san}`);
                        } else {
                            sanMoves.push(moveObj.san);
                        }
                    }
                    stockfishState.pvSan = sanMoves.join(' ');
                } catch (_) {
                    stockfishState.pvSan = uciMoves.join(' ');
                }
            }
        }

        renderStockfishUI();
    }

    function renderStockfishUI() {
        updateEvalBarUI();
        updateBoardArrows();
    }

    function evaluateCurrentBoardPosition() {
        if (stockfishState && stockfishState.depth > 0) {
            return {
                evalScore: stockfishState.scoreCp / 100,
                textScore: stockfishState.textScore,
                whitePercent: stockfishState.whitePercent
            };
        }

        if (!chessState.game) return { evalScore: 0, textScore: '0.0', whitePercent: 50 };

        if (chessState.game.in_checkmate && chessState.game.in_checkmate()) {
            const turn = chessState.game.turn();
            if (turn === 'w') {
                return { evalScore: -999, textScore: '-M', whitePercent: 0 };
            } else {
                return { evalScore: 999, textScore: '+M', whitePercent: 100 };
            }
        }

        if (chessState.game.in_draw && chessState.game.in_draw()) {
            return { evalScore: 0, textScore: '0.0', whitePercent: 50 };
        }

        const board = chessState.game.board();
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = board[r][f];
                if (!piece) continue;

                const t = piece.type.toLowerCase();
                const val = PIECE_VALS[t] || 0;
                let pstVal = 0;

                if (t === 'p') pstVal = PAWN_PST[r * 8 + f];
                else if (t === 'n') pstVal = KNIGHT_PST[r * 8 + f];
                else if (t === 'b') pstVal = BISHOP_PST[r * 8 + f];
                else if (t === 'r') pstVal = ROOK_PST[r * 8 + f];
                else if (t === 'q') pstVal = QUEEN_PST[r * 8 + f];
                else if (t === 'k') pstVal = KING_PST[r * 8 + f];

                if (piece.color === 'w') {
                    score += (val + pstVal);
                } else {
                    let blackPst = 0;
                    const br = 7 - r;
                    if (t === 'p') blackPst = PAWN_PST[br * 8 + f];
                    else if (t === 'n') blackPst = KNIGHT_PST[br * 8 + f];
                    else if (t === 'b') blackPst = BISHOP_PST[br * 8 + f];
                    else if (t === 'r') blackPst = ROOK_PST[br * 8 + f];
                    else if (t === 'q') blackPst = QUEEN_PST[br * 8 + f];
                    else if (t === 'k') blackPst = KING_PST[br * 8 + f];
                    score -= (val + blackPst);
                }
            }
        }

        const evalPawns = score / 100;
        let textScore = '0.0';
        if (Math.abs(evalPawns) < 0.05) {
            textScore = '0.0';
        } else if (evalPawns > 0) {
            textScore = `+${evalPawns.toFixed(1)}`;
        } else {
            textScore = `${evalPawns.toFixed(1)}`;
        }

        const winProb = 1 / (1 + Math.pow(10, -evalPawns / 4));
        const whitePercent = Math.min(95, Math.max(5, Math.round(winProb * 100)));

        return { evalScore: evalPawns, textScore, whitePercent };
    }

    function updateEvalBarUI() {
        const evalWrap = document.getElementById('board-eval-wrap');
        const fillWhite = document.getElementById('board-eval-fill-white');
        const fillBlack = document.getElementById('board-eval-fill-black');
        const scoreWhite = document.getElementById('board-eval-score-white');
        const scoreBlack = document.getElementById('board-eval-score-black');
        const compactScore = dom.boardEvalCompactScore;

        const { evalScore, textScore, whitePercent } = evaluateCurrentBoardPosition();

        if (compactScore) {
            compactScore.textContent = textScore;
            if (evalScore > 0.05) compactScore.style.color = '#22c55e';
            else if (evalScore < -0.05) compactScore.style.color = '#ef4444';
            else compactScore.style.color = 'var(--reader-text)';
        }

        const mode = state.settings.evalMode || 'full';
        if (mode === 'off') {
            if (evalWrap) evalWrap.classList.add('is-hidden');
            if (compactScore) compactScore.style.display = 'none';
            return;
        } else if (mode === 'numbers') {
            if (evalWrap) evalWrap.classList.add('is-hidden');
            if (compactScore) compactScore.style.display = 'inline-flex';
            return;
        }

        if (compactScore) compactScore.style.display = 'none';
        if (!evalWrap || !fillWhite || !fillBlack) return;
        evalWrap.classList.remove('is-hidden');

        const isFlipped = chessState.boardFlipped;
        const bottomPercent = isFlipped ? (100 - whitePercent) : whitePercent;
        const topPercent = 100 - bottomPercent;

        if (isFlipped) {
            fillBlack.style.height = `${bottomPercent}%`;
            fillWhite.style.height = `${topPercent}%`;
            fillBlack.style.order = '2';
            fillWhite.style.order = '1';
        } else {
            fillWhite.style.height = `${bottomPercent}%`;
            fillBlack.style.height = `${topPercent}%`;
            fillWhite.style.order = '2';
            fillBlack.style.order = '1';
        }

        if (evalScore >= 0) {
            if (scoreWhite) scoreWhite.textContent = textScore;
            if (scoreBlack) scoreBlack.textContent = '';
        } else {
            if (scoreBlack) scoreBlack.textContent = textScore;
            if (scoreWhite) scoreWhite.textContent = '';
        }
    }

    function initChessEvalBar() {
        initStockfish();
        updateEvalBarUI();
    }

    // ========================================================
    // ⚡ CHESS ARROWS & ENGINE SUGGESTIONS (Best Move & Threat)
    // ========================================================
    function evaluateGameScore(game) {
        if (!game) return 0;
        const board = game.board();
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = board[r][f];
                if (!piece) continue;
                const val = PIECE_VALS[piece.type] || 0;
                const t = piece.type;
                if (piece.color === 'w') {
                    const wr = 7 - r;
                    let pst = 0;
                    if (t === 'p') pst = PAWN_PST[wr * 8 + f];
                    else if (t === 'n') pst = KNIGHT_PST[wr * 8 + f];
                    else if (t === 'b') pst = BISHOP_PST[wr * 8 + f];
                    else if (t === 'r') pst = ROOK_PST[wr * 8 + f];
                    else if (t === 'q') pst = QUEEN_PST[wr * 8 + f];
                    else if (t === 'k') pst = KING_PST[wr * 8 + f];
                    score += (val + pst);
                } else {
                    const br = r;
                    let pst = 0;
                    if (t === 'p') pst = PAWN_PST[br * 8 + f];
                    else if (t === 'n') pst = KNIGHT_PST[br * 8 + f];
                    else if (t === 'b') pst = BISHOP_PST[br * 8 + f];
                    else if (t === 'r') pst = ROOK_PST[br * 8 + f];
                    else if (t === 'q') pst = QUEEN_PST[br * 8 + f];
                    else if (t === 'k') pst = KING_PST[br * 8 + f];
                    score -= (val + pst);
                }
            }
        }
        return score / 100;
    }

    function findBestMove(game) {
        if (!game || game.game_over()) return null;
        const moves = game.moves({ verbose: true });
        if (!moves || moves.length === 0) return null;

        const isWhite = game.turn() === 'w';
        let bestScore = isWhite ? -Infinity : Infinity;
        let bestMove = moves[0];

        for (const m of moves) {
            game.move(m);
            const score = evaluateGameScore(game);
            game.undo();

            if (isWhite) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = m;
                }
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMove = m;
                }
            }
        }
        return bestMove;
    }

    function findOpponentThreat(game) {
        if (!game || game.game_over()) return null;
        try {
            const currentScore = evaluateGameScore(game);
            const fen = game.fen();
            const parts = fen.split(' ');
            const oppColor = parts[1] === 'w' ? 'b' : 'w';
            parts[1] = oppColor;
            parts[3] = '-'; // скидаємо бите поле
            const sim = new Chess();
            if (!sim.load(parts.join(' '))) return null;

            const oppMoves = sim.moves({ verbose: true });
            if (!oppMoves || oppMoves.length === 0) return null;

            const isOppWhite = oppColor === 'w';
            let bestOppScore = isOppWhite ? -Infinity : Infinity;
            let threatMove = null;
            let givesCheck = false;

            for (const m of oppMoves) {
                sim.move(m);
                const score = evaluateGameScore(sim);
                const isCheck = typeof sim.in_check === 'function' ? sim.in_check() : false;
                sim.undo();

                if (isOppWhite) {
                    if (score > bestOppScore) {
                        bestOppScore = score;
                        threatMove = m;
                        givesCheck = isCheck;
                    }
                } else {
                    if (score < bestOppScore) {
                        bestOppScore = score;
                        threatMove = m;
                        givesCheck = isCheck;
                    }
                }
            }

            if (!threatMove) return null;

            // ОСТОРОЖНА СТРІЛКА ЗАГРОЗИ:
            // Показуємо загрозу ТІЛЬКИ коли дійсно є небезпека або сильний тактичний удар:
            // 1) Взяття фігури (threatMove.captured)
            // 2) Шах королю (givesCheck)
            // 3) Або значний тактичний стрибок оцінки на користь суперника (> 0.8 пішака)
            const evalDiff = isOppWhite ? (bestOppScore - currentScore) : (currentScore - bestOppScore);
            const isTacticalThreat = Boolean(threatMove.captured) || givesCheck || (evalDiff >= 0.8);
            if (!isTacticalThreat) return null;

            return threatMove;
        } catch (_) {
            return null;
        }
    }

    function squareToSvgCoords(square, flipped) {
        const f = square.charCodeAt(0) - 97;
        const r = parseInt(square[1], 10) - 1;
        let x, y;
        if (flipped) {
            x = (7 - f) * 100 + 50;
            y = r * 100 + 50;
        } else {
            x = f * 100 + 50;
            y = (7 - r) * 100 + 50;
        }
        return { x, y };
    }

    function updateBoardArrows() {
        if (!dom.boardArrowsGroup) return;
        dom.boardArrowsGroup.innerHTML = '';
        if (!chessState.game) return;

        const flipped = chessState.boardFlipped;

        // 1. Зелена стрілка найкращого ходу (Stockfish або PST)
        if (state.settings.arrowBest) {
            const best = (stockfishState && stockfishState.bestMove) || findBestMove(chessState.game);
            if (best) {
                const p1 = squareToSvgCoords(best.from, flipped);
                const p2 = squareToSvgCoords(best.to, flipped);
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 15) {
                    const startX = p1.x + (dx / dist) * 18;
                    const startY = p1.y + (dy / dist) * 18;
                    const endX = p2.x - (dx / dist) * 20;
                    const endY = p2.y - (dy / dist) * 20;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', startX);
                    line.setAttribute('y1', startY);
                    line.setAttribute('x2', endX);
                    line.setAttribute('y2', endY);
                    line.setAttribute('class', 'board-arrow-line arrow-best');
                    line.setAttribute('marker-end', 'url(#arrow-head-best)');
                    dom.boardArrowsGroup.appendChild(line);
                }
            }
        }

        // 2. Червона стрілка загрози суперника (обережна, показує тільки реальні небезпеки)
        if (state.settings.arrowThreat) {
            const threat = findOpponentThreat(chessState.game);
            if (threat) {
                const p1 = squareToSvgCoords(threat.from, flipped);
                const p2 = squareToSvgCoords(threat.to, flipped);
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 15) {
                    const startX = p1.x + (dx / dist) * 18;
                    const startY = p1.y + (dy / dist) * 18;
                    const endX = p2.x - (dx / dist) * 20;
                    const endY = p2.y - (dy / dist) * 20;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', startX);
                    line.setAttribute('y1', startY);
                    line.setAttribute('x2', endX);
                    line.setAttribute('y2', endY);
                    line.setAttribute('class', 'board-arrow-line arrow-threat');
                    line.setAttribute('marker-end', 'url(#arrow-head-threat)');
                    dom.boardArrowsGroup.appendChild(line);
                }
            }
        }
    }

    // ========================================================
    // 2. INITIALIZATION
    // ========================================================
    function resolveTotalPages() {
        let pages = parseInt(urlParams.get('pages')) || 0;
        const cleanTitle = (bookParam.title || '').toLowerCase().replace(/\.[^/.]+$/, '').trim();
        const cleanId = (bookParam.id || '').toLowerCase().replace(/\.[^/.]+$/, '').trim();

        if (!pages && window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) {
            const found = window.CHESS_BOOKS_CACHE.find(b => {
                if (!b) return false;
                if (b.id && (b.id.toLowerCase() === cleanId || b.id.toLowerCase().includes(cleanId))) return true;
                const bt = (b.title || '').toLowerCase().replace(/\.[^/.]+$/, '').trim();
                return bt && cleanTitle && (bt === cleanTitle || bt.includes(cleanTitle) || cleanTitle.includes(bt));
            });
            if (found && found.pages) pages = parseInt(found.pages) || 0;
        }

        if (!pages && window.CHESS_PAGE_COUNTS) {
            const id = bookParam.id;
            const title = bookParam.title;
            if (window.CHESS_PAGE_COUNTS[id]) pages = window.CHESS_PAGE_COUNTS[id];
            else if (window.CHESS_PAGE_COUNTS[id.toLowerCase()]) pages = window.CHESS_PAGE_COUNTS[id.toLowerCase()];
            else if (title && window.CHESS_PAGE_COUNTS[title]) pages = window.CHESS_PAGE_COUNTS[title];
            else if (title && window.CHESS_PAGE_COUNTS[title.toLowerCase()]) pages = window.CHESS_PAGE_COUNTS[title.toLowerCase()];
            else {
                for (const [k, count] of Object.entries(window.CHESS_PAGE_COUNTS)) {
                    const normK = k.toLowerCase().replace(/\.[^/.]+$/, '').trim();
                    if ((cleanTitle && (normK.includes(cleanTitle) || cleanTitle.includes(normK))) ||
                        (cleanId && (normK.includes(cleanId) || cleanId.includes(normK)))) {
                        pages = count;
                        break;
                    }
                }
            }
        }
        return pages > 0 ? pages : 100;
    }

    function init() {
        document.title = `${bookParam.title} — Онлайн Читалка | Chess Vault`;
        dom.topbarTitle.textContent = bookParam.title;
        dom.topbarAuthor.textContent = bookParam.author;

        state.totalPages = resolveTotalPages();
        if (dom.labelTotalPages) dom.labelTotalPages.textContent = state.totalPages;
        if (dom.inputCurrentPage) dom.inputCurrentPage.max = state.totalPages;
        updatePageUI();

        applyDockSide(state.settings.dockSide);
        applyDockCollapsed(state.isDockCollapsed);

        initChessGame();
        initChessEvalBar();

        // 1. Спочатку завантажуємо локальний стан воркспейсу юзера для цієї книги
        loadUserBookWorkspace();

        // 2. Перевірка авторизації (читання дозволено тільки зареєстрованим юзерам)
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                state.currentUser = user;
                if (user) {
                    if (dom.authGateModal) dom.authGateModal.style.display = 'none';
                    // Миттєво завантажуємо збережені закладки та прогрес з LocalStorage для цього юзера!
                    loadUserBookWorkspace(user.uid);
                    // Потім синхронізуємо з хмарою Firestore
                    loadUserBookWorkspaceFromFirestore(user.uid);
                } else {
                    if (dom.authGateModal) dom.authGateModal.style.display = 'flex';
                }
            });
        }

        bindEvents();
        loadDocument();
    }

    // ========================================================
    // 2.5 INDEXEDDB USER BOOK CACHE ENGINE (Offline & Personal Copy)
    // ========================================================
    const IDB_NAME = 'ChessVault_UserBooksDB';
    const IDB_VERSION = 1;
    const IDB_STORE = 'user_books';

    function openBooksDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getCachedBookBlob(bookId, uid) {
        try {
            const db = await openBooksDB();
            const userKey = `book_${uid || 'guest'}_${bookId}`;
            const guestKey = `book_guest_${bookId}`;
            const rawKey = `book_${bookId}`;

            return new Promise((resolve) => {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const req = store.get(userKey);
                req.onsuccess = () => {
                    if (req.result && req.result.blob) {
                        resolve(req.result.blob);
                        return;
                    }
                    const reqGuest = store.get(guestKey);
                    reqGuest.onsuccess = () => {
                        if (reqGuest.result && reqGuest.result.blob) {
                            resolve(reqGuest.result.blob);
                            return;
                        }
                        const reqRaw = store.get(rawKey);
                        reqRaw.onsuccess = () => {
                            resolve(reqRaw.result ? reqRaw.result.blob : null);
                        };
                        reqRaw.onerror = () => resolve(null);
                    };
                    reqGuest.onerror = () => resolve(null);
                };
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            console.warn('IndexedDB read error:', e);
            return null;
        }
    }

    async function saveCachedBookBlob(bookId, uid, blob, meta = {}) {
        if (!blob) return;
        try {
            const db = await openBooksDB();
            const userKey = `book_${uid || 'guest'}_${bookId}`;
            const rawKey = `book_${bookId}`;
            const record = {
                key: userKey,
                bookId,
                uid: uid || 'guest',
                format: meta.format || bookParam.format,
                title: meta.title || bookParam.title,
                size: blob.size,
                savedAt: Date.now(),
                blob
            };

            return new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                store.put(record);
                store.put({ ...record, key: rawKey });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('IndexedDB write error:', e);
        }
    }

    async function deleteCachedBookBlob(bookId, uid) {
        try {
            const db = await openBooksDB();
            const userKey = `book_${uid || 'guest'}_${bookId}`;
            const guestKey = `book_guest_${bookId}`;
            const rawKey = `book_${bookId}`;
            return new Promise((resolve) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                try { store.delete(userKey); } catch (_) {}
                try { store.delete(guestKey); } catch (_) {}
                try { store.delete(rawKey); } catch (_) {}
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (_) {
            return false;
        }
    }

    // ========================================================
    // ARCHIVE.ORG URL HELPERS
    // --------------------------------------------------------
    // archive.org/download/... НЕ віддає CORS-заголовків, тому fetch() з браузера
    // падає (TypeError: Failed to fetch). Через це DjVu/DOC/PDF-перевірка ніколи
    // не працювали. Офіційний CORS-ендпоінт archive.org: /cors/{item}/{file}.
    // ========================================================
    const ARCHIVE_DOWNLOAD_RE = /^https?:\/\/(?:www\.)?archive\.org\/(?:download|cors)\/([^/?#]+)\/([^?#]+)/i;
    const ARCHIVE_NODE_RE = /^https?:\/\/ia\d+\.us\.archive\.org\/\d+\/items\/([^/?#]+)\/([^?#]+)/i;

    function parseArchiveUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const m = url.match(ARCHIVE_DOWNLOAD_RE) || url.match(ARCHIVE_NODE_RE);
        return m ? { item: m[1], path: m[2] } : null;
    }

    // URL для fetch() (з CORS-заголовками)
    function toCorsUrl(url) {
        const p = parseArchiveUrl(url);
        return p ? `https://archive.org/cors/${p.item}/${p.path}` : url;
    }

    // URL для iframe / прямого посилання (браузерний переглядач, без CORS)
    function toDirectUrl(url) {
        const p = parseArchiveUrl(url);
        return p ? `https://archive.org/download/${p.item}/${p.path}` : url;
    }

    function normalizeFormat(fmt) {
        const f = String(fmt || '').toLowerCase().replace(/^\./, '').trim();
        if (f === 'djv') return 'djvu';
        return f;
    }

    function getDirectFileUrl() {
        return state.resolvedDirectUrl || toDirectUrl(bookParam.file) || '';
    }

    function getDjVuBaseUrl() {
        const src = state.resolvedCorsUrl || (bookParam.file ? toCorsUrl(bookParam.file) : '');
        if (!src || src.startsWith('blob:') || src.startsWith('data:')) return null;
        const idx = src.lastIndexOf('/');
        return idx > 8 ? src.slice(0, idx + 1) : null;
    }

    function sniffArrayBufferFormat(buf, fallback) {
        try {
            const u8 = new Uint8Array(buf, 0, Math.min(64, buf.byteLength));
            if (u8.length < 4) return fallback;
            const ascii = String.fromCharCode(...u8);
            if (ascii.startsWith('%PDF')) return 'pdf';
            if (ascii.startsWith('AT&T') || ascii.includes('AT&TFORM')) return 'djvu';
            if (ascii.startsWith('FORM') && u8.length >= 12) {
                const sub = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
                if (sub === 'DJVM' || sub === 'DJVU') return 'djvu';
            }
            if (u8[0] === 0x50 && u8[1] === 0x4B) return 'docx';
            if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) return 'doc';
            const trimmed = ascii.trimStart().toLowerCase();
            if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
                return 'html_error';
            }
        } catch (_) {}
        return fallback;
    }

    // Визначає реальний формат файлу за сигнатурою (magic bytes)
    async function sniffBlobFormat(blob, fallback) {
        try {
            const sliceBuf = await blob.slice(0, 64).arrayBuffer();
            return sniffArrayBufferFormat(sliceBuf, fallback);
        } catch (_) {
            return fallback;
        }
    }

    async function isValidCachedBlobForFormat(blob, expectedFormat) {
        if (!blob || blob.size < 64) return false;
        try {
            const sliceBuf = await blob.slice(0, 64).arrayBuffer();
            const detected = sniffArrayBufferFormat(sliceBuf, '');
            if (detected === 'html_error') return false;
            const fmt = normalizeFormat(expectedFormat);
            if (fmt === 'djvu') return detected === 'djvu';
            if (fmt === 'pdf') return detected === 'pdf';
            if (fmt === 'docx') return detected === 'docx';
            if (fmt === 'doc') return detected === 'doc' || detected === 'docx';
            return true;
        } catch (_) {
            return false;
        }
    }

    // Приводить буфер DjVu до канонічного заголовка AT&TFORM...
    function normalizeDjVuBuffer(arrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength < 16) {
            throw new Error('Файл порожній або занадто малий для DjVu');
        }
        const u8 = new Uint8Array(arrayBuffer);
        const head = String.fromCharCode(...u8.subarray(0, Math.min(64, u8.length)));
        if (head.startsWith('AT&TFORM')) {
            return arrayBuffer;
        }
        // Деякі DjVu-файли починаються одразу з IFF85 "FORM....DJVM" / "FORM....DJVU" без 4-байтного префікса "AT&T"
        if (head.startsWith('FORM')) {
            const sub = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
            if (sub === 'DJVM' || sub === 'DJVU') {
                const merged = new Uint8Array(u8.byteLength + 4);
                merged[0] = 0x41; // A
                merged[1] = 0x54; // T
                merged[2] = 0x26; // &
                merged[3] = 0x54; // T
                merged.set(u8, 4);
                return merged.buffer;
            }
        }
        // Якщо є кілька службових байтів перед AT&TFORM
        const idx = head.indexOf('AT&TFORM');
        if (idx > 0) {
            return arrayBuffer.slice(idx);
        }
        throw new Error('Файл не має коректної сигнатури DjVu (AT&TFORM)');
    }

    function loadScriptDynamic(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
    }

    async function ensureDjVuLibraryLoaded() {
        if (typeof DjVu !== 'undefined' && (DjVu.Viewer || DjVu.Document)) return true;
        const fallbacks = [
            ['vendor/djvu.js?v=2', 'vendor/djvu_viewer.js?v=2'],
            ['https://djvu.js.org/assets/dist/djvu.js', 'https://djvu.js.org/assets/dist/djvu_viewer.js']
        ];
        for (const [coreSrc, viewerSrc] of fallbacks) {
            try {
                if (typeof DjVu === 'undefined') await loadScriptDynamic(coreSrc);
                if (typeof DjVu !== 'undefined' && !DjVu.Viewer) {
                    await loadScriptDynamic(viewerSrc).catch(() => {});
                }
                if (typeof DjVu !== 'undefined' && (DjVu.Viewer || DjVu.Document)) return true;
            } catch (_) {}
        }
        return typeof DjVu !== 'undefined' && Boolean(DjVu.Viewer || DjVu.Document);
    }

    function getPdfWorkerUrl() {
        if (window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
            return 'vendor/pdf.worker.min.js?v=1';
        }
        return 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    async function ensurePdfJsLibraryLoaded() {
        if (typeof pdfjsLib !== 'undefined' && typeof pdfjsLib.getDocument === 'function') return true;
        const sources = [
            'vendor/pdf.min.js?v=1',
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        ];
        for (const src of sources) {
            try {
                if (typeof pdfjsLib === 'undefined') await loadScriptDynamic(src);
                if (typeof pdfjsLib !== 'undefined' && typeof pdfjsLib.getDocument === 'function') return true;
            } catch (_) {}
        }
        return typeof pdfjsLib !== 'undefined' && typeof pdfjsLib.getDocument === 'function';
    }

    // Перевіряє, що файл існує (через CORS-ендпоінт), не завантажуючи його повністю
    async function probeUrl(url, timeoutMs = 15000) {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
        try {
            const res = await fetch(url, { mode: 'cors', signal: ctrl ? ctrl.signal : undefined });
            const type = (res.headers.get('content-type') || '').toLowerCase();
            const ok = res.ok && !type.startsWith('text/html');
            if (ctrl) ctrl.abort(); // нам потрібні тільки заголовки
            return ok;
        } catch (_) {
            return false;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function downloadBookWithProgress(urls, onProgress, format) {
        if (!Array.isArray(urls)) urls = [urls];
        const fmt = normalizeFormat(format || bookParam.format);
        let lastError = null;

        for (const rawUrl of urls) {
            if (!rawUrl) continue;
            const url = toCorsUrl(rawUrl);
            try {
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const type = (response.headers.get('content-type') || '').toLowerCase();
                if (type.startsWith('text/html')) {
                    throw new Error('Отримано HTML-сторінку замість файлу книги');
                }

                const contentLength = response.headers.get('content-length');
                const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                const chunks = [];
                let receivedBytes = 0;

                if (response.body && response.body.getReader) {
                    const reader = response.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        receivedBytes += value.length;
                        if (typeof onProgress === 'function') {
                            onProgress(receivedBytes, totalBytes);
                        }
                    }
                } else {
                    const buf = await response.arrayBuffer();
                    chunks.push(new Uint8Array(buf));
                    receivedBytes = buf.byteLength;
                    if (typeof onProgress === 'function') onProgress(receivedBytes, receivedBytes);
                }

                let mime = 'application/pdf';
                if (fmt === 'djvu') mime = 'image/vnd.djvu';
                else if (fmt === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (fmt === 'doc') mime = 'application/msword';
                else if (fmt === 'txt') mime = 'text/plain';

                state.resolvedCorsUrl = url;
                state.resolvedDirectUrl = toDirectUrl(rawUrl);
                return new Blob(chunks, { type: mime });
            } catch (err) {
                console.warn(`Download attempt failed for ${url}:`, err);
                lastError = err;
            }
        }
        throw lastError || new Error('Не вдалося завантажити книгу');
    }

    function showDownloadProgress(received, total) {
        if (total > 0) {
            const pct = Math.min(100, Math.round((received / total) * 100));
            if (dom.downloadProgressFill) dom.downloadProgressFill.style.width = `${pct}%`;
            if (dom.downloadProgressPercent) dom.downloadProgressPercent.textContent = `${pct}%`;
            const rMB = (received / (1024 * 1024)).toFixed(1);
            const tMB = (total / (1024 * 1024)).toFixed(1);
            if (dom.downloadProgressBytes) dom.downloadProgressBytes.textContent = `${rMB} / ${tMB} MB`;
        } else {
            const rMB = (received / (1024 * 1024)).toFixed(1);
            if (dom.downloadProgressBytes) dom.downloadProgressBytes.textContent = `${rMB} MB завантажено`;
            if (dom.downloadProgressFill) dom.downloadProgressFill.style.width = '70%';
        }
    }

    // ========================================================
    // 3. DOCUMENT LOADERS (PDF, DjVu, DOC/DOCX, TXT + Local Drag & Drop)
    // ========================================================
    async function loadDocument() {
        const cleanId = (bookParam.id || '').replace(/\.[^/.]+$/, '').trim();
        const fullId = (bookParam.id || '').trim();

        // Пошук у кеші бібліотеки (books-cache.js) — порівнюємо з урахуванням NFC/NFD, перейменувань та аліасів
        const nfcLower = (s) => String(s || '').normalize('NFC').toLowerCase().trim();
        const slugifyKey = (s, keepYear = true) => {
            if (!s) return '';
            let t = nfcLower(s).replace(/\.[^/.]+$/, '').replace(/ё/g, 'е');
            if (!keepYear) t = t.replace(/\b(18|19|20)\d{2}\b/g, '');
            return t.replace(/[^a-zа-яіїєґ0-9]+/g, '');
        };
        const LEGACY_ALIASES = {
            '2005_kasparov_mgp_vol_1_rus.djvu': 'Каспаров--MGP-1,от Стейница до Алёхина,2005.djvu',
            '2005_kasparov_mgp_vol_2_rus.djvu': 'Каспаров--MGP-2.от Эйве до Таля,2005.djvu',
            '2005_kasparov_mgp_vol_3_rus.djvu': 'Каспаров--MGP-3,от Петросяна до Спасского,2005.djvu',
            '2005_kasparov_mgp_vol_4_rus.djvu': 'Каспаров--MGP-4.Фишер и звёзды запада,2005.djvu',
            '2006_kasparov_mgp_vol_5_rus.djvu': 'Каспаров--MGP-5. Карпов и Корчной,2006.djvu',
            'kasparovcml.pdf': 'Каспаров - Шахматы как Модель Жизни, 2007.pdf',
            'endgame_troitzky_500': 'Троицкий - Сборник шахматных этюдов,1935.djvu',
            'endgame_panchenko_theory': 'Панченко - Теория и практика шахматных окончаний - 2006.djvu',
            'endgame_ece_vol1': 'Энциклопедия шахматных окончаний,1982.djvu',
            'endgame_ece_vol2': 'Энциклопедия шахматных окончаний,1985.djvu',
            'endgame_ece_vol4': 'Энциклопедия Шахматных Окончаний-4.Ферзевые, 1989.djvu',
            'endgame_nunn_secrets_pawns': 'endgame_muller_secrets_pawns'
        };
        let cachedBook = null;
        if (window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) {
            const rawIdN = nfcLower(fullId);
            const idN = LEGACY_ALIASES[rawIdN] ? nfcLower(LEGACY_ALIASES[rawIdN]) : rawIdN;
            const cleanN = nfcLower(cleanId);
            const titleN = nfcLower(bookParam.title);
            const slugFull = slugifyKey(idN, true);
            const slugNy = slugifyKey(idN, false);
            cachedBook = window.CHESS_BOOKS_CACHE.find(x => x && x.id && nfcLower(x.id) === idN)
                || window.CHESS_BOOKS_CACHE.find(x => x && x.id && nfcLower(x.id.replace(/\.[^/.]+$/, '')) === cleanN)
                || (slugFull ? window.CHESS_BOOKS_CACHE.find(x => x && x.id && slugifyKey(x.id, true) === slugFull) : null)
                || (titleN && titleN !== rawIdN ? window.CHESS_BOOKS_CACHE.find(x => x && x.title && nfcLower(x.title) === titleN) : null)
                || (slugNy.length >= 12 ? window.CHESS_BOOKS_CACHE.find(x => x && x.id && slugifyKey(x.id, false) === slugNy) : null)
                || null;
        }

        // Визначаємо формат: явний параметр → кеш → розширення файлу
        let format = normalizeFormat(urlParams.get('format'));
        if (!format || format === '---') {
            format = normalizeFormat(cachedBook && cachedBook.format);
        }
        if (!format || format === '---') {
            const src = (cachedBook && (cachedBook.id || cachedBook.url)) || bookParam.file || bookParam.id || '';
            format = normalizeFormat(decodeURIComponent(src.split('?')[0]).split('.').pop());
        }
        if (!format || format.length > 5) format = 'pdf';
        bookParam.format = format;

        if (dom.dropBar) dom.dropBar.style.display = 'flex';

        // Прямий режим відкриття локального файлу (reader.html?local=1)
        if (urlParams.get('local') === '1' && !rawId && !rawFile) {
            showDocError('Оберіть файл книги (.djvu, .pdf, .doc, .docx, .txt) з вашого комп’ютера або просто перетягніть його у це вікно.');
            return;
        }

        const uid = state.currentUser ? state.currentUser.uid : 'guest';

        // 1. ПЕРЕВІРЯЄМО ОСОБИСТУ КОПІЮ В INDEXEDDB (миттєве офлайн-відкриття з перевіркою цілісності)
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Пошук персональної копії книги...`;

        try {
            const cachedBlob = await getCachedBookBlob(bookParam.id, uid);
            if (cachedBlob && cachedBlob.size > 1024) {
                const cachedFormat = await sniffBlobFormat(cachedBlob, format);
                const validCache = await isValidCachedBlobForFormat(cachedBlob, cachedFormat === 'html_error' ? format : cachedFormat);
                if (validCache && cachedFormat !== 'html_error') {
                    if (cachedBook && cachedBook.url) {
                        state.resolvedCorsUrl = toCorsUrl(cachedBook.url);
                        state.resolvedDirectUrl = toDirectUrl(cachedBook.url);
                    }
                    dom.loading.style.display = 'none';
                    if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                    showSyncToast('⚡ Відкрито збережену персональну копію (IndexedDB)');
                    displayDocumentBlob(cachedBlob, cachedFormat);
                    return;
                } else {
                    console.warn('Evicting invalid/corrupted IndexedDB cached blob for:', bookParam.id);
                    await deleteCachedBookBlob(bookParam.id, uid);
                }
            }
        } catch (e) {
            console.warn('Error reading cached blob:', e);
        }

        // 2. ДЖЕРЕЛА ДЛЯ ЗАВАНТАЖЕННЯ (прямі URL /download/; для fetch конвертуються в /cors/)
        const candidateUrls = [];
        const pushUnique = (u) => { if (u && !candidateUrls.includes(u)) candidateUrls.push(u); };
        const addCandidate = (u) => {
            if (!u || typeof u !== 'string') return;
            let clean = u.trim();
            if (clean.includes('1971_20260223_vol2')) {
                clean = clean.replace('1971_20260223_vol2', '1971_20260223');
            }
            if (clean.startsWith('blob:') || clean.startsWith('data:')) {
                pushUnique(clean);
                return;
            }
            const parsed = parseArchiveUrl(clean);
            if (parsed) {
                // Точна назва як у кеші + варіанти NFC / NFD (macOS-завантаження на Archive.org)
                let rawName = parsed.path;
                try { rawName = decodeURIComponent(parsed.path); } catch (_) {}
                const base = `https://archive.org/download/${parsed.item}/`;
                pushUnique(base + encodeURIComponent(rawName));
                pushUnique(base + encodeURIComponent(rawName.normalize('NFD')));
                pushUnique(base + encodeURIComponent(rawName.normalize('NFC')));
                return;
            }
            pushUnique(clean);
        };

        // Якщо книга відома як не завантажена в онлайн-архів (тільки локальна копія)
        const isKnownOffline = (cachedBook && !cachedBook.url && cachedBook.inArchive === false)
            || (!cachedBook && urlParams.get('inArchive') === '0');
        const hasRealCustomFile = Boolean(bookParam.file) && !(
            isKnownOffline &&
            parseArchiveUrl(bookParam.file) &&
            parseArchiveUrl(bookParam.file).item === '1971_20260223'
        );

        if (cachedBook && cachedBook.url) addCandidate(cachedBook.url);
        if (hasRealCustomFile) addCandidate(bookParam.file);

        if (isKnownOffline && !hasRealCustomFile) {
            showDocError('Ця книга з локальної колекції (ще не завантажена в онлайн-архів). Будь ласка, оберіть свій файл з диска або перетягніть його сюди.');
            return;
        }

        if (fullId && (!cachedBook || cachedBook.inArchive !== false)) {
            let raw = fullId;
            try { raw = decodeURIComponent(fullId); } catch (_) {}
            addCandidate(`https://archive.org/download/1971_20260223/${encodeURIComponent(raw)}`);
        }

        if (candidateUrls.length === 0) {
            showDocError('Посилання на файл відсутнє. Оберіть файл з комп’ютера для читання.');
            return;
        }

        // 3. PDF: знаходимо робочий URL через CORS-ендпоінт і відкриваємо через PDF.js зі синхронізацією сторінок при скролі
        if (format === 'pdf') {
            dom.loading.style.display = 'flex';
            dom.loadingText.textContent = `Підключення до джерела книги...`;

            let workingUrl = null;
            for (const cand of candidateUrls) {
                if (cand.startsWith('blob:') || cand.startsWith('data:')) { workingUrl = cand; break; }
                if (!parseArchiveUrl(cand)) { workingUrl = cand; break; } // сторонній URL — не можемо перевірити, пробуємо напряму
                if (await probeUrl(toCorsUrl(cand))) { workingUrl = cand; break; }
            }

            if (workingUrl) {
                state.resolvedCorsUrl = toCorsUrl(workingUrl);
                state.resolvedDirectUrl = toDirectUrl(workingUrl);
                const pdfBytes = cachedBook && Number(cachedBook.sizeRaw) ? Number(cachedBook.sizeRaw) : 0;

                const pdfReady = await ensurePdfJsLibraryLoaded();
                if (pdfReady) {
                    // Для звичайних PDF (до 65 МБ) завантажуємо з прогрес-баром, кешуємо в IndexedDB та рендеримо через PDF.js
                    if (!pdfBytes || pdfBytes <= 65 * 1024 * 1024) {
                        dom.loadingText.textContent = `Завантаження персональної копії...`;
                        if (dom.downloadProgressWrap) {
                            dom.downloadProgressWrap.style.display = 'block';
                            if (dom.downloadProgressFill) dom.downloadProgressFill.style.width = '0%';
                            if (dom.downloadProgressPercent) dom.downloadProgressPercent.textContent = '0%';
                            if (dom.downloadProgressBytes) dom.downloadProgressBytes.textContent = 'З’єднання з сервером...';
                        }
                        try {
                            const blob = await downloadBookWithProgress([workingUrl], showDownloadProgress, 'pdf');
                            const detectedFormat = await sniffBlobFormat(blob, 'pdf');
                            if (detectedFormat !== 'html_error') {
                                saveCachedBookBlob(bookParam.id, uid, blob, { format: detectedFormat, title: bookParam.title }).then(() => {
                                    showSyncToast('📖 Персональну копію книги збережено у вашу бібліотеку!');
                                }).catch(() => {});
                                if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                                displayDocumentBlob(blob, detectedFormat);
                                return;
                            }
                        } catch (pdfDlErr) {
                            console.warn('PDF personal copy download failed, trying direct stream:', pdfDlErr);
                        }
                    }

                    // Для великих сканованих PDF (> 65 МБ) або при збої кешування — потокове відкриття у PDF.js
                    try {
                        dom.loading.style.display = 'flex';
                        dom.loadingText.textContent = `Потокове завантаження PDF книги...`;
                        await initPdfJsViewer({
                            url: toCorsUrl(workingUrl),
                            disableRange: true,
                            disableStream: false,
                            disableAutoFetch: false
                        }, toDirectUrl(workingUrl));
                        return;
                    } catch (streamErr) {
                        console.warn('PDF.js stream fallback to native iframe:', streamErr);
                    }
                }

                dom.loading.style.display = 'none';
                if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                loadPdfDirect(toDirectUrl(workingUrl));
                return;
            }

            showDocError('Не вдалося знайти цю книгу в онлайн-архіві. Оберіть файл з вашого пристрою або перетягніть його сюди.');
            return;
        }

        // 4. CHM та інші непідтримувані браузером формати
        if (!['djvu', 'docx', 'doc', 'txt'].includes(format)) {
            state.resolvedDirectUrl = toDirectUrl(candidateUrls[0]);
            showDocError(`Формат .${format} не підтримується онлайн-читалкою. Завантажте файл за посиланням нижче та відкрийте його у спеціальній програмі.`);
            return;
        }

        // 5. DjVu / DOC / DOCX / TXT: завантажуємо через CORS-ендпоінт з прогрес-баром і кешуємо
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Завантаження персональної копії...`;
        if (dom.downloadProgressWrap) {
            dom.downloadProgressWrap.style.display = 'block';
            if (dom.downloadProgressFill) dom.downloadProgressFill.style.width = '0%';
            if (dom.downloadProgressPercent) dom.downloadProgressPercent.textContent = '0%';
            if (dom.downloadProgressBytes) dom.downloadProgressBytes.textContent = 'З’єднання з сервером...';
        }

        try {
            const blob = await downloadBookWithProgress(candidateUrls, showDownloadProgress, format);
            const detectedFormat = await sniffBlobFormat(blob, format);

            // Зберігаємо персональну копію в локальну БД браузера
            saveCachedBookBlob(bookParam.id, uid, blob, { format: detectedFormat, title: bookParam.title }).then(() => {
                showSyncToast('📖 Персональну копію книги збережено у вашу бібліотеку!');
            }).catch(() => {});

            if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
            displayDocumentBlob(blob, detectedFormat);
        } catch (downloadErr) {
            console.warn('Download failed:', downloadErr);
            if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
            showDocError('Не вдалося завантажити книгу з онлайн-архіву. Перевірте інтернет-з’єднання або оберіть файл з пристрою.');
        }
    }

    // Вбудований парсер бінарних MS Word 97-2003 (.doc, OLE2/CFB + FIB + PieceTable)
    function parseBinaryDocToHtml(arrayBuffer) {
        const u8 = new Uint8Array(arrayBuffer);
        const dv = new DataView(arrayBuffer);
        if (u8.length < 512 || dv.getUint32(0, true) !== 0xE011CFD0 || dv.getUint32(4, true) !== 0xE11AB1A1) {
            throw new Error('Not an OLE2 CFB .doc file');
        }

        const secShift = dv.getUint16(0x1E, true);
        const secSize = 1 << secShift;
        const miniCutoff = dv.getUint32(0x38, true);
        const firstDirSec = dv.getUint32(0x30, true);
        const firstMiniFatSec = dv.getUint32(0x3C, true);
        const firstDifatSec = dv.getUint32(0x44, true);
        const numDifatSecs = dv.getUint32(0x48, true);

        const difat = [];
        for (let i = 0; i < 109; i++) {
            difat.push(dv.getUint32(0x4C + i * 4, true));
        }
        let currDifat = firstDifatSec;
        const entriesPerDifat = (secSize >> 2) - 1;
        for (let d = 0; d < numDifatSecs && currDifat < 0xFFFFFFFC; d++) {
            const off = (currDifat + 1) * secSize;
            if (off + secSize > u8.length) break;
            for (let j = 0; j < entriesPerDifat; j++) {
                difat.push(dv.getUint32(off + j * 4, true));
            }
            currDifat = dv.getUint32(off + entriesPerDifat * 4, true);
        }

        const fat = [];
        const intsPerSec = secSize >> 2;
        for (const sec of difat) {
            if (sec >= 0xFFFFFFFC) continue;
            const off = (sec + 1) * secSize;
            if (off + secSize > u8.length) continue;
            for (let j = 0; j < intsPerSec; j++) {
                fat.push(dv.getUint32(off + j * 4, true));
            }
        }

        function readChain(startSec, maxBytes) {
            const chunks = [];
            let total = 0;
            let s = startSec;
            let guard = 0;
            while (s < fat.length && s < 0xFFFFFFFC && guard++ < 250000) {
                const off = (s + 1) * secSize;
                if (off >= u8.length) break;
                const slice = u8.subarray(off, Math.min(off + secSize, u8.length));
                chunks.push(slice);
                total += slice.length;
                if (maxBytes && total >= maxBytes) break;
                s = fat[s];
            }
            const out = new Uint8Array(maxBytes ? Math.min(total, maxBytes) : total);
            let pos = 0;
            for (const c of chunks) {
                const take = Math.min(c.length, out.length - pos);
                if (take <= 0) break;
                out.set(c.subarray(0, take), pos);
                pos += take;
            }
            return out;
        }

        const dirBytes = readChain(firstDirSec);
        const dirDv = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
        const utf16 = new TextDecoder('utf-16le');
        const cp1251 = new TextDecoder('windows-1251');
        const entries = [];

        for (let off = 0; off + 128 <= dirBytes.length; off += 128) {
            const nameLen = dirDv.getUint16(off + 64, true);
            if (nameLen < 2 || nameLen > 64) continue;
            const name = utf16.decode(dirBytes.subarray(off, off + nameLen - 2));
            const type = dirBytes[off + 66];
            const start = dirDv.getUint32(off + 116, true);
            const size = dirDv.getUint32(off + 120, true);
            entries.push({ name, type, start, size });
        }

        const root = entries.find(e => e.type === 5);
        const miniStream = (root && root.start < 0xFFFFFFFC && root.size > 0) ? readChain(root.start, root.size) : new Uint8Array(0);
        const miniFat = [];
        if (firstMiniFatSec < 0xFFFFFFFC) {
            const mfBytes = readChain(firstMiniFatSec);
            const mfDv = new DataView(mfBytes.buffer, mfBytes.byteOffset, mfBytes.byteLength);
            for (let i = 0; i + 4 <= mfBytes.length; i += 4) {
                miniFat.push(mfDv.getUint32(i, true));
            }
        }

        function getStream(targetName) {
            const entry = entries.find(e => e.name === targetName);
            if (!entry) return null;
            if (entry.size < miniCutoff && entry.type !== 5) {
                const out = new Uint8Array(entry.size);
                let s = entry.start;
                let pos = 0;
                let guard = 0;
                while (s < miniFat.length && s < 0xFFFFFFFC && pos < entry.size && guard++ < 250000) {
                    const mOff = s * 64;
                    const take = Math.min(64, entry.size - pos, Math.max(0, miniStream.length - mOff));
                    if (take <= 0) break;
                    out.set(miniStream.subarray(mOff, mOff + take), pos);
                    pos += take;
                    s = miniFat[s];
                }
                return out;
            }
            return readChain(entry.start, entry.size);
        }

        const wdoc = getStream('WordDocument');
        if (!wdoc || wdoc.length < 0x01AA) throw new Error('Missing WordDocument stream');
        const wDv = new DataView(wdoc.buffer, wdoc.byteOffset, wdoc.byteLength);
        const flags = wDv.getUint16(0x0A, true);
        const ccpText = wDv.getUint32(0x004C, true);
        const tblName = (flags & 0x0200) ? '1Table' : '0Table';
        const fcClx = wDv.getUint32(0x01A2, true);
        const lcbClx = wDv.getUint32(0x01A6, true);
        const tbl = getStream(tblName);
        if (!tbl || fcClx + lcbClx > tbl.length) throw new Error('Missing Table stream / CLX');

        const clx = tbl.subarray(fcClx, fcClx + lcbClx);
        const clxDv = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);
        let pos = 0;
        while (pos < clx.length && clx[pos] === 1) {
            const cbGrpprl = clxDv.getUint16(pos + 1, true);
            pos += 3 + cbGrpprl;
        }
        if (pos >= clx.length || clx[pos] !== 2) throw new Error('Invalid CLX PlcPcd');
        const lcbPlc = clxDv.getUint32(pos + 1, true);
        const plcOff = pos + 5;
        const pieceCount = Math.floor((lcbPlc - 4) / 12);
        if (pieceCount <= 0) throw new Error('Empty PieceTable');

        const parts = [];
        for (let k = 0; k < pieceCount; k++) {
            const cpStart = clxDv.getUint32(plcOff + k * 4, true);
            const cpEnd = clxDv.getUint32(plcOff + (k + 1) * 4, true);
            const cpLen = cpEnd - cpStart;
            if (cpLen <= 0) continue;
            const pcdOff = plcOff + (pieceCount + 1) * 4 + k * 8;
            const fcRaw = clxDv.getUint32(pcdOff + 2, true);
            const isCompressed = (fcRaw & 0x40000000) !== 0;
            if (isCompressed) {
                const byteOff = (fcRaw & 0x3FFFFFFF) >>> 1;
                parts.push(cp1251.decode(wdoc.subarray(byteOff, Math.min(wdoc.length, byteOff + cpLen))));
            } else {
                const byteOff = fcRaw & 0x3FFFFFFF;
                parts.push(utf16.decode(wdoc.subarray(byteOff, Math.min(wdoc.length, byteOff + cpLen * 2))));
            }
        }

        let rawText = parts.join('');
        if (ccpText > 0 && rawText.length > ccpText) {
            rawText = rawText.slice(0, ccpText);
        }

        // Очищення службових кодів полів Word (\x13 код \x14 видимий текст \x15) та м'яких переносів (\x1f)
        rawText = rawText
            .replace(/\x13[^\x14\x15]*\x14([^\x15]*)\x15/g, '$1')
            .replace(/\x13[^\x15]*\x15/g, '')
            .replace(/\x1f/g, '')
            .replace(/\x1e/g, '-')
            .replace(/\x07/g, '\t')
            .replace(/[\x00-\x06\x08\x0e-\x1c]/g, '');

        const paragraphs = rawText.split(/\r|\x0c/);
        const htmlBlocks = [];
        for (const para of paragraphs) {
            const trimmed = para.replace(/\x0b/g, '\n').trim();
            if (!trimmed) continue;
            const safe = escapeHtml(trimmed).replace(/\n/g, '<br>').replace(/\t+/g, ' &nbsp; ');
            if (trimmed.length < 90 && /^[А-ЯІЇЄҐA-Z0-9№«"§IVXLC\s.,:—–\-()!?]+$/.test(trimmed) && /[А-ЯІЇЄҐA-Z]/.test(trimmed)) {
                htmlBlocks.push(`<h3 style="margin: 1.2em 0 0.5em;">${safe}</h3>`);
            } else {
                htmlBlocks.push(`<p style="margin: 0 0 0.75em; line-height: 1.65;">${safe}</p>`);
            }
        }
        if (htmlBlocks.length === 0) throw new Error('Empty extracted .doc content');
        return htmlBlocks.join('\n');
    }

    function setViewportInnerScrollLock(locked) {
        if (!dom.viewport) return;
        dom.viewport.classList.toggle('locked-inner-scroll', Boolean(locked));
    }

    function createViewerBottomBar() {
        const bar = document.createElement('div');
        bar.className = 'pdf-viewer-bottom-bar';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.title = 'Попередня сторінка';
        prevBtn.textContent = '◀';
        prevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));

        const pageInput = document.createElement('input');
        pageInput.type = 'number';
        pageInput.className = 'pdf-viewer-bottom-input';
        pageInput.min = '1';
        pageInput.max = String(state.totalPages || 1);
        pageInput.value = String(state.currentPage || 1);
        pageInput.addEventListener('change', () => {
            goToPage(pageInput.value);
            pageInput.blur();
        });
        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToPage(pageInput.value);
                pageInput.blur();
            }
        });

        const sep = document.createElement('span');
        sep.textContent = '/';
        sep.style.opacity = '0.7';

        const totalSpan = document.createElement('span');
        totalSpan.textContent = String(state.totalPages || 1);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.title = 'Наступна сторінка';
        nextBtn.textContent = '▶';
        nextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

        bar.appendChild(prevBtn);
        bar.appendChild(pageInput);
        bar.appendChild(sep);
        bar.appendChild(totalSpan);
        bar.appendChild(nextBtn);

        state.viewerBottomBar = { bar, prevBtn, nextBtn, pageInput, totalSpan };
        return bar;
    }

    function cleanupPdfState() {
        if (state.pdfZoomTimer) {
            clearTimeout(state.pdfZoomTimer);
            state.pdfZoomTimer = null;
        }
        if (state.pdfRenderObserver) {
            try { state.pdfRenderObserver.disconnect(); } catch (_) {}
            state.pdfRenderObserver = null;
        }
        if (state.pdfRenderTasks) {
            for (const task of state.pdfRenderTasks.values()) {
                try { task.cancel && task.cancel(); } catch (_) {}
            }
            state.pdfRenderTasks.clear();
            state.pdfRenderTasks = null;
        }
        if (state.pdfLoadingTask) {
            try { state.pdfLoadingTask.destroy && state.pdfLoadingTask.destroy(); } catch (_) {}
            state.pdfLoadingTask = null;
        }
        if (state.pdfDoc) {
            try { state.pdfDoc.destroy && state.pdfDoc.destroy(); } catch (_) {}
            state.pdfDoc = null;
        }
        state.pdfPageContainers = null;
        state.viewerBottomBar = null;
        state.htmlDocActive = false;
    }

    function cleanupViewerState() {
        cleanupDjVuState();
        cleanupPdfState();
        state.isOfficeViewer = false;
    }

    // DISPLAY DOCUMENT FROM BLOB (Personal copy / downloaded file)
    function displayDocumentBlob(blob, format) {
        format = normalizeFormat(format);
        if (state.currentBlobUrl) {
            try { URL.revokeObjectURL(state.currentBlobUrl); } catch (_) {}
        }
        const blobUrl = URL.createObjectURL(blob);
        state.currentBlobUrl = blobUrl;

        if (format === 'pdf') {
            dom.loading.style.display = 'flex';
            dom.loadingText.textContent = 'Відкриття PDF документа...';
            ensurePdfJsLibraryLoaded().then(loaded => {
                if (!loaded) {
                    loadPdfDirect(blobUrl);
                    return;
                }
                return blob.arrayBuffer().then(buf => {
                    return initPdfJsViewer({ data: new Uint8Array(buf) }, blobUrl);
                });
            }).catch(err => {
                console.warn('PDF.js render fallback to native iframe:', err);
                loadPdfDirect(blobUrl);
            });
        } else if (format === 'djvu') {
            cleanupPdfState();
            setViewportInnerScrollLock(true);
            dom.docFrame.style.display = 'none';
            if (dom.contentWrap) dom.contentWrap.style.display = 'none';
            if (dom.djvuWrap) dom.djvuWrap.style.display = 'block';
            dom.loading.style.display = 'flex';
            dom.loadingText.textContent = 'Відкриття DjVu документа...';
            ensureDjVuLibraryLoaded().then(loaded => {
                if (!loaded) {
                    showDocError('Бібліотека DjVu.js не завантажилась. Оновіть сторінку (Cmd+Shift+R / Ctrl+F5) або перевірте інтернет-з’єднання.');
                    return;
                }
                return blob.arrayBuffer().then(buf => openDjVuBuffer(buf, bookParam.title || bookParam.id || 'book.djvu'));
            }).catch(err => {
                console.warn('DjVu blob read error:', err);
                showDocError('Не вдалося прочитати DjVu файл. Перевірте цілісність файлу або оберіть іншу копію з пристрою.');
            });
        } else if (format === 'doc') {
            blob.arrayBuffer().then(buf => {
                const html = parseBinaryDocToHtml(buf);
                renderHtmlDocument(html);
            }).catch(err => {
                console.warn('Binary .doc parse fallback:', err);
                const direct = getDirectFileUrl();
                if (direct && parseArchiveUrl(direct)) {
                    loadOfficeViewer(direct);
                } else {
                    showDocError('Не вдалося прочитати цей .doc файл у браузері.');
                }
            });
        } else if (format === 'docx') {
            blob.arrayBuffer().then(async (buf) => {
                if (typeof mammoth === 'undefined') throw new Error('Mammoth.js не знайдено');
                const result = await mammoth.convertToHtml({ arrayBuffer: buf });
                renderHtmlDocument(result.value);
            }).catch(err => {
                console.warn('DOCX render error:', err);
                const direct = getDirectFileUrl();
                if (direct && parseArchiveUrl(direct)) {
                    loadOfficeViewer(direct);
                } else {
                    showDocError('Не вдалося відкрити Word-документ у браузері. Збережіть його у форматі PDF або DOCX.');
                }
            });
        } else if (format === 'txt') {
            blob.arrayBuffer().then(buf => {
                const bytes = new Uint8Array(buf);
                let text;
                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                } catch (_) {
                    text = new TextDecoder('windows-1251').decode(bytes);
                }
                renderHtmlDocument(`<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(text)}</pre>`);
            });
        } else {
            showDocError(`Формат .${format} не підтримується онлайн-читалкою.`);
        }
    }

    function renderHtmlDocument(html) {
        cleanupViewerState();
        setViewportInnerScrollLock(false);
        dom.loading.style.display = 'none';
        dom.docFrame.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        dom.contentWrap.style.display = 'block';
        dom.contentWrap.innerHTML = `<div class="reader-docx-container">${html}</div>`;

        const totalChars = (html.replace(/<[^>]*>/g, '') || '').length;
        state.totalPages = Math.max(1, Math.round(totalChars / 2200));
        state.htmlDocActive = true;
        dom.contentWrap.appendChild(createViewerBottomBar());

        requestAnimationFrame(() => {
            if (!state.htmlDocActive || !dom.viewport || !dom.contentWrap) return;
            const pageHeightStep = Math.max(520, Math.round((dom.viewport.clientHeight || 720) * 0.88));
            const measuredPages = Math.max(1, Math.ceil((dom.contentWrap.scrollHeight || pageHeightStep) / pageHeightStep));
            state.totalPages = Math.max(1, measuredPages);
            if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;
            if (dom.labelTotalPages) dom.labelTotalPages.textContent = state.totalPages;
            if (dom.inputCurrentPage) dom.inputCurrentPage.max = state.totalPages;

            state.programmaticScrollUntil = Date.now() + 350;
            if (state.currentPage > 1 && state.totalPages > 1) {
                const maxScroll = Math.max(0, dom.viewport.scrollHeight - dom.viewport.clientHeight);
                dom.viewport.scrollTop = Math.round(((state.currentPage - 1) / (state.totalPages - 1)) * maxScroll);
            } else {
                dom.viewport.scrollTop = 0;
            }
            updatePageUI(true);
            saveUserBookWorkspace();
        });
    }

    // Старі .doc файли: Microsoft Office Online Viewer (працює з публічними URL)
    function loadOfficeViewer(directUrl) {
        cleanupViewerState();
        setViewportInnerScrollLock(true);
        dom.loading.style.display = 'none';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';
        dom.docFrame.style.display = 'block';
        dom.docFrame.onload = null;
        dom.docFrame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directUrl)}`;
        state.isOfficeViewer = true;
        updatePageUI(true);
    }

    // PDF.js CONTINUOUS VIEWER: Full bidirectional scroll ↔ header counter sync + selectable text layer
    async function initPdfJsViewer(pdfSource, fallbackUrl = '') {
        await ensurePdfJsLibraryLoaded();
        if (typeof pdfjsLib === 'undefined') {
            if (fallbackUrl) {
                loadPdfDirect(fallbackUrl);
                return;
            }
            throw new Error('PDF.js not available');
        }

        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerUrl();
        }

        cleanupViewerState();
        setViewportInnerScrollLock(false);
        if (dom.docFrame) dom.docFrame.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) {
            dom.contentWrap.style.display = 'block';
            dom.contentWrap.innerHTML = '';
        }

        const docParams = (pdfSource && typeof pdfSource === 'object' && !(pdfSource instanceof Uint8Array) && !(pdfSource instanceof ArrayBuffer))
            ? {
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
                ...pdfSource
            }
            : pdfSource;

        const loadingTask = pdfjsLib.getDocument(docParams);
        state.pdfLoadingTask = loadingTask;
        loadingTask.onProgress = (prog) => {
            if (prog && prog.loaded > 0) {
                if (dom.downloadProgressWrap && dom.loading && dom.loading.style.display !== 'none') {
                    dom.downloadProgressWrap.style.display = 'block';
                    showDownloadProgress(prog.loaded, prog.total || 0);
                }
            }
        };

        const pdfDoc = await loadingTask.promise;
        if (state.pdfLoadingTask !== loadingTask) {
            try { pdfDoc.destroy(); } catch (_) {}
            return;
        }

        state.pdfDoc = pdfDoc;
        state.pdfRenderTasks = new Map();
        const total = pdfDoc.numPages || 1;
        state.totalPages = total;
        if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
        if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
        state.currentPage = Math.min(Math.max(1, state.currentPage || 1), total);

        const firstPage = await pdfDoc.getPage(1);
        const baseVp = firstPage.getViewport({ scale: 1.0 });
        state.pdfBaseWidth = baseVp.width || 595;
        state.pdfBaseHeight = baseVp.height || 842;
        const availWidth = Math.max(460, Math.min(840, (dom.viewport ? dom.viewport.clientWidth : 860) - 56));
        state.pdfFitScale = availWidth / state.pdfBaseWidth;

        const z = state.zoom || 1.0;
        const defaultCssW = Math.round(state.pdfBaseWidth * state.pdfFitScale * z);
        const defaultCssH = Math.round(state.pdfBaseHeight * state.pdfFitScale * z);

        const stage = document.createElement('div');
        stage.className = 'pdf-pages-stage';

        const containers = [];
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= total; i++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'reader-page-container';
            pageDiv.dataset.page = String(i);
            pageDiv.dataset.baseW = String(state.pdfBaseWidth);
            pageDiv.dataset.baseH = String(state.pdfBaseHeight);
            pageDiv.style.width = `${defaultCssW}px`;
            pageDiv.style.height = `${defaultCssH}px`;

            const badge = document.createElement('span');
            badge.className = 'pdf-page-placeholder-badge';
            badge.textContent = `${i} / ${total}`;
            pageDiv.appendChild(badge);

            containers.push(pageDiv);
            frag.appendChild(pageDiv);
        }
        stage.appendChild(frag);
        dom.contentWrap.appendChild(stage);
        dom.contentWrap.appendChild(createViewerBottomBar());
        state.pdfPageContainers = containers;

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target;
                const pNum = parseInt(el.dataset.page, 10);
                if (pNum > 0) {
                    renderPdfPageIntoContainer(pdfDoc, pNum, el);
                }
            }
        }, {
            root: dom.viewport || null,
            rootMargin: '1200px 0px 1200px 0px',
            threshold: 0.01
        });
        state.pdfRenderObserver = observer;
        for (const el of containers) {
            observer.observe(el);
        }

        dom.loading.style.display = 'none';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';

        state.programmaticScrollUntil = Date.now() + 420;
        if (state.currentPage > 1) {
            scrollToPdfPage(state.currentPage);
        } else if (dom.viewport) {
            dom.viewport.scrollTop = 0;
        }
        // Негайно рендеримо стартову сторінку
        if (containers[state.currentPage - 1]) {
            renderPdfPageIntoContainer(pdfDoc, state.currentPage, containers[state.currentPage - 1]);
        }

        updatePageUI(true);
        try {
            saveUserBookWorkspace();
        } catch (wsErr) {
            console.warn('Initial PDF workspace save skipped:', wsErr);
        }
        showSyncToast('📄 PDF документ підвантажено');
    }

    async function renderPdfPageIntoContainer(pdfDoc, pageNum, container, forceScaleRefresh = false) {
        if (!state.pdfDoc || state.pdfDoc !== pdfDoc || !container) return;
        const z = state.zoom || 1.0;
        const scaleKey = (state.pdfFitScale * z).toFixed(3);
        if (!forceScaleRefresh && (container.dataset.renderedScale === scaleKey || container.dataset.renderingScale === scaleKey)) {
            return;
        }
        container.dataset.renderingScale = scaleKey;

        const prevTask = state.pdfRenderTasks && state.pdfRenderTasks.get(pageNum);
        if (prevTask) {
            try { prevTask.cancel(); } catch (_) {}
            state.pdfRenderTasks.delete(pageNum);
        }

        try {
            const page = await pdfDoc.getPage(pageNum);
            if (state.pdfDoc !== pdfDoc) return;

            const rawVp = page.getViewport({ scale: 1.0 });
            container.dataset.baseW = String(rawVp.width);
            container.dataset.baseH = String(rawVp.height);

            const cssScale = state.pdfFitScale * (state.zoom || 1.0);
            const currentKey = cssScale.toFixed(3);
            const cssVp = page.getViewport({ scale: cssScale });
            const cssW = Math.round(cssVp.width);
            const cssH = Math.round(cssVp.height);
            container.style.width = `${cssW}px`;
            container.style.height = `${cssH}px`;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const renderVp = page.getViewport({ scale: cssScale * dpr });

            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(renderVp.width);
            canvas.height = Math.floor(renderVp.height);
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;

            const ctx = canvas.getContext('2d', { alpha: false });
            const renderTask = page.render({ canvasContext: ctx, viewport: renderVp });
            if (state.pdfRenderTasks) state.pdfRenderTasks.set(pageNum, renderTask);
            await renderTask.promise;
            if (state.pdfRenderTasks) state.pdfRenderTasks.delete(pageNum);
            if (state.pdfDoc !== pdfDoc) return;

            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.setProperty('--scale-factor', String(cssScale));

            const badge = container.querySelector('.pdf-page-placeholder-badge');
            container.innerHTML = '';
            container.appendChild(canvas);
            container.appendChild(textLayerDiv);
            if (badge) container.appendChild(badge);
            container.dataset.renderedScale = currentKey;
            delete container.dataset.renderingScale;

            if (typeof pdfjsLib.renderTextLayer === 'function') {
                try {
                    const tlTask = pdfjsLib.renderTextLayer({
                        textContentSource: page.streamTextContent(),
                        container: textLayerDiv,
                        viewport: cssVp
                    });
                    if (tlTask && tlTask.promise) {
                        tlTask.promise.catch(() => {});
                    }
                } catch (_) {}
            }

            evictDistantPdfCanvases(pageNum);
        } catch (err) {
            delete container.dataset.renderingScale;
            if (err && err.name === 'RenderingCancelledException') return;
            console.warn(`PDF page ${pageNum} render warning:`, err);
        }
    }

    function evictDistantPdfCanvases(centerPage) {
        if (!state.pdfPageContainers) return;
        const anchor = state.currentPage || centerPage || 1;
        for (let i = 0; i < state.pdfPageContainers.length; i++) {
            const p = i + 1;
            if (Math.abs(p - anchor) <= 12) continue;
            const el = state.pdfPageContainers[i];
            if (el && el.dataset.renderedScale) {
                const badge = el.querySelector('.pdf-page-placeholder-badge');
                el.innerHTML = '';
                if (badge) el.appendChild(badge);
                delete el.dataset.renderedScale;
                delete el.dataset.renderingScale;
            }
        }
    }

    function scrollToPdfPage(pageNum) {
        if (!dom.viewport || !state.pdfPageContainers || !state.pdfPageContainers.length) return;
        const idx = Math.min(Math.max(0, pageNum - 1), state.pdfPageContainers.length - 1);
        const target = state.pdfPageContainers[idx];
        if (!target) return;
        const vpRect = dom.viewport.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        const nextTop = dom.viewport.scrollTop + (tRect.top - vpRect.top) - 12;
        dom.viewport.scrollTop = Math.max(0, Math.round(nextTop));
        if (state.pdfDoc) {
            renderPdfPageIntoContainer(state.pdfDoc, idx + 1, target);
        }
    }

    function refreshPdfZoomLayout() {
        if (!state.pdfDoc || !state.pdfPageContainers || !state.pdfPageContainers.length) return;
        const anchorPage = state.currentPage || 1;
        const z = state.zoom || 1.0;
        const cssScale = state.pdfFitScale * z;
        for (const el of state.pdfPageContainers) {
            const bw = parseFloat(el.dataset.baseW) || state.pdfBaseWidth;
            const bh = parseFloat(el.dataset.baseH) || state.pdfBaseHeight;
            const w = Math.round(bw * cssScale);
            const h = Math.round(bh * cssScale);
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            const c = el.querySelector('canvas');
            if (c) {
                c.style.width = `${w}px`;
                c.style.height = `${h}px`;
            }
        }
        state.programmaticScrollUntil = Date.now() + 300;
        scrollToPdfPage(anchorPage);

        if (state.pdfZoomTimer) clearTimeout(state.pdfZoomTimer);
        const activePdf = state.pdfDoc;
        state.pdfZoomTimer = setTimeout(() => {
            if (state.pdfDoc !== activePdf || !state.pdfPageContainers) return;
            const cur = state.currentPage || 1;
            const start = Math.max(1, cur - 2);
            const end = Math.min(state.pdfPageContainers.length, cur + 2);
            for (let p = start; p <= end; p++) {
                renderPdfPageIntoContainer(activePdf, p, state.pdfPageContainers[p - 1], true);
            }
        }, 180);
    }

    // PDF FALLBACK LOADER: Uses native browser PDF viewer via Iframe when PDF.js cannot read file
    function loadPdfDirect(url) {
        if (!url) {
            showDocError('Посилання на файл PDF відсутнє.');
            return;
        }

        cleanupViewerState();
        setViewportInnerScrollLock(true);
        dom.docFrame.style.display = 'block';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';

        // Direct embed with starting page anchor
        const frameSrc = url.includes('#') ? url : `${url}#page=${state.currentPage}&toolbar=1&navpanes=0`;
        dom.docFrame.src = frameSrc;

        dom.docFrame.onload = () => {
            dom.loading.style.display = 'none';
            if (dom.errorOverlay && dom.errorOverlay.style.display === 'flex') return;
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

        updatePageUI(true);
    }

    function cleanupDjVuState() {
        if (typeof state.djvuViewerUnsub === 'function') {
            try { state.djvuViewerUnsub(); } catch (_) {}
            state.djvuViewerUnsub = null;
        }
        if (state.djvuViewer) {
            try { state.djvuViewer.destroy(); } catch (_) {}
            state.djvuViewer = null;
        }
        if (state.djvuFallbackDoc) {
            try { state.djvuFallbackDoc.resetLastRequestedPage && state.djvuFallbackDoc.resetLastRequestedPage(); } catch (_) {}
            state.djvuFallbackDoc = null;
        }
        state.djvuFallbackCanvas = null;
        state.djvuFallbackOcrBody = null;
    }

    async function openDjVuBuffer(rawBuf, fileName = 'book.djvu') {
        if (!dom.djvuMount) return;
        let normalizedBuf;
        try {
            normalizedBuf = normalizeDjVuBuffer(rawBuf);
        } catch (err) {
            console.warn('Invalid DjVu header:', err);
            showDocError('Обраний файл не є коректним DjVu-документом або завантажився з помилкою. Спробуйте обрати інший файл з пристрою.');
            return;
        }

        cleanupViewerState();
        setViewportInnerScrollLock(true);
        dom.docFrame.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'block';
        dom.djvuMount.style.transform = '';
        dom.djvuMount.innerHTML = '';

        const baseUrl = getDjVuBaseUrl();
        const djvuOptions = baseUrl ? { baseUrl } : undefined;

        // 1. Основний переглядач DjVu.Viewer (Web Worker + повний безперервний скрол зі синхронізацією сторінок)
        if (typeof DjVu !== 'undefined' && DjVu.Viewer && typeof Worker !== 'undefined') {
            try {
                await initDjVuViewer(normalizedBuf.slice(0), fileName, djvuOptions);
                return;
            } catch (viewerErr) {
                console.warn('DjVu.Viewer failed, switching to built-in Canvas DjVu renderer:', viewerErr);
                cleanupDjVuState();
                dom.djvuMount.innerHTML = '';
            }
        }

        // 2. Вбудований безвідмовний Canvas-рендерер DjVu.Document (без Web Worker / Blob URL)
        if (typeof DjVu !== 'undefined' && DjVu.Document) {
            try {
                await initDjVuCanvasFallback(normalizedBuf, djvuOptions);
                return;
            } catch (fallbackErr) {
                console.error('DjVu Canvas fallback failed:', fallbackErr);
            }
        }

        showDocError('Не вдалося відкрити DjVu файл (можливо, файл пошкоджений). Спробуйте завантажити оригінал або обрати інший файл з пристрою.');
    }

    // Primary DjVu.Viewer initializer with continuous scroll mode & 1:1 Redux store page sync
    function initDjVuViewer(buf, fileName = 'book.djvu', djvuOptions = undefined) {
        return new Promise((resolve, reject) => {
            if (!dom.djvuMount) {
                reject(new Error('djvuMount missing'));
                return;
            }
            const viewer = new DjVu.Viewer();
            state.djvuViewer = viewer;
            viewer.render(dom.djvuMount);

            // PAGE_NUMBER_CHANGED у DjVu.Viewer не передає аргументів — зчитуємо viewer.getPageNumber()
            const pageEvent = (DjVu.Viewer && DjVu.Viewer.Events && DjVu.Viewer.Events.PAGE_NUMBER_CHANGED) || 'PAGE_NUMBER_CHANGED';
            viewer.on(pageEvent, (argPage) => {
                if (Date.now() < state.programmaticScrollUntil) return;
                let newPage = typeof argPage === 'number' && argPage > 0 ? argPage : 0;
                if (!newPage && typeof viewer.getPageNumber === 'function') {
                    try { newPage = viewer.getPageNumber(); } catch (_) {}
                }
                if (newPage > 0) {
                    syncPageFromViewerScroll(newPage);
                }
            });

            let settled = false;
            let readyForScrollSync = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('DjVu.Viewer loadDocument timeout'));
                }
            }, 14000);

            // Пряме відстеження помилок, кількості сторінок та поточної сторінки з Redux-стору DjVu.Viewer
            if (viewer.store && typeof viewer.store.subscribe === 'function') {
                state.djvuViewerUnsub = viewer.store.subscribe(() => {
                    try {
                        const st = viewer.store.getState();
                        const getSel = DjVu.Viewer && DjVu.Viewer.get;
                        const err = (getSel && getSel.error) ? getSel.error(st) : (st && st.error);
                        if (err && !settled) {
                            settled = true;
                            clearTimeout(timer);
                            reject(err);
                            return;
                        }
                        if (!settled || !getSel) return;

                        const total = (getSel.pagesQuantity && getSel.pagesQuantity(st))
                            || (getSel.pagesCount && getSel.pagesCount(st))
                            || 0;
                        if (total > 0 && total !== state.totalPages) {
                            state.totalPages = total;
                            if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
                            if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
                            updatePageUI(false);
                        }

                        if (readyForScrollSync && Date.now() >= state.programmaticScrollUntil) {
                            const cur = getSel.currentPageNumber ? getSel.currentPageNumber(st) : 0;
                            if (cur > 0 && cur !== state.currentPage) {
                                syncPageFromViewerScroll(cur);
                            }
                        }
                    } catch (_) {}
                });
            }

            const initialPage = Math.max(1, parseInt(state.currentPage, 10) || 1);
            const config = {
                viewMode: 'continuous',
                uiOptions: { changePageOnScroll: true }
            };
            if (djvuOptions) config.djvuOptions = djvuOptions;
            if (initialPage > 1) config.pageNumber = initialPage;
            if (state.zoom && Math.abs(state.zoom - 1.0) > 0.02) {
                config.pageScale = state.zoom;
            }

            state.programmaticScrollUntil = Date.now() + 450;
            viewer.loadDocument(buf, fileName, config).then(() => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                dom.loading.style.display = 'none';

                try {
                    const st = viewer.store ? viewer.store.getState() : null;
                    const getSel = DjVu.Viewer && DjVu.Viewer.get;
                    const total = st && getSel
                        ? ((getSel.pagesQuantity && getSel.pagesQuantity(st)) || (getSel.pagesCount && getSel.pagesCount(st)) || 0)
                        : 0;
                    if (total && total > 0) {
                        state.totalPages = total;
                        if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
                        if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
                        if (state.currentPage > total) state.currentPage = 1;
                    }
                } catch (err) {
                    console.warn('Error reading DjVu pagesQuantity:', err);
                }

                // Активація live-синхронізації після ініціалізації початкової сторінки в сазі DjVu.Viewer
                setTimeout(() => {
                    readyForScrollSync = true;
                    try {
                        if (typeof viewer.getPageNumber === 'function') {
                            const p = viewer.getPageNumber();
                            if (p > 0 && p !== state.currentPage) {
                                syncPageFromViewerScroll(p);
                            }
                        }
                    } catch (_) {}
                }, 200);

                updatePageUI(true);
                saveUserBookWorkspace();
                showSyncToast('📖 DjVu документ підвантажено');
                resolve(true);
            }).catch(err => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                }
            });
        });
    }

    // Built-in main-thread Canvas DjVu renderer (works even if Web Workers / DjVu.Viewer fail)
    async function initDjVuCanvasFallback(buf, djvuOptions = undefined) {
        const doc = new DjVu.Document(buf, djvuOptions || {});
        const total = doc.getPagesQuantity() || 1;
        state.djvuFallbackDoc = doc;
        state.totalPages = total;
        if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
        if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
        if (state.currentPage > total) state.currentPage = 1;

        const stage = document.createElement('div');
        stage.className = 'djvu-fallback-stage';

        const canvas = document.createElement('canvas');
        canvas.className = 'djvu-fallback-canvas';
        stage.appendChild(canvas);

        const ocrDetails = document.createElement('details');
        ocrDetails.className = 'djvu-fallback-ocr';
        ocrDetails.style.display = 'none';
        const summary = document.createElement('summary');
        summary.textContent = '🔤 Текстовий шар сторінки (для виділення шахової нотації)';
        const pre = document.createElement('pre');
        ocrDetails.appendChild(summary);
        ocrDetails.appendChild(pre);
        stage.appendChild(ocrDetails);
        stage.appendChild(createViewerBottomBar());

        let lastWheelFlip = 0;
        stage.addEventListener('wheel', (e) => {
            if (e.ctrlKey || Math.abs(e.deltaY) < 12) return;
            const now = Date.now();
            if (now - lastWheelFlip < 240) return;
            const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;
            const atTop = stage.scrollTop <= 1;
            if (e.deltaY > 0 && atBottom && state.currentPage < state.totalPages) {
                e.preventDefault();
                lastWheelFlip = now;
                goToPage(state.currentPage + 1);
            } else if (e.deltaY < 0 && atTop && state.currentPage > 1) {
                e.preventDefault();
                lastWheelFlip = now;
                goToPage(state.currentPage - 1);
            }
        }, { passive: false });

        dom.djvuMount.innerHTML = '';
        dom.djvuMount.appendChild(stage);
        state.djvuFallbackCanvas = canvas;
        state.djvuFallbackOcrBody = { details: ocrDetails, pre, stage };

        await renderDjVuFallbackPage(state.currentPage || 1);
        dom.loading.style.display = 'none';
        applyZoomToDocument();
        updatePageUI(true);
        saveUserBookWorkspace();
        showSyncToast('📖 DjVu документ підвантажено');
    }

    async function renderDjVuFallbackPage(pageNum) {
        if (!state.djvuFallbackDoc || !state.djvuFallbackCanvas) return;
        const token = ++state.djvuRenderToken;
        const p = Math.min(Math.max(1, pageNum), state.totalPages || 1);
        const page = await state.djvuFallbackDoc.getPage(p);
        if (token !== state.djvuRenderToken) return;

        const imageData = page.getImageData();
        if (token !== state.djvuRenderToken) return;

        const canvas = state.djvuFallbackCanvas;
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        if (state.djvuFallbackOcrBody) {
            let txt = '';
            try { txt = (page.getText && page.getText()) ? String(page.getText()).trim() : ''; } catch (_) {}
            if (txt) {
                state.djvuFallbackOcrBody.pre.textContent = txt;
                state.djvuFallbackOcrBody.details.style.display = 'block';
            } else {
                state.djvuFallbackOcrBody.pre.textContent = '';
                state.djvuFallbackOcrBody.details.style.display = 'none';
            }
            if (state.djvuFallbackOcrBody.stage) {
                state.djvuFallbackOcrBody.stage.scrollTop = 0;
            }
        }
    }

    // LOCAL FILE LOADER (Drag-and-Drop or File Picker)
    async function handleLocalFileSelected(file) {
        if (!file) return;
        const fname = file.name || 'local_book';
        const lower = fname.toLowerCase();
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        let ext = '';
        if (lower.endsWith('.djvu') || lower.endsWith('.djv')) ext = 'djvu';
        else if (lower.endsWith('.pdf')) ext = 'pdf';
        else if (lower.endsWith('.docx')) ext = 'docx';
        else if (lower.endsWith('.doc')) ext = 'doc';
        else if (lower.endsWith('.txt')) ext = 'txt';

        dom.loading.style.display = 'flex';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
        dom.loadingText.textContent = `Читання локального файлу ${fname}...`;

        try {
            const arrayBuf = await file.arrayBuffer();
            const detected = sniffArrayBufferFormat(arrayBuf, ext || normalizeFormat(bookParam.format) || 'pdf');
            const finalFormat = (detected && detected !== 'html_error') ? detected : (ext || 'pdf');

            let mime = 'application/octet-stream';
            if (finalFormat === 'pdf') mime = 'application/pdf';
            else if (finalFormat === 'djvu') mime = 'image/vnd.djvu';
            else if (finalFormat === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (finalFormat === 'doc') mime = 'application/msword';
            else if (finalFormat === 'txt') mime = 'text/plain';

            // Оновлюємо заголовок та ID, якщо відкривали в режимі "Свій файл" без конкретної книги з каталогу
            if (!rawId && (!rawTitle || urlParams.get('local') === '1')) {
                const cleanLocalTitle = fname.replace(/\.[^/.]+$/, '');
                bookParam.id = fname;
                bookParam.title = cleanLocalTitle || fname;
                bookParam.format = finalFormat;
                state.currentPage = 1;
                if (dom.topbarTitle) dom.topbarTitle.textContent = bookParam.title;
                document.title = `${bookParam.title} — Онлайн Читалка | Chess Vault`;
                loadUserBookWorkspace(uid);
            } else {
                bookParam.format = finalFormat;
            }

            // Створюємо чистий Blob у пам'яті (запобігає помилці NotReadableError у Safari/macOS при збереженні File в IndexedDB)
            const memBlob = new Blob([arrayBuf], { type: mime });
            saveCachedBookBlob(bookParam.id, uid, memBlob, { format: finalFormat, title: bookParam.title || fname }).catch(() => {});

            if (finalFormat === 'djvu') {
                const loaded = await ensureDjVuLibraryLoaded();
                if (!loaded) {
                    showDocError('Бібліотека DjVu.js не завантажилась. Оновіть сторінку та спробуйте знову.');
                    return;
                }
                await openDjVuBuffer(arrayBuf, fname);
            } else {
                displayDocumentBlob(memBlob, finalFormat);
            }
            showSyncToast(`📂 Файл "${fname}" відкрито та збережено у вашу бібліотеку!`);
        } catch (err) {
            console.error('Local file open error:', err);
            showDocError(`Не вдалося прочитати локальний файл "${fname}". Перевірте, що файл не пошкоджений.`);
        }
    }

    // ========================================================
    // 4. PER-USER & PER-BOOK WORKSPACE PERSISTENCE
    // ========================================================
    function getWorkspaceKey(uid) {
        const idKey = (bookParam.id || bookParam.title || 'book').trim().replace(/[\/\s]/g, '_');
        return `chess_vault_workspace_${uid || 'guest'}_${idKey}`;
    }

    function saveUserBookWorkspace() {
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        const safeTotal = Math.max(1, Number(state.totalPages) || 1);
        const safeCurrent = Math.min(Math.max(1, Number(state.currentPage) || 1), safeTotal);
        const percent = Math.min(100, Math.max(1, Math.round((safeCurrent / safeTotal) * 100)));
        const resolvedDockSide = (state.settings && state.settings.dockSide) ? state.settings.dockSide : 'right';

        const rawWorkspaceData = {
            bookId: bookParam.id || 'book',
            title: bookParam.title || '',
            author: bookParam.author || '—',
            url: bookParam.file || '',
            format: bookParam.format || 'pdf',
            currentPage: safeCurrent,
            totalPages: safeTotal,
            percentage: percent,
            boardFEN: chessState.game ? chessState.game.fen() : null,
            boardMoves: Array.isArray(chessState.moveHistory) ? chessState.moveHistory : [],
            boardMoveIndex: typeof chessState.currentMoveIndex === 'number' ? chessState.currentMoveIndex : -1,
            boardFlipped: Boolean(chessState.boardFlipped),
            boardTurn: chessState.editorTurn || 'w',
            bookmarks: Array.isArray(state.bookmarks) ? state.bookmarks : [],
            notes: Array.isArray(state.notes) ? state.notes : [],
            highlights: Array.isArray(state.highlights) ? state.highlights : [],
            dockSide: resolvedDockSide,
            updatedAt: Date.now()
        };

        const workspaceData = {};
        for (const [k, v] of Object.entries(rawWorkspaceData)) {
            if (v !== undefined) workspaceData[k] = v;
        }

        // 1. Збереження в LocalStorage під ключем поточного юзера, guest та заголовком книги
        try {
            const jsonStr = JSON.stringify(workspaceData);
            localStorage.setItem(getWorkspaceKey(uid), jsonStr);
            localStorage.setItem(`chess_vault_workspace_${uid}_${bookParam.id}`, jsonStr);
            if (uid !== 'guest') {
                localStorage.setItem(getWorkspaceKey('guest'), jsonStr);
                localStorage.setItem(`chess_vault_workspace_guest_${bookParam.id}`, jsonStr);
            }
            if (bookParam.title) {
                localStorage.setItem(`chess_vault_workspace_${uid}_title_${encodeURIComponent(bookParam.title)}`, jsonStr);
                localStorage.setItem(`chess_vault_workspace_guest_title_${encodeURIComponent(bookParam.title)}`, jsonStr);
            }
        } catch (_) {}

        // 2. Оновлення ReadingProgress (якщо >= 10 сторінок — рахується у «Зараз читаю» в профілі)
        try {
            if (window.ReadingProgress) {
                window.ReadingProgress.saveProgress(uid, {
                    id: bookParam.id || 'book',
                    title: bookParam.title || '',
                    author: bookParam.author || '—',
                    url: bookParam.file || '',
                    format: bookParam.format || 'pdf',
                    currentPage: safeCurrent,
                    totalPages: safeTotal,
                    notesCount: Array.isArray(state.notes) ? state.notes.length : 0,
                    bookmarksCount: Array.isArray(state.bookmarks) ? state.bookmarks.length : 0
                });
            }
        } catch (rpErr) {
            console.warn('ReadingProgress save warning:', rpErr);
        }

        // 3. Збереження в хмару Firestore окремо для цього користувача
        if (state.currentUser && window.db) {
            try {
                const docId = (bookParam.id || 'book').replace(/[\/\.#$\[\]]/g, '_');
                window.db.collection('user_reading').doc(state.currentUser.uid)
                    .collection('books').doc(docId)
                    .set(workspaceData, { merge: true })
                    .then(() => {
                        showSyncIndicator('✅ Збережено в хмарі');
                    })
                    .catch(err => console.warn('Workspace sync error:', err));
            } catch (err) {
                console.warn('Workspace sync error:', err);
            }
        } else {
            showSyncIndicator('💾 Збережено локально');
        }
    }

    function loadUserBookWorkspace(customUid) {
        const uid = customUid || (state.currentUser ? state.currentUser.uid : 'guest');
        try {
            let raw = localStorage.getItem(getWorkspaceKey(uid));
            if (!raw) {
                raw = localStorage.getItem(`chess_vault_workspace_${uid}_${bookParam.id}`);
            }
            if (!raw && uid !== 'guest') {
                raw = localStorage.getItem(getWorkspaceKey('guest'));
            }
            if (!raw && uid !== 'guest') {
                raw = localStorage.getItem(`chess_vault_workspace_guest_${bookParam.id}`);
            }
            if (!raw && bookParam.title) {
                raw = localStorage.getItem(`chess_vault_workspace_${uid}_title_${encodeURIComponent(bookParam.title)}`);
            }
            if (!raw && bookParam.title) {
                raw = localStorage.getItem(`chess_vault_workspace_guest_title_${encodeURIComponent(bookParam.title)}`);
            }
            if (raw) {
                const data = JSON.parse(raw);
                applyWorkspaceData(data);
            }
        } catch (_) {}
    }


    async function loadUserBookWorkspaceFromFirestore(uid) {
        if (!uid || !window.db) return;
        try {
            const docId = (bookParam.id || 'book').replace(/[\/\.#$\[\]]/g, '_');
            const snap = await window.db.collection('user_reading').doc(uid)
                .collection('books').doc(docId).get();
            if (snap.exists) {
                const data = snap.data();
                applyWorkspaceData(data);
                // Оновлюємо локальний кеш
                const jsonStr = JSON.stringify(data);
                localStorage.setItem(getWorkspaceKey(uid), jsonStr);
                localStorage.setItem(getWorkspaceKey('guest'), jsonStr);
            }
        } catch (err) {
            console.warn('Could not load user workspace from firestore:', err);
        }
    }

    function applyWorkspaceData(data) {
        if (!data) return;

        // Restore reading page
        if (data.currentPage && !urlParams.get('page') && !state.pdfDoc && !state.djvuViewer && !state.djvuFallbackDoc) {
            state.currentPage = data.currentPage;
            if (dom.inputCurrentPage) dom.inputCurrentPage.value = state.currentPage;
        }
        if (data.totalPages && !state.pdfDoc && !state.djvuViewer && !state.djvuFallbackDoc) {
            state.totalPages = data.totalPages;
            if (dom.labelTotalPages) dom.labelTotalPages.textContent = state.totalPages;
        }

        // Restore bookmarks & notes safely
        if (Array.isArray(data.bookmarks)) {
            if (data.bookmarks.length > 0 || state.bookmarks.length === 0) {
                state.bookmarks = data.bookmarks;
            }
        }
        if (Array.isArray(data.notes)) {
            if (data.notes.length > 0 || state.notes.length === 0) {
                state.notes = data.notes;
            }
        }
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
    // 5. PAGE NAVIGATION & BIDIRECTIONAL SCROLL SYNC
    // ========================================================
    function scheduleSaveWorkspace(delayMs = 500) {
        if (state.workspaceSaveTimer) {
            clearTimeout(state.workspaceSaveTimer);
        }
        state.workspaceSaveTimer = setTimeout(() => {
            state.workspaceSaveTimer = null;
            saveUserBookWorkspace();
        }, delayMs);
    }

    function flushScheduledWorkspaceSave() {
        if (state.workspaceSaveTimer) {
            clearTimeout(state.workspaceSaveTimer);
            state.workspaceSaveTimer = null;
            saveUserBookWorkspace();
        }
    }

    function syncPageFromViewerScroll(newPage) {
        const total = Math.max(1, state.totalPages || 1);
        const p = Math.min(Math.max(1, parseInt(newPage, 10) || 1), total);
        // Якщо користувач ввів сторінку в поле і одразу почав скролити — знімаємо фокус,
        // щоб обидва лічильники (у хедері та внизу рідера) завжди оновлювалися синхронно.
        const activeEl = document.activeElement;
        if (activeEl && (activeEl === dom.inputCurrentPage || (state.viewerBottomBar && activeEl === state.viewerBottomBar.pageInput))) {
            try { activeEl.blur(); } catch (_) {}
        }
        if (p === state.currentPage) {
            updatePageUI(true);
            return;
        }
        state.currentPage = p;
        updatePageUI(true);
        scheduleSaveWorkspace(500);
    }

    function detectVisiblePageInViewport() {
        if (!dom.viewport || Date.now() < state.programmaticScrollUntil) return;

        // 1. PDF.js continuous pages inside #reader-viewport
        if (state.pdfDoc && state.pdfPageContainers && state.pdfPageContainers.length > 0) {
            const pages = state.pdfPageContainers;
            const vp = dom.viewport;
            if (vp.scrollTop <= 4) {
                syncPageFromViewerScroll(1);
                return;
            }
            if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 6) {
                syncPageFromViewerScroll(pages.length);
                return;
            }
            const vpRect = vp.getBoundingClientRect();
            const readingLineY = vpRect.top + Math.min(220, vpRect.height * 0.36);

            let lo = 0;
            let hi = pages.length - 1;
            let foundIdx = 0;
            while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                const r = pages[mid].getBoundingClientRect();
                if (r.bottom < readingLineY) {
                    foundIdx = Math.min(pages.length - 1, mid + 1);
                    lo = mid + 1;
                } else if (r.top > readingLineY) {
                    foundIdx = mid;
                    hi = mid - 1;
                } else {
                    foundIdx = mid;
                    break;
                }
            }
            syncPageFromViewerScroll(foundIdx + 1);
            return;
        }

        // 2. HTML documents (.doc / .docx / .txt) inside #reader-viewport
        if (state.htmlDocActive && state.totalPages > 1) {
            const maxScroll = Math.max(0, dom.viewport.scrollHeight - dom.viewport.clientHeight);
            if (maxScroll <= 8) {
                syncPageFromViewerScroll(1);
                return;
            }
            const ratio = Math.min(1, Math.max(0, dom.viewport.scrollTop / maxScroll));
            const p = 1 + Math.round(ratio * (state.totalPages - 1));
            syncPageFromViewerScroll(p);
        }
    }

    function goToPage(page) {
        const total = Math.max(1, state.totalPages || 1);
        const p = Math.min(Math.max(1, parseInt(page, 10) || 1), total);
        state.programmaticScrollUntil = Date.now() + 380;
        state.currentPage = p;
        updatePageUI(true);

        // 1. PDF.js continuous scroll viewer
        if (state.pdfDoc && state.pdfPageContainers && state.pdfPageContainers.length > 0) {
            scrollToPdfPage(p);
        }
        // 2. DjVu.js Viewer / Canvas Fallback page navigation
        else if (state.djvuViewer && state.djvuViewer.configure) {
            try {
                state.djvuViewer.configure({ pageNumber: p });
            } catch (err) {
                console.warn('DjVu configure page error:', err);
            }
        } else if (state.djvuFallbackDoc) {
            renderDjVuFallbackPage(p).catch(err => console.warn('DjVu fallback page error:', err));
        }
        // 3. HTML documents (.doc / .docx / .txt)
        else if (state.htmlDocActive && dom.viewport) {
            const maxScroll = Math.max(0, dom.viewport.scrollHeight - dom.viewport.clientHeight);
            dom.viewport.scrollTop = total > 1
                ? Math.round(((p - 1) / (total - 1)) * maxScroll)
                : 0;
        }
        // 4. Native Iframe fallback (PDF fallback mode)
        else if (dom.docFrame && dom.docFrame.style.display !== 'none' && dom.docFrame.src && !state.isOfficeViewer) {
            const raw = dom.docFrame.src.split('#')[0];
            if (!raw.startsWith('blob:') && state.pdfBlobUrl) {
                dom.docFrame.src = `${state.pdfBlobUrl}#page=${p}&toolbar=1&navpanes=0`;
            } else if (raw.startsWith('blob:')) {
                const cleanBlob = raw.split('?')[0];
                dom.docFrame.src = `${cleanBlob}#page=${p}&toolbar=1&navpanes=0`;
            } else {
                try {
                    const u = new URL(raw, window.location.href);
                    u.searchParams.set('page_sync', p);
                    dom.docFrame.src = `${u.toString()}#page=${p}&toolbar=1&navpanes=0`;
                } catch (_) {
                    const clean = raw.split('?')[0];
                    dom.docFrame.src = `${clean}?page_sync=${p}#page=${p}&toolbar=1&navpanes=0`;
                }
            }
        }

        scheduleSaveWorkspace(150);
    }

    function updatePageUI(forceInputOverwrite = false) {
        const total = Math.max(1, state.totalPages || 1);
        const cur = Math.min(Math.max(1, state.currentPage || 1), total);

        if (dom.inputCurrentPage && (forceInputOverwrite || document.activeElement !== dom.inputCurrentPage)) {
            dom.inputCurrentPage.value = cur;
        }
        if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
        if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
        if (dom.btnPrevPage) dom.btnPrevPage.disabled = cur <= 1;
        if (dom.btnNextPage) dom.btnNextPage.disabled = cur >= total;

        const percent = Math.min(100, Math.max(1, Math.round((cur / total) * 100)));
        if (dom.labelPercentage) dom.labelPercentage.textContent = `${percent}%`;

        if (state.viewerBottomBar) {
            const b = state.viewerBottomBar;
            if (b.pageInput && (forceInputOverwrite || document.activeElement !== b.pageInput)) {
                b.pageInput.value = String(cur);
            }
            if (b.pageInput) b.pageInput.max = String(total);
            if (b.totalSpan) b.totalSpan.textContent = String(total);
            if (b.prevBtn) b.prevBtn.disabled = cur <= 1;
            if (b.nextBtn) b.nextBtn.disabled = cur >= total;
        }
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

                // 1. Підпис вертикалі (ранг 1-8) на крайній лівій клітинці поточної орієнтації
                if (f === files[0]) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord-rank';
                    rankLabel.textContent = (r + 1);
                    sqDiv.appendChild(rankLabel);
                }

                // 2. Підпис горизонталі (файл a-h) на нижньому ряду поточної орієнтації
                if (r === ranks[7]) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord-file';
                    fileLabel.textContent = String.fromCharCode(97 + f);
                    sqDiv.appendChild(fileLabel);
                }

                const piece = board[7 - r][f];
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    pieceSpan.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                    pieceSpan.textContent = PIECE_SYMBOLS[key] || '';
                    pieceSpan.addEventListener('pointerdown', (e) => handlePiecePointerDown(e, squareName, piece));
                    sqDiv.appendChild(pieceSpan);
                }

                sqDiv.addEventListener('pointerdown', (e) => {
                    if (e.target === sqDiv || e.target.classList.contains('coord-rank') || e.target.classList.contains('coord-file')) {
                        handleSquareClick(squareName);
                    }
                });
                dom.chessGrid.appendChild(sqDiv);
            }
        }

        // Оновлюємо показник переваги на дошці в реальному часі (+1.2 / -3.0)
        updateEvalBarUI();

        // Оновлюємо стрілки ходів (зелена - кращий хід, червона - загроза)
        updateBoardArrows();
    }

    // Pointer Events Drag & Drop Controller
    let activeDrag = null;

    function handlePiecePointerDown(e, squareName, piece) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
        activeDrag = {
            type: 'board',
            fromSquare: squareName,
            piece: piece,
            pieceKey: pieceKey,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            el: e.currentTarget
        };

        window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
        window.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
        window.addEventListener('pointercancel', onGlobalPointerUp, { passive: false });
    }

    function handlePalettePiecePointerDown(e, pieceKey) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        activeDrag = {
            type: 'palette',
            pieceKey: pieceKey,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            el: e.currentTarget
        };

        window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
        window.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
        window.addEventListener('pointercancel', onGlobalPointerUp, { passive: false });
    }

    function onGlobalPointerMove(e) {
        if (!activeDrag) return;
        const dx = e.clientX - activeDrag.startX;
        const dy = e.clientY - activeDrag.startY;

        if (!activeDrag.moved && Math.hypot(dx, dy) > 4) {
            activeDrag.moved = true;
            let ghost = document.getElementById('chess-drag-ghost');
            if (!ghost) {
                ghost = document.createElement('div');
                ghost.id = 'chess-drag-ghost';
                document.body.appendChild(ghost);
            }
            ghost.textContent = PIECE_SYMBOLS[activeDrag.pieceKey] || '';
            const isWhite = activeDrag.pieceKey === activeDrag.pieceKey.toUpperCase();
            ghost.className = `chess-drag-ghost ${isWhite ? 'white' : 'black'}`;
            ghost.style.display = 'flex';
            activeDrag.ghostEl = ghost;

            if (activeDrag.type === 'board') {
                chessState.selectedSquare = activeDrag.fromSquare;
                highlightPossibleMoves(activeDrag.fromSquare);
            }
            if (activeDrag.el) {
                activeDrag.el.style.opacity = '0.3';
            }
        }

        if (activeDrag.moved && activeDrag.ghostEl) {
            activeDrag.ghostEl.style.left = `${e.clientX}px`;
            activeDrag.ghostEl.style.top = `${e.clientY}px`;

            const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
            const sqUnder = elemUnder ? elemUnder.closest('.chess-square') : null;
            document.querySelectorAll('.chess-square.drag-hover').forEach(s => s.classList.remove('drag-hover'));
            if (sqUnder) {
                sqUnder.classList.add('drag-hover');
            }
        }
    }

    function onGlobalPointerUp(e) {
        window.removeEventListener('pointermove', onGlobalPointerMove);
        window.removeEventListener('pointerup', onGlobalPointerUp);
        window.removeEventListener('pointercancel', onGlobalPointerUp);

        if (!activeDrag) return;
        const drag = activeDrag;
        activeDrag = null;

        if (drag.ghostEl) {
            drag.ghostEl.style.display = 'none';
        }
        if (drag.el) {
            drag.el.style.opacity = '1';
        }
        document.querySelectorAll('.chess-square.drag-hover').forEach(s => s.classList.remove('drag-hover'));

        if (!drag.moved) {
            if (drag.type === 'board') {
                handleSquareClick(drag.fromSquare);
            }
            return;
        }

        const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
        const sqUnder = elemUnder ? elemUnder.closest('.chess-square') : null;
        const targetSquare = sqUnder ? sqUnder.dataset.square : null;

        if (drag.type === 'palette') {
            if (targetSquare) {
                const col = drag.pieceKey === drag.pieceKey.toUpperCase() ? 'w' : 'b';
                const typ = drag.pieceKey.toLowerCase();
                chessState.game.put({ type: typ, color: col }, targetSquare);
                renderChessBoard();
                requestStockfishEval();
                saveUserBookWorkspace();
                showSyncToast(`Встановлено ${PIECE_SYMBOLS[drag.pieceKey]} на ${targetSquare}`);
            }
            return;
        }

        if (drag.type === 'board') {
            const fromSq = drag.fromSquare;

            // Перетягнуто ЗА межі шахівниці -> видалення фігури з дошки в редакторі!
            if (!targetSquare) {
                chessState.game.remove(fromSq);
                chessState.selectedSquare = null;
                showSyncToast('🗑️ Фігуру прибрано з дошки');
                renderChessBoard();
                requestStockfishEval();
                saveUserBookWorkspace();
                return;
            }

            if (targetSquare === fromSq) {
                chessState.selectedSquare = null;
                renderChessBoard();
                return;
            }

            if (chessState.editorActivePiece) {
                chessState.game.remove(fromSq);
                const col = drag.pieceKey === drag.pieceKey.toUpperCase() ? 'w' : 'b';
                const typ = drag.pieceKey.toLowerCase();
                chessState.game.put({ type: typ, color: col }, targetSquare);
                chessState.selectedSquare = null;
                renderChessBoard();
                requestStockfishEval();
                saveUserBookWorkspace();
                return;
            }

            const move = chessState.game.move({
                from: fromSq,
                to: targetSquare,
                promotion: 'q'
            });

            if (move) {
                chessState.selectedSquare = null;
                chessState.moveHistory.push(move.san);
                chessState.currentMoveIndex = chessState.moveHistory.length - 1;
                updateMovesLogUI();
                renderChessBoard();
                requestStockfishEval();
                saveUserBookWorkspace();
            } else {
                chessState.game.remove(fromSq);
                const col = drag.pieceKey === drag.pieceKey.toUpperCase() ? 'w' : 'b';
                const typ = drag.pieceKey.toLowerCase();
                chessState.game.put({ type: typ, color: col }, targetSquare);
                chessState.selectedSquare = null;
                renderChessBoard();
                requestStockfishEval();
                saveUserBookWorkspace();
            }
        }
    }

    function handleSquareClick(square) {
        if (chessState.editorActivePiece) {
            placePieceInEditor(square, chessState.editorActivePiece);
            requestStockfishEval();
            saveUserBookWorkspace();
            return;
        }

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
                requestStockfishEval();
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
    // ========================================================
    // 7. NOTATION PARSER & REPLAY (Smart Figurine & Cyrillic Translator)
    // ========================================================
    function parseChessMovesFromText(rawText) {
        if (!rawText || typeof rawText !== 'string') return [];

        let text = rawText
            // 1. Unicode figurines
            .replace(/[\u2654\u265A]/g, 'K')
            .replace(/[\u2655\u265B]/g, 'Q')
            .replace(/[\u2656\u265C]/g, 'R')
            .replace(/[\u2657\u265D]/g, 'B')
            .replace(/[\u2658\u265E]/g, 'N')
            .replace(/[\u2659\u265F]/g, '')
            // 2. Castling
            .replace(/[ОO0]-[ОO0]-[ОO0]/gi, 'O-O-O')
            .replace(/[ОO0]-[ОO0]/gi, 'O-O')
            // 3. Cyrillic pieces
            .replace(/Кр/gi, 'K')
            .replace(/Ф/g, 'Q')
            .replace(/Л/g, 'R')
            .replace(/С(?=[a-hа-яx:1-8])/g, 'B')
            .replace(/К(?=[a-hа-яx:1-8])/g, 'N')
            // 4. Soviet typography font mapping (Knight encoded as Д/д)
            .replace(/[Дд](?=[a-hа-яЬx:1-8])/g, 'N')
            // 5. Font letter Ь/ь -> b
            .replace(/[Ьь](?=[1-8])/g, 'b')
            // 6. Soviet chess fonts / OCR: digit 2 before file/square is Bishop (B)
            .replace(/2(?=[a-hа-яx:1-8])/g, 'B')
            // 7. OCR file 'g' scanned as '9' (e.g. 96 -> g6, 94 -> g4)
            .replace(/9(?=[1-8])/g, 'g')
            // 8. Cyrillic files mapping
            .replace(/а(?=[1-8x:])/gi, 'a')
            .replace(/б(?=[1-8x:])/gi, 'b')
            .replace(/с(?=[1-8x:])/g, 'c')
            .replace(/д(?=[1-8x:])/g, 'd')
            .replace(/е(?=[1-8x:])/gi, 'e')
            .replace(/ф(?=[1-8x:])/gi, 'f')
            .replace(/г(?=[1-8x:])/gi, 'g')
            .replace(/h(?=[1-8x:])/gi, 'h')
            // 9. Captures symbol (: and x and Cyrillic х)
            .replace(/[:xх]/g, 'x');

        // Remove move numbers like '1.', '2.', '12...' and punctuation
        text = text.replace(/\b\d+\s*\.{1,3}/g, ' ')
                   .replace(/[\(\)\,\!\?\#\+\;]/g, ' ');

        const tokens = text.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return [];

        function getCandidates(g, token) {
            const list = [];

            // 1. Pawn capture e.g. 'cd', 'cxd', 'ed', 'fe', 'gf'
            const pawnCap = token.match(/^([a-h])x?([a-h])$/);
            if (pawnCap) {
                const fromF = pawnCap[1];
                const toF = pawnCap[2];
                const found = g.moves({ verbose: true }).find(m => m.piece === 'p' && m.from[0] === fromF && m.to[0] === toF);
                if (found) list.push(found);
            }

            // 2. Piece-less capture e.g. 'xd4', ':d4', 'xc6', 'xf5'
            if (token.startsWith('x') || token.startsWith(':')) {
                const target = token.replace(/[:x]/g, '');
                const caps = g.moves({ verbose: true }).filter(m => m.to === target && m.captured);
                caps.sort((a, b) => {
                    const order = { n: 1, b: 2, r: 3, q: 4, p: 5, k: 6 };
                    return (order[a.piece] || 9) - (order[b.piece] || 9);
                });
                caps.forEach(c => list.push(c));
            }

            // 3. Coordinate square like 'f3', 'c3', 'f6', 'c6', 'a6', 'd6', 'e5', 'e6'
            if (/^[a-h][1-8]$/.test(token)) {
                // Common knight development squares where piece letter was dropped by OCR
                const isCommonKnightSquare = ['f3', 'c3', 'f6', 'c6'].includes(token);
                if (isCommonKnightSquare) {
                    try {
                        const km = g.move('N' + token, { sloppy: true });
                        if (km) { g.undo(); list.push(km); }
                    } catch (_) {}
                }

                // Direct pawn move
                try {
                    const pm = g.move(token, { sloppy: true });
                    if (pm) { g.undo(); list.push(pm); }
                } catch (_) {}

                // Other pieces (N, B, R, Q, K)
                for (const p of ['N', 'B', 'R', 'Q', 'K']) {
                    try {
                        const m = g.move(p + token, { sloppy: true });
                        if (m) {
                            g.undo();
                            if (!list.some(x => x.san === m.san)) list.push(m);
                        }
                    } catch (_) {}
                }
            } else {
                // Direct move attempt
                try {
                    const m = g.move(token, { sloppy: true });
                    if (m) { g.undo(); list.push(m); }
                } catch (_) {}
            }

            // 4. Missing file or OCR digit artifact (e.g. "5" when Nf5 was played)
            if (/^[1-8]$/.test(token) && list.length === 0) {
                for (const f of ['f', 'c', 'd', 'e', 'g', 'b', 'a', 'h']) {
                    const sq = f + token;
                    const mvs = g.moves({ verbose: true }).filter(m => m.to === sq);
                    mvs.sort((a, b) => {
                        const order = { n: 1, b: 2, r: 3, q: 4, p: 5, k: 6 };
                        return (order[a.piece] || 9) - (order[b.piece] || 9);
                    });
                    mvs.forEach(m => {
                        if (!list.some(x => x.san === m.san)) list.push(m);
                    });
                }
            }

            return list;
        }

        // Fast linear parsing with 2-step lookahead and resilient token skipping
        const g = new Chess();
        const moves = [];
        let idx = 0;

        while (idx < tokens.length) {
            const token = tokens[idx];
            const candidates = getCandidates(g, token);

            if (candidates.length === 0) {
                // Skip non-move token (annotations, OCR noise, symbols)
                idx++;
                continue;
            }

            if (candidates.length === 1) {
                g.move(candidates[0]);
                moves.push(candidates[0].san);
                idx++;
            } else {
                // Test candidates with lookahead up to 2 steps to pick the branch that continues
                let bestCand = candidates[0];
                let bestScore = -1;

                for (const cand of candidates) {
                    g.move(cand);
                    let score = 1;
                    if (idx + 1 < tokens.length) {
                        const nextCands1 = getCandidates(g, tokens[idx + 1]);
                        if (nextCands1.length > 0) {
                            score += 2;
                            g.move(nextCands1[0]);
                            if (idx + 2 < tokens.length) {
                                const nextCands2 = getCandidates(g, tokens[idx + 2]);
                                if (nextCands2.length > 0) score += 3;
                            }
                            g.undo();
                        }
                    }
                    g.undo();

                    if (score > bestScore) {
                        bestScore = score;
                        bestCand = cand;
                    }
                }

                g.move(bestCand);
                moves.push(bestCand.san);
                idx++;
            }
        }

        return moves;
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
        requestStockfishEval();
        switchDockTab('board');
        saveUserBookWorkspace();
        showSyncToast(`♟️ Завантажено ${chessState.moveHistory.length} ходів на дошку!`);
    }

    function updateMovesLogUI() {
        if (!dom.boardMovesLog) return;
        dom.boardMovesLog.innerHTML = '';
        if (chessState.moveHistory.length === 0) {
            dom.boardMovesLog.style.display = 'none';
            return;
        }
        dom.boardMovesLog.style.display = '';

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
        requestStockfishEval();
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

            div.style.cursor = 'pointer';
            div.addEventListener('click', () => goToPage(bm.page));
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
        const actual = side === 'left' ? 'left' : 'right';
        state.settings.dockSide = actual;
        localStorage.setItem('chess_vault_reader_dock_side', actual);

        dom.workspace.classList.remove('dock-left', 'dock-right');
        dom.workspace.classList.add(`dock-${actual}`);

        if (dom.settingDockLeft && dom.settingDockRight) {
            dom.settingDockLeft.classList.toggle('active', actual === 'left');
            dom.settingDockRight.classList.toggle('active', actual === 'right');
        }
    }

    function applyEvalMode(mode) {
        state.settings.evalMode = mode;
        localStorage.setItem('chess_vault_reader_eval_mode', mode);

        if (dom.settingEvalFull) dom.settingEvalFull.classList.toggle('active', mode === 'full');
        if (dom.settingEvalNumbers) dom.settingEvalNumbers.classList.toggle('active', mode === 'numbers');
        if (dom.settingEvalOff) dom.settingEvalOff.classList.toggle('active', mode === 'off');

        updateEvalBarUI();
        saveUserBookWorkspace();
    }

    function openSettingsModal() {
        if (!dom.settingsModal) return;
        if (dom.settingDockLeft && dom.settingDockRight) {
            dom.settingDockLeft.classList.toggle('active', state.settings.dockSide === 'left');
            dom.settingDockRight.classList.toggle('active', state.settings.dockSide === 'right');
        }
        if (dom.settingEvalFull && dom.settingEvalNumbers && dom.settingEvalOff) {
            dom.settingEvalFull.classList.toggle('active', state.settings.evalMode === 'full');
            dom.settingEvalNumbers.classList.toggle('active', state.settings.evalMode === 'numbers');
            dom.settingEvalOff.classList.toggle('active', state.settings.evalMode === 'off');
        }
        if (dom.settingArrowBest) dom.settingArrowBest.checked = state.settings.arrowBest;
        if (dom.settingArrowThreat) dom.settingArrowThreat.checked = state.settings.arrowThreat;

        dom.settingsModal.style.display = 'flex';
    }

    function closeSettingsModal() {
        if (!dom.settingsModal) return;
        dom.settingsModal.style.display = 'none';
    }

    function applyDockCollapsed(collapsed) {
        state.isDockCollapsed = Boolean(collapsed);
        localStorage.setItem('chess_vault_reader_dock_collapsed', String(state.isDockCollapsed));

        if (state.isDockCollapsed) {
            dom.dock.classList.add('collapsed');
            dom.dockCollapseArrow.textContent = state.settings.dockSide === 'right' ? '◂' : '▸';
        } else {
            dom.dock.classList.remove('collapsed');
            dom.dockCollapseArrow.textContent = state.settings.dockSide === 'right' ? '▸' : '◂';
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
    function getActiveSelection() {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            return {
                text: selection.toString().trim(),
                range: selection.rangeCount > 0 ? selection.getRangeAt(0) : null
            };
        }
        if (dom.djvuMount) {
            const el = dom.djvuMount.querySelector('*') || dom.djvuMount;
            if (el && el.shadowRoot && el.shadowRoot.getSelection) {
                const sSel = el.shadowRoot.getSelection();
                if (sSel && sSel.toString().trim()) {
                    return {
                        text: sSel.toString().trim(),
                        range: sSel.rangeCount > 0 ? sSel.getRangeAt(0) : null
                    };
                }
            }
        }
        return { text: '', range: null };
    }

    function handleTextSelection() {
        const selObj = getActiveSelection();
        const text = selObj.text;

        if (!text || text.length < 2) {
            dom.selectionToolbar.style.display = 'none';
            return;
        }

        state.selectedText = text;
        if (dom.inputChessMoves) {
            dom.inputChessMoves.value = text;
        }

        let rect = null;
        if (selObj.range) {
            rect = selObj.range.getBoundingClientRect();
        }

        if (rect && rect.width > 0) {
            dom.selectionToolbar.style.top = `${Math.max(10, rect.top - 46)}px`;
            dom.selectionToolbar.style.left = `${rect.left + rect.width / 2}px`;
        } else {
            dom.selectionToolbar.style.top = '70px';
            dom.selectionToolbar.style.left = '50%';
        }
        dom.selectionToolbar.style.display = 'flex';
    }

    // ========================================================
    // 11. EVENT LISTENERS
    // ========================================================
    function bindEvents() {
        dom.btnPrevPage.addEventListener('click', () => goToPage(state.currentPage - 1));
        dom.btnNextPage.addEventListener('click', () => goToPage(state.currentPage + 1));
        dom.inputCurrentPage.addEventListener('change', () => {
            goToPage(dom.inputCurrentPage.value);
            dom.inputCurrentPage.blur();
        });
        dom.inputCurrentPage.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToPage(dom.inputCurrentPage.value);
                dom.inputCurrentPage.blur();
            }
        });

        if (dom.viewport) {
            let scrollRafPending = false;
            dom.viewport.addEventListener('scroll', () => {
                if (scrollRafPending) return;
                scrollRafPending = true;
                requestAnimationFrame(() => {
                    scrollRafPending = false;
                    detectVisiblePageInViewport();
                });
            }, { passive: true });
        }

        window.addEventListener('pagehide', flushScheduledWorkspaceSave);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushScheduledWorkspaceSave();
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') goToPage(state.currentPage - 1);
            if (e.key === 'ArrowRight') goToPage(state.currentPage + 1);
        });

        // Settings modal controls
        if (dom.btnReaderSettings) {
            dom.btnReaderSettings.addEventListener('click', openSettingsModal);
        }
        if (dom.btnCloseSettings) {
            dom.btnCloseSettings.addEventListener('click', closeSettingsModal);
        }
        if (dom.btnDoneSettings) {
            dom.btnDoneSettings.addEventListener('click', closeSettingsModal);
        }
        if (dom.settingsModal) {
            dom.settingsModal.addEventListener('click', (e) => {
                if (e.target === dom.settingsModal) closeSettingsModal();
            });
        }
        if (dom.settingDockLeft) {
            dom.settingDockLeft.addEventListener('click', () => applyDockSide('left'));
        }
        if (dom.settingDockRight) {
            dom.settingDockRight.addEventListener('click', () => applyDockSide('right'));
        }
        if (dom.settingEvalFull) {
            dom.settingEvalFull.addEventListener('click', () => applyEvalMode('full'));
        }
        if (dom.settingEvalNumbers) {
            dom.settingEvalNumbers.addEventListener('click', () => applyEvalMode('numbers'));
        }
        if (dom.settingEvalOff) {
            dom.settingEvalOff.addEventListener('click', () => applyEvalMode('off'));
        }
        if (dom.settingArrowBest) {
            dom.settingArrowBest.addEventListener('change', (e) => {
                state.settings.arrowBest = e.target.checked;
                localStorage.setItem('chess_vault_reader_arrow_best', String(state.settings.arrowBest));
                updateBoardArrows();
            });
        }
        if (dom.settingArrowThreat) {
            dom.settingArrowThreat.addEventListener('change', (e) => {
                state.settings.arrowThreat = e.target.checked;
                localStorage.setItem('chess_vault_reader_arrow_threat', String(state.settings.arrowThreat));
                updateBoardArrows();
            });
        }
        if (dom.settingBtnFullscreen) {
            dom.settingBtnFullscreen.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }
        if (dom.btnQuickNote) {
            dom.btnQuickNote.addEventListener('click', () => {
                switchDockTab('notes');
                if (dom.noteInput) dom.noteInput.focus();
                showSyncToast('📝 Введіть нотатку або коментар до поточної сторінки');
            });
        }

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
            btn.addEventListener('pointerdown', (e) => handlePalettePiecePointerDown(e, btn.dataset.piece));
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

        // Zoom Controls initialization
        initZoomControls();

        // Selection toolbar
        document.addEventListener('mouseup', handleTextSelection);

        dom.selBtnChess.addEventListener('click', () => {
            if (dom.inputChessMoves) dom.inputChessMoves.value = state.selectedText;
            const moves = parseChessMovesFromText(state.selectedText);
            loadMovesToBoard(moves);
            dom.selectionToolbar.style.display = 'none';
        });

        // Manual moves entry & paste
        function handleManualMovesSubmit() {
            const raw = dom.inputChessMoves ? dom.inputChessMoves.value.trim() : '';
            if (!raw) return;
            const moves = parseChessMovesFromText(raw);
            if (moves && moves.length > 0) {
                loadMovesToBoard(moves);
                if (dom.inputChessMoves) dom.inputChessMoves.value = '';
            } else {
                showSyncToast('⚠️ Не вдалося розпізнати шахові ходи', 'warn');
            }
        }

        async function handlePasteMovesClick() {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const clipText = await navigator.clipboard.readText();
                    if (clipText && clipText.trim()) {
                        if (dom.inputChessMoves) dom.inputChessMoves.value = clipText.trim();
                        handleManualMovesSubmit();
                        return;
                    }
                }
            } catch (err) {
                console.warn('Clipboard read error:', err);
            }
            if (dom.inputChessMoves) {
                dom.inputChessMoves.focus();
                showSyncToast('Вставте текст комбінацією Ctrl+V (або Cmd+V)');
            }
        }

        if (dom.inputChessMoves) {
            dom.inputChessMoves.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualMovesSubmit();
                }
            });
            dom.inputChessMoves.addEventListener('paste', () => {
                setTimeout(handleManualMovesSubmit, 60);
            });
        }

        if (dom.btnLoadMoves) {
            dom.btnLoadMoves.addEventListener('click', handleManualMovesSubmit);
        }

        if (dom.btnPasteMoves) {
            dom.btnPasteMoves.addEventListener('click', handlePasteMovesClick);
        }

        if (dom.boardMovesLog) {
            dom.boardMovesLog.addEventListener('click', () => {
                if (chessState.moveHistory.length === 0 && dom.inputChessMoves) {
                    dom.inputChessMoves.focus();
                }
            });
        }

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
        if (dom.inputLocalFile) {
            const triggerFilePick = () => dom.inputLocalFile.click();
            if (dom.btnPickLocal) dom.btnPickLocal.addEventListener('click', triggerFilePick);
            if (dom.btnTopbarLocal) dom.btnTopbarLocal.addEventListener('click', triggerFilePick);
            dom.inputLocalFile.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleLocalFileSelected(file);
                e.target.value = '';
            });
        }

        // Drag & drop file support (works across entire reader window)
        const onDragOver = (e) => {
            if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
                e.preventDefault();
                if (dom.viewport) dom.viewport.style.outline = '2px dashed var(--reader-accent)';
            }
        };
        const onDragLeave = (e) => {
            if (!e.relatedTarget && dom.viewport) {
                dom.viewport.style.outline = 'none';
            }
        };
        const onDrop = (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                e.preventDefault();
                if (dom.viewport) dom.viewport.style.outline = 'none';
                handleLocalFileSelected(e.dataTransfer.files[0]);
            }
        };
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDrop);
    }

    // ========================================================
    // ZOOM CONTROLS (Reader scale & text magnification)
    // ========================================================
    function initZoomControls() {
        const savedZoom = localStorage.getItem('chess_vault_reader_zoom');
        if (savedZoom) {
            state.zoom = parseFloat(savedZoom) || 1.0;
        }

        if (dom.labelZoomLevel) {
            dom.labelZoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
            dom.labelZoomLevel.addEventListener('click', () => setReaderZoom(1.0));
        }

        if (dom.btnZoomOut) {
            dom.btnZoomOut.addEventListener('click', () => setReaderZoom(state.zoom - 0.15));
        }

        if (dom.btnZoomIn) {
            dom.btnZoomIn.addEventListener('click', () => setReaderZoom(state.zoom + 0.15));
        }

        if (dom.settingZoomControl) {
            const btns = dom.settingZoomControl.querySelectorAll('.setting-segment-btn');
            btns.forEach(btn => {
                const z = parseFloat(btn.dataset.zoom);
                btn.classList.toggle('active', Math.abs(z - state.zoom) < 0.08);
                btn.addEventListener('click', () => setReaderZoom(z));
            });
        }

        applyZoomToDocument();
    }

    function setReaderZoom(newZoom) {
        state.zoom = Math.max(0.7, Math.min(2.2, Math.round(newZoom * 100) / 100));
        localStorage.setItem('chess_vault_reader_zoom', state.zoom.toString());

        if (dom.labelZoomLevel) {
            dom.labelZoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
        }

        if (dom.settingZoomControl) {
            const btns = dom.settingZoomControl.querySelectorAll('.setting-segment-btn');
            btns.forEach(btn => {
                const z = parseFloat(btn.dataset.zoom);
                btn.classList.toggle('active', Math.abs(z - state.zoom) < 0.08);
            });
        }

        applyZoomToDocument();
    }

    function applyZoomToDocument() {
        const z = state.zoom || 1.0;
        if (state.pdfDoc && state.pdfPageContainers) {
            refreshPdfZoomLayout();
            return;
        }
        if (dom.docFrame) {
            dom.docFrame.style.transformOrigin = 'top center';
            if (z === 1.0) {
                dom.docFrame.style.transform = '';
                dom.docFrame.style.width = '100%';
                dom.docFrame.style.height = '';
            } else {
                dom.docFrame.style.transform = `scale(${z})`;
                dom.docFrame.style.width = `${100 / z}%`;
                dom.docFrame.style.height = `${100 / z}%`;
            }
        }
        if (state.djvuViewer && state.djvuViewer.configure) {
            if (dom.djvuMount) dom.djvuMount.style.transform = '';
            try {
                state.djvuViewer.configure({ pageScale: z });
            } catch (_) {}
        } else if (state.djvuFallbackCanvas) {
            state.djvuFallbackCanvas.style.width = z === 1.0 ? '' : `${Math.round(z * 100)}%`;
            state.djvuFallbackCanvas.style.maxWidth = z > 1.0 ? 'none' : '100%';
        } else if (dom.djvuMount) {
            dom.djvuMount.style.transformOrigin = 'top center';
            dom.djvuMount.style.transform = z === 1.0 ? '' : `scale(${z})`;
        }
        if (dom.contentWrap) {
            dom.contentWrap.style.fontSize = `${1.05 * z}rem`;
        }
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
        cleanupViewerState();
        setViewportInnerScrollLock(false);
        dom.loading.style.display = 'none';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
        if (dom.docFrame) dom.docFrame.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) {
            dom.contentWrap.style.display = 'block';
            const directUrl = state.resolvedDirectUrl || '';
            dom.contentWrap.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">📂</div>
                    <h3 style="margin-bottom: 8px;">Відкриття персональної копії книги</h3>
                    <p style="color: var(--reader-text-muted); max-width: 480px; margin: 0 auto 16px;">
                        ${escapeHtml(msg || 'Оберіть файл книги з комп’ютера, щоб зберегти його у вашу особисту бібліотеку.')}
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
                        <button type="button" onclick="document.getElementById('input-local-file').click()" class="btn-add-note" style="padding: 12px 24px; font-size: 0.95rem; cursor: pointer; border: none; border-radius: 8px; font-weight: 600;">
                            📂 Обрати файл з пристрою
                        </button>
                        ${directUrl ? `
                            <a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener" class="btn-add-note" style="text-decoration: none; padding: 12px 24px; font-size: 0.95rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);">
                                🔗 Завантажити оригінал
                            </a>
                        ` : ''}
                    </div>
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
