/* ========================================================
   CHESS VAULT — INTERNATIONALIZATION (i18n) MODULE
   Default: English ('en') for unauthorized/new users
   Supported: 'en', 'uk'
   ======================================================== */

const I18N_TRANSLATIONS = {
    en: {
        // Navigation & General
        nav_home: "Home",
        nav_my_account: "My Account",
        nav_library: "Library",
        nav_account: "Account",
        nav_login: "Log In",
        nav_register: "Sign Up",
        nav_logout: "Log Out",
        scroll_to_top: "Scroll to top",

        // Home Page (index.html)
        home_news_title: "News",
        home_news_empty: "No news yet...",
        home_top_books: "Top Downloads",
        home_top_empty: "No downloads yet...",
        home_useful_links: "Useful Links",
        home_champions_title: "World Chess Champions",
        home_champions_subtitle: "From Steinitz to Ding Liren — the greatest minds in chess history",

        // Auth Modals
        login_title: "Log In",
        login_username_ph: "Username",
        login_password_ph: "Password",
        login_btn: "Sign In",
        login_no_account: "Don't have an account?",
        login_link_reg: "Sign Up",

        reg_title: "Sign Up",
        reg_username_ph: "Choose a username",
        reg_password_ph: "Choose a password (min 6 chars)",
        reg_btn: "Create Account",
        reg_have_account: "Already have an account?",
        reg_link_login: "Log In",

        auth_err_empty_username: "Please enter a username.",
        auth_err_len: "Username must be between 4 and 20 characters.",
        auth_err_chars: "Username may only contain Latin letters, numbers, hyphens (-) and spaces.",
        auth_err_letter: "Username must contain at least one Latin letter.",
        auth_err_taken: "This username is already taken.",
        auth_err_diff: "Enter a username different from your current one.",
        auth_welcome: "Welcome, {username}!",
        auth_bye: "Goodbye!",
        auth_created: "Account created! Welcome, {username}!",
        auth_invalid_cred: "Invalid username or password.",
        auth_email_taken: "This username is already taken.",
        auth_weak_pass: "Password is too short (min 6 characters).",
        auth_too_many: "Too many attempts. Please try again later.",
        auth_generic_err: "An error occurred. Please try again.",

        // Library Page (library.html)
        lib_title: "Chess Vault - Library",
        lib_tab_all: "All Books",
        lib_tab_topics: "Game Sections",
        lib_tab_authors: "By Authors",
        lib_tab_stats: "DB Statistics",

        lib_search_ph: "Search by author, title or year...",
        lib_authors_search_ph: "Search author across collections...",
        lib_sort_label: "Sort by:",
        lib_sort_author: "Author",
        lib_sort_year: "Date",
        lib_sort_pages: "Pages",
        lib_sort_size: "Size",

        lib_th_author: "Author",
        lib_th_title: "Book Title",
        lib_th_year: "Year",
        lib_th_pages: "Pages",
        lib_th_format: "Type",
        lib_th_size: "Size",
        lib_th_action: "Action",
        lib_loading: "Loading library...",
        lib_no_books: "No books found matching your query",
        lib_btn_open: "Open",
        lib_count_stats: "Showing {count} of {total} books",
        lib_back_all: "← Back to all collections",
        lib_clear_author: "✕ Show all authors",
        lib_author_books_badge: "{count} books",
        lib_author_tag: "Author",

        // Book Detail Modal (book-modal.js)
        modal_btn_download: "Download ({size})",
        modal_section_about: "About Book",
        modal_section_author: "About Author",
        modal_section_topics: "Topics",
        modal_pages: "{count} p.",
        modal_journal_tag: "Magazine \"64\"",
        modal_source_data: "Data: {source}",
        modal_desc_preparing: "Description for this book is being prepared. You can download the book and view its contents.",
        modal_wiki_link: "Wikipedia Article",
        modal_openlib_link: "Open Library",
        modal_downloading: "Preparing download: \"{title}\"...",
        modal_download_success: "Download started: \"{title}\"",
        modal_close: "Close",

        // Champions (champions.js)
        champ_pill_author: "{count} author",
        champ_pill_about: "{count} about",
        champ_years: "Years",
        champ_view_books: "View books",
        champ_about_player: "About Champion",
        champ_reign: "World Champion: {years}",

        // Profile & Settings (profile.html)
        profile_title: "Chess Vault - Profile",
        profile_member_badge: "Chess Vault Member",
        profile_reg_date: "Registered: {date}",
        profile_stat_downloads: "Downloads",
        profile_stat_label: "Total downloads",
        profile_btn_settings: "Settings",
        profile_btn_logout: "Log Out",
        profile_history_title: "My Downloads",
        profile_history_hint: "Click on a book to read description and download again",
        profile_history_empty: "You haven't downloaded any books yet.",
        profile_history_click_hint: "Click to view synopsis and download",
        profile_history_load_err: "❌ Error loading download history",
        profile_th_title: "Title",
        profile_th_author: "Author",
        profile_th_date: "Date",

        // Settings Modal
        settings_title: "Account Settings",
        settings_username_section: "Change username / name",
        settings_username_hint: "4 to 20 characters. Latin letters, numbers, hyphens (-) and spaces only.",
        settings_username_ph: "New username",
        settings_btn_update: "Update",
        settings_password_section: "Change password",
        settings_password_hint: "Enter your current password to confirm, then a new password (min. 6 characters).",
        settings_old_pass_ph: "Current password",
        settings_new_pass_ph: "New password",
        settings_btn_save_pass: "Save Password",
        settings_theme_section: "Appearance Theme",
        settings_theme_hint: "Select visual style for the site interface.",
        settings_theme_light: "Light",
        settings_theme_dark: "Dark",
        settings_theme_system: "System",
        settings_language_section: "Interface Language",
        settings_language_hint: "Choose your preferred interface language.",
        settings_lang_en: "English",
        settings_lang_uk: "Ukrainian",
        settings_delete_section: "Delete Account",
        settings_delete_hint: "Permanently delete your profile and download history.",
        settings_btn_delete: "Delete Account",
        settings_delete_confirm: "Are you sure you want to delete your account? This action cannot be undone!",
        settings_saved_theme: "Theme switched to: {theme}",
        settings_saved_lang: "Language switched to: {lang}",
        settings_username_updated: "Username successfully updated!",
        settings_password_updated: "Password successfully updated!",

        // Collections & Stats Topics
        topic_debut_title: "Openings",
        topic_debut_sub: "Theory of openings, defenses, gambits and development systems",
        topic_mittelspiel_title: "Middlegame",
        topic_mittelspiel_sub: "Strategy, tactics, combinations, game planning and attack",
        topic_endgame_title: "Endgame",
        topic_endgame_sub: "Endgame theory, pawn and piece endgame techniques",
        topic_etudes_title: "Studies & Problems",
        topic_etudes_sub: "Chess composition, endgame studies, artistic chess and FIDE albums",
        topic_beginners_title: "For Beginners",
        topic_beginners_sub: "Tutorials, textbooks, fundamentals and first steps in chess",
        topic_tournaments_title: "Tournaments & Matches",
        topic_tournaments_sub: "Historic world championships, interzonals and super-tournaments",
        topic_personal_title: "Personalities & Games",
        topic_personal_sub: "Selected games of great masters, life stories of world champions",
        topic_psychology_title: "Psychology & Thinking",
        topic_psychology_sub: "Mental preparation, decision-making and philosophy of chess",
        topic_magazines_title: "Magazines & Periodicals",
        topic_magazines_sub: "Periodical editions: «64», «Chess in USSR», bulletins",
        topic_history_title: "History & Culture",
        topic_history_sub: "Chess history, stories, legends and cultural impact of the game",

        // Statistics tab in library
        stats_header_title: "Vault Database Analytics",
        stats_header_sub: "Detailed metrics on library structure, volume, page distributions and authors.",
        stats_card_total_books: "Total Books",
        stats_card_total_authors: "Authors in DB",
        stats_card_total_volume: "Total Volume",
        stats_card_total_pages: "Scanned Pages",
        stats_sec_distribution: "Distribution by Game Sections",
        stats_sec_distribution_sub: "Volume and percentage of books by key categories.",
        stats_sec_pages: "Page Volume Distribution",
        stats_sec_pages_sub: "Book volume tiers: from brief brochures to multivolume encyclopedias.",
        stats_sec_top_authors: "Leading Authors by Book Count",
        stats_sec_top_authors_sub: "Author ranking by number of published works in the chess fund.",
        stats_books_in_db: "{count} books in database →",
        stats_most_popular_tier: "Most in DB ({pct}%)",
        stats_summary_title: "Analytics Verdict:",
        stats_avg_pages: "Average book length is {pages} pages."
    },

    uk: {
        // Navigation & General
        nav_home: "Головна",
        nav_my_account: "Мій Аккаунт",
        nav_library: "Бібліотека",
        nav_account: "Аккаунт",
        nav_login: "Вхід",
        nav_register: "Реєстрація",
        nav_logout: "Вийти",
        scroll_to_top: "Нагору",

        // Home Page (index.html)
        home_news_title: "Новини",
        home_news_empty: "Поки порожньо...",
        home_top_books: "Топ завантажень",
        home_top_empty: "Поки порожньо...",
        home_useful_links: "Корисні посилання",
        home_champions_title: "Чемпіони світу",
        home_champions_subtitle: "Від Стейніца до Дін Ліженя — генії шахової думки",

        // Auth Modals
        login_title: "Вхід",
        login_username_ph: "Логін",
        login_password_ph: "Пароль",
        login_btn: "Увійти",
        login_no_account: "Немає аккаунту?",
        login_link_reg: "Реєстрація",

        reg_title: "Реєстрація",
        reg_username_ph: "Придумай логін",
        reg_password_ph: "Придумай пароль (мін. 6 символів)",
        reg_btn: "Створити аккаунт",
        reg_have_account: "Вже є аккаунт?",
        reg_link_login: "Увійти",

        auth_err_empty_username: "Введіть логін.",
        auth_err_len: "Логін має бути довшим за 3 символи (від 4 до 20).",
        auth_err_chars: "Логін може містити лише англійські літери, цифри, дефіс (-) та пробіл.",
        auth_err_letter: "Логін повинен містити хоча б одну англійську літеру.",
        auth_err_taken: "Цей логін вже зайнятий іншим користувачем.",
        auth_err_diff: "Введіть логін, відмінний від поточного.",
        auth_welcome: "Ласкаво просимо, {username}!",
        auth_bye: "До побачення!",
        auth_created: "Аккаунт створено! Ласкаво просимо, {username}!",
        auth_invalid_cred: "Невірний логін або пароль.",
        auth_email_taken: "Цей логін вже зайнятий.",
        auth_weak_pass: "Пароль занадто короткий (мін. 6 символів).",
        auth_too_many: "Забагато спроб. Спробуйте пізніше.",
        auth_generic_err: "Помилка. Спробуйте ще раз.",

        // Library Page (library.html)
        lib_title: "Chess Vault - Бібліотека",
        lib_tab_all: "Всі книги",
        lib_tab_topics: "Розділи гри",
        lib_tab_authors: "За авторами",
        lib_tab_stats: "Статистика БД",

        lib_search_ph: "Шукати за автором, назвою або роком...",
        lib_authors_search_ph: "Пошук автора серед колекцій...",
        lib_sort_label: "Упорядкувати:",
        lib_sort_author: "Автор",
        lib_sort_year: "Дата",
        lib_sort_pages: "Стор.",
        lib_sort_size: "Розмір",

        lib_th_author: "Автор",
        lib_th_title: "Назва книги",
        lib_th_year: "Рік",
        lib_th_pages: "Стор.",
        lib_th_format: "Вид",
        lib_th_size: "Вага",
        lib_th_action: "Дія",
        lib_loading: "Завантаження бібліотеки...",
        lib_no_books: "Книг за вашим запитом не знайдено",
        lib_btn_open: "Відкрити",
        lib_count_stats: "Показано {count} з {total} книг",
        lib_back_all: "← Назад до всіх розділів",
        lib_clear_author: "✕ Показати всіх авторів",
        lib_author_books_badge: "{count} книг",
        lib_author_tag: "Автор",

        // Book Detail Modal (book-modal.js)
        modal_btn_download: "Скачати ({size})",
        modal_section_about: "Про книгу",
        modal_section_author: "Про автора",
        modal_section_topics: "Теми",
        modal_pages: "{count} стор.",
        modal_journal_tag: "Журнал \"64\"",
        modal_source_data: "Дані: {source}",
        modal_desc_preparing: "Опис для цієї книги готується. Ви можете завантажити книгу та ознайомитися з її змістом.",
        modal_wiki_link: "Стаття у Вікіпедії",
        modal_openlib_link: "Open Library",
        modal_downloading: "Підготовка до завантаження: «{title}»...",
        modal_download_success: "Завантаження розпочато: «{title}»",
        modal_close: "Закрити",

        // Champions (champions.js)
        champ_pill_author: "{count} авт.",
        champ_pill_about: "{count} про нього",
        champ_years: "Роки",
        champ_view_books: "Дивитись книги",
        champ_about_player: "Про чемпіона",
        champ_reign: "Чемпіон світу: {years}",

        // Profile & Settings (profile.html)
        profile_title: "Chess Vault - Профіль",
        profile_member_badge: "Учасник Chess Vault",
        profile_reg_date: "Зареєстровано: {date}",
        profile_stat_downloads: "Завантажень",
        profile_stat_label: "Всього завантажень",
        profile_btn_settings: "Налаштування",
        profile_btn_logout: "Вийти",
        profile_history_title: "Мої завантаження",
        profile_history_hint: "Натисніть на книгу, щоб прочитати опис і завантажити знову",
        profile_history_empty: "Ви ще не завантажили жодної книги.",
        profile_history_click_hint: "Натисніть для перегляду синопсису та завантаження",
        profile_history_load_err: "❌ Помилка завантаження історії",
        profile_th_title: "Назва",
        profile_th_author: "Автор",
        profile_th_date: "Дата",

        // Settings Modal
        settings_title: "Налаштування аккаунту",
        settings_username_section: "Зміна логіну / імені",
        settings_username_hint: "Від 4 до 20 символів. Лише англійські літери, цифри, дефіс (-) та пробіл.",
        settings_username_ph: "Новий логін",
        settings_btn_update: "Оновити",
        settings_password_section: "Зміна пароля",
        settings_password_hint: "Введіть старий пароль для підтвердження, потім новий пароль (мін. 6 символів).",
        settings_old_pass_ph: "Поточний пароль",
        settings_new_pass_ph: "Новий пароль",
        settings_btn_save_pass: "Зберегти пароль",
        settings_theme_section: "Тема оформлення",
        settings_theme_hint: "Оберіть зовнішній вигляд для інтерфейсу сайту.",
        settings_theme_light: "Світла",
        settings_theme_dark: "Темна",
        settings_theme_system: "Системна",
        settings_language_section: "Мова інтерфейсу",
        settings_language_hint: "Оберіть мову відображення сайту.",
        settings_lang_en: "English",
        settings_lang_uk: "Українська",
        settings_delete_section: "Видалення аккаунту",
        settings_delete_hint: "Безповоротне видалення вашого профілю та історії завантажень.",
        settings_btn_delete: "Видалити аккаунт",
        settings_delete_confirm: "Ви точно впевнені, що хочете видалити свій аккаунт? Цю дію неможливо скасувати!",
        settings_saved_theme: "Тему переключено на: {theme}",
        settings_saved_lang: "Мову переключено на: {lang}",
        settings_username_updated: "Логін успішно оновлено!",
        settings_password_updated: "Пароль успішно змінено!",

        // Collections & Stats Topics
        topic_debut_title: "Дебюти",
        topic_debut_sub: "Теорія початків, захисти, гамбіти та системи розвитку",
        topic_mittelspiel_title: "Мітельшпіль",
        topic_mittelspiel_sub: "Стратегія, тактика, комбінації, плани гри та атака",
        topic_endgame_title: "Ендшпіль",
        topic_endgame_sub: "Теорія закінчень, техніка пішакових та фігурних фіналів",
        topic_etudes_title: "Етюди та задачі",
        topic_etudes_sub: "Шахова композиція, етюди, краса гри та альбоми FIDE",
        topic_beginners_title: "Для початківців",
        topic_beginners_sub: "Самовчителі, підручники, основи та перші кроки у грі",
        topic_tournaments_title: "Матчі та турніри",
        topic_tournaments_sub: "Історичні чемпіонати світу, міжзональні та супертурніри",
        topic_personal_title: "Персоналії та партії",
        topic_personal_sub: "Вибрані партії великих гравців, життєвий шлях чемпіонів",
        topic_psychology_title: "Психологія та мислення",
        topic_psychology_sub: "Психологічна підготовка, мислення та філософія гри",
        topic_magazines_title: "Журнали та періодика",
        topic_magazines_sub: "Періодичні видання: «64», «Шахматы в СССР», вісники",
        topic_history_title: "Історія та культура",
        topic_history_sub: "Історія шахів, спогади, легенди та культурний вплив гри",

        // Statistics tab in library
        stats_header_title: "Аналітика шахової бази",
        stats_header_sub: "Детальні метрики за структурою бібліотеки, обсягом, розподілом сторінок та авторами.",
        stats_card_total_books: "Всього книг",
        stats_card_total_authors: "Авторів у базі",
        stats_card_total_volume: "Сумарний обсяг",
        stats_card_total_pages: "Просканованих стор.",
        stats_sec_distribution: "Розподіл за розділами гри",
        stats_sec_distribution_sub: "Обсяг та відсоток книг за ключовими категоріями.",
        stats_sec_pages: "Розподіл за обсягом сторінок",
        stats_sec_pages_sub: "Градація книг за обсягом: від коротких брошур до солідних томів.",
        stats_sec_top_authors: "Лідери за кількістю книг (Топ авторів)",
        stats_sec_top_authors_sub: "Рейтинг авторів за кількістю творів у шахматному фонді.",
        stats_books_in_db: "{count} книг у базі →",
        stats_most_popular_tier: "Найбільше в базі ({pct}%)",
        stats_summary_title: "Вердикт аналітики:",
        stats_avg_pages: "Середній обсяг однієї книги становить {pages} сторінок."
    }
};

