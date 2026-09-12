/* ==============================================
   CHESS VAULT — CHAMPIONS LOGIC & MODAL
   1 рядок на 1 людину, квадратні портрети
   Модалка 1 в 1 як для книги з переходом на модалку твору
   ============================================== */

const CHAMPIONS_I18N = {
    gukesh: {
        name: "Gukesh Dommaraju",
        country: "India",
        years: "2024 — present",
        bio: "18th World Champion. The youngest undisputed world chess champion in history (18 years old, Singapore 2024). Renowned for exceptional psychological composure and deep tactical vision.",
        facts: [
            "Became the youngest Candidates Tournament winner in history at age 17.",
            "Led India to gold at the 2024 Chess Olympiad in Budapest with a phenomenal performance rating of 3056."
        ]
    },
    ding: {
        name: "Ding Liren",
        country: "China",
        years: "2023 — 2024",
        bio: "17th World Champion. First Chinese world chess champion. Won the crown in a dramatic match against Ian Nepomniachtchi in Astana on tiebreaks.",
        facts: [
            "Set a record of 100 consecutive classical games without defeat against world elite (2017–2018).",
            "Qualified for the winning 2022 Candidates tournament just weeks before start following Karjakin's disqualification."
        ]
    },
    carlsen: {
        name: "Magnus Carlsen",
        country: "Norway",
        years: "2013 — 2023",
        bio: "16th World Champion. Holder of the highest peak FIDE classical rating in history (2882). Defended his title successfully five times, dominating all formats for over a decade.",
        facts: [
            "Holds the longest unbeaten streak in top-level classical chess: 125 games without defeat.",
            "First player in history to simultaneously hold world championship titles in classical, rapid, and blitz."
        ]
    },
    anand: {
        name: "Viswanathan Anand",
        country: "India",
        years: "2000 — 2002, 2007 — 2013",
        bio: "15th World Champion (and FIDE World Champion 2000–2002). The 'Tiger of Madras', first Grandmaster and World Champion from India, inspiring a worldwide chess boom.",
        facts: [
            "In his youth, renowned for lightning-fast play, spending only 15-20 minutes on full grandmaster games.",
            "Won world championships in four different formats: knockout, round-robin tournament, and classical matches."
        ]
    },
    kramnik: {
        name: "Vladimir Kramnik",
        country: "Russia",
        years: "2000 — 2007",
        bio: "14th Classical World Champion. Dethroned Garry Kasparov in London (2000) using the formidable Berlin Defense, and reunified the world title in 2006 against Topalov.",
        facts: [
            "Selected for the 1992 Chess Olympiad by Kasparov before even gaining the Grandmaster title, scoring 8.5 out of 9.",
            "Revolutionized modern opening theory by reviving the Berlin Wall defense with 1.e4 e5."
        ]
    },
    topalov: {
        name: "Veselin Topalov",
        country: "Bulgaria",
        years: "2005 — 2006",
        bio: "FIDE World Champion (San Luis 2005). Renowned for an uncompromising, aggressive tactical style and immense fighting spirit.",
        facts: [
            "Won the FIDE World Championship tournament in San Luis 2005 with an extraordinary score of 10/14.",
            "Awarded the Chess Oscar in 2005 as the world's best player."
        ]
    },
    kasimdzhanov: {
        name: "Rustam Kasimdzhanov",
        country: "Uzbekistan",
        years: "2004 — 2005",
        bio: "FIDE World Champion (Tripoli 2004). Defeated Ivanchuk, Grischuk, Topalov and Adams. Later became a world-renowned opening theorist and coach to Vishy Anand and Fabiano Caruana.",
        facts: [
            "Won the Tripoli 2004 knockout championship starting as a 54th seed in a field of 128 elite players.",
            "Key second and analyst in Anand's successful World Championship matches (2008, 2010, 2012)."
        ]
    },
    ponomariov: {
        name: "Ruslan Ponomariov",
        country: "Ukraine",
        years: "2002 — 2004",
        bio: "FIDE World Champion (Moscow 2002). The youngest FIDE World Champion in history (18 years old), defeating Vassily Ivanchuk in the final.",
        facts: [
            "Became a Grandmaster at age 14 years and 17 days, setting a world record at the time.",
            "Key board leader in Ukraine's gold medal victories at the Chess Olympiads (2004, 2010)."
        ]
    },
    khalifman: {
        name: "Alexander Khalifman",
        country: "Russia",
        years: "1999 — 2000",
        bio: "FIDE World Champion (Las Vegas 1999). Prolific chess author, profound opening theoretician, and founder of the St. Petersburg Chess Academy.",
        facts: [
            "Triumph in Las Vegas 1999 knockout tournament against world-class opposition.",
            "Author of monumental encyclopedic opening monographs, notably 'Opening for White According to Anand' and 'Kramnik'."
        ]
    },
    karpov: {
        name: "Anatoly Karpov",
        country: "USSR / Russia",
        years: "1975 — 1985, 1993 — 1999",
        bio: "12th World Champion. Master of prophylactic positional play and legendary tournament winner with over 160 tournament victories.",
        facts: [
            "Holds the record for the most tournament victories in chess history.",
            "Played five epic World Championship matches against Garry Kasparov totaling 144 games."
        ]
    },
    kasparov: {
        name: "Garry Kasparov",
        country: "USSR / Russia",
        years: "1985 — 2000",
        bio: "13th World Champion. Youngest undisputed champion (at age 22 in 1985). Ranked world number 1 for a record 255 months, renowned for ferocious dynamic aggression and deep preparation.",
        facts: [
            "Peak Elo of 2851 stood unchallenged for over 13 years.",
            "Author of the celebrated five-volume book series 'My Great Predecessors'."
        ]
    },
    fischer: {
        name: "Robert (Bobby) Fischer",
        country: "USA",
        years: "1972 — 1975",
        bio: "11th World Champion. Ended 24 years of Soviet dominance by winning the 'Match of the Century' in Reykjavik 1972 against Boris Spassky.",
        facts: [
            "Scored legendary 6-0 whitewashes against Taimanov and Larsen in the Candidates matches, followed by a 20-game winning streak against top Grandmasters.",
            "Invented Fischer Random Chess (Chess960) and the digital increment chess clock."
        ]
    },
    spassky: {
        name: "Boris Spassky",
        country: "USSR / France",
        years: "1969 — 1972",
        bio: "10th World Champion. Universal style master who defeated Tigran Petrosian for the crown in 1969 and played Bobby Fischer in the 1972 Match of the Century.",
        facts: [
            "Won World Junior Chess Championship in 1955 at age 18.",
            "Celebrated for his sportsmanship, chivalry, and deep mastery of the King's Gambit."
        ]
    },
    petrosian: {
        name: "Tigran Petrosian",
        country: "USSR",
        years: "1963 — 1969",
        bio: "9th World Champion. 'Iron Tigran', the greatest master of defensive chess and positional exchange sacrifices in history.",
        facts: [
            "Dethroned Mikhail Botvinnik in 1963 and defended the crown against Spassky in 1966.",
            "Went virtually undefeated in ten consecutive Chess Olympiads, winning nine team golds and six individual golds."
        ]
    },
    tal: {
        name: "Mikhail Tal",
        country: "USSR",
        years: "1960 — 1961",
        bio: "8th World Champion. The 'Magician from Riga', renowned for unmatched intuitive sacrifices, spellbinding tactical combinations, and romantic attacking spirit.",
        facts: [
            "Dethroned Botvinnik in 1960 at age 23, becoming the youngest world champion at the time.",
            "Held an unbeaten record of 95 consecutive games from 1973 to 1974."
        ]
    },
    smyslov: {
        name: "Vasily Smyslov",
        country: "USSR",
        years: "1957 — 1958",
        bio: "7th World Champion. Acclaimed endgame virtuoso, harmonious positional genius, and operatic baritone.",
        facts: [
            "Won a total of 17 Chess Olympiad medals, including 9 team golds.",
            "Reached the Candidates Final match at age 62 in 1984 against Garry Kasparov."
        ]
    },
    botvinnik: {
        name: "Mikhail Botvinnik",
        country: "USSR",
        years: "1948 — 1957, 1958 — 1960, 1961 — 1963",
        bio: "6th World Champion. Patriarch of the Soviet chess school, pioneer of computer chess, and mentor to Karpov, Kasparov, and Kramnik.",
        facts: [
            "Won the world championship match-tournament in 1948 after Alekhine's death.",
            "Regained the world title twice in return matches against Smyslov (1958) and Tal (1961)."
        ]
    },
    euwe: {
        name: "Max Euwe",
        country: "Netherlands",
        years: "1935 — 1937",
        bio: "5th World Champion. Mathematician, educator, author of dozens of instructional works, and President of FIDE (1970–1978).",
        facts: [
            "Defeated Alexander Alekhine in the thrilling 1935 World Championship match.",
            "As FIDE President, skillfully resolved the diplomatic crisis surrounding the Fischer–Spassky 1972 match."
        ]
    },
    alekhine: {
        name: "Alexander Alekhine",
        country: "France / Russian Empire",
        years: "1927 — 1935, 1937 — 1946",
        bio: "4th World Champion. Dethroned Capablanca in Buenos Aires 1927. The only world champion in history to die while holding the crown, celebrated for ferocious combinational vision.",
        facts: [
            "Famous for extraordinary blindfold simultaneous exhibitions, playing 32 boards blindfolded in 1933.",
            "Won San Remo 1930 with an unheard-of score of 14/15, leaving the world elite far behind."
        ]
    },
    capablanca: {
        name: "José Raúl Capablanca",
        country: "Cuba",
        years: "1921 — 1927",
        bio: "3rd World Champion. The 'Chess Machine', celebrated for legendary endgame precision, crystal-clear positional intuition, and near invulnerability.",
        facts: [
            "Went eight consecutive years (1916–1924) in 63 tournament and match games without a single defeat.",
            "Dethroned Emanuel Lasker in Havana 1921 without dropping a single game."
        ]
    },
    lasker: {
        name: "Emanuel Lasker",
        country: "Germany",
        years: "1894 — 1921",
        bio: "2nd World Champion. Held the world title for 27 consecutive years, the longest reign in history. Mathematician, philosopher, and pioneer of psychological combat in chess.",
        facts: [
            "Defended the world championship in six successful matches over nearly three decades.",
            "Made fundamental contributions to commutative algebra (Lasker–Noether theorem)."
        ]
    },
    steinitz: {
        name: "Wilhelm Steinitz",
        country: "Austria / USA",
        years: "1886 — 1894",
        bio: "1st Official World Champion. Founder of modern positional chess theory, formulating principles of center control, weaknesses, outposts, and piece harmony.",
        facts: [
            "Won the first official World Chess Championship match against Johannes Zukertort in 1886.",
            "Went 25 consecutive games with victories in match play across two decades at his peak."
        ]
    }
};

