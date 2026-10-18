#!/usr/bin/env python3
"""
Chess Vault — Automated Book Cover Verification & Resolution Pipeline
====================================================================
Этот скрипт автоматически:
1. Проверяет все книги из каталога (books-cache.json) на наличие обложек в папке covers/.
2. Верифицирует целостность существующих обложек (размер > 1КБ, валидный формат изображения).
3. Находит все книги, у которых обложек пока нет.
4. Автоматически получает недостающие обложки через многоуровневый конвейер:
   - Уровень 1: Логическое сопоставление с имеющимися обложками (алиасы, нормализация имен).
   - Уровень 2: Извлечение обложек через Internet Archive API (services/img).
   - Уровень 3: Извлечение страницы 1 из сканов IA (JP2 из _jp2.zip для сборников задач и книг).
   - Уровень 4: Загрузка издательских обложек через Open Library & ISBN базы.
   - Уровень 5: Генерация премиальных винтажных обложек Chess Vault (Pillow) для рукописей,
                статей, .doc, .txt и редких материалов с золотым тиснением и шахматной геральдикой.
5. Выполняет финальную верификацию и гарантирует 100% покрытие обложками.
"""

import os
import sys
import json
import re
import math
import shutil
import urllib.request
import urllib.parse
import unicodedata
import subprocess
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COVERS_DIR = os.path.join(BASE_DIR, 'covers')
CACHE_JSON = os.path.join(BASE_DIR, 'books-cache.json')
SIPS_BIN = '/usr/bin/sips'

os.makedirs(COVERS_DIR, exist_ok=True)

# ---------------------------------------------------------
# Шрифты macOS для генератора обложек
# ---------------------------------------------------------
def get_system_font(names, size):
    search_dirs = [
        '/System/Library/Fonts/Supplemental',
        '/System/Library/Fonts',
        '/Library/Fonts'
    ]
    for name in names:
        for d in search_dirs:
            fp = os.path.join(d, name)
            if os.path.exists(fp):
                try:
                    return ImageFont.truetype(fp, size)
                except Exception:
                    pass
    return ImageFont.load_default()

# ---------------------------------------------------------
# Утилиты верификации и обработки изображений
# ---------------------------------------------------------
def verify_image_integrity(path):
    """Проверяет существование и целостность изображения."""
    if not os.path.exists(path):
        return False
    if os.path.getsize(path) < 1000:
        return False
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False

def crop_spread_if_needed(image_path):
    """Если обложка представляет собой разворот (ширина > высота), обрезает лицевую часть."""
    try:
        with Image.open(image_path) as im:
            w, h = im.size
            if w > h:
                x_start = max(int(w * 0.54), w - int(h * 0.72))
                front = im.crop((x_start, 0, w, h))
                front.save(image_path, quality=94)
                return True
    except Exception:
        pass
    return False