const i18n = {
    // Current active language: default is 'en' for unauthorized users
    currentLang: 'en',

    getLanguage() {
        try {
            const saved = localStorage.getItem('chess_vault_lang');
            if (saved === 'uk' || saved === 'en') {
                return saved;
            }
        } catch (_) {}
        return 'en'; // default for guests & new users
    },

    t(key, params = {}) {
        const lang = this.currentLang || 'en';
        const dict = I18N_TRANSLATIONS[lang] || I18N_TRANSLATIONS.en;
        let val = dict[key];
        if (val === undefined) {
            // fallback to English
            val = I18N_TRANSLATIONS.en[key];
        }
        if (val === undefined) {
            return key;
        }
        if (params && typeof params === 'object') {
            for (const [pKey, pVal] of Object.entries(params)) {
                val = val.replace(new RegExp(`\\{${pKey}\\}`, 'g'), pVal);
            }
        }
        return val;
    },

    setLanguage(lang, saveToCloud = true) {
        if (lang !== 'en' && lang !== 'uk') lang = 'en';
        this.currentLang = lang;
        try {
            localStorage.setItem('chess_vault_lang', lang);
        } catch (_) {}

        document.documentElement.lang = lang;

        // Apply translations to DOM
        this.translatePage();

        // Dispatch language change event for dynamic components (collections, champions, etc.)
        window.dispatchEvent(new CustomEvent('chessVaultLanguageChanged', { detail: { lang } }));

        // If user is authenticated, sync to Firestore
        if (saveToCloud && window.auth && window.auth.currentUser && window.db) {
            try {
                window.db.collection('user_preferences').doc(window.auth.currentUser.uid).set({
                    language: lang,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
            } catch (_) {}
        }
    },

    translatePage() {
        // Elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = this.t(key);
            }
        });

        // Elements with data-i18n-html
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (key) {
                el.innerHTML = this.t(key);
            }
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = this.t(key);
            }
        });

        // Titles / Aria-labels
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = this.t(key);
                el.setAttribute('aria-label', this.t(key));
            }
        });

        // Update nav quick language switch button if present
        document.querySelectorAll('.lang-switcher-toggle').forEach(btn => {
            const label = this.currentLang === 'en' ? '🌐 UKR' : '🌐 ENG';
            btn.textContent = label;
            btn.title = this.currentLang === 'en' ? 'Перемкнути на українську' : 'Switch to English';
        });

        // Update active class on language selectors in settings modal
        document.querySelectorAll('.lang-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
        });
    },

    toggleLanguage() {
        const nextLang = this.currentLang === 'en' ? 'uk' : 'en';
        this.setLanguage(nextLang, true);
    },

    init() {
        this.currentLang = this.getLanguage();
        document.documentElement.lang = this.currentLang;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.translatePage());
        } else {
            this.translatePage();
        }
    }
};

// Initialize immediately so currentLang is ready for sync execution
i18n.init();
window.i18n = i18n;
