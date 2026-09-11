/* ========================================================
   CHESS VAULT — COLLECTIONS & TOPICS LOGIC
   ======================================================== */

// --- 1. КАТЕГОРІЇ (РОЗДІЛИ ГРИ) ---
const CHESS_TOPICS = [
    {
        id: 'debut',
        title: 'Дебюти',
        icon: '♟️',
        subtitle: 'Теорія початків, захисти, гамбіти та системи розвитку',
        keywords: ['дебют', 'начало', 'защит', 'гамбит', 'испанск', 'сицилианск', 'французск', 'каро-канн', 'староиндийск', 'английск', 'ферзев', 'открыт', 'полуоткрыт', 'цукерторт', 'филидор', 'шотландск', 'славянск', 'грюнфельд', 'каталонск', 'дебютн']
    },
    {
        id: 'mittelspiel',
        title: 'Мітельшпіль',
        icon: '⚔️',
        subtitle: 'Стратегія, тактика, комбінації, плани гри та атака',
        keywords: ['миттельшпил', 'середин', 'тактик', 'комбинац', 'атак', 'план', 'стратеги', 'позицион', 'пешечн', 'взаимодейств', 'оценк', 'штурм', 'жертв', 'интуиция']
    },
    {
        id: 'endgame',
        title: 'Ендшпіль',
        icon: '👑',
        subtitle: 'Теорія закінчень, техніка пішакових та фігурних фіналів',
        keywords: ['эндшпил', 'окончан', 'финал', 'ладейн', 'ферзев', 'конев', 'слонов']
    },
    {
        id: 'etudes',
        title: 'Етюди та задачі',
        icon: '🧩',
        subtitle: 'Шахова композиція, етюди, краса гри та альбоми FIDE',
        keywords: ['этюд', 'композиц', 'задач', 'albom fide', 'альбом фиде']
    },
    {
        id: 'beginners',
        title: 'Для початківців',
        icon: '🐣',
        subtitle: 'Самовчителі, підручники, основи та перші кроки у грі',
        keywords: ['самоучител', 'королевств', 'азбук', 'начинающ', 'первые шаг', 'школа', 'учебник', 'руководств', 'правила', 'ход за ходом']
    },
    {
        id: 'tournaments',
        title: 'Матчі та турніри',
        icon: '🏆',
        subtitle: 'Історичні чемпіонати світу, міжзональні та супертурніри',
        keywords: ['турнир', 'матч', 'первенств', 'чемпионат', 'олимпиад', 'ноттингем', 'нью-йорк', 'амстердам', 'авро']
    },
    {
        id: 'personal',
        title: 'Персоналії та партії',
        icon: '👤',
        subtitle: 'Вибрані партії великих гравців, життєвий шлях чемпіонів',
        keywords: ['жизнь', 'творчеств', 'избранн', '100 партий', 'метеор', 'советские шахматисты', 'гроссмейстер', 'каспаров', 'карпов', 'фишер', 'алехин', 'ботвинник', 'таль', 'петросян', 'спасский', 'ласкер', 'капабланка', 'стейн']
    },
    {
        id: 'psychology',
        title: 'Психологія та мислення',
        icon: '🧠',
        subtitle: 'Психологічна підготовка, мислення та філософія гри',
        keywords: ['психолог', 'мышлени', 'характер', 'философия']
    },
    {
        id: 'magazines',
        title: 'Журнали та періодика',
        icon: '📰',
        subtitle: 'Періодичні видання: «64», «Шахматы в СССР», вісники',
        keywords: ['64-', 'chess in ussr', 'chess(riga)', 'шахматы в ссср', 'шахматный бюллетень', 'бюллетен', 'альманах', 'журнал']
    },
    {
        id: 'general',
        title: 'Теорія та загальні праці',
        icon: '📚',
        subtitle: 'Довідники, енциклопедії, кодекси та загальна шахова література',
        keywords: []
    }
];

// --- 2. СТАН КОЛЕКЦІЙ ---
const collectionsState = {
    allBooks: [],
    currentView: 'all',     // 'all' | 'topics' | 'authors'
    activeTopicId: null,    // null або ID топіку
    activeAuthor: null,     // null або ім'я автора
    selectedLetter: 'ALL',  // 'ALL' або літера кирилиці
    authorFilterQuery: ''
};

