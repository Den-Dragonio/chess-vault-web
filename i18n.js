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
        nav_admin_panel: "Admin Panel",
        scroll_to_top: "Scroll to top",

        // Home Page (index.html)
        home_news_title: "News",
        home_news_empty: "No news yet...",
        news_downloaded: "📥 {user} downloaded \"{title}\"",
        news_welcome: "🎉 {user} joined Chess Vault! Welcome!",
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
        auth_err_len: "Username must be between 2 and 14 letters.",
        auth_err_chars: "Username must contain only English letters.",
        auth_err_letters_only: "Username must contain only English letters (a-z, A-Z).",
        auth_err_max_14: "Username maximum length is 14 letters.",
        auth_err_min_len: "Username must be at least 2 letters.",
        auth_err_letter: "Username must contain at least one English letter.",
        auth_err_taken: "This username is already taken. Please choose another.",
        auth_err_diff: "Enter a username different from your current one.",
        auth_welcome: "Welcome, {username}!",
        auth_bye: "Goodbye!",
        auth_created: "Account created! Welcome, {username}!",
        auth_invalid_cred: "Invalid username or password.",
        auth_email_taken: "This username is already taken. Please choose another.",
        auth_weak_pass: "Password is too short (min 6 characters).",
        auth_too_many: "Too many attempts. Please try again later.",
        auth_generic_err: "An error occurred. Please try again.",

        // Registration Cheat-sheet
        cheat_sheet_title: "📋 Login Requirements:",
        cheat_rule_letters: "English letters only (a-z, A-Z)",
        cheat_rule_length: "Maximum 14 characters",
        cheat_rule_unique: "Unique individual login",

        // User Statuses / Ranks
        status_creator: "👑 Creator",
        status_grandmaster: "♚ Vault Grandmaster",
        status_master: "♜ Vault Master",
        status_adept: "♞ Chess Adept",
        status_member: "♟ Chess Vault Member",

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
        pl_title: "My Playlists",
        pl_read_later: "Read Later",
        pl_watch_later: "Read Later",
        pl_favorites: "Favorites",
        pl_btn_add: "+ New Playlist",
        pl_new_playlist: "New Playlist",
        pl_add_to_modal: "Add to Playlist",

        // Settings Modal
        settings_title: "Account Settings",
        settings_username_section: "Change username / name",
        settings_username_hint: "Up to 14 characters. English letters only (a-z, A-Z). Must be unique.",
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
        settings_date_format_section: "Date Format",
        settings_date_format_hint: "Choose your preferred date display format (default is DD/MM/YYYY).",
        settings_date_format_ddmmyyyy: "DD/MM/YYYY",
        settings_date_format_mmddyyyy: "MM/DD/YYYY",
        settings_saved_date_format: "Date format switched to: {format}",
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
        topic_general_title: "Theory & General Works",
        topic_general_sub: "Handbooks, encyclopedias, rules and general chess literature",

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
        nav_admin_panel: "Адмін-панель",
        scroll_to_top: "Нагору",

        // Home Page (index.html)
        home_news_title: "Новини",
        home_news_empty: "Поки порожньо...",
        news_downloaded: "📥 {user} завантажив \"{title}\"",
        news_welcome: "🎉 {user} приєднався до Chess Vault! Ласкаво просимо!",
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
        auth_err_len: "Логін має бути від 2 до 14 літер.",
        auth_err_chars: "Логін може містити виключно англійські літери.",
        auth_err_letters_only: "Логін повинен містити виключно англійські літери (a-z, A-Z).",
        auth_err_max_14: "Максимальна довжина логіна — 14 символів.",
        auth_err_min_len: "Логін повинен містити щонайменше 2 літери.",
        auth_err_letter: "Логін повинен містити виключно англійські літери.",
        auth_err_taken: "Цей логін вже зайнятий іншим користувачем.",
        auth_err_diff: "Введіть логін, відмінний від поточного.",
        auth_welcome: "Ласкаво просимо, {username}!",
        auth_bye: "До побачення!",
        auth_created: "Аккаунт створено! Ласкаво просимо, {username}!",
        auth_invalid_cred: "Невірний логін або пароль.",
        auth_email_taken: "Цей логін вже зайнятий іншим користувачем.",
        auth_weak_pass: "Пароль занадто короткий (мін. 6 символів).",
        auth_too_many: "Забагато спроб. Спробуйте пізніше.",
        auth_generic_err: "Помилка. Спробуйте ще раз.",

        // Реєстраційна шпаргалка
        cheat_sheet_title: "📋 Вимоги до логіна:",
        cheat_rule_letters: "Лише англійські літери (a-z, A-Z)",
        cheat_rule_length: "Максимум 14 символів",
        cheat_rule_unique: "Індивідуальний логін",

        // Ранги та статуси користувачів
        status_creator: "👑 Творець",
        status_grandmaster: "♚ Гросмейстер Chess Vault",
        status_master: "♜ Майстер Chess Vault",
        status_adept: "♞ Знавець Chess Vault",
        status_member: "♟ Учасник Chess Vault",

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
        pl_title: "Мої Плейлисти",
        pl_read_later: "Читати потім",
        pl_watch_later: "Читати потім",
        pl_favorites: "Улюблені",
        pl_btn_add: "+ Новий плейлист",
        pl_new_playlist: "Новий плейлист",
        pl_add_to_modal: "Додати в плейлист",

        // Settings Modal
        settings_title: "Налаштування аккаунту",
        settings_username_section: "Зміна логіну / імені",
        settings_username_hint: "До 14 символів. Виключно англійські літери (a-z, A-Z). Логін має бути унікальним.",
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
        settings_date_format_section: "Формат дати",
        settings_date_format_hint: "Оберіть формат відображення дат на сайті (за замовчуванням ДД/ММ/РРРР).",
        settings_date_format_ddmmyyyy: "ДД/ММ/РРРР",
        settings_date_format_mmddyyyy: "ММ/ДД/РРРР",
        settings_saved_date_format: "Формат дати змінено на: {format}",
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
        topic_general_title: "Теорія та загальні праці",
        topic_general_sub: "Довідники, енциклопедії, кодекси та загальна шахова література",

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

    getDateFormat() {
        try {
            return localStorage.getItem('chess_date_format') || 'DD/MM/YYYY';
        } catch (_) {
            return 'DD/MM/YYYY';
        }
    },

    setDateFormat(fmt, saveToCloud = true) {
        if (fmt !== 'DD/MM/YYYY' && fmt !== 'MM/DD/YYYY') fmt = 'DD/MM/YYYY';
        try {
            localStorage.setItem('chess_date_format', fmt);
        } catch (_) {}

        // Dispatch date format change event
        window.dispatchEvent(new CustomEvent('chessVaultDateFormatChanged', { detail: { dateFormat: fmt } }));

        // If user is authenticated, sync to Firestore
        if (saveToCloud && window.auth && window.auth.currentUser && window.db) {
            try {
                window.db.collection('user_preferences').doc(window.auth.currentUser.uid).set({
                    dateFormat: fmt,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
            } catch (_) {}
        }
    },

    formatDate(dateObj, includeTime = false) {
        if (!dateObj) return '—';
        const d = dateObj.toDate ? dateObj.toDate() : (dateObj instanceof Date ? dateObj : new Date(dateObj));
        if (isNaN(d.getTime())) return '—';

        const fmt = this.getDateFormat();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        const dateStr = (fmt === 'MM/DD/YYYY') ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;

        if (includeTime) {
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${dateStr} ${hours}:${minutes}`;
        }
        return dateStr;
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

window.formatAppDate = function (dateObj, includeTime = false) {
    if (window.i18n && window.i18n.formatDate) {
        return window.i18n.formatDate(dateObj, includeTime);
    }
    const d = dateObj && dateObj.toDate ? dateObj.toDate() : (dateObj instanceof Date ? dateObj : new Date(dateObj));
    if (!d || isNaN(d.getTime())) return '—';
    const fmt = localStorage.getItem('chess_date_format') || 'DD/MM/YYYY';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = (fmt === 'MM/DD/YYYY') ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
    if (includeTime) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${dateStr} ${hours}:${minutes}`;
    }
    return dateStr;
};

// Global Creator & Admin Helpers (admin, denys)
window.CREATOR_LOGINS = ['admin', 'denys', 'админ', 'denysdraha'];
// Тільки головний адміністратор admin має доступ до дашборду
window.ALLOWED_ADMINS = ['admin', 'админ'];

window.isChessAdmin = function (user) {
    if (!user) return false;
    const name = (user.displayName || (user.email ? user.email.split('@')[0] : '')).toLowerCase().trim();
    const email = (user.email || '').toLowerCase().trim();
    return (window.ALLOWED_ADMINS || []).some(adm => {
        const a = adm.toLowerCase().trim();
        return name === a || email === `${a}@chess-lib.local` || email === a;
    });
};

// ========================================================
// ЖОРСТКА ВАЛІДАЦІЯ ЛОГІНА
// Тільки англійські літери (a-z, A-Z), максимум 14 символів
// ========================================================
window.validateChessUsername = function (username) {
    const t = (k) => window.i18n ? window.i18n.t(k) : k;
    if (!username || !username.trim()) {
        return {
            valid: false,
            error: t('auth_err_empty_username'),
            ruleLetters: false,
            ruleLength: false
        };
    }
    const trimmed = username.trim();
    const isLettersOnly = /^[a-zA-Z]+$/.test(trimmed);
    const isWithinLength = trimmed.length >= 2 && trimmed.length <= 14;

    if (!isLettersOnly) {
        return {
            valid: false,
            error: t('auth_err_letters_only'),
            ruleLetters: false,
            ruleLength: isWithinLength
        };
    }
    if (trimmed.length > 14) {
        return {
            valid: false,
            error: t('auth_err_max_14'),
            ruleLetters: true,
            ruleLength: false
        };
    }
    if (trimmed.length < 2) {
        return {
            valid: false,
            error: t('auth_err_min_len'),
            ruleLetters: true,
            ruleLength: false
        };
    }

    return {
        valid: true,
        error: null,
        ruleLetters: true,
        ruleLength: true
    };
};

// ========================================================
// ДИНАМІЧНИЙ РОЗРАХУНОК РАНГУ / СТАТУСУ КОРИСТУВАЧА
// - admin та denys -> статус "Творець" (Creator)
// - Прогресія:
//     • Ранг 0: Учасник (< 1 міс. або < 5 скачувань)
//     • Ранг 1: Знавець (≥ 1 місяць та ≥ 5 скачувань)
//     • Ранг 2: Майстер (≥ 6 місяців та ≥ 10 скачувань)
//     • Ранг 3: Гросмейстер (≥ 1 рік та ≥ 20 скачувань)
// ========================================================
window.getUserRank = function (userOrData, downloadsCount = 0, creationDate = null) {
    const isEn = window.i18n && window.i18n.currentLang === 'en';

    // 1. Отримуємо ім'я
    let username = '';
    if (typeof userOrData === 'string') {
        username = userOrData;
    } else if (userOrData) {
        username = userOrData.username || userOrData.displayName || (userOrData.email ? userOrData.email.split('@')[0] : '');
    }
    username = (username || '').toLowerCase().trim();

    // 2. Статус Создателя / Творца (admin, denys)
    const isCreator = (window.CREATOR_LOGINS || ['admin', 'denys']).some(c => c.toLowerCase() === username);
    if (isCreator) {
        return {
            id: 'creator',
            title: isEn ? 'Creator' : 'Творець',
            fullLabel: isEn ? '👑 Creator' : '👑 Творець',
            icon: '👑',
            badgeClass: 'badge-creator',
            badgeStyle: 'background: linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.35)); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.6); font-weight: 700; box-shadow: 0 0 10px rgba(245, 158, 11, 0.25);',
            isCreator: true,
            hint: isEn ? 'Special Creator Status' : 'Особливий статус засновника'
        };
    }

    // 3. Розрахунок віку аккаунта в днях
    let createdMs = 0;
    if (creationDate) {
        createdMs = creationDate.getTime ? creationDate.getTime() : new Date(creationDate).getTime();
    } else if (userOrData && userOrData.createdAt) {
        const ca = userOrData.createdAt;
        createdMs = ca.toMillis ? ca.toMillis() : (ca.toDate ? ca.toDate().getTime() : new Date(ca).getTime());
    } else if (userOrData && userOrData.metadata && userOrData.metadata.creationTime) {
        createdMs = new Date(userOrData.metadata.creationTime).getTime();
    }

    const nowMs = Date.now();
    const daysOld = createdMs > 0 ? Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24))) : 0;
    const dl = Number(downloadsCount) || 0;

    // 4. Трьохетапна шкала досягнень:

    // Ласт апгрейд: через 1 рік (365 днів) та 20 скачувань
    if (daysOld >= 365 && dl >= 20) {
        return {
            id: 'grandmaster',
            title: isEn ? 'Vault Grandmaster' : 'Гросмейстер',
            fullLabel: isEn ? '♚ Vault Grandmaster' : '♚ Гросмейстер Chess Vault',
            icon: '♚',
            badgeClass: 'badge-grandmaster',
            badgeStyle: 'background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(236, 72, 153, 0.25)); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.55); font-weight: 700; box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);',
            hint: isEn ? 'Highest mastery rank achieved!' : 'Найвищий ранг майстерності досягнуто!'
        };
    }

    // Слід апгрейд: через 6 місяців (180 днів) та 10 скачувань
    if (daysOld >= 180 && dl >= 10) {
        const daysLeft = Math.max(0, 365 - daysOld);
        const dlLeft = Math.max(0, 20 - dl);
        return {
            id: 'master',
            title: isEn ? 'Vault Master' : 'Майстер',
            fullLabel: isEn ? '♜ Vault Master' : '♜ Майстер Chess Vault',
            icon: '♜',
            badgeClass: 'badge-master',
            badgeStyle: 'background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.25)); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.55); font-weight: 700;',
            hint: isEn ? `Next: ♚ Grandmaster (${daysLeft}d & ${dlLeft} downloads left)` : `Наступний: ♚ Гросмейстер (залишилось ${daysLeft} дн. та ${dlLeft} скачувань)`
        };
    }

    // Перший апгрейд: через 1 місяць (30 днів) та 5 скачувань
    if (daysOld >= 30 && dl >= 5) {
        const daysLeft = Math.max(0, 180 - daysOld);
        const dlLeft = Math.max(0, 10 - dl);
        return {
            id: 'adept',
            title: isEn ? 'Chess Adept' : 'Знавець',
            fullLabel: isEn ? '♞ Chess Adept' : '♞ Знавець Chess Vault',
            icon: '♞',
            badgeClass: 'badge-adept',
            badgeStyle: 'background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(99, 102, 241, 0.25)); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.55); font-weight: 700;',
            hint: isEn ? `Next: ♜ Master (${daysLeft}d & ${dlLeft} downloads left)` : `Наступний: ♜ Майстер (залишилось ${daysLeft} дн. та ${dlLeft} скачувань)`
        };
    }

    // Базовий рівень: Учасник
    const daysLeft = Math.max(0, 30 - daysOld);
    const dlLeft = Math.max(0, 5 - dl);
    return {
        id: 'member',
        title: isEn ? 'Member' : 'Учасник',
        fullLabel: isEn ? '♟ Chess Vault Member' : '♟ Учасник Chess Vault',
        icon: '♟',
        badgeClass: 'badge-member',
        badgeStyle: 'background: rgba(255, 255, 255, 0.08); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.15);',
        hint: isEn ? `Next: ♞ Adept (${daysLeft}d & ${dlLeft} downloads left)` : `Наступний: ♞ Знавець (залишилось ${daysLeft} дн. та ${dlLeft} скачувань)`
    };
};

