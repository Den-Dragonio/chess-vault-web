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
        keywords: ['эндшпил', 'окончан', 'финал', 'ладейн', 'ферзев', 'конев', 'слонов', 'endgame', 'ending', 'endings', 'rook endings', 'pawn endings']
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

    // 0. Прямий топік (якщо заданий у моделі книги)
    if (book.topicId && CHESS_TOPICS.some(t => t.id === book.topicId)) {
        return book.topicId;
    }

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
    if (['эндшпил', 'окончан', 'финал', 'ладейн', 'ферзев', 'конев', 'слонов', 'endgame', 'endings', 'ending'].some(k => raw.includes(k))) {
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

const CHESS_AUTHOR_CANONICAL_MAP = {
    'абрамов': 'Абрамов Лев',
    'авербах': 'Авербах Ю.Л.',
    'айвар гипслис': 'Гипслис Айвар',
    'гипслис': 'Гипслис Айвар',
    'алаторцев': 'Алаторцев Владимир',
    'александр зайцев': 'Зайцев Александр',
    'зайцев': 'Зайцев Александр',
    'константинопольский': 'Константинопольский Александр',
    'константинопольский': 'Константинопольский Александр',
    'александр константинопольский': 'Константинопольский Александр',
    'александр константинопольский': 'Константинопольский Александр',
    'котов': 'Котов Александр',
    'толуш': 'Толуш Александр',
    'александр толуш': 'Толуш Александр',
    'суэтин': 'Суэтин Алексей',
    'суетин': 'Суэтин Алексей',
    'алексей суэтин': 'Суэтин Алексей',
    'алексей суэтин': 'Суэтин Алексей',
    'алехин': 'Алехин Александр',
    'алеехин': 'Алехин Александр',
    'ананд': 'Ананд Вишванатан',
    'лилиенталь': 'Лилиенталь Андре',
    'андре лилиенталь': 'Лилиенталь Андре',
    'багиров': 'Багиров В.К.',
    'белавенец': 'Белавенец Сергей',
    'мастер сергей белавенец': 'Белавенец Сергей',
    'мастер сергей белавенец': 'Белавенец Сергей',
    'белявский': 'Белявский Александр',
    'белявский': 'Белявский Александр',
    'болеславский': 'Болеславский Исаак',
    'болеславский': 'Болеславский Исаак',
    'бологан': 'Бологан Виорел',
    'бондаревский': 'Бондаревский Игорь',
    'бондаревский': 'Бондаревский Игорь',
    'ботвинник': 'Ботвинник Михаил',
    'бронштейн': 'Бронштейн Давид',
    'бронштейн': 'Бронштейн Давид',
    'вайнштейн': 'Вайнштейн Борис',
    'вайнштейн': 'Вайнштейн Борис',
    'вайштейн': 'Вайнштейн Борис',
    'панов': 'Панов Василий',
    'василий панов': 'Панов Василий',
    'василий панов': 'Панов Василий',
    'микенас': 'Микенас Владас',
    'владас микенас': 'Микенас Владас',
    'симагин': 'Симагин Владимир',
    'владимир симагин': 'Симагин Владимир',
    'волчок': 'Волчок Александр',
    'воронков': 'Воронков Сергей',
    'рагозин': 'Рагозин Вячеслав',
    'вячеслав рагозин': 'Рагозин Вячеслав',
    'геллер': 'Геллер Ефим',
    'гик': 'Гик Евгений',
    'глазков': 'Глазков Игорь',
    'глигорич': 'Глигорич Светозар',
    'голенищев': 'Голенищев Виктор',
    'горт': 'Горт Властимил',
    'греков': 'Греков Николай',
    'грин': 'Грин Александр',
    'григорьев': 'Григорьев Николай',
    'гришин': 'Гришин В.Г.',
    'гукеш': 'Гукеш Доммараджу',
    'гуфельд': 'Гуфельд Эдуард',
    'эдуард гуфельд': 'Гуфельд Эдуард',
    'дамский': 'Дамский Яков',
    'дамский': 'Дамский Яков',
    'дворецкий': 'Дворецкий Марк',
    'дворецкий': 'Дворецкий Марк',
    'дин': 'Дин Лижэнь',
    'дреев': 'Дреев Алексей',
    'журавлев': 'Журавлев Николай',
    'журавлёв': 'Журавлев Николай',
    'зак': 'Зак Владимир',
    'иващенко': 'Иващенко Сергей',
    'калинин': 'Калинин Александр',
    'калиниченко': 'Калиниченко Николай',
    'капабланка': 'Капабланка Хосе Рауль',
    'карлсен': 'Карлсен Магнус',
    'карпов': 'Карпов Анатолий',
    'касимджанов': 'Касимджанов Рустам',
    'каспаров': 'Каспаров Гарри',
    'керес': 'Керес Пауль',
    'кобленц': 'Кобленц Александр',
    'косиков': 'Косиков Алексей',
    'костров': 'Костров Всеволод',
    'корчной': 'Корчной Виктор',
    'корчной': 'Корчной Виктор',
    'крамник': 'Крамник Владимир',
    'ласкер': 'Ласкер Эмануил',
    'лисицын': 'Лисицын Георгий',
    'лутиков': 'Лутиков Анатолий',
    'майзелис': 'Майзелис Илья',
    'майзелис': 'Майзелис Илья',
    'мароци': 'Мароци Гёза',
    'мацукевич': 'Мацукевич Александр',
    'морфи': 'Морфи Пол',
    'пол морфи': 'Морфи Пол',
    'нейштадт': 'Нейштадт Яков',
    'нейштадт': 'Нейштадт Яков',
    'нежметдинов': 'Нежметдинов Рашид',
    'рашид нежметдинов': 'Нежметдинов Рашид',
    'нимцович': 'Нимцович Арон',
    'одесский': 'Одесский Илья',
    'одесский': 'Одесский Илья',
    'петросян': 'Петросян Тигран',
    'пожарский': 'Пожарский Виктор',
    'пожарский': 'Пожарский Виктор',
    'полугаевский': 'Полугаевский Лев',
    'полугаевский': 'Полугаевский Лев',
    'гроссмейстер полугаевский': 'Полугаевский Лев',
    'гроссмейстер полугаевский': 'Полугаевский Лев',
    'пономарев': 'Пономарев Руслан',
    'пономарёв': 'Пономарев Руслан',
    'пономарьов': 'Пономарев Руслан',
    'рабинович': 'Рабинович Илья',
    'романовский': 'Романовский Петр',
    'романовский': 'Романовский Петр',
    'петр романовский': 'Романовский Петр',
    'петр романовский': 'Романовский Петр',
    'рохлин': 'Рохлин Яков',
    'рубинштейн': 'Рубинштейн Акиба',
    'рубинштейн': 'Рубинштейн Акиба',
    'рублевский': 'Рублевский Сергей',
    'рублевский': 'Рублевский Сергей',
    'свешников': 'Свешников Евгений',
    'семен фурман': 'Фурман Семен',
    'фурман': 'Фурман Семен',
    'славин': 'Славин И.Л.',
    'смирин': 'Смирин Илья',
    'смыслов': 'Смыслов Василий',
    'сокольский': 'Сокольский Алексей',
    'сокольский': 'Сокольский Алексей',
    'сосонко': 'Сосонко Геннадий',
    'спасский': 'Спасский Борис',
    'стейниц': 'Стейниц Вильгельм',
    'стейниц': 'Стейниц Вильгельм',
    'тайманов': 'Тайманов Марк',
    'тайманов': 'Тайманов Марк',
    'таль': 'Таль Михаил',
    'михаил таль': 'Таль Михаил',
    'тарраш': 'Тарраш Зигберт',
    'топалов': 'Топалов Веселин',
    'фишер': 'Фишер Роберт (Бобби)',
    'бобби фишер': 'Фишер Роберт (Бобби)',
    'флор': 'Флор Сало',
    'гроссмейстер флор': 'Флор Сало',
    'гроссмейстер флор': 'Флор Сало',
    'халифман': 'Халифман Александр',
    'хенкин': 'Хенкин Виктор',
    'холмов': 'Холмов Ратмир',
    'ратмир холмов': 'Холмов Ратмир',
    'чарушин': 'Чарушин Виктор',
    'чехов': 'Чехов Валерий',
    'чеховер': 'Чеховер Виталий',
    'чигорин': 'Чигорин Михаил',
    'михаил чигорин': 'Чигорин Михаил',
    'шашин': 'Шашин Борис',
    'шацкий': 'Шацкий Роман',
    'шацкий': 'Шацкий Роман',
    'шипов': 'Шипов Сергей',
    'шлехтер': 'Шлехтер Карл',
    'карл шлехтер': 'Шлехтер Карл',
    'эйве': 'Эйве Макс',
    'эйве': 'Эйве Макс',
    'макс эйве': 'Эйве Макс',
    'макс эйве': 'Эйве Макс',
    'эстрин': 'Эстрин Яков',
    'юдович': 'Юдович Михаил'
};

function getBookAuthorClean(book) {
    if (!book) return 'Збірники та інші';
    let author = (book.author || '').normalize('NFC').trim();
    const rawId = (book.id || book.title || '').normalize('NFC').toLowerCase();

    // 1. Журнали та періодика
    if (rawId.startsWith('64') || rawId.includes('журнал «64»') || author === '64') return 'Журнал «64»';
    if (rawId.includes('chess in ussr') || rawId.includes('шахматы в ссср')) return 'Журнал «Шахматы в СССР»';
    if (rawId.includes('chess(riga)') || rawId.includes('шахматы (рига)')) return 'Журнал «Шахматы» (Рига)';
    if (rawId.includes('шахматный бюллетень')) return 'Журнал «Шахматный бюллетень»';
    if (rawId.includes('шахматный вестник')) return 'Журнал «Шахматный вестник»';
    if (rawId.includes('информатор') || rawId.includes('informant')) return 'Шахматный Информатор';
    if (rawId.includes('albom fide') || rawId.includes('альбом фиде') || author.toLowerCase().includes('albom fide')) return 'Альбомы ФИДЕ';

    // 2. Якщо автора нема або '1 - Разное' / '---' -> пробуємо взяти з префіксу назви файлу
    if (!author || author === '1 - Разное' || author === '.' || author === '---' || author === 'Журналы и альманахи') {
        const cleanName = (book.id || book.title || '').replace(/\.[^/.]+$/, '');
        const parts = cleanName.split(/\s*-\s*/);
        if (parts.length > 1) {
            author = parts[0].trim();
        } else {
            author = '';
        }
    }

    if (!author || author === '---' || author.trim() === '') {
        return 'Збірники та інші';
    }

    // 3. Знімаємо розширення файлів, якщо випадково потрапили в поле автора
    author = author.replace(/\.(djvu|pdf|epub|cbr|cbz|txt|doc|docx)$/i, '').trim();

    // 4. Тематичні некатегоризовані назви, матчі або серії
    const lowAuth = author.toLowerCase();
    if (lowAuth.includes('словарь') || lowAuth.includes('энциклопедия') || lowAuth.includes('словник') || lowAuth.includes('енциклопедія')) return 'Энциклопедии и словари';
    if (lowAuth.includes('правила') || lowAuth.includes('кодекс')) return 'Правила и кодексы';
    if (lowAuth.includes('турнир') || lowAuth.includes('турнір') || lowAuth.includes('матч века') || lowAuth.includes('межзональн') || lowAuth.includes('олимпиад')) return 'Турниры и матчи';
    if (/^шахматн(ая|ое|ый|ые|ы)\b/i.test(author) && !author.toLowerCase().includes('информатор')) return 'Збірники та інші';
    if (/^программа подготовки/i.test(author) || /^указатель/i.test(author) || /^21 критическ/i.test(author)) return 'Збірники та інші';
    if (/^часть \d+/i.test(author)) return 'Дворецкий Марк';
    if (/^шахматное наследие а\.?с\.?\s*лутикова/i.test(author)) return 'Лутиков Анатолий';

    // 5. Очищення років та додаткових позначок (',1987', ' (1987)', ' (ВШМ) (1979)')
    author = author.replace(/\s*\([^)]*\d{4}[^)]*\)/g, '');
    author = author.replace(/[\s,.]+\d{4}\b.*$/g, '').trim();

    // 6. Очищення префіксів серій ('Гроссмейстер', 'Мастер', 'Шахматное творчество', '744 партии')
    author = author.replace(/^(Гроссмейстер|Гроссмейстер|Мастер|Шахматное творчество|Избранные партии|Мыслитель\s*\(?|744 партии\s*)\s*/i, '');
    author = author.replace(/\)?$/, '').trim();

    // 7. Нормалізація пробілів навколо пунктуації
    author = author.replace(/\s*,\s*/g, ', ');
    author = author.replace(/\s*&\s*/g, ', ');
    author = author.replace(/_/g, ' ');

    // 8. Співавтори (якщо кілька авторів через кому)
    if (author.includes(',')) {
        const coList = author.split(',').map(p => {
            const pTrim = p.trim();
            const pKey = pTrim.toLowerCase().replace(/[.\s]+/g, ' ').trim();
            const pSurname = pTrim.split(/[\s.]+/)[0].toLowerCase();
            return CHESS_AUTHOR_CANONICAL_MAP[pKey] || CHESS_AUTHOR_CANONICAL_MAP[pSurname] || pTrim;
        });
        return coList.join(', ');
    }

    // 9. Пряма перевірка в словнику канонічних імен
    const cleanKey = author.toLowerCase().replace(/[.\s]+/g, ' ').trim();
    if (CHESS_AUTHOR_CANONICAL_MAP[cleanKey]) {
        return CHESS_AUTHOR_CANONICAL_MAP[cleanKey];
    }

    // 10. Пошук за прізвищем серед токенів (об'єднання 'Каспаров', 'Г. Каспаров', 'Каспаров Г.')
    const tokens = author.split(/[\s.]+/).filter(Boolean);
    for (const t of tokens) {
        const tClean = t.toLowerCase().replace(/[^а-яёa-z]/gi, '');
        if (tClean.length > 2 && CHESS_AUTHOR_CANONICAL_MAP[tClean]) {
            return CHESS_AUTHOR_CANONICAL_MAP[tClean];
        }
    }

    // 11. Перестановка 'Ім'я Прізвище' -> 'Прізвище Ім'я' для уніфікації списку
    if (tokens.length === 2) {
        const firstNames = ['Александр', 'Алексей', 'Алексей', 'Анатолий', 'Анатолий', 'Андрей', 'Андрей', 'Борис', 'Василий', 'Василий', 'Виктор', 'Владимир', 'Вячеслав', 'Гарри', 'Давид', 'Евгений', 'Евгений', 'Игорь', 'Константин', 'Лев', 'Марк', 'Михаил', 'Николай', 'Николай', 'Олег', 'Павел', 'Петр', 'Рашид', 'Роберт', 'Бобби', 'Сало', 'Сергей', 'Сергей', 'Семен', 'Семён', 'Тигран', 'Юрий', 'Юрий', 'Эдуард', 'Эммануил', 'Яков', 'Пауль', 'Макс', 'Пол', 'Айвар', 'Айвар', 'Владас', 'Ратмир', 'Властимил', 'Светозар', 'Илья', 'Виорел', 'Арон', 'Зигберт', 'Акиба', 'Исаак', 'Виталий', 'Виталий', 'Геннадий', 'Геннадий', 'Григорий', 'Григорий', 'Роман'];
        if (firstNames.includes(tokens[0])) {
            return `${tokens[1]} ${tokens[0]}`;
        }
    }

    return author;
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
    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const booksWord = isEn ? 'books' : 'книг';

    if (view === 'all') {
        if (topicsWrap) topicsWrap.style.display = 'none';
        if (authorsWrap) authorsWrap.style.display = 'none';
        if (statsWrap) statsWrap.style.display = 'none';
        if (activeHeader) activeHeader.style.display = 'none';
        if (booksListBlock) booksListBlock.style.display = 'flex';
        if (searchBox) searchBox.style.display = 'block';
        if (sortControls) sortControls.style.display = 'flex';
        if (searchInput) searchInput.placeholder = window.i18n ? window.i18n.t('lib_search_ph') : 'Шукати за автором, назвою або роком...';
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
            const topic = CHESS_TOPICS.find(t => t.id === activeTopicId) || { id: 'all', title: 'Розділ', icon: '♟️' };
            const topicTitle = window.i18n ? window.i18n.t(`topic_${topic.id}_title`) : topic.title;
            const count = collectionsState.allBooks.filter(b => b.topicId === activeTopicId).length;
            const backText = isEn ? '← All sections' : '← Всі розділи';
            if (topicsWrap) topicsWrap.style.display = 'none';
            if (authorsWrap) authorsWrap.style.display = 'none';
            if (activeHeader) {
                activeHeader.style.display = 'flex';
                activeHeader.innerHTML = `
                    <div class="collection-header-info">
                        <span class="collection-header-icon">${topic.icon}</span>
                        <h2 class="collection-header-title">
                            ${topicTitle}
                            <span class="collection-header-badge">${count} ${booksWord}</span>
                        </h2>
                    </div>
                    <button class="collection-back-btn" onclick="backToTopics()">
                        ${backText}
                    </button>
                `;
            }
            if (booksListBlock) booksListBlock.style.display = 'flex';
            if (searchBox) searchBox.style.display = 'block';
            if (sortControls) sortControls.style.display = 'flex';
            if (searchInput) searchInput.placeholder = isEn ? `Search books in «${topicTitle}»...` : `Шукати серед книг розділу «${topicTitle}»...`;
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
            const backText = isEn ? '← All authors' : '← Всі автори';
            if (topicsWrap) topicsWrap.style.display = 'none';
            if (authorsWrap) authorsWrap.style.display = 'none';
            if (activeHeader) {
                activeHeader.style.display = 'flex';
                activeHeader.innerHTML = `
                    <div class="collection-header-info">
                        <span class="collection-header-icon">👤</span>
                        <h2 class="collection-header-title">
                            ${escapeHtml(activeAuthor)}
                            <span class="collection-header-badge">${count} ${booksWord}</span>
                        </h2>
                    </div>
                    <button class="collection-back-btn" onclick="backToAuthors()">
                        ${backText}
                    </button>
                `;
            }
            if (booksListBlock) booksListBlock.style.display = 'flex';
            if (searchBox) searchBox.style.display = 'block';
            if (sortControls) sortControls.style.display = 'flex';
            if (searchInput) searchInput.placeholder = isEn ? `Search books by «${activeAuthor}»...` : `Шукати серед книг автора «${activeAuthor}»...`;
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
    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const yearBuckets = isEn ? [
        { label: 'pre-1930', min: 0, max: 1929, count: 0, desc: 'Early Classics' },
        { label: '1930–49', min: 1930, max: 1949, count: 0, desc: 'Golden Era of 30-40s' },
        { label: '1950s', min: 1950, max: 1959, count: 0, desc: 'Soviet Chess School' },
        { label: '1960s', min: 1960, max: 1969, count: 0, desc: 'Tal & Petrosian Era' },
        { label: '1970s', min: 1970, max: 1979, count: 0, desc: 'Fischer & Karpov Era' },
        { label: '1980s', min: 1980, max: 1989, count: 0, desc: 'Karpov vs Kasparov' },
        { label: '1990s', min: 1990, max: 1999, count: 0, desc: 'Computer Revolution' },
        { label: '2000s', min: 2000, max: 2009, count: 0, desc: 'Modern Theory' },
        { label: '2010+', min: 2010, max: 2099, count: 0, desc: 'Contemporary Works' }
    ] : [
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

    const booksWord = isEn ? 'books' : 'книг';
    const kpiTotal = isEn ? 'Total works in database' : 'Всього творів у базі';
    const kpiAuthors = isEn ? 'Unique authors' : 'Унікальних авторів';
    const kpiPages = isEn ? 'Avg pages per book' : 'Сер. кількість сторінок';
    const kpiMagazines = isEn ? 'Magazines in separate cast' : 'Журналів в окремій касті';
    const yearsSecTitle = isEn ? 'Publication Years' : 'Роки публікацій літератури';
    const pagesSecTitle = isEn ? 'Page Count Distribution' : 'Розподіл за обсягом: яких книг більше?';
    const authorsSecTitle = isEn ? 'Leading Authors by Book Count' : 'Лідери за кількістю книг (Топ авторів)';
    const authorsSecSub = isEn ? 'Author ranking by number of published works in the chess fund. Magazines and periodicals are separated.' : 'Рейтинг авторів за кількістю творів у шахматному фонді. Журнали та періодика виділені в окрему касту і не беруть участі в авторському заліку.';
    const booksInDbText = isEn ? 'books in database →' : 'книг у базі →';
    const mostInDbText = isEn ? 'Most in database' : 'Найбільше в базі';
    const verdictTitle = isEn ? 'Analytics verdict:' : 'Вердикт аналітики:';

    // ГЕНЕРУЄМО ДАШБОРД HTML
    container.innerHTML = `
        <div class="stats-dashboard">
            <!-- 1. KPI КАРТКИ -->
            <div class="stats-kpi-grid">
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">📚</div>
                    <div>
                        <div class="stats-kpi-val">${books.length.toLocaleString(isEn ? 'en-US' : 'uk-UA')}</div>
                        <div class="stats-kpi-label">${kpiTotal}</div>
                    </div>
                </div>
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">✍️</div>
                    <div>
                        <div class="stats-kpi-val">${totalAuthors}</div>
                        <div class="stats-kpi-label">${kpiAuthors}</div>
                    </div>
                </div>
                <div class="stats-kpi-card">
                    <div class="stats-kpi-icon">📄</div>
                    <div>
                        <div class="stats-kpi-val">~${avgPages}</div>
                        <div class="stats-kpi-label">${kpiPages}</div>
                    </div>
                </div>
                <div class="stats-kpi-card" style="cursor:pointer;" onclick="openTopic('magazines')">
                    <div class="stats-kpi-icon">📰</div>
                    <div>
                        <div class="stats-kpi-val">${magazineBooks.length}</div>
                        <div class="stats-kpi-label">${kpiMagazines}</div>
                    </div>
                </div>
            </div>

            <!-- 2. ГРАФІК РОКІВ ПУБЛІКАЦІЙ -->
            <div class="stats-section-card">
                <h3 class="stats-section-title">
                    <span>📅</span>
                    <span>${yearsSecTitle}</span>
                </h3>
                <p class="stats-section-sub">
                    ${isEn ? `Distribution across chronological decades (${totalWithYear} books with specified year). Peak period: <strong>${peakDecade.label}</strong> — ${peakDecade.count} works!` : `Розподіл видань за хронологічними десятиліттями (оцифровано ${totalWithYear} книг із зазначеним роком). Піковий період: <strong>${peakDecade.label} (${peakDecade.desc})</strong> — ${peakDecade.count} творів!`}
                </p>

                <div class="years-chart-container">
                    ${yearBuckets.map(bucket => {
                        const heightPct = Math.max(6, Math.round((bucket.count / maxYearCount) * 100));
                        const pctOfTotal = totalWithYear ? Math.round((bucket.count / totalWithYear) * 100) : 0;
                        const isPeak = bucket === peakDecade;
                        const tipText = isEn ? `${bucket.label}: ${bucket.count} books (${pctOfTotal}% of catalog)` : `${bucket.label}: ${bucket.count} книг (${pctOfTotal}% від оцифрованих)`;
                        return `
                            <div class="year-bar-col" title="${tipText}">
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
                    <span>${pagesSecTitle}</span>
                </h3>
                <p class="stats-section-sub">
                    ${isEn ? `Page volume analysis of digitized literature (sample: ${booksWithPages.length} books with exact count).` : `Аналіз сторінкового обсягу оцифрованої літератури (вибірка: ${booksWithPages.length} книг з точним підрахунком).`}
                </p>

                <div class="pages-dist-list">
                    ${pageTiers.map(t => {
                        const isWinner = t === winnerTier;
                        const tierName = isEn ? (t.id === 'micro' ? 'Short brochures' : (t.id === 'compact' ? 'Compact editions' : (t.id === 'medium' ? 'Standard monographs' : (t.id === 'large' ? 'Voluminous textbooks' : 'Multivolume tomes')))) : t.name;
                        return `
                            <div class="pages-dist-item">
                                <div class="pages-dist-header">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span>${tierName} <small style="opacity:0.75; font-weight:normal;">(${t.range})</small></span>
                                        ${isWinner ? `<span class="pages-dist-highlight">🏆 ${mostInDbText} (${t.pct}%)</span>` : ''}
                                    </div>
                                    <span style="font-weight:700;">${t.count} ${booksWord} <span style="opacity:0.6; font-size:0.85em;">(${t.pct}%)</span></span>
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
                        <strong>${verdictTitle}</strong>
                        ${isEn
                            ? (totalShort > totalLong
                                ? `The database is dominated by <strong>compact and short books</strong> (under 249 pages — <strong>${shortPct}%</strong> vs ${longPct}% long books). `
                                : `The database is dominated by <strong>solid monographs and comprehensive textbooks</strong> (over 250 pages — <strong>${longPct}%</strong> vs ${shortPct}% short brochures). `)
                            : (totalShort > totalLong
                                ? `У базі переважають <strong>компактні та короткі книги</strong> (до 249 стор. — <strong>${shortPct}%</strong> бази проти ${longPct}% довгих книг). `
                                : `У базі переважають <strong>солідні монографії та підручники</strong> (від 250 стор. — <strong>${longPct}%</strong> бази проти ${shortPct}% коротких брошур). `)
                        }
                        ${isEn ? `Average volume per book is <strong>${avgPages} pages</strong>.` : `Середній обсяг однієї книги становить <strong>${avgPages} сторінок</strong>.`}
                    </div>
                </div>
            </div>

            <!-- 4. ТОП АВТОРІВ ЗА КІЛЬКІСТЮ КНИГ (ЖУРНАЛИ В ОКРЕМІЙ КАСТІ) -->
            <div class="stats-section-card">
                <h3 class="stats-section-title">
                    <span>👑</span>
                    <span>${authorsSecTitle}</span>
                </h3>
                <p class="stats-section-sub">
                    ${authorsSecSub}
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
                                    <div class="top-author-books">${a.count} ${booksInDbText}</div>
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

if (typeof window !== 'undefined') {
    window.addEventListener('chessVaultLanguageChanged', () => {
        if (typeof switchCollectionView === 'function' && collectionsState && collectionsState.currentView) {
            switchCollectionView(collectionsState.currentView);
        }
    });
}


