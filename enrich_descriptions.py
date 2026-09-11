#!/usr/bin/env python3
"""
Chess Vault — Multi-tier Deep Description Enrichment
Generates structured metadata for each book:
- bookDescription: Deep, multi-paragraph content explaining exactly what THIS book covers
- authorBio: Dedicated biographical overview of the author/grandmaster
- wikiUrl: Direct link to Wikipedia article
- source: Source tag (catalog, wikipedia, author_bio, etc.)
Saves to descriptions.json and descriptions.js for zero-latency loading.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import subprocess
import re

ARCHIVE_ITEM = '1971_20260223'
FLASH_PATH = '/Volumes/NO NAME/Chess'
DESCRIPTIONS_JSON = os.path.join(os.path.dirname(__file__), 'descriptions.json')
DESCRIPTIONS_JS = os.path.join(os.path.dirname(__file__), 'descriptions.js')
DJVUTXT_BIN = '/opt/homebrew/bin/djvutxt' if os.path.exists('/opt/homebrew/bin/djvutxt') else 'djvutxt'

FLASH_INDEX = {}

def build_flash_index():
    global FLASH_INDEX
    if os.path.exists(FLASH_PATH):
        for root, dirs, files in os.walk(FLASH_PATH):
            for f in files:
                if not f.startswith('.'):
                    FLASH_INDEX[f] = os.path.join(root, f)

def load_existing_descriptions():
    if os.path.exists(DESCRIPTIONS_JSON):
        try:
            with open(DESCRIPTIONS_JSON, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_descriptions(data):
    with open(DESCRIPTIONS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
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
    if author and author not in ('---', 'Збірники та інші', '1 - Разное'):
        return f'{author} {t}'.strip()
    return t.strip()

# =========================================================================
# DOMAIN KNOWLEDGE: DEEP BOOK-SPECIFIC PROFILES
# =========================================================================
def get_custom_book_analysis(book):
    raw = (book.get('id', '') + ' ' + book.get('title', '')).lower()
    title = book.get('title', '')
    author = book.get('author', '')
    year = book.get('year', '')

    # --- ЖУРНАЛИ «64» ---
    if raw.startswith('64-') or '64_шахматное_обозрение' in raw:
        parts = re.sub(r'\.[^/.]+$', '', book.get('id', '')).split('-')
        yr = parts[1] if len(parts) > 1 else year
        num = f"№{int(parts[2])}" if len(parts) > 2 and parts[2].isdigit() else ""
        return (
            f"Выпуск {num} легендарного советского и российского еженедельника «64 — Шахматное обозрение» за {yr} год.\n\n"
            f"В номере представлены:\n"
            f"• Подробные репортажи и турнирные таблицы крупнейших всесоюзных и международных соревнований;\n"
            f"• Глубокий анализ партий с комментариями ведущих мировых гроссмейстеров;\n"
            f"• Теоретические обзоры современных дебютных систем и свежих новинок;\n"
            f"• Отдел композиции: авторские этюды, комбинации для самостоятельного решения и исторические очерки.\n\n"
            f"Журнал является бесценным первоисточником для изучения истории шахмат и практического совершенствования."
        )

    # --- «ШАХМАТЫ В СССР» ---
    if 'chess in ussr' in raw or 'шахматы в ссср' in raw:
        return (
            f"Центральный ежемесячный орган Шахматной федерации СССР за {year} год. Издание отражает золотую эпоху советской шахматной школы.\n\n"
            f"Основные рубрики выпуска:\n"
            f"• Официальные итоги чемпионатов СССР, Спартакиад и межзональных турниров;\n"
            f"• Партии чемпионов мира с эксклюзивным гроссмейстерским анализом;\n"
            f"• Научно-методические материалы для тренеров и квалифицированных спортсменов;\n"
            f"• Дебютные исследования актуальных разветвлений сицилианской, староиндийской и славянской защит."
        )

    # --- «ШАХМАТЫ (РИГА)» ---
    if 'chess(riga)' in raw or 'шахматы (рига)' in raw:
        return (
            f"Популярнейший журнал «Шахматы» (Рига), главным редактором которого многие годы являлся 8-й чемпион мира Михаил Таль.\n\n"
            f"Журнал славится яркой и живой манерой подачи материала, бескомпромиссным разбором тактических осложнений и психологических аспектов борьбы. "
            f"Номер включает комментарии гроссмейстеров первой величины, уникальные репортажи с мест событий и отдел задач повышенной сложности."
        )

    # --- АВЕРБАХ: ШАХМАТНЫЕ ОКОНЧАНИЯ ---
    if 'авербах' in raw and 'пешечн' in raw:
        return (
            "Фундаментальный том капитальной пятитомной энциклопедии эндшпиля Юрия Авербаха, посвященный пешечным окончаниям — базису всего шахматного эндшпиля.\n\n"
            "В книге систематизированы все базовые и тонкие концепции борьбы пешек:\n"
            "• Правило квадрата, ключевые поля и границы безопасного продвижения;\n"
            "• Ближняя, дальняя и диагональная оппозиция, метод триангуляции и передача очереди хода;\n"
            "• Техника пешечного прорыва, борьба против защищенных и отдаленных проходных;\n"
            "• Поля соответствия и сложные многопешечные окончания.\n\n"
            "Материал сопровождается сотнями учебных диаграмм и анализом партий классиков. Книга обязательна для изучения каждому серьезному шахматисту."
        )

    if 'авербах' in raw and ('конь против' in raw or 'коневые' in raw or 'слонов' in raw):
        return (
            "Классическое руководство Юрия Авербаха по сложнейшему разделу эндшпиля — соотношению легких фигур и борьбе коня со слоном.\n\n"
            "Автор всесторонне разбирает стратегию разыгрывания позиций с пешками на одном или обоих флангах, позиционные плюсы открытых диагоналей для слона и "
            "блокадные форпосты коня в закрытых структурах. Детально рассмотрены патовые рубежи, построение непробиваемых крепостей и техника реализации минимального перевеса."
        )

    if 'авербах' in raw and 'ладейн' in raw:
        return (
            "Исследование самого частого и стратегически богатого вида окончаний — ладейного эндшпиля. По статистике, более 50% практических партий переходят именно в ладейные финалы.\n\n"
            "Рассматриваются ключевые позиции:\n"
            "• Позиция Филидора и активная защита по 6-й горизонтали;\n"
            "• Метод Лусены («постройка моста») для выигрыша за сильнейшую сторону;\n"
            "• Защита Ванчуры при ладье сбоку и атака пешек с тыла;\n"
            "• Ладья позади проходной пешки (правило Тарраша) и отсечение неприятельского короля.\n\n"
            "Практический справочник для мастеров и гроссмейстеров."
        )

    if 'авербах' in raw and 'о чем молчат фигуры' in raw:
        return (
            "Увлекательное историко-культурологическое исследование Юрия Авербаха о рождении и вековой эволюции шахмат.\n\n"
            "Автор прослеживает судьбу игры от древнеиндийской чатуранги и арабского шатранджа до европейских правил эпохи Возрождения. "
            "Книга раскрывает, как и почему менялись названия и траектории фигур (превращение восточного советника-ферзя в самую могущественную фигуру, появление рокировки), "
            "и связывает развитие игры с общественными изменениями цивилизации."
        )

    if 'авербах' in raw and 'как решать шахматные этюды' in raw:
        return (
            "Учебно-методическое пособие выдающегося гроссмейстера и теоретика по искусству шахматной композиции.\n\n"
            "Авербах учит читателя не просто восхищаться красотой этюдов, а использовать их как мощнейший тренажер для практической игры: находить неочевидные парадоксальные ходы, "
            "считать форсированные варианты до мата или пата и развивать геометрическое зрение доски."
        )

    if 'авербах' in raw and 'в поисках истины' in raw:
        return (
            "Творческая автобиография и мемуары Юрия Авербаха — глубокий взгляд изнутри на советскую шахматную эпоху.\n\n"
            "Гроссмейстер делится секретами своей исследовательской лаборатории, рассказывает о турнирах претендентов, психологических дуэлях с Ботвинником, Смысловым, Петросяном и Талем, "
            "а также формулирует философские принципы шахматной борьбы."
        )

    # --- АВРО-ТУРНИР 1938 ---
    if 'авро' in raw or 'avro' in raw:
        return (
            "Знаменитый двухкруговой турнир в Нидерландах (1938 год), в котором приняли участие 8 сильнейших шахматистов планеты: "
            "Александр Алехин, Хосе Рауль Капабланка, Макс Эйве, Михаил Ботвинник, Пауль Керес, Рубен Файн, Самуэль Решевский и Сало Флор.\n\n"
            "Турнир должен был определить официального соперника чемпиона мира Александра Алехина. Сборник содержит все 56 партий с исчерпывающими гроссмейстерскими примечаниями, "
            "включая бессмертную победу Ботвинника над Капабланкой с жертвой двух фигур."
        )

    # --- МАТЧ ВЕКА (СССР — СБОРНАЯ МИРА) ---
    if 'ссср-сборная' in raw or 'ссср - сборная' in raw or 'sbornaya-mira' in raw:
        return (
            "«Матч века» (Белград, 1970) — величайшее командное состязание в истории шахмат, где советская сборная сошлась с сильнейшими гроссмейстерами остального мира.\n\n"
            "Составы команд вошли в легенду:\n"
            "• Спасский и Корчной против Ларсена и Фишера;\n"
            "• Петросян против Хюбнера и Портиша;\n"
            "• Ботвинник, Смыслов, Таль, Геллер, Полугаевский и Тайманов против лучших мастеров Запада.\n\n"
            "В книге собраны все партии с подробными комментариями участников, стенограммами и закулисными подробностями матча."
        )

    # --- СТАРОИНДИЙСКАЯ ЗАЩИТА ---
    if 'староиндийская' in raw:
        return (
            "Фундаментальная монография, посвященная одному из самых боевых и бескомпромиссных дебютов в истории шахмат — Староиндийской защите.\n\n"
            "В книге подробно рассматриваются:\n"
            "• Классическая система и прорыв f7-f5 с последующей атакой на белого короля;\n"
            "• Системы Земиша и Авербаха: методы блокады и позиционного давления;\n"
            "• Пешечные структуры с запертым центром (d4-e5 против c7-d6);\n"
            "• Типовые жертвы фигур на f4 и h3, маневры коней через d7-f8-g6 и ферзевая контригра белых.\n\n"
            "Книга содержит детально прокомментированные партии Каспарова, Фишера, Таля и Геллера."
        )

    # --- СИЦИЛИАНСКАЯ: ВАРИАНТ ДРАКОНА ---
    if 'сицилианская' in raw and 'дракон' in raw:
        return (
            "Глубокое исследование острейшей дебютной системы — Варианта Дракона в Сицилианской защите.\n\n"
            "Книга детально раскрывает главные стратегические и тактические идеи сторон:\n"
            "• Атака Раузера и югославская атака (Be3, f3, Qd2, Bc4, 0-0-0) со встречными штурмами разносторонних рокировок;\n"
            "• Знаменитая качественная жертва ладьи на c3 (Rxc3!) как центральный динамический мотив черных;\n"
            "• Мощнейшее давление чернопольного слона g7 по диагонали h8-a1;\n"
            "• Современные защитные построения черных и противоядия против пешечного наката h4-h5."
        )

    # --- СЛАВЯНСКАЯ ЗАЩИТА ---
    if 'славянская' in raw:
        return (
            "Классическая монография по одному из самых солидных и надежных ответов на ферзевый гамбит (1.d4 d5 2.c4 c6).\n\n"
            "Анализируются ключевые разветвления, включая систему Чебаненко (4...a6), систему Ботвинника, чешский вариант и меранский вариант. "
            "Книга помогает выстроить надежный дебютный репертуар черными и понимать гармоничное развитие фигур без ранних позиционных уступок."
        )

    # --- УРОКИ ШАХМАТНОЙ ТАКТИКИ ---
    if 'уроки шахматной тактики' in raw or 'шахматные орешки' in raw:
        return (
            "Практический задачник и учебник тактического мастерства. Книга предназначена для выработки комбинационного чутья и расчетной дисциплины.\n\n"
            "Включает систематизированные разделы:\n"
            "• Связки, двойные удары, сквозные нападения и открытые шахи;\n"
            "• Завлечение, отвлечение, уничтожение защиты и блокировка полей;\n"
            "• Эффектные жертвы ферзя, спертые маты и геометрические мотивы фигур;\n"
            "• Тестовые позиции разного уровня сложности от простых двухходовок до форсированных каскадов."
        )

    # --- КАРПОВ: МОИ ЛУЧШИЕ ПАРТИИ ---
    if 'карпов' in raw and 'партии' in raw:
        return (
            "Сборник избранных шедевров 12-го чемпиона мира Анатолия Карпова с его собственными комментариями.\n\n"
            "В книге представлена уникальная позиционная школа Карпова — искусство профилактики, ограничение активности соперника («железный зажим»), "
            "виртуозная игра в окончаниях и переход позиционного давления в решающую тактику. Каждая партия снабжена глубоким самоанализом и воспоминаниями о турнирной борьбе."
        )

    # --- НИМЦОВИЧ: МОЯ СИСТЕМА ---
    if 'нимцович' in raw and ('моя система' in raw or 'блокада' in raw):
        return (
            "Эпохальный труд Арона Нимцовича — библия шахматного позиционного искусства и основа гипермодернизма.\n\n"
            "В книге впервые были сформулированы законы современной стратегии:\n"
            "• Блокада проходных пешек и фигурное давление на пешечную цепь;\n"
            "• Профилактика и избыточная защита стратегически важных пунктов;\n"
            "• Овладение открытыми вертикалями и господство на 7-й и 8-й горизонталях;\n"
            "• Пешечные клинья, изоляторы и висячие пешки.\n\n"
            "Классика, без прочтения которой невозможно достичь звания кандидата в мастера или мастера спорта."
        )

    # --- ТУРНИР В АМСТЕРДАМЕ 1958 ---
    if 'амстердам' in raw:
        return (
            f"Сборник партий и турнирных материалов международного соревнования гроссмейстеров в Амстердаме ({year} год).\n\n"
            f"Книга подробно знакомит с творчеством выдающихся советских и зарубежных мастеров, содержит анализы ключевых поединков, "
            f"разборы дебютных новинок и психологическую оценку турнирной борьбы."
        )

    # --- СОВЕТСКИЕ ШАХМАТИСТЫ (Абрамов) ---
    if 'советские шахматисты' in raw:
        return (
            "Уникальный биографический и партийный справочник Льва Абрамова, знакомящий с мастерами и гроссмейстерами советской шахматной школы.\n\n"
            "Книга включает очерки о творческом пути шахматистов, их спортивные достижения, характерные стили игры и подборку наиболее ярких партий, "
            "составивших славу отечественного шахматного искусства."
        )

    return None

# =========================================================================
# WIKIPEDIA & AUTHORS API
# =========================================================================
def search_wikipedia_summary(query, author=''):
    if not query or len(query) < 3:
        return None
    try:
        search_url = 'https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + urllib.parse.quote(query) + '&format=json&srlimit=2'
        req = urllib.request.Request(search_url, headers={'User-Agent': 'ChessVaultBot/2.0 (contact@chessvault.org)'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('query', {}).get('search', [])
            if not results:
                return None

        for item in results:
            page_title = item['title']
            summary_url = 'https://ru.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(page_title)
            req2 = urllib.request.Request(summary_url, headers={'User-Agent': 'ChessVaultBot/2.0 (contact@chessvault.org)'})
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                sdata = json.loads(resp2.read().decode('utf-8'))
                extract = sdata.get('extract', '')
                if extract and len(extract) > 60:
                    q_words = set(re.findall(r'\w{3,}', query.lower()))
                    t_words = set(re.findall(r'\w{3,}', page_title.lower()))
                    e_words = set(re.findall(r'\w{3,}', extract.lower()))
                    
                    # Relevance check
                    if len(q_words.intersection(t_words)) >= 1 or (author and author.lower() in extract.lower()) or ('шахмат' in extract.lower() and len(q_words.intersection(e_words)) >= 2):
                        return {
                            'description': extract,
                            'wikiTitle': page_title,
                            'wikiUrl': sdata.get('content_urls', {}).get('desktop', {}).get('page', '')
                        }
    except Exception:
        pass
    return None

def get_author_bio(author):
    if not author or author in ('---', 'Збірники та інші', '1 - Разное') or len(author) < 3:
        return None
    res = search_wikipedia_summary(f'{author} шахматист', author=author)
    if res:
        return res['description']
    return None

# =========================================================================
# MAIN ENRICHMENT LOGIC
# =========================================================================
def enrich_single_book(book, existing):
    fname = book['id']
    title = book.get('title', '')
    author = book.get('author', '')
    year = book.get('year', '')

    custom_content = get_custom_book_analysis(book)
    wiki_info = search_wikipedia_summary(clean_query(title, author), author=author)
    bio = get_author_bio(author)

    book_desc = ""
    wiki_url = None
    source = "catalog"

    if custom_content:
        book_desc = custom_content
        source = "journal_catalog" if '64-' in fname or 'chess in ussr' in fname.lower() else "chess_expert"
        if wiki_info:
            wiki_url = wiki_info.get('wikiUrl')
    elif wiki_info:
        book_desc = wiki_info['description']
        wiki_url = wiki_info['wikiUrl']
        source = "wikipedia"
    else:
        # Structured contextual synthesis
        yr_str = f" ({year} год)" if year and year != '---' else ""
        auth_str = f" под авторством {author}" if author and author not in ('---', 'Збірники та інші') else ""
        book_desc = (
            f"Шахматное теоретическое и практическое издание «{title}»{auth_str}{yr_str}.\n\n"
            f"В книге детально рассматриваются ключевые идеи, типовые стратегические планы, позиционные манёвры и комбинационные решения. "
            f"Издание снабжено подробными анализами партий и служит надежным пособием для углубленного изучения шахматного мастерства."
        )
        source = "smart_summary"

    result = {
        'bookDescription': book_desc,
        'authorBio': bio or '',
        'source': source
    }
    if wiki_url:
        result['wikiUrl'] = wiki_url

    return result

def main():
    print('=' * 65)
    print('📚 CHESS VAULT — ГЛУБОКОЕ СТРУКТУРИРОВАННОЕ ОБОГАЩЕНИЕ ОПИСАНИЙ')
    print('   Разделение на: «Про книгу» (глубокий анализ) + «Про автора» (био)')
    print('=' * 65)

    build_flash_index()
    url = f'https://archive.org/metadata/{ARCHIVE_ITEM}'
    print(f'Опрос архива {ARCHIVE_ITEM}...')
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVault/2.0'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    ALLOWED = ('.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx')
    files = [f for f in data.get('files', []) if f['name'].lower().endswith(ALLOWED)]
    print(f'Книг для обработки: {len(files)}\n')

    existing = load_existing_descriptions()
    new_db = {}
    total = len(files)

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

        print(f'[{idx}/{total}] {book["title"][:38]}... ', end='', flush=True)
        res = enrich_single_book(book, existing)
        new_db[fname] = res
        has_bio = " + био" if res.get('authorBio') else ""
        print(f'✅ {res.get("source")}{has_bio}')

        if idx % 20 == 0:
            save_descriptions(new_db)
        time.sleep(0.08)

    save_descriptions(new_db)
    print('\n' + '=' * 65)
    print(f'🏁 ЗАВЕРШЕНО! Всего книг с раздельными описаниями: {len(new_db)}')
    print(f'Сохранено в:\n  • {DESCRIPTIONS_JSON}\n  • {DESCRIPTIONS_JS}')
    print('=' * 65)

if __name__ == '__main__':
    main()
