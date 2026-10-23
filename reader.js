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
    const rawId = (urlParams.get('id') || '').replace(/\+/g, ' ').trim();
    const rawFile = (urlParams.get('file') || '').replace(/\+/g, ' ').trim();
    const rawTitle = (urlParams.get('title') || '').replace(/\+/g, ' ').trim();
    const rawAuthor = (urlParams.get('author') || '').replace(/\+/g, ' ').trim();
    const bookParam = {
        id: rawId || 'book_' + Date.now(),
        file: rawFile,
        title: rawTitle || 'Шахова книга',
        author: rawAuthor || '—',
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
        btnReaderSettings: document.getElementById('btn-reader-settings'),
        btnQuickNote: document.getElementById('btn-quick-note'),
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
        // Stockfish Engine Eval
        engineEvalBox: document.getElementById('engine-eval-box'),
        engineEvalScorePill: document.getElementById('engine-eval-score-pill'),
        engineEvalDepth: document.getElementById('engine-eval-depth'),
        engineEvalPv: document.getElementById('engine-eval-pv'),
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

        if (dom.engineEvalDepth) dom.engineEvalDepth.textContent = 'обчислення...';
        if (dom.engineEvalPv) dom.engineEvalPv.textContent = 'Аналіз позиції двигуном Stockfish...';

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
        if (dom.engineEvalScorePill) {
            dom.engineEvalScorePill.textContent = stockfishState.textScore;
            const s = stockfishState.textScore;
            if (s.startsWith('+')) {
                dom.engineEvalScorePill.style.background = 'rgba(34, 197, 94, 0.2)';
                dom.engineEvalScorePill.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                dom.engineEvalScorePill.style.color = '#22c55e';
            } else if (s.startsWith('-')) {
                dom.engineEvalScorePill.style.background = 'rgba(239, 68, 68, 0.2)';
                dom.engineEvalScorePill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                dom.engineEvalScorePill.style.color = '#ef4444';
            } else {
                dom.engineEvalScorePill.style.background = 'rgba(255, 255, 255, 0.1)';
                dom.engineEvalScorePill.style.borderColor = 'var(--reader-border)';
                dom.engineEvalScorePill.style.color = 'var(--reader-text)';
            }
        }

        if (dom.engineEvalDepth) {
            dom.engineEvalDepth.textContent = `d=${stockfishState.depth || 12}`;
        }

        if (dom.engineEvalPv) {
            dom.engineEvalPv.textContent = stockfishState.pvSan || 'Stockfish аналізує позицію...';
        }

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
        if (!pages && window.CHESS_PAGE_COUNTS) {
            const id = bookParam.id;
            const title = bookParam.title;
            if (window.CHESS_PAGE_COUNTS[id]) pages = window.CHESS_PAGE_COUNTS[id];
            else if (window.CHESS_PAGE_COUNTS[id.toLowerCase()]) pages = window.CHESS_PAGE_COUNTS[id.toLowerCase()];
            else if (title && window.CHESS_PAGE_COUNTS[title]) pages = window.CHESS_PAGE_COUNTS[title];
            else if (title && window.CHESS_PAGE_COUNTS[title.toLowerCase()]) pages = window.CHESS_PAGE_COUNTS[title.toLowerCase()];
            else {
                const clean = (title || id || '').toLowerCase().replace(/\.[^/.]+$/, '').trim();
                for (const [k, count] of Object.entries(window.CHESS_PAGE_COUNTS)) {
                    const normK = k.toLowerCase().replace(/\.[^/.]+$/, '').trim();
                    if (normK.includes(clean) || clean.includes(normK)) {
                        pages = count;
                        break;
                    }
                }
            }
        }
        if (!pages && window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) {
            const found = window.CHESS_BOOKS_CACHE.find(b => b && (b.id === bookParam.id || b.title === bookParam.title));
            if (found && found.pages) pages = parseInt(found.pages) || 0;
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

    async function downloadBookWithProgress(urls, onProgress) {
        if (!Array.isArray(urls)) urls = [urls];
        let lastError = null;

        for (const url of urls) {
            if (!url) continue;
            try {
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const contentLength = response.headers.get('content-length');
                const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                const reader = response.body.getReader();
                const chunks = [];
                let receivedBytes = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedBytes += value.length;
                    if (typeof onProgress === 'function') {
                        onProgress(receivedBytes, totalBytes);
                    }
                }

                let mime = 'application/pdf';
                if (bookParam.format === 'djvu') mime = 'image/vnd.djvu';
                else if (bookParam.format === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

                return new Blob(chunks, { type: mime });
            } catch (err) {
                console.warn(`Download attempt failed for ${url}:`, err);
                lastError = err;
            }
        }
        throw lastError || new Error('Не вдалося завантажити книгу');
    }

    // ========================================================
    // 3. DOCUMENT LOADERS (PDF, DjVu, DOCX + Local Drag & Drop)
    // ========================================================
    async function loadDocument() {
        let format = bookParam.format;

        // Auto-detect format from file extension if needed
        if (!format || format === '---') {
            const ext = (bookParam.file || bookParam.id).split('.').pop().toLowerCase();
            if (ext) format = ext;
        }

        if (dom.dropBar) dom.dropBar.style.display = 'flex';

        const uid = state.currentUser ? state.currentUser.uid : 'guest';

        // 1. ПЕРЕВІРЯЄМО ОСОБИСТУ КОПІЮ В INDEXEDDB (миттєве офлайн-відкриття 0ms)
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Пошук персональної копії книги...`;

        try {
            const cachedBlob = await getCachedBookBlob(bookParam.id, uid);
            if (cachedBlob && cachedBlob.size > 1024) {
                dom.loading.style.display = 'none';
                if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                showSyncToast('⚡ Відкрито збережену персональну копію (IndexedDB)');
                displayDocumentBlob(cachedBlob, format);
                return;
            }
        } catch (e) {
            console.warn('Error reading cached blob:', e);
        }

        // 2. ДЖЕРЕЛА ДЛЯ ЗАВАНТАЖЕННЯ (Прямі URL)
        const candidateUrls = [];
        const addCandidate = (u) => {
            if (!u || typeof u !== 'string') return;
            const clean = u.trim();
            if (clean && !candidateUrls.includes(clean)) {
                candidateUrls.push(clean);
            }
        };

        const cleanId = (bookParam.id || '').replace(/\.[^/.]+$/, '').trim();
        const fullId = (bookParam.id || '').trim();

        // Пошук у кеші бібліотеки (books-cache.js)
        if (window.CHESS_BOOKS_CACHE && Array.isArray(window.CHESS_BOOKS_CACHE)) {
            const b = window.CHESS_BOOKS_CACHE.find(x => 
                (x.id && x.id.toLowerCase() === fullId.toLowerCase()) ||
                (x.id && x.id.replace(/\.[^/.]+$/, '').toLowerCase() === cleanId.toLowerCase()) ||
                (x.title && x.title.toLowerCase() === (bookParam.title || '').toLowerCase())
            );
            if (b && b.url) {
                addCandidate(b.url);
            }
        }

        if (bookParam.file) {
            addCandidate(bookParam.file);
        }

        if (fullId) {
            let encId;
            try {
                encId = encodeURIComponent(decodeURIComponent(fullId));
            } catch (_) {
                encId = encodeURIComponent(fullId);
            }
            addCandidate(`https://archive.org/download/1971_20260223/${encId}`);
        }

        if (candidateUrls.length === 0) {
            showDocError('Посилання на файл відсутнє. Оберіть файл з комп’ютера для читання.');
            return;
        }

        const directUrl = candidateUrls[0];

        // 3. МИТТЄВЕ ВІДКРИТТЯ ДЛЯ PDF (Native Iframe - 0s очікування)
        if (format === 'pdf') {
            dom.loading.style.display = 'none';
            if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
            loadPdfDirect(directUrl);
            // Асинхронне збереження персональної копії без затримки читання
            downloadBookWithProgress([directUrl], () => {}).then(blob => {
                if (blob && blob.size > 1024) {
                    saveCachedBookBlob(bookParam.id, uid, blob, { format, title: bookParam.title });
                }
            }).catch(() => {});
            return;
        }

        // 4. ДЛЯ DJVU ТА DOCX
        if (format === 'djvu') {
            loadDjvuDirect(directUrl);
            return;
        }

        if (format === 'docx' || format === 'doc') {
            loadDocxDirect(directUrl);
            return;
        }

        // 5. ВІДОБРАЖАЄМО ПРОГРЕС-БАР ЗАВАНТАЖЕННЯ ДЛЯ ІНШИХ ФАЙЛІВ
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Завантаження персональної копії...`;
        if (dom.downloadProgressWrap) {
            dom.downloadProgressWrap.style.display = 'block';
            if (dom.downloadProgressFill) dom.downloadProgressFill.style.width = '0%';
            if (dom.downloadProgressPercent) dom.downloadProgressPercent.textContent = '0%';
            if (dom.downloadProgressBytes) dom.downloadProgressBytes.textContent = 'З’єднання з сервером...';
        }

        try {
            const blob = await downloadBookWithProgress(candidateUrls, (received, total) => {
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
            });

            // Зберігаємо персональну копію в локальну БД браузера!
            await saveCachedBookBlob(bookParam.id, uid, blob, { format, title: bookParam.title });

            if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
            dom.loading.style.display = 'none';
            showSyncToast('📖 Персональну копію книги збережено у вашу бібліотеку!');

            displayDocumentBlob(blob, format);
            return;
        } catch (downloadErr) {
            console.warn('Download fallback:', downloadErr);
            if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
            loadPdfDirect(directUrl);
        }
    }

    // DISPLAY DOCUMENT FROM BLOB (Personal copy)
    function displayDocumentBlob(blob, format) {
        const blobUrl = URL.createObjectURL(blob);
        if (format === 'pdf') {
            dom.docFrame.style.display = 'block';
            if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
            if (dom.contentWrap) dom.contentWrap.style.display = 'none';
            dom.docFrame.src = `${blobUrl}#page=${state.currentPage}&toolbar=1&navpanes=0`;
            dom.loading.style.display = 'none';
            updatePageUI();
        } else if (format === 'djvu') {
            if (typeof DjVu !== 'undefined' && DjVu.Viewer && dom.djvuMount) {
                dom.docFrame.style.display = 'none';
                dom.contentWrap.style.display = 'none';
                dom.djvuWrap.style.display = 'block';
                blob.arrayBuffer().then(buf => {
                    dom.djvuMount.innerHTML = '';
                    const viewer = new DjVu.Viewer();
                    viewer.render(dom.djvuMount);
                    viewer.loadDocument(buf);
                    dom.loading.style.display = 'none';
                    updatePageUI();
                }).catch(() => {
                    dom.docFrame.src = blobUrl;
                    dom.docFrame.style.display = 'block';
                    dom.loading.style.display = 'none';
                });
            } else {
                dom.docFrame.src = blobUrl;
                dom.docFrame.style.display = 'block';
                dom.loading.style.display = 'none';
            }
        } else if (format === 'docx') {
            blob.arrayBuffer().then(async (buf) => {
                if (typeof mammoth !== 'undefined') {
                    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
                    dom.loading.style.display = 'none';
                    dom.docFrame.style.display = 'none';
                    if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
                    dom.contentWrap.style.display = 'block';
                    dom.contentWrap.innerHTML = `<div class="reader-docx-container">${result.value}</div>`;
                    const totalChars = (result.value.replace(/<[^>]*>/g, '') || '').length;
                    state.totalPages = Math.max(1, Math.round(totalChars / 2200));
                    dom.labelTotalPages.textContent = state.totalPages;
                    dom.inputCurrentPage.max = state.totalPages;
                    updatePageUI();
                }
            });
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

    // DjVu LOADER: Uses DjVu.js Viewer with CORS arrayBuffer
    function loadDjvuDirect(url) {
        if (!url) {
            showDocError('Посилання на файл DjVu відсутнє.');
            return;
        }

        // Перевіряємо наявність DjVu.js Viewer
        if (typeof DjVu !== 'undefined' && DjVu.Viewer && dom.djvuMount) {
            dom.docFrame.style.display = 'none';
            dom.contentWrap.style.display = 'none';
            dom.djvuWrap.style.display = 'block';

            fetch(url).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            }).then(buf => {
                dom.djvuMount.innerHTML = '';
                const viewer = new DjVu.Viewer();
                viewer.render(dom.djvuMount);
                viewer.loadDocument(buf);
                dom.loading.style.display = 'none';
                showSyncToast('📖 DjVu документ підвантажено');
                updatePageUI();
            }).catch(err => {
                console.warn('DjVu direct fetch error:', err);
                dom.loading.style.display = 'none';
                // Fallback: embed via iframe or show direct view
                dom.docFrame.src = url;
                dom.docFrame.style.display = 'block';
                if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
                showSyncToast('📖 Документ відкрито через системний переглядач');
            });
            return;
        }

        // Якщо бібліотека недоступна в браузері:
        dom.loading.style.display = 'none';
        dom.docFrame.src = url;
        dom.docFrame.style.display = 'block';
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
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        let ext = 'pdf';
        if (fname.endsWith('.djvu')) ext = 'djvu';
        else if (fname.endsWith('.docx') || fname.endsWith('.doc')) ext = 'docx';

        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Читання та збереження локального файлу ${file.name}...`;

        // Зберігаємо файл у IndexedDB як особисту копію користувача!
        saveCachedBookBlob(bookParam.id, uid, file, { format: ext, title: file.name });

        displayDocumentBlob(file, ext);
        showSyncToast(`📂 Файл "${file.name}" збережено як вашу особисту копію!`);
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
        if (dom.docFrame) {
            dom.docFrame.style.transformOrigin = 'top center';
            if (z === 1.0) {
                dom.docFrame.style.transform = '';
                dom.docFrame.style.width = '100%';
                dom.docFrame.style.height = '100%';
            } else {
                dom.docFrame.style.transform = `scale(${z})`;
                dom.docFrame.style.width = `${100 / z}%`;
                dom.docFrame.style.height = `${100 / z}%`;
            }
        }
        if (dom.djvuMount) {
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
        dom.loading.style.display = 'none';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
        if (dom.docFrame) dom.docFrame.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) {
            dom.contentWrap.style.display = 'block';
            const hasDirectFile = Boolean(bookParam.file);
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
                        ${hasDirectFile ? `
                            <a href="${bookParam.file}" target="_blank" class="btn-add-note" style="text-decoration: none; padding: 12px 24px; font-size: 0.95rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);">
                                🔗 Відкрити за прямим посиланням
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