// --- 3. КЛАСИФІКАЦІЯ КНИГ ---
function normalizeTextForMatch(str) {
    if (!str) return '';
    return str
        .normalize('NFC')
        .toLowerCase()
        .replace(/\.[^/.]+$/, '')
        .replace(/[\u0308]/g, 'е')
        .replace(/ё/g, 'е')
        .replace(/[\s\(\)\[\]\,\.\-\_\d]+/g, ' ')
        .trim();
}

function classifyBookTopic(book) {
    const raw = (book.id || book.title || '').toLowerCase();
    const norm = normalizeTextForMatch(book.id || book.title);

    // 1. Перевірка топіку з бази флешки (CHESS_COLLECTIONS_DATA)
    if (window.CHESS_COLLECTIONS_DATA && window.CHESS_COLLECTIONS_DATA.themeIndex) {
        const themeIndex = window.CHESS_COLLECTIONS_DATA.themeIndex;
        if (themeIndex[norm]) {
            return themeIndex[norm];
        }
        for (const [k, topicId] of Object.entries(themeIndex)) {
            if (k.length > 8 && (norm.includes(k) || k.includes(norm))) {
                return topicId;
            }
        }
    }

    // 2. Журнали (пріоритет)
    if (raw.startsWith('64-') || raw.includes('chess in ussr') || raw.includes('chess(riga)') || raw.includes('бюллетен') || raw.includes('альманах')) {
        return 'magazines';
    }

    // 3. Ендшпіль (пріоритет над мітельшпілем)
    if (['эндшпил', 'окончан', 'финал', 'ладейн', 'ферзев', 'конев', 'слонов'].some(k => raw.includes(k))) {
        return 'endgame';
    }

    // 4. Ключові слова топіків
    for (const topic of CHESS_TOPICS) {
        if (topic.id === 'general' || topic.id === 'magazines' || topic.id === 'endgame') continue;
        if (topic.keywords.some(k => raw.includes(k))) {
            return topic.id;
        }
    }

    return 'general';
}

function getBookAuthorClean(book) {
    const raw = (book.id || book.title || '').toLowerCase();
    const norm = normalizeTextForMatch(book.id || book.title);

    let author = '';

    // 1. Перевірка автора з бази флешки
    if (window.CHESS_COLLECTIONS_DATA && window.CHESS_COLLECTIONS_DATA.authorIndex) {
        const authIndex = window.CHESS_COLLECTIONS_DATA.authorIndex;
        if (authIndex[norm]) {
            author = authIndex[norm];
        } else {
            for (const [k, authName] of Object.entries(authIndex)) {
                if (k.length > 8 && (norm.includes(k) || k.includes(norm))) {
                    author = authName;
                    break;
                }
            }
        }
    }

    // 2. Журнали та періодика
    if (raw.startsWith('64-')) return 'Журнал «64»';
    if (raw.includes('chess in ussr')) return 'Журнал «Шахматы в СССР»';
    if (raw.includes('chess(riga)')) return 'Журнал «Шахматы» (Рига)';

    if (!author || author === '1 - Разное' || author === '.' || author === '---') {
        author = book.author || '';
    }

    if (author === 'Журналы и альманахи') {
        return 'Журнали та альманахи';
    }

    if (!author || author === '---' || author.trim() === '') {
        return 'Збірники та інші';
    }

    return author.normalize('NFC').trim();
}

// --- 4. ІНІЦІАЛІЗАЦІЯ КОЛЕКЦІЙ ---
function initCollections(books) {
    collectionsState.allBooks = books.map(b => ({
        ...b,
        topicId: classifyBookTopic(b),
        cleanAuthor: getBookAuthorClean(b)
    }));

    renderCollectionsUI();
    bindCollectionsEvents();
}

// --- 5. РЕНДЕРИНГ КОМПОНЕНТІВ ---
function renderCollectionsUI() {
    renderTopicsGrid();
    renderAuthorsGrid();
    updateViewDisplay();
}

