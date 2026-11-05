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
        settingEngineLines: document.getElementById('setting-engine-lines'),
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
        isHighlightActive: false,
        settings: {
            dockSide: localStorage.getItem('chess_vault_reader_dock_side') || 'right',
            evalMode: localStorage.getItem('chess_vault_reader_eval_mode') || 'full', // 'full' | 'numbers' | 'off'
            arrowBest: localStorage.getItem('chess_vault_reader_arrow_best') !== 'false',
            arrowThreat: localStorage.getItem('chess_vault_reader_arrow_threat') !== 'false',
            engineLines: localStorage.getItem('chess_vault_reader_engine_lines') !== 'false'
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

        applyEngineLinesVisibility();
        updateEvalBarUI();
        updateBoardArrows();
    }

    function applyEngineLinesVisibility() {
        const show = state.settings.engineLines !== false;
        if (dom.engineEvalBox) {
            dom.engineEvalBox.style.display = show ? 'flex' : 'none';
        }
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

    // Визначає реальний формат файлу за сигнатурою (magic bytes)
    async function sniffBlobFormat(blob, fallback) {
        try {
            const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
            const str = String.fromCharCode(...head);
            if (str.startsWith('%PDF')) return 'pdf';
            if (str.startsWith('AT&T')) return 'djvu';
            if (head[0] === 0x50 && head[1] === 0x4B) return 'docx';
            if (head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0) return 'doc';
        } catch (_) {}
        return fallback;
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

        const uid = state.currentUser ? state.currentUser.uid : 'guest';

        // 1. ПЕРЕВІРЯЄМО ОСОБИСТУ КОПІЮ В INDEXEDDB (миттєве офлайн-відкриття)
        dom.loading.style.display = 'flex';
        dom.loadingText.textContent = `Пошук персональної копії книги...`;

        try {
            const cachedBlob = await getCachedBookBlob(bookParam.id, uid);
            if (cachedBlob && cachedBlob.size > 1024) {
                const cachedFormat = await sniffBlobFormat(cachedBlob, format);
                dom.loading.style.display = 'none';
                if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                showSyncToast('⚡ Відкрито збережену персональну копію (IndexedDB)');
                displayDocumentBlob(cachedBlob, cachedFormat);
                return;
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

        // 3. PDF: знаходимо робочий URL через CORS-ендпоінт і відкриваємо у вбудованому переглядачі
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
                state.resolvedDirectUrl = toDirectUrl(workingUrl);
                dom.loading.style.display = 'none';
                if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
                loadPdfDirect(toDirectUrl(workingUrl));
                // Асинхронне збереження персональної копії без перевантаження каналу для великих PDF
                const pdfBytes = cachedBook && Number(cachedBook.sizeRaw) ? Number(cachedBook.sizeRaw) : 0;
                if (!pdfBytes || pdfBytes <= 35 * 1024 * 1024) {
                    setTimeout(() => {
                        downloadBookWithProgress([workingUrl], () => {}, format).then(blob => {
                            if (blob && blob.size > 1024) {
                                state.pdfBlobUrl = URL.createObjectURL(blob);
                                saveCachedBookBlob(bookParam.id, uid, blob, { format, title: bookParam.title });
                            }
                        }).catch(() => {});
                    }, 1500);
                }
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

    // DISPLAY DOCUMENT FROM BLOB (Personal copy / downloaded file)
    function displayDocumentBlob(blob, format) {
        format = normalizeFormat(format);
        if (state.currentBlobUrl) {
            try { URL.revokeObjectURL(state.currentBlobUrl); } catch (_) {}
        }
        const blobUrl = URL.createObjectURL(blob);
        state.currentBlobUrl = blobUrl;

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
                if (dom.contentWrap) dom.contentWrap.style.display = 'none';
                dom.djvuWrap.style.display = 'block';
                dom.loading.style.display = 'flex';
                dom.loadingText.textContent = 'Відкриття DjVu документа...';
                blob.arrayBuffer().then(buf => {
                    initDjVuViewer(buf);
                }).catch(err => {
                    console.warn('DjVu blob read error:', err);
                    showDocError('Не вдалося прочитати DjVu файл.');
                });
            } else {
                showDocError('Бібліотека DjVu.js не завантажилась. Оновіть сторінку або перевірте інтернет-з’єднання.');
            }
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
        dom.loading.style.display = 'none';
        dom.docFrame.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        dom.contentWrap.style.display = 'block';
        dom.contentWrap.innerHTML = `<div class="reader-docx-container">${html}</div>`;
        const totalChars = (html.replace(/<[^>]*>/g, '') || '').length;
        state.totalPages = Math.max(1, Math.round(totalChars / 2200));
        if (dom.labelTotalPages) dom.labelTotalPages.textContent = state.totalPages;
        if (dom.inputCurrentPage) dom.inputCurrentPage.max = state.totalPages;
        updatePageUI();
        saveUserBookWorkspace();
    }

    // Старі .doc файли: Microsoft Office Online Viewer (працює з публічними URL)
    function loadOfficeViewer(directUrl) {
        dom.loading.style.display = 'none';
        if (dom.downloadProgressWrap) dom.downloadProgressWrap.style.display = 'none';
        if (dom.djvuWrap) dom.djvuWrap.style.display = 'none';
        if (dom.contentWrap) dom.contentWrap.style.display = 'none';
        dom.docFrame.style.display = 'block';
        dom.docFrame.onload = null;
        dom.docFrame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directUrl)}`;
        state.isOfficeViewer = true;
        updatePageUI();
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

        updatePageUI();
    }

    // Shared DjVu Viewer initializer with robust page synchronization
    function initDjVuViewer(buf) {
        if (!dom.djvuMount) return;
        dom.djvuMount.innerHTML = '';
        const viewer = new DjVu.Viewer();
        state.djvuViewer = viewer;
        viewer.render(dom.djvuMount);

        // Listen for user turning pages in DjVu.js Viewer
        const pageEvent = (DjVu.Viewer && DjVu.Viewer.Events && DjVu.Viewer.Events.PAGE_NUMBER_CHANGED) || 'PAGE_NUMBER_CHANGED';
        viewer.on(pageEvent, (newPage) => {
            if (newPage && newPage !== state.currentPage) {
                state.currentPage = newPage;
                updatePageUI();
                saveUserBookWorkspace();
            }
        });

        viewer.loadDocument(buf).then(() => {
            dom.loading.style.display = 'none';
            try {
                if (DjVu.Viewer && DjVu.Viewer.get && DjVu.Viewer.get.pagesCount) {
                    const total = DjVu.Viewer.get.pagesCount(viewer.store.getState());
                    if (total && total > 0) {
                        state.totalPages = total;
                        if (dom.labelTotalPages) dom.labelTotalPages.textContent = total;
                        if (dom.inputCurrentPage) dom.inputCurrentPage.max = total;
                    }
                }
            } catch (err) {
                console.warn('Error reading DjVu pages count:', err);
            }

            // Jump to user's saved reading position
            if (state.currentPage && state.currentPage > 1) {
                try {
                    viewer.configure({ pageNumber: state.currentPage });
                } catch (_) {}
            }
            updatePageUI();
            saveUserBookWorkspace();
            showSyncToast('📖 DjVu документ підвантажено');
        }).catch(err => {
            console.warn('DjVu loadDocument error:', err);
            showDocError('Не вдалося відкрити DjVu файл (можливо, файл пошкоджений). Спробуйте обрати файл з пристрою.');
        });
    }

    // LOCAL FILE LOADER (Drag-and-Drop or File Picker)
    function handleLocalFileSelected(file) {
        if (!file) return;
        const fname = file.name.toLowerCase();
        const uid = state.currentUser ? state.currentUser.uid : 'guest';
        let ext = 'pdf';
        if (fname.endsWith('.djvu') || fname.endsWith('.djv')) ext = 'djvu';
        else if (fname.endsWith('.docx')) ext = 'docx';
        else if (fname.endsWith('.doc')) ext = 'doc';
        else if (fname.endsWith('.txt')) ext = 'txt';

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
        const idKey = (bookParam.id || bookParam.title || 'book').trim().replace(/[\/\s]/g, '_');
        return `chess_vault_workspace_${uid || 'guest'}_${idKey}`;
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
            const docId = (bookParam.id || 'book').replace(/[\/\.#$\[\]]/g, '_');
            window.db.collection('user_reading').doc(state.currentUser.uid)
                .collection('books').doc(docId)
                .set(workspaceData, { merge: true })
                .then(() => {
                    showSyncIndicator('✅ Збережено в хмарі');
                })
                .catch(err => console.warn('Workspace sync error:', err));
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
        if (data.currentPage && !urlParams.get('page')) {
            state.currentPage = data.currentPage;
            if (dom.inputCurrentPage) dom.inputCurrentPage.value = state.currentPage;
        }
        if (data.totalPages) {
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
    // 5. PAGE NAVIGATION & UI
    // ========================================================
    function goToPage(page) {
        const p = Math.min(Math.max(1, parseInt(page) || 1), state.totalPages);
        state.currentPage = p;
        updatePageUI();

        // 1. DjVu.js Viewer page navigation
        if (state.djvuViewer && state.djvuViewer.configure) {
            try {
                state.djvuViewer.configure({ pageNumber: p });
            } catch (err) {
                console.warn('DjVu configure page error:', err);
            }
        }

        // 2. Iframe anchor (PDF mode) - query param change forces native viewer navigation
        if (dom.docFrame && dom.docFrame.style.display !== 'none' && dom.docFrame.src && !state.isOfficeViewer) {
            const raw = dom.docFrame.src.split('#')[0];
            if (!raw.startsWith('blob:') && state.pdfBlobUrl) {
                // Персональна копія вже завантажена у фоні — переходимо на неї (без повторного завантаження з архіву)
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
        if (dom.settingEngineLines) dom.settingEngineLines.checked = state.settings.engineLines !== false;
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
        if (dom.settingEngineLines) {
            dom.settingEngineLines.addEventListener('change', (e) => {
                state.settings.engineLines = e.target.checked;
                localStorage.setItem('chess_vault_reader_engine_lines', String(state.settings.engineLines));
                applyEngineLinesVisibility();
            });
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
