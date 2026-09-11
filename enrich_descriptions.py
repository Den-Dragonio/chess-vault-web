#!/usr/bin/env python3
"""
Chess Vault — Multi-tier Deep Description Enrichment (Safe & Smart Edition)

Особливості вдосконаленого скрапера:
1. Залізний захист існуючих книг: книги з descriptions.json не перезаписуються!
2. Автоматичне підтягування точної кількості сторінок (pages) з page_counts.js.
3. Безпека: автоматичне резервне копіювання descriptions.json.bak перед стартом.
4. Анти-шум для Вікіпедії: захист від танків (Т-64), приставки Nintendo 64, Doom тощо.
5. Спеціалізовані шаблони для шахової періодики ("64", "Шахматы в СССР", "Шахматы (Рига)").
6. Тематичний синтез (дебюти, ескізи, ендшпілі, тактика, турніри) для книг без Вікіпедії.
"""

import os
import sys
import json
import time
import shutil
import urllib.request
import urllib.parse
import re

ARCHIVE_ITEM = '1971_20260223'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DESCRIPTIONS_JSON = os.path.join(BASE_DIR, 'descriptions.json')
DESCRIPTIONS_JS = os.path.join(BASE_DIR, 'descriptions.js')
PAGE_COUNTS_JS = os.path.join(BASE_DIR, 'page_counts.js')