def normalize_text(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', s)
    s = re.sub(r'[\(\)\[\],_\-\.\s\d]+', ' ', s.lower())
    return ' '.join(s.split())

# ---------------------------------------------------------
# Стратегия 1: Поиск среди существующих обложек (алиасы)
# ---------------------------------------------------------
KNOWN_MANUAL_MATCHES = {
    'endgame_troitzky_500': 'Троицкий - Сборник шахматных этюдов,1935.jpg',
    'Зак - О методике преподавания шахматной игры начинающим шахматистам - детям до 12-летнего возраст.djv': 'Зак - О методике преподавания начинающим шахматистам,1959.jpg',
    'Бронштейн - Самоучитель.chm': 'Бронштейн - Самоучитель Шахматной Игры, 1980.jpg',
    'Нимцович - Моя система.chm': 'Нимцович - Моя система на практике - 2005.jpg',
    'Загорянский - Повесть о Морфи (1968).doc': 'Загорянский - Повесть о Морфи  1968.jpg',
    'Испанская партия.doc': 'Суэтин А.С. - Испанская партия, 1982.jpg',
    'КАРЛСБАД.doc': 'Дроздов,Каленов,Черныш-Таинственный Карлсбад, 2000.jpg',
    'Нанн - Секреты практических шахмат.doc': 'Нанн - Секреты практических шахмат,2009.jpg',
    'Преимущество двух слонов.doc': 'Верховский - Цугцванг, Кочиев - Преимущество двух слонов (1989).jpg',
    'Шахматные байки.doc': 'Гик - Шахматные байки (2000).jpg',
    'Эйве - Курс шахматных лекций.doc': 'Эйве - Стратегия и тактика. Курс шахматных лекций (2002).jpg',
    'Никитин А - С Каспаровым ход за ходом, год за годом (1998) (неполн.).doc': 'Никитин - С Каспаровым ход за ходом. Год за годом, 1998.jpg',
    'Правила ФИДЕ 2005.doc': 'Правила шахмат ФИДЕ (2007, Элиста).jpg',
    'Искусство анализа -1.doc': 'Дворецкий - Искусство анализа (1989).jpg',
    'Искусство анализа -2.doc': 'Дворецкий - Искусство анализа (1989).jpg',
    'Искусство анализа-3.doc': 'Дворецкий - Искусство анализа (1989).jpg',
}

def resolve_by_existing_alias(book, target_path, existing_files_set):
    bid = book['id']
    if bid in KNOWN_MANUAL_MATCHES:
        src_name = KNOWN_MANUAL_MATCHES[bid]
        src_path = os.path.join(COVERS_DIR, src_name)
        if os.path.exists(src_path):
            shutil.copyfile(src_path, target_path)
            return True, f'Алиас: {src_name}'
            
    # Проверка через URL basename
    url = book.get('url', '')
    if url:
        url_file = url.split('/')[-1]
        decoded = urllib.parse.unquote(url_file)
        base_name = os.path.splitext(decoded)[0]
        candidate = base_name + '.jpg'
        candidate_path = os.path.join(COVERS_DIR, candidate)
        if os.path.exists(candidate_path) and os.path.getsize(candidate_path) > 1000:
            shutil.copyfile(candidate_path, target_path)
            return True, f'Совпадение по URL: {candidate}'

    return False, None

# ---------------------------------------------------------
# Стратегия 2: Загрузка через Internet Archive Image Service
# ---------------------------------------------------------
KNOWN_IA_VOLUMES = {
    'theorypracticeof0001panc',
    '639essentialendg00schi',
    'capablancasbestc00capa',
    'silmans-complete-endgame-course_202012',
    'howtoplayendgame00leon',
    'winningchessendg00leva',
    'dvoretsky-s-endgame-manual-3rd-edition',
    'guidetochessendi00euwe',
    'm.-i.-shereshevsky-endgame-strategy-pergamon-press-1985',
    'practicalchessen00kere',
    'basicchessending00reub',
    'chessendings_essentialknowledge',
    'comprehensivechessendings_volume5_rookendings',
    'monster-your-endgame-planning-vol-1',
    'domination-in-2-545-endgame-studies-by-ghenrikh-m.-kasparyan-z-lib.org',
}

def resolve_by_archive_img(book, target_path):
    vol = book.get('archiveVolume')
    if not vol or vol not in KNOWN_IA_VOLUMES:
        return False, None
        
    url = f'https://archive.org/services/img/{vol}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ChessVault/1.0'})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            # Пропускаем заглушки IA (<= 3000 байт)
            if len(data) <= 3000:
                return False, 'IA вернул пустую заглушку'
            with open(target_path, 'wb') as f:
                f.write(data)
                
        # Если скачанный файл PNG, конвертируем в JPEG через PIL
        try:
            with Image.open(target_path) as im:
                if im.format != 'JPEG':
                    rgb_im = im.convert('RGB')
                    rgb_im.save(target_path, 'JPEG', quality=94)
        except Exception:
            pass
            
        crop_spread_if_needed(target_path)
        if verify_image_integrity(target_path):
            return True, f'Internet Archive сервис обложек ({vol})'
    except Exception as e:
        return False, str(e)
        
    return False, None