function getChampData(champ, isEn) {
    if (isEn && typeof CHAMPIONS_I18N !== 'undefined' && CHAMPIONS_I18N[champ.id]) {
        const trans = CHAMPIONS_I18N[champ.id];
        return {
            name: trans.name || champ.name,
            country: trans.country || champ.country || '',
            years: trans.years || champ.years,
            bio: trans.bio || champ.bio,
            facts: (trans.facts && trans.facts.length > 0) ? trans.facts : (champ.facts || [])
        };
    }
    return {
        name: champ.name,
        country: champ.country || '',
        years: champ.years,
        bio: champ.bio,
        facts: champ.facts || []
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initChampionsSection();
});

function initChampionsSection() {
    if (typeof WORLD_CHAMPIONS_DATA === 'undefined') {
        console.warn('WORLD_CHAMPIONS_DATA is not loaded');
        return;
    }

    renderChampionsList();
    setupChampionModal();
}

// Допоміжна функція для прапора
function getFlagHtml(champ) {
    if (!champ.flag) return '';
    if (champ.flag.endsWith('.svg') || champ.flag.includes('/')) {
        return `<img src="${champ.flag}" alt="${champ.country || ''}" class="champ-flag-img">`;
    }
    return `<span class="champ-flag-emoji">${champ.flag}</span>`;
}