function updateViewDisplay() {
    const view = collectionsState.currentView;
    const activeTopicId = collectionsState.activeTopicId;
    const activeAuthor = collectionsState.activeAuthor;

    // Оновлюємо активні кнопки перемикача
    document.querySelectorAll('.collections-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    const topicsWrap = document.getElementById('collections-topics-wrap');
    const authorsWrap = document.getElementById('collections-authors-wrap');
    const statsWrap = document.getElementById('collections-stats-wrap');
    const activeHeader = document.getElementById('collection-active-header');
    const booksListBlock = document.querySelector('.books-list-block');
    const searchBox = document.querySelector('.search-box');
    const sortControls = document.querySelector('.sort-controls');

    const searchInput = document.getElementById('lib-search-input');

    if (view === 'all') {
        if (topicsWrap) topicsWrap.style.display = 'none';
        if (authorsWrap) authorsWrap.style.display = 'none';
        if (statsWrap) statsWrap.style.display = 'none';
        if (activeHeader) activeHeader.style.display = 'none';
        if (booksListBlock) booksListBlock.style.display = 'flex';
        if (searchBox) searchBox.style.display = 'block';
        if (sortControls) sortControls.style.display = 'flex';
        if (searchInput) searchInput.placeholder = 'Шукати за автором, назвою або роком...';
        renderFilteredBooks();
    } else if (view === 'topics') {
        if (statsWrap) statsWrap.style.display = 'none';
        if (activeTopicId === null) {
            // Показати сітку карток категорій
            if (topicsWrap) topicsWrap.style.display = 'block';
            if (authorsWrap) authorsWrap.style.display = 'none';
            if (activeHeader) activeHeader.style.display = 'none';
            if (booksListBlock) booksListBlock.style.display = 'none';
            if (searchBox) searchBox.style.display = 'none';
            if (sortControls) sortControls.style.display = 'none';
        } else {
            // Показати список книг обраного розділу
            const topic = CHESS_TOPICS.find(t => t.id === activeTopicId) || { title: 'Розділ', icon: '♟️' };
            const count = collectionsState.allBooks.filter(b => b.topicId === activeTopicId).length;
            if (topicsWrap) topicsWrap.style.display = 'none';
            if (authorsWrap) authorsWrap.style.display = 'none';
            if (activeHeader) {
                activeHeader.style.display = 'flex';
                activeHeader.innerHTML = `
                    <div class="collection-header-info">
                        <span class="collection-header-icon">${topic.icon}</span>
                        <h2 class="collection-header-title">
                            ${topic.title}
                            <span class="collection-header-badge">${count} книг</span>
                        </h2>
                    </div>
                    <button class="collection-back-btn" onclick="backToTopics()">
                        ← Всі розділи
                    </button>
                `;
            }
            if (booksListBlock) booksListBlock.style.display = 'flex';
            if (searchBox) searchBox.style.display = 'block';
            if (sortControls) sortControls.style.display = 'flex';
            if (searchInput) searchInput.placeholder = `Шукати серед книг розділу «${topic.title}»...`;
            renderFilteredBooks();
        }
    } else if (view === 'authors') {
        if (statsWrap) statsWrap.style.display = 'none';
        if (activeAuthor === null) {
            // Показати авторів
            if (topicsWrap) topicsWrap.style.display = 'none';
            if (authorsWrap) authorsWrap.style.display = 'block';
            if (activeHeader) activeHeader.style.display = 'none';
            if (booksListBlock) booksListBlock.style.display = 'none';
            if (searchBox) searchBox.style.display = 'none';
            if (sortControls) sortControls.style.display = 'none';
        } else {
            // Показати книги обраного автора
            const count = collectionsState.allBooks.filter(b => b.cleanAuthor === activeAuthor).length;
            if (topicsWrap) topicsWrap.style.display = 'none';
            if (authorsWrap) authorsWrap.style.display = 'none';
            if (activeHeader) {
                activeHeader.style.display = 'flex';
                activeHeader.innerHTML = `
                    <div class="collection-header-info">
                        <span class="collection-header-icon">👤</span>
                        <h2 class="collection-header-title">
                            ${escapeHtml(activeAuthor)}
                            <span class="collection-header-badge">${count} книг</span>
                        </h2>
                    </div>
                    <button class="collection-back-btn" onclick="backToAuthors()">
                        ← Всі автори
                    </button>
                `;
            }
            if (booksListBlock) booksListBlock.style.display = 'flex';
            if (searchBox) searchBox.style.display = 'block';
            if (sortControls) sortControls.style.display = 'flex';
            if (searchInput) searchInput.placeholder = `Шукати серед книг автора «${activeAuthor}»...`;
            renderFilteredBooks();
        }
    } else if (view === 'stats') {
        if (topicsWrap) topicsWrap.style.display = 'none';
        if (authorsWrap) authorsWrap.style.display = 'none';
        if (activeHeader) activeHeader.style.display = 'none';
        if (booksListBlock) booksListBlock.style.display = 'none';
        if (searchBox) searchBox.style.display = 'none';
        if (sortControls) sortControls.style.display = 'none';
        if (statsWrap) {
            statsWrap.style.display = 'block';
            renderStatsDashboard();
        }
    }
}

// --- 6. РЕНДЕР СІТКИ РОЗДІЛІВ ГРИ ---
function renderTopicsGrid() {
    const grid = document.getElementById('collections-topics-grid');
    if (!grid) return;

    grid.innerHTML = CHESS_TOPICS.map(topic => {
        const count = collectionsState.allBooks.filter(b => b.topicId === topic.id).length;
        return `
            <div class="category-card" onclick="openTopic('${topic.id}')">
                <div class="category-card-top">
                    <span class="category-card-icon">${topic.icon}</span>
                    <span class="category-card-badge">${count} книг</span>
                </div>
                <div>
                    <h3 class="category-card-title">${topic.title}</h3>
                    <p class="category-card-desc">${topic.subtitle}</p>
                </div>
            </div>
        `;
    }).join('');
}

// --- 7. РЕНДЕР СІТКИ ТА АЛФАВІТУ АВТОРІВ ---
function renderAuthorsGrid() {
    const authorsGrid = document.getElementById('collections-authors-grid');
    const alphabetBar = document.getElementById('authors-alphabet-bar');
    if (!authorsGrid) return;

    // Групуємо книги за автором
    const authorCounts = {};
    collectionsState.allBooks.forEach(b => {
        const a = b.cleanAuthor;
        authorCounts[a] = (authorCounts[a] || 0) + 1;
    });

    let authorsList = Object.keys(authorCounts).sort((a, b) => a.localeCompare(b, 'uk'));

    // Рендер алфавітної панелі
    if (alphabetBar) {
        const letters = ['Всі', 'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Э', 'Ю', 'Я'];
        alphabetBar.innerHTML = letters.map(letter => {
            const isActive = (letter === 'Всі' && collectionsState.selectedLetter === 'ALL') || (letter === collectionsState.selectedLetter);
            const hasAuthors = letter === 'Всі' || authorsList.some(a => a.toUpperCase().startsWith(letter));
            return `
                <button class="alpha-btn ${isActive ? 'active' : ''} ${!hasAuthors ? 'disabled' : ''}" 
                        onclick="filterAuthorsLetter('${letter === 'Всі' ? 'ALL' : letter}')">
                    ${letter}
                </button>
            `;
        }).join('');
    }

    // Фільтрація авторів
    if (collectionsState.selectedLetter !== 'ALL') {
        authorsList = authorsList.filter(a => a.toUpperCase().startsWith(collectionsState.selectedLetter));
    }
    if (collectionsState.authorFilterQuery.trim() !== '') {
        const q = collectionsState.authorFilterQuery.toLowerCase();
        authorsList = authorsList.filter(a => a.toLowerCase().includes(q));
    }

    if (authorsList.length === 0) {
        authorsGrid.innerHTML = `<div class="collections-empty" style="grid-column: 1/-1;">Авторів не знайдено</div>`;
        return;
    }

    authorsGrid.innerHTML = authorsList.map(author => {
        const count = authorCounts[author];
        const initials = author.split(' ').map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
        return `
            <div class="author-card" onclick="openAuthor('${escapeHtmlAttr(author)}')">
                <div class="author-avatar">${initials || '♟'}</div>
                <div class="author-info">
                    <h4 class="author-name" title="${escapeHtmlAttr(author)}">${escapeHtml(author)}</h4>
                    <span class="author-count">${count} книг</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- 7. РЕНДЕР СТАТИСТИКИ БАЗИ ДАНИХ (STATS DASHBOARD) ---
function isMagazineBook(b) {
    if (b.topicId === 'magazines') return true;
    const authorClean = (b.cleanAuthor || b.author || '').toLowerCase();
    if (authorClean.startsWith('журнал') || authorClean === 'періодика' || authorClean.includes('альманах') || authorClean.includes('бюллетен') || authorClean.includes('бюлетен')) return true;
    const raw = (b.id || b.title || '').toLowerCase();
    if (raw.startsWith('64-') || raw.includes('chess in ussr') || raw.includes('chess(riga)') ||
        raw.includes('шахматы в ссср') || raw.includes('шахматный бюллетень') || raw.includes('шахматный вестник') ||
        raw.includes('шахматное время') || raw.includes('информатор') || raw.includes('альманах')) {
        return true;
    }
    return false;
}

function renderStatsDashboard() {
    const container = document.getElementById('collections-stats-wrap');
    if (!container) return;

    const books = collectionsState.allBooks || [];
    if (!books.length) {
        container.innerHTML = `<div style="text-align:center; padding:50px; color:#888;">⏳ Завантаження статистики бази даних...</div>`;
        return;
    }

    // 1. РОЗДІЛЕННЯ: КНИГИ vs ЖУРНАЛИ (журнали виділені в окрему касту і не беруть участь в авторському заліку)
    const magazineBooks = books.filter(isMagazineBook);
    const regularBooks = books.filter(b => !isMagazineBook(b));

    // Автори регулярних книг (без журналів!)
    const authorCounts = {};
    regularBooks.forEach(b => {
        let auth = b.cleanAuthor || b.author || '';
        if (!auth || auth === '---' || auth === 'Невідомий' || auth === 'Збірники та інші' || auth.toLowerCase().startsWith('неизвест')) return;
        authorCounts[auth] = (authorCounts[auth] || 0) + 1;
    });
    const sortedAuthors = Object.entries(authorCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    const totalAuthors = sortedAuthors.length;

    // Підрахунок сторінок
    const booksWithPages = books.filter(b => typeof b.pages === 'number' && b.pages > 0);
    const totalKnownPages = booksWithPages.reduce((sum, b) => sum + b.pages, 0);
    const avgPages = booksWithPages.length ? Math.round(totalKnownPages / booksWithPages.length) : 0;

    // 2. ГРАФІК РОКІВ ПУБЛІКАЦІЙ (BAR CHART)
    const yearBuckets = [
        { label: 'до 1930', min: 0, max: 1929, count: 0, desc: 'Рання класика' },
        { label: '1930–49', min: 1930, max: 1949, count: 0, desc: 'Золота доба 30-40х' },
        { label: '1950-і', min: 1950, max: 1959, count: 0, desc: 'Радянська школа' },
        { label: '1960-і', min: 1960, max: 1969, count: 0, desc: 'Епоха Таля і Петросяна' },
        { label: '1970-і', min: 1970, max: 1979, count: 0, desc: 'Ера Фішера і Карпова' },
        { label: '1980-і', min: 1980, max: 1989, count: 0, desc: 'Битви Карпов–Каспаров' },
        { label: '1990-і', min: 1990, max: 1999, count: 0, desc: 'Компʼютерна революція' },
        { label: '2000-і', min: 2000, max: 2009, count: 0, desc: 'Сучасна теорія' },
        { label: '2010+', min: 2010, max: 2099, count: 0, desc: 'Новітня література' }
    ];

    let totalWithYear = 0;
    books.forEach(b => {
        const y = parseInt(b.year, 10);
        if (!isNaN(y) && y >= 1800 && y <= 2050) {
            totalWithYear++;
            for (const bucket of yearBuckets) {
                if (y >= bucket.min && y <= bucket.max) {
                    bucket.count++;
                    break;
                }
            }
        }
    });

    const maxYearCount = Math.max(...yearBuckets.map(b => b.count), 1);
    const peakDecade = yearBuckets.reduce((max, b) => b.count > max.count ? b : max, yearBuckets[0]);

    // 3. РОЗПОДІЛ ЗА КІЛЬКІСТЮ СТОРІНОК (МАЛЕНЬКІ vs ДОВГІ)
    const pageTiers = [
        { id: 'tiny', name: 'Маленькі / Брошури', range: 'до 120 стор.', min: 1, max: 119, count: 0, color: '#3b82f6', desc: 'Дебютні буклети, регламенти, короткі огляди' },
        { id: 'compact', name: 'Компактні книги', range: '120 – 249 стор.', min: 120, max: 249, count: 0, color: '#10b981', desc: 'Базові курси, збірники вибраних партій' },
        { id: 'standard', name: 'Середні / Стандартні', range: '250 – 399 стор.', min: 250, max: 399, count: 0, color: '#f59e0b', desc: 'Класичні підручники, фундаментальна теорія' },
        { id: 'long', name: 'Довгі / Монографії', range: '400 – 599 стор.', min: 400, max: 599, count: 0, color: '#ec4899', desc: 'Капітальні монографії, глибокі аналізи' },
        { id: 'huge', name: 'Фоліанти / Величезні', range: '600+ стор.', min: 600, max: 99999, count: 0, color: '#8b5cf6', desc: 'Енциклопедії, томи та повні зібрання' }
    ];

    booksWithPages.forEach(b => {
        const p = b.pages;
        for (const tier of pageTiers) {
            if (p >= tier.min && p <= tier.max) {
                tier.count++;
                break;
            }
        }
    });

    const totalPagesSample = booksWithPages.length || 1;
    pageTiers.forEach(t => {
        t.pct = Math.round((t.count / totalPagesSample) * 100);
    });

    // Порівняння: Короткі (до 249 стор.) vs Довгі (від 250 стор.)
    const totalShort = (pageTiers[0].count + pageTiers[1].count);
    const totalLong = (pageTiers[2].count + pageTiers[3].count + pageTiers[4].count);
    const shortPct = Math.round((totalShort / totalPagesSample) * 100);
    const longPct = Math.round((totalLong / totalPagesSample) * 100);

    const winnerTier = pageTiers.reduce((max, t) => t.count > max.count ? t : max, pageTiers[0]);

    // 4. ТОП АВТОРІВ (Журнали виключені, тільки автори книг)
    const topAuthors = sortedAuthors.slice(0, 15);

    // ГЕНЕРУЄМО ДАШБОРД HTML
    container.innerHTML = `
        <div class="stats-dashboard">
            <!-- 1. KPI КАРТКИ -->
            <div class="stats-kpi-grid">
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">📚</div>
                    <div>
                        <div class="stats-kpi-val">${books.length.toLocaleString('uk-UA')}</div>
                        <div class="stats-kpi-label">Всього творів у базі</div>
                    </div>
                </div>
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">✍️</div>
                    <div>
                        <div class="stats-kpi-val">${totalAuthors}</div>
                        <div class="stats-kpi-label">Унікальних авторів</div>
                    </div>
                </div>
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">📄</div>
                    <div>
                        <div class="stats-kpi-val">~${avgPages}</div>
                        <div class="stats-kpi-label">Сер. кількість сторінок</div>
                    </div>
                </div>
                <div class="stats-kpi-card" style="cursor:pointer;" onclick="openTopic('magazines')">
                    <div class="stats-kpi-icon">📰</div>
                    <div>
                        <div class="stats-kpi-val">${magazineBooks.length}</div>
                        <div class="stats-kpi-label">Журналів в окремій касті</div>
                    </div>
                </div>
            </div>

            <!-- 2. ГРАФІК РОКІВ ПУБЛІКАЦІЙ -->
            <div class="stats-section-card">
                <h3 class="stats-section-title">
                    <span>📅</span>
                    <span>Роки публікацій літератури</span>
                </h3>
                <p class="stats-section-sub">
                    Розподіл видань за хронологічними десятиліттями (оцифровано ${totalWithYear} книг із зазначеним роком).
                    Піковий період: <strong>${peakDecade.label} (${peakDecade.desc})</strong> — ${peakDecade.count} творів!
                </p>

                <div class="years-chart-container">
                    ${yearBuckets.map(bucket => {
                        const heightPct = Math.max(6, Math.round((bucket.count / maxYearCount) * 100));
                        const pctOfTotal = totalWithYear ? Math.round((bucket.count / totalWithYear) * 100) : 0;
                        const isPeak = bucket === peakDecade;
                        return `
                            <div class="year-bar-col" title="${bucket.label}: ${bucket.count} книг (${pctOfTotal}% від оцифрованих)">
                                <div class="year-bar-val">${bucket.count}</div>
                                <div class="year-bar-fill ${isPeak ? 'peak-bar' : ''}" style="height: ${heightPct}%;"></div>
                                <div class="year-bar-label">${bucket.label}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 3. РОЗПОДІЛ ЗА СТОРІНКАМИ: ЯКИХ КНИГ БІЛЬШЕ (МАЛЕНЬКИХ ЧИ ДОВГИХ) -->
            <div class="stats-section-card">
                <h3 class="stats-section-title">
                    <span>📖</span>
                    <span>Розподіл за обсягом: яких книг більше?</span>
                </h3>
                <p class="stats-section-sub">
                    Аналіз сторінкового обсягу оцифрованої літератури (вибірка: ${booksWithPages.length} книг з точним підрахунком).
                </p>

                <div class="pages-dist-list">
                    ${pageTiers.map(t => {
                        const isWinner = t === winnerTier;
                        return `
                            <div class="pages-dist-item">
                                <div class="pages-dist-header">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span>${t.name} <small style="opacity:0.75; font-weight:normal;">(${t.range})</small></span>
                                        ${isWinner ? `<span class="pages-dist-highlight">🏆 Найбільше в базі (${t.pct}%)</span>` : ''}
                                    </div>
                                    <span style="font-weight:700;">${t.count} книг <span style="opacity:0.6; font-size:0.85em;">(${t.pct}%)</span></span>
                                </div>
                                <div class="pages-dist-track">
                                    <div class="pages-dist-bar" style="width: ${t.pct}%; background: ${t.color};"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="pages-summary-banner">
                    <span style="font-size:1.4rem;">💡</span>
                    <div>
                        <strong>Вердикт аналітики:</strong>
                        ${totalShort > totalLong
                            ? `У базі переважають <strong>компактні та короткі книги</strong> (до 249 стор. — <strong>${shortPct}%</strong> бази проти ${longPct}% довгих книг).`
                            : `У базі переважають <strong>солідні монографії та підручники</strong> (від 250 стор. — <strong>${longPct}%</strong> бази проти ${shortPct}% коротких брошур).`
                        }
                        Найчисельніша окрема категорія: <strong>«${winnerTier.name}»</strong> (${winnerTier.count} книг, ${winnerTier.pct}%).
                        Середній обсяг однієї книги становить <strong>${avgPages} сторінок</strong>.
                    </div>
                </div>
            </div>

            <!-- 4. ТОП АВТОРІВ ЗА КІЛЬКІСТЮ КНИГ (ЖУРНАЛИ В ОКРЕМІЙ КАСТІ) -->
            <div class="stats-section-card">
                <h3 class="stats-section-title">
                    <span>👑</span>
                    <span>Лідери за кількістю книг (Топ авторів)</span>
                </h3>
                <p class="stats-section-sub">
                    Рейтинг авторів за кількістю творів у шахматному фонді. Журнали та періодика виділені в окрему касту і не беруть участі в авторському заліку.
                </p>

                <div class="top-authors-grid">
                    ${topAuthors.map((a, idx) => {
                        const rank = idx + 1;
                        const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
                        return `
                            <div class="top-author-card" onclick="openAuthor('${escapeHtmlAttr(a.name)}')">
                                <div class="top-author-rank">${medal}</div>
                                <div class="top-author-info">
                                    <div class="top-author-name" title="${escapeHtmlAttr(a.name)}">${escapeHtml(a.name)}</div>
                                    <div class="top-author-books">${a.count} книг у базі →</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- БАННЕР КАСТИ ЖУРНАЛІВ -->
                <div class="magazines-info-banner">
                    <span style="font-size: 2rem;">📰</span>
                    <div style="flex-grow:1;">
                        <strong style="font-size:1.05rem; display:block; margin-bottom:3px;">
                            Каста «Журнали та періодичні видання» (${magazineBooks.length} випусків)
                        </strong>
                        <span>
                            «64-Шахматное обозрение», «Шахматы в СССР», «Шахматы» (Рига), інформатори та альманахи винесені в окрему касту і не змагаються з персональними авторами книг.
                        </span>
                    </div>
                    <button class="collection-back-btn" style="white-space:nowrap; flex-shrink:0;" onclick="openTopic('magazines')">
                        Відкрити журнали →
                    </button>
                </div>
            </div>
        </div>
    `;
}

// --- 8. НАВІГАЦІЯ ТА ОБРОБНИКИ ПОДІЙ ---
function switchCollectionView(view) {
    collectionsState.currentView = view;
    if (view === 'topics') {
        collectionsState.activeTopicId = null;
    } else if (view === 'authors') {
        collectionsState.activeAuthor = null;
    }
    updateViewDisplay();
}

function openTopic(topicId) {
    collectionsState.currentView = 'topics';
    collectionsState.activeTopicId = topicId;
    updateViewDisplay();
}

function backToTopics() {
    collectionsState.currentView = 'topics';
    collectionsState.activeTopicId = null;
    updateViewDisplay();
}

function openAuthor(authorName) {
    collectionsState.currentView = 'authors';
    collectionsState.activeAuthor = authorName;
    updateViewDisplay();
}

function backToAuthors() {
    collectionsState.currentView = 'authors';
    collectionsState.activeAuthor = null;
    updateViewDisplay();
}

function filterAuthorsLetter(letter) {
    collectionsState.selectedLetter = letter;
    renderAuthorsGrid();
}

function onAuthorSearchInput(e) {
    collectionsState.authorFilterQuery = e.target.value;
    renderAuthorsGrid();
}

// --- 9. ФІЛЬТРАЦІЯ ТА ПЕРЕДАЧА ДАНИХ ДО ТАБЛИЦІ ---
function renderFilteredBooks() {
    let list = collectionsState.allBooks;

    if (collectionsState.currentView === 'topics' && collectionsState.activeTopicId) {
        list = list.filter(b => b.topicId === collectionsState.activeTopicId);
    } else if (collectionsState.currentView === 'authors' && collectionsState.activeAuthor) {
        list = list.filter(b => b.cleanAuthor === collectionsState.activeAuthor);
    }

    // Застосовуємо загальний пошук
    const searchInput = document.getElementById('lib-search-input');
    const query = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
        list = list.filter(b =>
            (b.title && b.title.toLowerCase().includes(query)) ||
            (b.author && b.author.toLowerCase().includes(query)) ||
            (b.cleanAuthor && b.cleanAuthor.toLowerCase().includes(query)) ||
            (b.year && b.year.toLowerCase().includes(query))
        );
    }

    if (typeof renderTable === 'function') {
        renderTable(list);
    }

    // Оновлюємо статистику
    const statsEl = document.getElementById('lib-stats');
    if (statsEl) {
        const totalBytes = list.reduce((sum, b) => sum + (b.sizeRaw || 0), 0);
        const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
        statsEl.innerText = `Всього: ${list.length} книг (~${totalMB} MB)`;
    }
}

function bindCollectionsEvents() {
    const authorSearchInput = document.getElementById('authors-search-input');
    if (authorSearchInput) {
        authorSearchInput.addEventListener('input', onAuthorSearchInput);
    }
}

// Допоміжні функції безпеки HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeHtmlAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Глобальний експорт для викликів з HTML onclick та інших скриптів
if (typeof window !== 'undefined') {
    window.CHESS_TOPICS = CHESS_TOPICS;
    window.collectionsState = collectionsState;
    window.initCollections = initCollections;
    window.switchCollectionView = switchCollectionView;
    window.openTopic = openTopic;
    window.backToTopics = backToTopics;
    window.openAuthor = openAuthor;
    window.backToAuthors = backToAuthors;
    window.filterAuthorsLetter = filterAuthorsLetter;
    window.renderFilteredBooks = renderFilteredBooks;
    window.classifyBookTopic = classifyBookTopic;
    window.getBookAuthorClean = getBookAuthorClean;
    window.renderStatsDashboard = renderStatsDashboard;
    window.isMagazineBook = isMagazineBook;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHESS_TOPICS,
        collectionsState,
        initCollections,
        switchCollectionView,
        openTopic,
        backToTopics,
        openAuthor,
        backToAuthors,
        filterAuthorsLetter,
        renderFilteredBooks,
        classifyBookTopic,
        getBookAuthorClean,
        renderStatsDashboard,
        isMagazineBook
    };
}