# ---------------------------------------------------------
# Стратегия 3: Извлечение JP2 первого листа из архива IA (TCE сборники)
# ---------------------------------------------------------
def resolve_by_ia_jp2(book, target_path):
    vol = book.get('archiveVolume')
    if vol != 'tacticalchessexercises':
        return False, None
        
    url = book.get('url', '')
    if not url:
        return False, None
        
    orig_name = urllib.parse.unquote(url.split('/')[-1])
    base_name = orig_name[:-4] if orig_name.endswith('.pdf') else orig_name
    
    # URL первого листа в _jp2.zip
    encoded_zip = urllib.parse.quote(f'{base_name}_jp2.zip')
    encoded_inner = urllib.parse.quote(f'{base_name}_jp2/{base_name}_0000.jp2')
    jp2_url = f'https://archive.org/download/tacticalchessexercises/{encoded_zip}/{encoded_inner}'
    
    tmp_jp2 = f'/tmp/tce_page_{os.getpid()}.jp2'
    try:
        req = urllib.request.Request(jp2_url, headers={'User-Agent': 'ChessVault/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if len(data) < 2000:
                return False, 'Слишком маленький JP2'
            with open(tmp_jp2, 'wb') as f:
                f.write(data)
                
        # Конвертация через macOS sips
        subprocess.run(
            [SIPS_BIN, '-s', 'format', 'jpeg', '-Z', '650', tmp_jp2, '--out', target_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        
        crop_spread_if_needed(target_path)
        if verify_image_integrity(target_path):
            return True, f'IA JP2 скан 1-й страницы ({orig_name[:25]}...)'
    except Exception as e:
        return False, str(e)
    finally:
        if os.path.exists(tmp_jp2):
            try:
                os.remove(tmp_jp2)
            except OSError:
                pass
                
    return False, None

# ---------------------------------------------------------
# Стратегия 4: Open Library / ISBN База
# ---------------------------------------------------------
KNOWN_ISBN_MAPPING = {
    'endgame_nunn_secrets_pawns': 'https://covers.openlibrary.org/b/isbn/9781901983227-L.jpg',
    'endgame_nunn_secrets_rooks': 'https://covers.openlibrary.org/b/id/947661-L.jpg',
    'endgame_fundamental_muller': 'https://covers.openlibrary.org/b/id/947682-L.jpg',
}

def resolve_by_open_library(book, target_path):
    bid = book.get('id', '')
    url_or_isbn = KNOWN_ISBN_MAPPING.get(bid)
    
    urls_to_try = []
    if url_or_isbn:
        if url_or_isbn.startswith('http'):
            urls_to_try.append(url_or_isbn)
        else:
            urls_to_try.append(f'https://covers.openlibrary.org/b/isbn/{url_or_isbn}-L.jpg?default=false')
        
    for u in urls_to_try:
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'ChessVault/1.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 3000:
                        with open(target_path, 'wb') as f:
                            f.write(data)
                        if verify_image_integrity(target_path):
                            return True, f'Open Library ({u.split("/")[-1]})'
        except Exception:
            pass
            
    return False, None

# ---------------------------------------------------------
# Стратегия 5: Премиальный Винтажный Генератор Chess Vault (Pillow)
# ---------------------------------------------------------
PALETTES = [
    {
        'name': 'Navy Gold',
        'bg_top': (11, 20, 38),
        'bg_bot': (19, 32, 58),
        'gold': '#e2be5a',
        'gold_dim': '#8b7536',
        'gold_bright': '#fae58d',
        'text_white': '#f8fafc',
        'badge_bg': '#1e293b'
    },
    {
        'name': 'Imperial Burgundy',
        'bg_top': (34, 11, 20),
        'bg_bot': (56, 18, 32),
        'gold': '#f0c78a',
        'gold_dim': '#9c7348',
        'gold_bright': '#ffdfb0',
        'text_white': '#fff5f5',
        'badge_bg': '#3b1422'
    },
    {
        'name': 'Grandmaster Emerald',
        'bg_top': (10, 32, 24),
        'bg_bot': (18, 54, 40),
        'gold': '#e2c668',
        'gold_dim': '#8f7a37',
        'gold_bright': '#faf0a2',
        'text_white': '#f0fdf4',
        'badge_bg': '#14382c'
    },
    {
        'name': 'Obsidian Royal',
        'bg_top': (18, 20, 24),
        'bg_bot': (32, 36, 44),
        'gold': '#d8b248',
        'gold_dim': '#8a6e27',
        'gold_bright': '#fae086',
        'text_white': '#f9fafb',
        'badge_bg': '#232730'
    },
    {
        'name': 'Mahogany Vintage',
        'bg_top': (30, 16, 12),
        'bg_bot': (54, 30, 22),
        'gold': '#eec974',
        'gold_dim': '#9a773d',
        'gold_bright': '#fbe5a3',
        'text_white': '#fdf8f6',
        'badge_bg': '#3b2219'
    }
]

CHESS_SYMBOLS = ['♚', '♛', '♞', '♜']

# Особые темы для Энциклопедий Эндшпиля
ECE_SYMBOLS = {
    'endgame_ece_vol1': ('♟', 'ТОМ 1 • ПЕШЕЧНЫЕ ОКОНЧАНИЯ', 'Encyclopedia of Chess Endings: Pawn Endings'),
    'endgame_ece_vol2': ('♜', 'ТОМ 2 • ЛАДЕЙНЫЕ ОКОНЧАНИЯ', 'Encyclopedia of Chess Endings: Rook and Pawn'),
    'endgame_ece_vol3': ('♜', 'ТОМ 3 • ЛАДЬЯ ПРОТИВ ЛЕГКИХ ФИГУР', 'Encyclopedia of Chess Endings: Rook vs Minor'),
    'endgame_ece_vol4': ('♛', 'ТОМ 4 • ФЕРЗЕВЫЕ ОКОНЧАНИЯ', 'Encyclopedia of Chess Endings: Queen Endings'),
    'endgame_ece_vol5': ('♝', 'ТОМ 5 • ОКОНЧАНИЯ С ЛЕГКИМИ ФИГУРАМИ', 'Encyclopedia of Chess Endings: Minor Pieces')
}

def generate_bespoke_cover(book, target_path):
    """Генерирует роскошную винтажную обложку в фирменном стиле Chess Vault."""
    W, H = 600, 850
    bid = book.get('id', '')
    title = book.get('title', '')
    author = book.get('author', '')
    fmt = book.get('format', 'DOC').upper()
    
    # Очистка названия
    clean_title = re.sub(r'\.(doc|txt|chm|pdf|djvu)$', '', title, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', clean_title).strip()
    if not clean_title or clean_title == bid:
        clean_title = os.path.splitext(bid)[0]
        
    # Выбор палитры по хешу
    hash_val = sum(ord(c) for c in bid)
    p = PALETTES[hash_val % len(PALETTES)]
    
    # Создание холста с градиентом
    im = Image.new('RGB', (W, H), p['bg_top'])
    draw = ImageDraw.Draw(im)
    
    top_r, top_g, top_b = p['bg_top']
    bot_r, bot_g, bot_b = p['bg_bot']
    for y in range(H):
        factor = y / float(H)
        r = int(top_r + (bot_r - top_r) * factor)
        g = int(top_g + (bot_g - top_g) * factor)
        b = int(top_b + (bot_b - top_b) * factor)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
        
    # Легкая текстура холста/кожи
    for y in range(0, H, 4):
        draw.line([(0, y), (W, y)], fill=(top_r + 4, top_g + 4, top_b + 4))
        
    # Рамка с золотым тиснением
    gold = p['gold']
    gold_dim = p['gold_dim']
    gold_bright = p['gold_bright']
    
    draw.rectangle([20, 20, W-20, H-20], outline=gold_dim, width=1)
    draw.rectangle([26, 26, W-26, H-26], outline=gold, width=2)
    draw.rectangle([34, 34, W-34, H-34], outline=gold_dim, width=1)
    
    # Декоративные уголки
    for cx, cy in [(26, 26), (W-26, 26), (26, H-26), (W-26, H-26)]:
        draw.rectangle([cx-9, cy-9, cx+9, cy+9], fill=p['bg_top'], outline=gold, width=1)
        draw.rectangle([cx-3, cy-3, cx+3, cy+3], fill=gold_bright)
        
    # Шрифты
    font_header = get_system_font(['Georgia.ttf', 'Times New Roman.ttf'], 15)
    font_symbol = get_system_font(['Apple Symbols.ttf', 'Arial Unicode.ttf', 'Georgia.ttf'], 56)
    font_title = get_system_font(['Georgia Bold.ttf', 'Georgia.ttf', 'Times New Roman Bold.ttf'], 27)
    font_author = get_system_font(['Georgia Italic.ttf', 'Georgia.ttf', 'Times New Roman Italic.ttf'], 21)
    font_badge = get_system_font(['Georgia.ttf', 'Times New Roman.ttf'], 14)
    font_footer = get_system_font(['Georgia.ttf', 'Times New Roman.ttf'], 13)
    
    # Заголовок серии
    header_text = 'CHESS VAULT ARCHIVE'
    w_h = draw.textlength(header_text, font=font_header)
    draw.text(((W - w_h) / 2, 54), header_text, fill=gold, font=font_header)
    # Изящные золотые ромбики по бокам заголовка
    draw.polygon([((W - w_h)/2 - 18, 62), ((W - w_h)/2 - 14, 58), ((W - w_h)/2 - 10, 62), ((W - w_h)/2 - 14, 66)], fill=gold_bright)
    draw.polygon([((W + w_h)/2 + 10, 62), ((W + w_h)/2 + 14, 58), ((W + w_h)/2 + 18, 62), ((W + w_h)/2 + 14, 66)], fill=gold_bright)
    
    # Разделитель с ромбом
    draw.line([60, 82, W-60, 82], fill=gold_dim, width=1)
    draw.polygon([(W/2 - 6, 82), (W/2, 77), (W/2 + 6, 82), (W/2, 87)], fill=gold)
    
    # Шахматная эмблема
    emblem_y = 155
    draw.ellipse([W/2 - 48, emblem_y - 48, W/2 + 48, emblem_y + 48], outline=gold, width=2)
    draw.ellipse([W/2 - 54, emblem_y - 54, W/2 + 54, emblem_y + 54], outline=gold_dim, width=1)
    
    symbol = CHESS_SYMBOLS[hash_val % len(CHESS_SYMBOLS)]
    sub_title_extra = None
    if bid in ECE_SYMBOLS:
        symbol, sub_title_extra, clean_title = ECE_SYMBOLS[bid]
        
    w_sym = draw.textlength(symbol, font=font_symbol)
    draw.text((W/2 - w_sym/2, emblem_y - 40), symbol, fill=gold_bright, font=font_symbol)
    
    # Разбивка названия на строки
    words = clean_title.split()
    lines = []
    curr = ''
    max_w = 460
    for w in words:
        test = (curr + ' ' + w).strip()
        if draw.textlength(test, font=font_title) <= max_w:
            curr = test
        else:
            if curr: lines.append(curr)
            curr = w
    if curr: lines.append(curr)
    
    # Ограничение до 5 строк
    lines = lines[:5]
    
    title_start_y = 265
    line_h = 36
    for i, line in enumerate(lines):
        wl = draw.textlength(line, font=font_title)
        draw.text(((W - wl) / 2, title_start_y + i * line_h), line, fill=p['text_white'], font=font_title)
        
    title_end_y = title_start_y + len(lines) * line_h + 15
    
    # Подзаголовок для энциклопедий
    if sub_title_extra:
        w_sub = draw.textlength(sub_title_extra, font=font_header)
        draw.text(((W - w_sub) / 2, title_end_y), sub_title_extra, fill=gold_bright, font=font_header)
        title_end_y += 28
        
    # Разделитель под названием
    draw.line([120, title_end_y, W-120, title_end_y], fill=gold, width=1)
    draw.rectangle([W/2 - 3, title_end_y - 3, W/2 + 3, title_end_y + 3], fill=gold_bright)
    
    # Автор
    author_clean = re.sub(r'[\(\[\{].*?[\)\]\}]', '', author).strip()
    if not author_clean or author_clean.lower() == clean_title.lower() or author_clean.isdigit():
        author_text = 'Библиотека мастера'
    else:
        author_text = f'{author_clean}'
        
    w_auth = draw.textlength(author_text, font=font_author)
    draw.text(((W - w_auth) / 2, title_end_y + 24), author_text, fill=gold_bright, font=font_author)
    
    # Бейдж формата документа
    badge_label = f'МАТЕРИАЛ • {fmt}'
    if fmt == 'DOC':
        badge_label = 'РУКОПИСЬ • DOC'
    elif fmt == 'TXT':
        badge_label = 'АРХИВ • ТЕКСТ'
    elif fmt == 'CHM':
        badge_label = 'СПРАВОЧНИК • CHM'
    elif 'ece' in bid:
        badge_label = 'CHESS INFORMANT • ECE'
        
    wb = draw.textlength(badge_label, font=font_badge)
    badge_y = H - 150
    draw.rectangle([W/2 - wb/2 - 18, badge_y - 6, W/2 + wb/2 + 18, badge_y + 26], outline=gold_dim, fill=p['badge_bg'], width=1)
    draw.text(((W - wb) / 2, badge_y), badge_label, fill=gold, font=font_badge)
    
    # Нижний колонтитул
    draw.line([60, H - 90, W-60, H - 90], fill=gold_dim, width=1)
    footer_text = 'CHESS VAULT • COLLECTOR’S EDITION'
    wf = draw.textlength(footer_text, font=font_footer)
    draw.text(((W - wf) / 2, H - 76), footer_text, fill=gold_dim, font=font_footer)
    
    im.save(target_path, 'JPEG', quality=94)
    return True, f'Премиум обложка Chess Vault ({p["name"]})'

# ---------------------------------------------------------
# ОСНОВНОЙ КОНВЕЙЕР
# ---------------------------------------------------------
def process_book_cover(book, existing_files_set):
    """Применяет конвейер стратегий для получения обложки."""
    bid = book['id']
    base_id = os.path.splitext(bid)[0]
    cover_name = base_id + '.jpg'
    target_path = os.path.join(COVERS_DIR, cover_name)
    
    # 0. Если уже существует и валидна
    if verify_image_integrity(target_path):
        return True, 'Уже есть'
        
    # Стратегия 1: Алиас / совпадение
    ok, src = resolve_by_existing_alias(book, target_path, existing_files_set)
    if ok: return True, src
    
    # Стратегия 2: Internet Archive service img
    ok, src = resolve_by_archive_img(book, target_path)
    if ok: return True, src
    
    # Стратегия 3: IA JP2 из _jp2.zip (TCE книги)
    ok, src = resolve_by_ia_jp2(book, target_path)
    if ok: return True, src
    
    # Стратегия 4: Open Library / ISBN
    ok, src = resolve_by_open_library(book, target_path)
    if ok: return True, src
    
    # Стратегия 5: Премиум генератор Chess Vault
    ok, src = generate_bespoke_cover(book, target_path)
    if ok: return True, src
    
    return False, 'Не удалось получить'

def main():
    print('=' * 70)
    print('♟️  CHESS VAULT — АВТОМАТИЧЕСКАЯ ОБРАБОТКА И ВЕРИФИКАЦИЯ ОБЛОЖЕК')
    print('=' * 70)
    
    if not os.path.exists(CACHE_JSON):
        print(f'❌ Ошибка: файл каталога не найден: {CACHE_JSON}')
        sys.exit(1)
        
    with open(CACHE_JSON, 'r', encoding='utf-8') as f:
        books = json.load(f)
        
    total_books = len(books)
    print(f'📚 Всего книг в каталоге: {total_books}')
    
    # ---------------------------------------------------------
    # ЭТАП 1: Проверка уже существующих обложек
    # ---------------------------------------------------------
    print('\n🔍 ЭТАП 1: Аудит и проверка существующих обложек...')
    existing_covers = set(os.listdir(COVERS_DIR))
    
    valid_existing = []
    missing_books = []
    
    for b in books:
        base_id = os.path.splitext(b['id'])[0]
        cover_name = base_id + '.jpg'
        cover_path = os.path.join(COVERS_DIR, cover_name)
        if verify_image_integrity(cover_path):
            valid_existing.append(b)
        else:
            missing_books.append(b)
            
    print(f'   ✅ Книг с готовыми валидными обложками: {len(valid_existing)}')
    print(f'   ⚠️  Книг без обложек (требуют обработки): {len(missing_books)}')
    
    if not missing_books:
        print('\n🎉 Все книги уже имеют качественные обложки! Дополнительных действий не требуется.')
        return
        
    # ---------------------------------------------------------
    # ЭТАП 2: Автоматическое получение обложек
    # ---------------------------------------------------------
    print(f'\n🚀 ЭТАП 2: Автоматическое получение недостающих обложек ({len(missing_books)} шт.)...\n')
    
    stats = {}
    success_count = 0
    fail_count = 0
    
    for idx, book in enumerate(missing_books, 1):
        bid = book['id']
        title = book.get('title', bid)
        print(f'[{idx:03d}/{len(missing_books):03d}] {title[:40]:<40} ... ', end='', flush=True)
        
        ok, source = process_book_cover(book, existing_covers)
        if ok:
            print(f'✅ {source}')
            success_count += 1
            # Группируем статистику
            cat = source.split('(')[0].strip()
            stats[cat] = stats.get(cat, 0) + 1
        else:
            print(f'❌ {source}')
            fail_count += 1
            
    # ---------------------------------------------------------
    # ЭТАП 3: Финальная верификация
    # ---------------------------------------------------------
    print('\n' + '=' * 70)
    print('🏁 ЭТАП 3: Финальная проверка покрытия библиотеки...')
    
    final_verified = 0
    still_missing = []
    for b in books:
        base_id = os.path.splitext(b['id'])[0]
        cover_name = base_id + '.jpg'
        cover_path = os.path.join(COVERS_DIR, cover_name)
        if verify_image_integrity(cover_path):
            final_verified += 1
        else:
            still_missing.append(b)
            
    coverage_pct = (final_verified / total_books) * 100.0
    print(f'📊 Результат: {final_verified} / {total_books} книг имеют обложки ({coverage_pct:.1f}%)')
    
    if stats:
        print('\n📈 Источники полученных обложек:')
        for src, cnt in sorted(stats.items(), key=lambda x: -x[1]):
            print(f'   • {src}: {cnt}')
            
    if still_missing:
        print(f'\n⚠️  Осталось без обложек: {len(still_missing)}')
    else:
        print('\n✨ ИДЕАЛЬНО: 100% книг библиотеки Chess Vault снабжены обложками!')
        
    print('=' * 70)

if __name__ == '__main__':
    main()