// 1. РЕНДЕР СПИСКУ ЧЕМПІОНІВ (1 рядок на 1 людину)
function renderChampionsList() {
    const listContainer = document.getElementById('champions-list');
    if (!listContainer) return;

    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const authPillText = isEn ? 'auth.' : 'авт.';
    const aboutPillText = isEn ? 'about' : 'про нього';
    const authPillTitle = isEn ? 'Authored books' : 'Книг авторства';
    const aboutPillTitle = isEn ? 'Books about him or game collections' : 'Книг про нього або збірок партій';

    listContainer.innerHTML = WORLD_CHAMPIONS_DATA.map(champ => {
        const cd = getChampData(champ, isEn);
        const authorPillClass = champ.authorBooksCount > 0 ? 'has-books' : '';
        const aboutPillClass = champ.aboutBooksCount > 0 ? 'has-books' : '';
        const flagHtml = getFlagHtml(champ);
        const countryHtml = cd.country ? `<span class="champ-country">${flagHtml} <span>${cd.country}</span></span><span class="champ-dot">•</span>` : '';

        return `
            <div class="champion-row" data-champ-id="${champ.id}">
                <div class="champ-row-portrait-wrap">
                    <img src="${champ.portrait}" alt="${escapeHtml(cd.name)}" class="champ-row-portrait" loading="lazy" onerror="this.src='img/black_king.png'">
                </div>
                <div class="champ-row-main">
                    <h4 class="champ-row-name">${escapeHtml(cd.name)}</h4>
                    <div class="champ-row-reign">
                        ${countryHtml}
                        <span>👑 ${cd.years}</span>
                    </div>
                </div>
                <div class="champ-row-stats">
                    <span class="champ-pill ${authorPillClass}" title="${authPillTitle}">
                        ✍️ ${champ.authorBooksCount} ${authPillText}
                    </span>
                    <span class="champ-pill ${aboutPillClass}" title="${aboutPillTitle}">
                        📖 ${champ.aboutBooksCount} ${aboutPillText}
                    </span>
                </div>
                <span class="champ-row-arrow">›</span>
            </div>
        `;
    }).join('');

    // Прив'язка кліку до рядків
    listContainer.querySelectorAll('.champion-row[data-champ-id]').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.getAttribute('data-champ-id');
            const champ = WORLD_CHAMPIONS_DATA.find(c => c.id === id);
            if (champ) {
                openChampionModal(champ);
            }
        });
    });
}