def load_existing_descriptions():
    if os.path.exists(DESCRIPTIONS_JSON):
        try:
            with open(DESCRIPTIONS_JSON, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Помилка читання {DESCRIPTIONS_JSON}: {e}")
    return {}

def load_page_counts():
    """Завантажує 3390+ розпізнаних кількостей сторінок з page_counts.js"""
    if os.path.exists(PAGE_COUNTS_JS):
        try:
            with open(PAGE_COUNTS_JS, 'r', encoding='utf-8') as f:
                content = f.read()
            m = re.search(r'window\.CHESS_PAGE_COUNTS\s*=\s*(\{.*?\});', content, re.DOTALL)
            if m:
                data = json.loads(m.group(1))
                return data
        except Exception as e:
            print(f"Попередження: не вдалося завантажити page_counts.js: {e}")
    return {}

def save_descriptions(data):
    # Зберігаємо JSON
    with open(DESCRIPTIONS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # Зберігаємо JS для веб-сторінок
    with open(DESCRIPTIONS_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated descriptions for Chess Vault books\n')
        f.write('window.CHESS_DESCRIPTIONS = ')
        json.dump(data, f, ensure_ascii=False)
        f.write(';\n')

def clean_query(title, author=''):
    t = re.sub(r'\.[^/.]+$', '', title)
    t = re.sub(r'[\(\[]\d{4}[\)\]]', '', t)
    t = re.sub(r'\b(том|т\.)\s*\d+', '', t, flags=re.IGNORECASE)
    t = t.replace('_', ' ').replace('--', ' - ')
    if author and author in t:
        return t.strip()
    if author and author not in ('---', 'Збірники та інші', '1 - Разное', 'Разное'):
        return f'{author} {t}'.strip()
    return t.strip()

# =========================================================================
# 1. ЕКСПЕРТНІ ШАБЛОНИ (ЖУРНАЛИ ТА ФУНДАМЕНТАЛЬНІ КНИГИ)
# =========================================================================
def get_custom_book_analysis(book):
    raw = (book.get('id', '') + ' ' + book.get('title', '')).lower()
    title = book.get('title', '')
    author = book.get('author', '')
    year = book.get('year', '')

    # --- ЖУРНАЛИ «64 — ШАХМАТНОЕ ОБОЗРЕНИЕ» ---
    if raw.startswith('64-') or '64_шахматное_обозрение' in raw or re.match(r'^64\s*-\s*\d{4}', raw):
        parts = re.sub(r'\.[^/.]+$', '', book.get('id', '')).split('-')
        yr = parts[1] if len(parts) > 1 and parts[1].isdigit() else (year if year != '---' else "")
        num = f"№{int(parts[2])}" if len(parts) > 2 and parts[2].isdigit() else ""
        yr_text = f" за {yr} год" if yr else ""
        desc = (
            f"Выпуск {num} легендарного советского и российского еженедельника «64 — Шахматное обозрение»{yr_text}.\n\n"
            f"В номере представлены:\n"
            f"• Подробные репортажи и турнирные таблицы крупнейших всесоюзных и международных соревнований;\n"
            f"• Глубокий анализ партий с комментариями ведущих мировых гроссмейстеров;\n"
            f"• Теоретические обзоры современных дебютных систем и свежих новинок;\n"
            f"• Отдел композиции: авторские этюды, комбинации для самостоятельного решения и исторические очерки.\n\n"
            f"Журнал является бесценным первоисточником для изучения истории шахмат и практического совершенствования."
        )
        return desc, "https://ru.wikipedia.org/wiki/64_—_Шахматное_обозрение", "journal_catalog"

    # --- «ШАХМАТЫ В СССР» ---
    if 'chess in ussr' in raw or 'шахматы в ссср' in raw:
        yr_text = f" за {year} год" if year and year != '---' else ""
        desc = (
            f"Центральный ежемесячный орган Шахматной федерации СССР{yr_text}. Издание отражает золотую эпоху советской шахматной школы.\n\n"
            f"Основные рубрики выпуска:\n"
            f"• Официальные итоги чемпионатов СССР, Спартакиад и межзональных турниров;\n"
            f"• Партии чемпионов мира с эксклюзивным гроссмейстерским анализом;\n"
            f"• Научно-методические материалы для тренеров и квалифицированных спортсменов;\n"
            f"• Дебютные исследования актуальных разветвлений сицилианской, староиндийской и славянской защит."
        )
        return desc, "https://ru.wikipedia.org/wiki/Шахматы_в_СССР", "journal_catalog"

    # --- «ШАХМАТЫ (РИГА)» ---
    if 'chess(riga)' in raw or 'шахматы (рига)' in raw or 'шахматы рига' in raw:
        desc = (
            f"Популярнейший журнал «Шахматы» (Рига), главным редактором которого многие годы являлся 8-й чемпион мира Михаил Таль.\n\n"
            f"Журнал славится яркой и живой манерой подачи материала, бескомпромиссным разбором тактических осложнений и психологических аспектов борьбы. "
            f"Номер включает комментарии гроссмейстеров первой величины, уникальные репортажи с мест событий и отдел задач повышенной сложности."
        )
        return desc, "https://ru.wikipedia.org/wiki/Шахматы_(журнал,_Рига)", "journal_catalog"

    # --- «ШАХМАТНЫЙ БЮЛЛЕТЕНЬ» ---
    if 'шахматный бюллетень' in raw:
        desc = (
            f"Ежемесячный теоретический бюллетень Шахматной федерации СССР — настольное издание гроссмейстеров и мастеров всего мира.\n\n"
            f"Каждый выпуск представляет собой концентрированный свод дебютной теории, новинок и свежих партий советских и международных соревнований без сокращений. "
            f"Незаменимый инструмент для глубокого аналитика и составителя дебютного репертуара."
        )
        return desc, "https://ru.wikipedia.org/wiki/Шахматный_бюллетень", "journal_catalog"

    # --- АВЕРБАХ: ШАХМАТНЫЕ ОКОНЧАНИЯ ---
    if 'авербах' in raw and 'пешечн' in raw:
        desc = (
            "Фундаментальный том капитальной пятитомной энциклопедии эндшпиля Юрия Авербаха, посвященный пешечным окончаниям — базису всего шахматного эндшпиля.\n\n"
            "В книге систематизированы все базовые и тонкие концепции борьбы пешек:\n"
            "• Правило квадрата, ключевые поля и границы безопасного продвижения;\n"
            "• Ближняя, дальняя и диагональная оппозиция, метод триангуляции и передача очереди хода;\n"
            "• Техника пешечного прорыва, борьба против защищенных и отдаленных проходных;\n"
            "• Поля соответствия и сложные многопешечные окончания.\n\n"
            "Материал сопровождается сотнями учебных диаграмм и анализом партий классиков. Книга обязательна для изучения каждому серьезному шахматисту."
        )
        return desc, None, "chess_expert"

    if 'авербах' in raw and ('конь против' in raw or 'коневые' in raw or 'слонов' in raw):
        desc = (
            "Классическое руководство Юрия Авербаха по сложнейшему разделу эндшпиля — соотношению легких фигур и борьбе коня со слоном.\n\n"
            "Автор всесторонне разбирает стратегию разыгрывания позиций с пешками на одном или обоих флангах, позиционные плюсы открытых диагоналей для слона и "
            "блокадные форпосты коня в закрытых структурах. Детально рассмотрены патовые рубежи, построение непробиваемых крепостей и техника реализации минимального перевеса."
        )
        return desc, None, "chess_expert"

    if 'авербах' in raw and 'ладейн' in raw:
        desc = (
            "Исследование самого частого и стратегически богатого вида окончаний — ладейного эндшпиля. По статистике, более 50% практических партий переходят именно в ладейные финалы.\n\n"
            "Рассматриваются ключевые позиции:\n"
            "• Позиция Филидора и активная защита по 6-й горизонтали;\n"
            "• Метод Лусены («постройка моста») для выигрыша за сильнейшую сторону;\n"
            "• Защита Ванчуры при ладье сбоку и атака пешек с тыла;\n"
            "• Ладья позади проходной пешки (правило Тарраша) и отсечение неприятельского короля.\n\n"
            "Практический справочник для мастеров и гроссмейстеров."
        )
        return desc, None, "chess_expert"

    # --- АВРО-ТУРНИР 1938 ---
    if 'авро' in raw or 'avro' in raw:
        desc = (
            "Знаменитый двухкруговой турнир в Нидерландах (1938 год), в котором приняли участие 8 сильнейших шахматистов планеты: "
            "Александр Алехин, Хосе Рауль Капабланка, Макс Эйве, Михаил Ботвинник, Пауль Керес, Рубен Файн, Самуэль Решевский и Сало Флор.\n\n"
            "Турнир должен был определить официального соперника чемпиона мира Александра Алехина. Сборник содержит все 56 партий с исчерпывающими гроссмейстерскими примечаниями, "
            "включая бессмертную победу Ботвинника над Капабланкой с жертвой двух фигур."
        )
        return desc, "https://ru.wikipedia.org/wiki/АВРО-турнир_1938", "chess_expert"

    # --- МАТЧ ВЕКА (СССР — СБОРНАЯ МИРА) ---
    if 'ссср-сборная' in raw or 'ссср - сборная' in raw or 'sbornaya-mira' in raw:
        desc = (
            "«Матч века» (Белград, 1970) — величайшее командное состязание в истории шахмат, где советская сборная сошлась с сильнейшими гроссмейстерами остального мира.\n\n"
            "Составы команд вошли в легенду:\n"
            "• Спасский и Корчной против Ларсена и Фишера;\n"
            "• Петросян против Хюбнера и Портиша;\n"
            "• Ботвинник, Смыслов, Таль, Геллер, Полугаевский и Тайманов против лучших мастеров Запада.\n\n"
            "В книге собраны все партии с подробными комментариями участников, стенограммами и закулисными подробностями матча."
        )
        return desc, "https://ru.wikipedia.org/wiki/Матч_века", "chess_expert"

    # --- НИМЦОВИЧ: МОЯ СИСТЕМА ---
    if 'нимцович' in raw and ('моя система' in raw or 'блокада' in raw):
        desc = (
            "Эпохальный труд Арона Нимцовича — библия шахматного позиционного искусства и основа гипермодернизма.\n\n"
            "В книге впервые были сформулированы законы современной стратегии:\n"
            "• Блокада проходных пешек и фигурное давление на пешечную цепь;\n"
            "• Профилактика и избыточная защита стратегически важных пунктов;\n"
            "• Овладение открытыми вертикалями и господство на 7-й и 8-й горизонталях;\n"
            "• Пешечные клинья, изоляторы и висячие пешки.\n\n"
            "Классика, без прочтения которой невозможно достичь звания кандидата в мастера или мастера спорта."
        )
        return desc, "https://ru.wikipedia.org/wiki/Моя_система", "chess_expert"

    return None, None, None

# =========================================================================
# 2. ПОШУК У ВІКІПЕДІЇ З ФІЛЬТРАЦІЄЮ ПОМИЛКОВИХ ЗБІГІВ
# =========================================================================
def search_wikipedia_summary(query, author=''):
    if not query or len(query) < 3:
        return None
    
    clean_q = query.strip()
    if re.match(r'^\d+$', clean_q):
        return None

    try:
        search_q = f"{clean_q} шахматы" if "шахмат" not in clean_q.lower() else clean_q
        search_url = 'https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + urllib.parse.quote(search_q) + '&format=json&srlimit=3'
        req = urllib.request.Request(search_url, headers={'User-Agent': 'ChessVaultBot/2.0 (contact@chessvault.org)'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('query', {}).get('search', [])
            if not results:
                return None

        # Заборонені слова (танки, приставки, зброя, відеоігри)
        BANNED_KEYWORDS = [
            'танк', 'бронетранспортер', 'оружие', 'nintendo', 'видеоигра', 'вооружение',
            'авиация', 'артиллерия', 'ракета', 'боевая машина', 'основной боевой'
        ]

        for item in results:
            page_title = item['title']
            title_lower = page_title.lower()

            if any(b in title_lower for b in BANNED_KEYWORDS):
                continue

            summary_url = 'https://ru.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(page_title)
            req2 = urllib.request.Request(summary_url, headers={'User-Agent': 'ChessVaultBot/2.0 (contact@chessvault.org)'})
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                sdata = json.loads(resp2.read().decode('utf-8'))
                extract = sdata.get('extract', '')
                if extract and len(extract) > 60:
                    ext_lower = extract.lower()
                    if any(b in ext_lower for b in BANNED_KEYWORDS):
                        continue
                    
                    # Обов'язкова перевірка шахового контексту
                    if any(w in ext_lower for w in ['шахмат', 'шахматист', 'гроссмейстер', 'эндшпиль', 'дебют', 'чемпион мира']):
                        return {
                            'description': extract,
                            'wikiTitle': page_title,
                            'wikiUrl': sdata.get('content_urls', {}).get('desktop', {}).get('page', '')
                        }
    except Exception:
        pass
    return None

def get_author_bio(author):
    if not author or author in ('---', 'Збірники та інші', '1 - Разное', 'Разное', 'Неизвестен') or len(author) < 3:
        return None
    main_author = author.split(',')[0].strip()
    res = search_wikipedia_summary(f'{main_author} шахматист', author=main_author)
    if res:
        return res['description']
    return None

# =========================================================================
# 3. ТЕМАТИЧНИЙ СИНТЕЗ ОПИСУ (КОЛИ НЕМАЄ СТАТТІ У ВІКІПЕДІЇ)
# =========================================================================
def generate_smart_summary(title, author, year):
    yr_str = f" ({year} год)" if year and year != '---' else ""
    auth_str = f" под авторством {author}" if author and author not in ('---', 'Збірники та інші', '1 - Разное', 'Разное') else ""
    t_lower = title.lower()

    if any(w in t_lower for w in ['дебют', 'защита', 'гамбит', 'начало', 'испанская', 'сицилианская', 'французская', 'каро-канн', 'грюнфельд']):
        return (
            f"Фундаментальное дебютное руководство «{title}»{auth_str}{yr_str}.\n\n"
            f"Издание посвящено глубокому разбору планов и идей в дебюте, типовым пешечным структурам и возникающим миттельшпильным позициям. "
            f"В книге приведены анализы ключевых вариантов, актуальные теоретические разветвления и подробные комментарии к образцовым гроссмейстерским партиям."
        )
    elif any(w in t_lower for w in ['эндшпиль', 'окончани', 'пешечн', 'ладейн']):
        return (
            f"Практическое руководство по технике эндшпиля «{title}»{auth_str}{yr_str}.\n\n"
            f"Книга систематизирует основные принципы разыгрывания шахматных окончаний: точный расчет вариантов, активность короля, техника реализации материального перевеса и построение оборонительных рубежей. "
            f"Снабжена наглядными учебными диаграммами и примерами из классического наследия."
        )
    elif any(w in t_lower for w in ['комбинаци', 'тактик', 'ловушк', 'атака', 'штурм', 'жертв']):
        return (
            f"Учебно-тренировочный курс по комбинационному мастерству «{title}»{auth_str}{yr_str}.\n\n"
            f"В издании систематизированы главные тактические приемы: форсированные связки, отвлечения, завлечения, вскрытые нападения и жертвы фигур. "
            f"Книга служит надежным инструментом для развития тактического зрения, расчета форсированных вариантов и динамического чувства позиции."
        )
    elif any(w in t_lower for w in ['чемпионат', 'первенство', 'турнир', 'матч', 'межзональн']):
        return (
            f"Турнирный сборник и хроника шахматных соревнований «{title}»{auth_str}{yr_str}.\n\n"
            f"Издание содержит полные таблицы соревнований, партии сильнейших советских и международных мастеров, теоретические обзоры новинок турнира "
            f"и подробные авторские комментарии к драматическим поединкам."
        )
    else:
        return (
            f"Шахматное теоретическое и практическое издание «{title}»{auth_str}{yr_str}.\n\n"
            f"В книге детально рассматриваются ключевые идеи, типовые стратегические планы, позиционные манёвры и комбинационные решения. "
            f"Издание снабжено подробными анализами партий и служит надежным пособием для углубленного изучения шахматного мастерства."
        )

# =========================================================================
# 4. ОБРОБКА ОДНІЄЇ КНИГИ
# =========================================================================
def enrich_single_book(book, page_counts):
    fname = book['id']
    title = book.get('title', '')
    author = book.get('author', '')
    year = book.get('year', '')

    pages = page_counts.get(fname) or page_counts.get(fname.lower())

    custom_desc, custom_wiki, custom_source = get_custom_book_analysis(book)
    bio = get_author_bio(author)

    if custom_desc:
        res = {
            'bookDescription': custom_desc,
            'authorBio': bio or '',
            'source': custom_source
        }
        if custom_wiki:
            res['wikiUrl'] = custom_wiki
        if pages:
            res['pages'] = pages
        return res

    # Пошук у Вікіпедії для самої книги
    wiki_info = search_wikipedia_summary(clean_query(title, author), author=author)
    if wiki_info:
        res = {
            'bookDescription': wiki_info['description'],
            'authorBio': bio or '',
            'source': 'wikipedia',
            'wikiUrl': wiki_info['wikiUrl']
        }
        if pages:
            res['pages'] = pages
        return res

    # Тематичний розумний синтез
    smart_desc = generate_smart_summary(title, author, year)
    res = {
        'bookDescription': smart_desc,
        'authorBio': bio or '',
        'source': 'smart_summary'
    }
    if pages:
        res['pages'] = pages
    return res

# =========================================================================
# 5. ГОЛОВНИЙ ПРОЦЕС (MAIN)
# =========================================================================
def main():
    print('=' * 70)
    print('📚 CHESS VAULT — БЕЗПЕЧНЕ ЗБАГАЧЕННЯ ОПИСІВ (SAFE & SMART)')
    print('   • Існуючі описи: ЗАХИЩЕНІ від перезапису (100% збереження)')
    print('   • Нові книги: аналіз журналів + Вікіпедія + шаховий синтез')
    print('   • Кількість сторінок: автоматична прив\'язка з page_counts.js')
    print('=' * 70)

    # 1. Автоматичний бекап
    if os.path.exists(DESCRIPTIONS_JSON):
        bak_json = DESCRIPTIONS_JSON + '.bak'
        shutil.copyfile(DESCRIPTIONS_JSON, bak_json)
        print(f'🛡️  Створено резервну копію: {os.path.basename(bak_json)}')

    existing = load_existing_descriptions()
    page_counts = load_page_counts()
    print(f'📖 Вже збережено описів у базі: {len(existing)}')
    print(f'📄 Завантажено значень сторінок з page_counts.js: {len(page_counts)}')

    # 2. Опитування Internet Archive
    url = f'https://archive.org/metadata/{ARCHIVE_ITEM}'
    print(f'\n🌐 Опитування архіву {ARCHIVE_ITEM}...')
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVault/2.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'❌ Помилка підключення до Internet Archive: {e}')
        return

    ALLOWED = ('.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx')
    files = [f for f in data.get('files', []) if f['name'].lower().endswith(ALLOWED)]
    total = len(files)
    print(f'📦 Всього файлів в архіві: {total}')

    # Починаємо з повної копії вже існуючої бази (нічого не губиться при Ctrl+C!)
    new_db = dict(existing)
    new_added = 0
    pages_added = 0
    skipped = 0

    print('\n🚀 Початок обробки:\n')

    for idx, f in enumerate(files, 1):
        fname = f['name']
        fileName = os.path.splitext(fname)[0]
        match = re.match(r'(.*?)\s*-\s*(.*)\s*\((\d{4})\)', fileName)
        book = {
            'id': fname,
            'author': match.group(1).strip() if match else fileName.split('-')[0].strip(),
            'title': match.group(2).strip() if match else fileName,
            'year': match.group(3) if match else '---'
        }

        # А. Книга вже має опис — НЕ ЧІПАЄМО, тільки перевіряємо сторінки
        if fname in existing and existing[fname].get('bookDescription'):
            skipped += 1
            # Якщо раптом у цієї книги не було вказано pages, але вони є у page_counts.js — додаємо!
            if not existing[fname].get('pages'):
                pc = page_counts.get(fname) or page_counts.get(fname.lower())
                if pc:
                    new_db[fname]['pages'] = pc
                    pages_added += 1
            if idx % 100 == 0 or idx == total:
                print(f'[{idx}/{total}] ⏩ Пропуск існуючих... ({skipped} готових)')
            continue

        # Б. Нова книга без опису — ЗБАГАЧУЄМО
        print(f'[{idx}/{total}] ✨ Збагачення: {book["title"][:40]}... ', end='', flush=True)
        res = enrich_single_book(book, page_counts)
        new_db[fname] = res
        new_added += 1
        has_bio = " + біо" if res.get('authorBio') else ""
        has_pg = f" [{res.get('pages')} стор.]" if res.get('pages') else ""
        print(f'✅ {res.get("source")}{has_bio}{has_pg}')

        # Зберігаємо прогрес кожні 10 нових книг
        if new_added % 10 == 0:
            save_descriptions(new_db)
        
        time.sleep(0.12)

    # Фінальне збереження
    save_descriptions(new_db)
    print('\n' + '=' * 70)
    print(f'🏁 УСПІШНО ЗАВЕРШЕНО!')
    print(f'   • Всього книг у базі: {len(new_db)}')
    print(f'   • Збережено оригінальних описів: {skipped}')
    print(f'   • Додано нових описів: {new_added}')
    if pages_added:
        print(f'   • Додано пропущених сторінок до старих книг: {pages_added}')
    print(f'\nФайли оновлено:\n  • {DESCRIPTIONS_JSON}\n  • {DESCRIPTIONS_JS}')
    print('=' * 70)

if __name__ == '__main__':
    main()