// 2. МОДАЛЬНЕ ВІКНО ЧЕМПІОНА
let championModalOverlay = null;

function setupChampionModal() {
    championModalOverlay = document.getElementById('champion-modal-overlay');
    if (!championModalOverlay) return;

    const closeBtn = document.getElementById('champion-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeChampionModal);
    }

    championModalOverlay.addEventListener('click', (e) => {
        if (e.target === championModalOverlay) {
            closeChampionModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Якщо відкрита модалка книги, закриваємо спочатку її
            const bookOverlay = document.getElementById('book-detail-overlay');
            if (bookOverlay && bookOverlay.classList.contains('active')) {
                if (typeof closeBookModal === 'function') closeBookModal();
                return;
            }
            if (championModalOverlay.classList.contains('active')) {
                closeChampionModal();
            }
        }
    });
}

let currentlyOpenChamp = null;

function openChampionModal(champ) {
    if (!championModalOverlay) return;

    const modalBody = document.getElementById('champion-modal-body');
    if (!modalBody) return;

    currentlyOpenChamp = champ;
    const isEn = window.i18n && window.i18n.currentLang === 'en';
    const cd = getChampData(champ, isEn);

    const numDisplay = typeof champ.number === 'number' 
        ? (isEn ? `${champ.number}th World Champion` : `${champ.number}-й Чемпіон Світу`)
        : (isEn ? `World Champion (${champ.number})` : `Чемпіон Світу (${champ.number})`);

    const factsHtml = cd.facts.map(f => `<li>${f}</li>`).join('');

    // Генерація списку авторських книг
    let authorBooksHtml = isEn 
        ? '<p class="chm-empty-books">No separate authored books in vault yet.</p>'
        : '<p class="chm-empty-books">У сховищі поки немає окремих видань авторства.</p>';
    if (champ.authorBooks && champ.authorBooks.length > 0) {
        authorBooksHtml = `
            <div class="chm-books-scroll-list">
                ${champ.authorBooks.map(b => `
                    <button type="button" class="chm-book-item" data-book-filename="${encodeURIComponent(b)}">
                        <span class="chm-book-title">📄 ${escapeHtml(b)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    // Генерація списку книг про нього
    let aboutBooksHtml = isEn
        ? '<p class="chm-empty-books">No separate books about this player in vault yet.</p>'
        : '<p class="chm-empty-books">У сховищі поки немає окремих книг про цього шахіста.</p>';
    if (champ.aboutBooks && champ.aboutBooks.length > 0) {
        aboutBooksHtml = `
            <div class="chm-books-scroll-list">
                ${champ.aboutBooks.map(b => `
                    <button type="button" class="chm-book-item" data-book-filename="${encodeURIComponent(b)}">
                        <span class="chm-book-title">📖 ${escapeHtml(b)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    const reignLabel = isEn ? 'Reign' : 'Час правління';
    const peakEloLabel = isEn ? 'Peak rating:' : 'Піковий рейтинг:';
    const authorBooksLabel = isEn ? 'Authored books:' : 'Авторських книг:';
    const aboutBooksLabel = isEn ? 'Books about him:' : 'Книг про нього:';
    const aboutChampTitle = isEn ? 'About Champion' : 'Про шахіста';
    const factsTitle = isEn ? 'Interesting Facts' : 'Цікаві факти';
    const authorColTitle = isEn ? `Authored Books (${champ.authorBooksCount})` : `Книги авторства (${champ.authorBooksCount})`;
    const aboutColTitle = isEn ? `Books About Him & Matches (${champ.aboutBooksCount})` : `Книги про нього та матчі (${champ.aboutBooksCount})`;

    modalBody.innerHTML = `
        <!-- ВЕРХНЯ ЧАСТИНА: фото 200x280 (як обкладинка книги) + інформація -->
        <div class="chm-top">
            <div class="chm-photo-wrap">
                <img src="${champ.portrait}" alt="${escapeHtml(cd.name)}" class="chm-photo" onerror="this.src='img/black_king.png'">
            </div>
            <div class="chm-hero-info">
                <div class="chm-badge-row">
                    <span class="chm-number-badge">👑 ${numDisplay}</span>
                    ${cd.country ? `<span class="chm-country-badge">${getFlagHtml(champ)} <span>${escapeHtml(cd.country)}</span></span>` : ''}
                </div>
                <h2 class="chm-name">${escapeHtml(cd.name)}</h2>
                <div class="chm-reign-badge">
                    <span>${reignLabel}: <strong>${escapeHtml(cd.years)}</strong></span>
                </div>
                <div class="chm-counts-summary">
                    ${champ.peakEloDisplay ? `
                    <div class="chm-count-pill">
                        <span>⚡ ${peakEloLabel}</span>
                        <strong class="chm-elo-val">${champ.peakEloDisplay}</strong>
                    </div>` : ''}
                    <div class="chm-count-pill">
                        <span>✍️ ${authorBooksLabel}</span>
                        <strong>${champ.authorBooksCount}</strong>
                    </div>
                    <div class="chm-count-pill">
                        <span>📖 ${aboutBooksLabel}</span>
                        <strong>${champ.aboutBooksCount}</strong>
                    </div>
                </div>
            </div>
        </div>

        <!-- ОПИС ТА ЦІКАВІ ФАКТИ -->
        <div class="chm-section">
            <h3 class="chm-section-title">📖 ${aboutChampTitle}</h3>
            <p class="chm-bio-text">${escapeHtml(cd.bio)}</p>
        </div>

        <div class="chm-section">
            <h3 class="chm-section-title">⚡ ${factsTitle}</h3>
            <ul class="chm-facts-list">
                ${factsHtml}
            </ul>
        </div>

        <!-- СПИСКИ КНИГ З ПРЯМИМ ПЕРЕХОДОМ НА МОДАЛКУ ТВОРУ -->
        <div class="chm-books-columns">
            <div class="chm-books-block">
                <h3 class="chm-section-title">✍️ ${authorColTitle}</h3>
                ${authorBooksHtml}
            </div>

            <div class="chm-books-block">
                <h3 class="chm-section-title">📖 ${aboutColTitle}</h3>
                ${aboutBooksHtml}
            </div>
        </div>
    `;

    // Прив'язуємо клік на книги → відкриваємо модалку книги (1 в 1 як у My Account / Бібліотеці)
    modalBody.querySelectorAll('.chm-book-item[data-book-filename]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filename = decodeURIComponent(btn.getAttribute('data-book-filename'));
            openBookModalFromFilename(filename);
        });
    });

    championModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeChampionModal() {
    if (!championModalOverlay) return;
    championModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentlyOpenChamp = null;
}

// 3. ВІДКРИТТЯ МОДАЛКИ КНИГИ З ІМЕНІ ФАЙЛУ (як на сторінці Мій Аккаунт)
function openBookModalFromFilename(filename) {
    if (!filename) return;

    const cleanName = filename.replace(/\.[^/.]+$/, '');
    const match = cleanName.match(/(.*?)\s*-\s*(.*)\s*\((\d{4})\)/);
    let author = '—';
    let title = cleanName;
    let year = '---';

    if (match) {
        author = match[1].trim();
        title = match[2].trim();
        year = match[3];
    } else {
        const parts = cleanName.split(/\s*-\s*/);
        if (parts.length > 1) {
            author = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }
    }

    const format = filename.split('.').pop().toLowerCase() || 'pdf';
    const pages = (window.CHESS_PAGE_COUNTS && (window.CHESS_PAGE_COUNTS[filename] || window.CHESS_PAGE_COUNTS[filename.toLowerCase()]))
        || (window.CHESS_DESCRIPTIONS && (window.CHESS_DESCRIPTIONS[filename]?.pages || window.CHESS_DESCRIPTIONS[filename.toLowerCase()]?.pages))
        || null;

    const cachedBook = window.CHESS_BOOKS_CACHE && window.CHESS_BOOKS_CACHE.find(b => b.id === filename || b.id.toLowerCase() === filename.toLowerCase());
    const sizeDisplay = cachedBook ? cachedBook.sizeDisplay : '—';
    const sizeRaw = cachedBook ? cachedBook.sizeRaw : 0;

    const bookObj = {
        id: filename,
        title: title || (cachedBook ? cachedBook.title : cleanName),
        author: author || (cachedBook ? cachedBook.author : ''),
        year: year !== '---' ? year : (cachedBook ? cachedBook.year : '---'),
        pages: pages ? parseInt(pages, 10) : (cachedBook ? cachedBook.pages : null),
        format: format,
        sizeDisplay: sizeDisplay,
        sizeRaw: sizeRaw,
        url: `https://archive.org/download/1971_20260223/${encodeURIComponent(filename)}`
    };

    if (typeof openBookModal === 'function') {
        openBookModal(bookObj);
    } else {
        console.error('openBookModal is not defined. Make sure book-modal.js is loaded.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.closeChampionModal = closeChampionModal;
window.openBookModalFromFilename = openBookModalFromFilename;

window.addEventListener('chessVaultLanguageChanged', () => {
    if (typeof renderChampionsList === 'function') {
        renderChampionsList();
    }
    if (currentlyOpenChamp && championModalOverlay && championModalOverlay.classList.contains('active')) {
        openChampionModal(currentlyOpenChamp);
    }
});

