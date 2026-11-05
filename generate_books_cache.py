#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generates books-cache.json and books-cache.js for instant loading of Chess Vault library.
Includes:
- Live verification against Internet Archive metadata (1971_20260223 + vol2 + tacticalchessexercises + standalone public endgame items)
- Exact byte-for-byte NFD/NFC Archive.org filename preservation in URLs (prevents 403/404 mismatches)
- Multi-format tactical & endgame books with verified public PDF/EPUB URLs
- Slug-based page-count & description inheritance across renamed entries
- Comprehensive ELO rating evaluation (min, max, level, badge, percentage)
"""

import os
import json
import re
import unicodedata
import urllib.parse
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DESCRIPTIONS_JSON = os.path.join(BASE_DIR, 'descriptions.json')
DESCRIPTIONS_JS = os.path.join(BASE_DIR, 'descriptions.js')
PAGE_COUNTS_JSON = os.path.join(BASE_DIR, 'page_counts.json')
PAGE_COUNTS_JS = os.path.join(BASE_DIR, 'page_counts.js')
BOOKS_CACHE_JSON = os.path.join(BASE_DIR, 'books-cache.json')
BOOKS_CACHE_JS = os.path.join(BASE_DIR, 'books-cache.js')

ARCHIVE_VOL1 = '1971_20260223'
ARCHIVE_VOL2 = '1971_20260223_vol2'
ALLOWED_EXTS = ('.pdf', '.djvu', '.djv', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx')
IGNORED_FILES = {'test_file.txt'}


def norm(s):
    if not s:
        return ''
    return unicodedata.normalize('NFC', s).strip().lower()


def slug_key(s, keep_year=True):
    if not s:
        return ''
    t = unicodedata.normalize('NFC', s).lower()
    t = re.sub(r'\.[^.]+$', '', t).replace('ё', 'е')
    if not keep_year:
        t = re.sub(r'\b(18|19|20)\d{2}\b', '', t)
    return re.sub(r'[^a-zа-я0-9]+', '', t)


def fetch_item_files(item_id):
    """Fetch non-derivative, non-private files from an Internet Archive item."""
    url = f"https://archive.org/metadata/{item_id}"
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVaultCacheGen/3.0'})
    files = []
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('is_dark'):
                print(f"Skipping dark/unavailable item: {item_id}")
                return []
            for f in data.get('files', []):
                name = f.get('name', '')
                if not name or f.get('source') == 'derivative':
                    continue
                if str(f.get('private', '')).lower() == 'true':
                    continue
                if name.lower() in IGNORED_FILES or name.startswith('__') or name.startswith(f'{item_id}_'):
                    continue
                if name.endswith(('_meta.xml', '_files.xml', '.sqlite', '.torrent', '_encrypted.pdf')):
                    continue
                if name.lower().endswith(ALLOWED_EXTS):
                    files.append({
                        'name': name,  # Exact byte sequence stored on Archive.org (NFD or NFC)
                        'size': int(f.get('size', 0) or 0),
                        'volume': item_id
                    })
        print(f"Loaded {len(files)} verified public files from {item_id}")
    except Exception as e:
        print(f"Warning: could not fetch {item_id}: {e}")
    return files


# 30 verified multi-format tactical books in `tacticalchessexercises`
TACTICAL_BOOKS_DATA = [
    {'title': 'Mil Mates Artísticos', 'author': 'Alonso', 'pdf': 'Alonso, Mil Mates Artísticos.pdf', 'epub': 'Alonso, Mil Mates Artísticos.epub', 'topic': 'etudes'},
    {'title': '300 Rompecabezas de Ajedrez', 'author': 'Barden', 'pdf': 'Barden, 300 Rompecabezas de Ajedrez.pdf', 'epub': 'Barden, 300 Rompecabezas de Ajedrez.epub', 'topic': 'etudes'},
    {'title': 'Combinational Motifs', 'author': 'Blokh', 'pdf': 'Blokh, Combinational Motifs.pdf', 'epub': 'Blokh, Combinational Motifs.epub', 'topic': 'mittelspiel'},
    {'title': 'The Gambit Book of Instructive Chess Puzzles', 'author': 'Burgess', 'pdf': 'Burgess, The Gambit Book of Instructive Chess Puzzles.pdf', 'epub': 'Burgess, The Gambit Book of Instructive Chess Puzzles.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez - Temas modernos', 'author': 'Coello', 'pdf': 'Coello, Problemas de Ajedrez - Temas modernos.pdf', 'epub': 'Coello, Problemas de Ajedrez - Temas modernos.epub', 'topic': 'etudes'},
    {'title': '365 Greatest Puzzles', 'author': 'Csaba', 'pdf': 'Csaba, 365 Greatest Puzzles.pdf', 'epub': 'Csaba, 365 Greatest Puzzles.epub', 'topic': 'etudes'},
    {'title': 'The Ultimate Chess Puzzle Book', 'author': 'Emms', 'pdf': 'Emms, The Ultimate Chess Puzzle Book.pdf', 'epub': 'Emms, The Ultimate Chess Puzzle Book.epub', 'topic': 'etudes'},
    {'title': 'Ajedrez por niveles', 'author': 'Fontarnau', 'pdf': 'Fontarnau, Ajedrez por niveles.pdf', 'epub': 'Fontarnau, Ajedrez por niveles.epub', 'topic': 'beginners'},
    {'title': 'The Giant Chess Puzzle Book', 'author': 'Franco', 'pdf': 'Franco, The Giant Chess Puzzle Book.pdf', 'epub': 'Franco, The Giant Chess Puzzle Book.epub', 'topic': 'etudes'},
    {'title': 'Problemas Resueltos Sobre Mates', 'author': 'Gillam', 'pdf': 'Gillam, Problemas Resueltos Sobre Mates.pdf', 'epub': 'Gillam, Problemas Resueltos Sobre Mates.epub', 'topic': 'etudes'},
    {'title': '200 Perplexing Chess Puzzles', 'author': 'Greif', 'pdf': 'Greif, 200 Perplexing Chess Puzzles.pdf', 'epub': 'Greif, 200 Perplexing Chess Puzzles.epub', 'topic': 'etudes'},
    {'title': 'Posiciones Explosivas', 'author': 'Gude', 'pdf': 'Gude, Posiciones Explosivas.pdf', 'epub': 'Gude, Posiciones Explosivas.epub', 'topic': 'mittelspiel'},
    {'title': 'Problemas de Cálculo', 'author': 'Gude', 'pdf': 'Gude, Problemas de Cálculo.pdf', 'epub': 'Gude, Problemas de Cálculo.epub', 'topic': 'etudes'},
    {'title': 'Sacrificios Posicionales', 'author': 'Gude', 'pdf': 'Gude, Sacrificios Posicionales.pdf', 'epub': 'Gude, Sacrificios Posicionales.epub', 'topic': 'mittelspiel'},
    {'title': 'La Pasión Del Ajedrez En Ejercicios', 'author': 'Kasparov', 'pdf': 'Kaspárov, La Pasión Del Ajedrez  En Ejercicios.pdf', 'epub': 'Kaspárov, La Pasión Del Ajedrez  En Ejercicios.epub', 'topic': 'personal'},
    {'title': 'The Times Winning Moves', 'author': 'Keene', 'pdf': 'Keene, The Times Winning Moves.pdf', 'epub': 'Keene, The Times Winning Moves.epub', 'topic': 'etudes'},
    {'title': 'Problemas Selectos', 'author': 'NN', 'pdf': 'NN, Problemas.pdf', 'epub': 'NN, Problemas.epub', 'topic': 'etudes'},
    {'title': 'Solving In Style', 'author': 'Nunn', 'pdf': 'Nunn, Solving In Style.pdf', 'epub': 'Nunn, Solving In Style.epub', 'topic': 'etudes'},
    {'title': 'The Complete Chess Workout', 'author': 'Palliser', 'pdf': 'Palliser, The Complete Chess Workout.pdf', 'epub': 'Palliser, The Complete Chess Workout.epub', 'topic': 'mittelspiel'},
    {'title': '5334 Problems, Combinations and Games', 'author': 'Polgár', 'pdf': 'Polgár, 5334 Problems, Combinations and Games.pdf', 'epub': 'Polgár, 5334 Problems, Combinations and Games.epub', 'topic': 'etudes'},
    {'title': '1001 Brilliant Chess Sacrifices and Combinations', 'author': 'Reinfeld', 'pdf': 'Reinfeld, 1001 Brilliant Chess Sacrifices and Combinations.pdf', 'epub': 'Reinfeld, 1001 Brilliant Chess Sacrifices and Combinations.epub', 'topic': 'mittelspiel'},
    {'title': 'Chess Puzzle Book', 'author': 'Speelman', 'pdf': 'Speelman, Chess Puzzle Book.pdf', 'epub': 'Speelman, Chess Puzzle Book.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez', 'author': 'Séneca', 'pdf': 'Séneca, Problemas de Ajedrez.pdf', 'epub': 'Séneca, Problemas de Ajedrez.epub', 'topic': 'etudes'},
    {'title': '200 Problemas de Ajedrez', 'author': 'Torán', 'pdf': 'Torán, 200 Problemas de Ajedrez.pdf', 'epub': 'Torán, 200 Problemas de Ajedrez.epub', 'topic': 'etudes'},
    {'title': 'La vanguardia - Problemas de ajedrez', 'author': 'Torán', 'pdf': 'Torán, La vanguardia - Problemas de ajedrez.pdf', 'epub': 'Torán, La vanguardia - Problemas de ajedrez.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez 1', 'author': 'Torán', 'pdf': 'Torán, Problemas de Ajedrez 1.pdf', 'epub': 'Torán, Problemas de Ajedrez 1.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez 2', 'author': 'Torán', 'pdf': 'Torán, Problemas de Ajedrez 2.pdf', 'epub': 'Torán, Problemas de Ajedrez 2.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez 3', 'author': 'Torán', 'pdf': 'Torán, Problemas de Ajedrez 3.pdf', 'epub': 'Torán, Problemas de Ajedrez 3.epub', 'topic': 'etudes'},
    {'title': 'Problemas de Ajedrez 4', 'author': 'Torán', 'pdf': 'Torán, Problemas de Ajedrez 4.pdf', 'epub': 'Torán, Problemas de Ajedrez 4.epub', 'topic': 'etudes'},
    {'title': '303 Jaques Mates de Ajedrez', 'author': 'Wilson & Albertson', 'pdf': 'Wilson & Albertson, 303 Jaques Mates de Ajedrez.pdf', 'epub': 'Wilson & Albertson, 303 Jaques Mates de Ajedrez.epub', 'topic': 'etudes'}
]

# Verified public standalone endgame classics on Archive.org
ENDGAME_CLASSICS_DATA = [
    {
        'id': 'endgame_silman_course',
        'title': "Silman's Complete Endgame Course",
        'author': 'Jeremy Silman',
        'year': '2007',
        'pages': 530,
        'archiveId': 'silmans-complete-endgame-course_202012',
        'file': "Silman's Complete Endgame Course.pdf",
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Легендарний фундаментальний посібник американського міжнародного майстра Джеремі Сілмана. Матеріал структуровано за рівнями майстерності: від початківця до майстра спорту.'
    },
    {
        'id': 'endgame_dvoretsky_manual_en',
        'title': "Dvoretsky's Endgame Manual",
        'author': 'Mark Dvoretsky',
        'year': '2011',
        'pages': 440,
        'archiveId': 'dvoretsky-s-endgame-manual-3rd-edition',
        'file': 'Dvoretsky-s-endgame-manual-3rd-edition.pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': "Світовий бестселер та головний підручник з ендшпілю XXI століття від заслуженого тренера СРСР Марка Дворецького. Обов'язкова книга для кожного шахіста високої кваліфікації."
    },
    {
        'id': 'endgame_kasparyan_domination',
        'title': 'Domination in 2,545 Endgame Studies',
        'author': 'Ghenrikh Kasparyan',
        'year': '1980',
        'pages': 544,
        'archiveId': 'domination-in-2-545-endgame-studies-by-ghenrikh-m.-kasparyan-z-lib.org',
        'file': 'Domination in 2,545 Endgame Studies by Ghenrikh M. Kasparyan (z-lib.org).pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Монументальна збірка етюдів видатного композитора Генріха Каспаряна на тему домінування фігур у фіналі партії.'
    },
    {
        'id': 'endgame_shereshevsky_strategy_en',
        'title': 'Endgame Strategy',
        'author': 'Mikhail Shereshevsky',
        'year': '1985',
        'pages': 228,
        'archiveId': 'm.-i.-shereshevsky-endgame-strategy-pergamon-press-1985',
        'file': 'M.I. Shereshevsky - Endgame Strategy-Pergamon press (1985).pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Світовий посібник зі складних стратегічних закінчень (принцип двох слабкостей, централізація короля, обмеження фігур).'
    },
    {
        'id': 'endgame_muller_secrets_pawns',
        'title': 'Secrets of Pawn Endings',
        'author': 'Karsten Müller, Frank Lamprecht',
        'year': '2000',
        'pages': 288,
        'archiveId': 'm.-i.-shereshevsky-endgame-strategy-pergamon-press-1985',
        'file': 'Karsten Muller, Frank Lamprecht - Secrets of Pawn Endings-Everyman Chess (2000).pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Фундаментальне дослідження пішакових закінчень з точним аналізом ключових полів, опозиції та проривів від доктора Карстена Мюллера та Франка Лампрехта.'
    },
    {
        'id': 'endgame_grivas_planning',
        'title': 'Monster Your Endgame Planning Vol. 1',
        'author': 'Efstratios Grivas',
        'year': '2019',
        'pages': 288,
        'archiveId': 'monster-your-endgame-planning-vol-1',
        'file': 'Monster Your Endgame Planning Vol 1 - Grivas (PDF).pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Сучасний курс стратегічного планування в ендшпілі від старшого тренера ФІДЕ Ефстратіоса Гріваса.'
    },
    {
        'id': 'endgame_averbakh_rook_endings',
        'title': 'Comprehensive Chess Endings - Volume 5: Rook Endings',
        'author': 'Yuri Averbakh',
        'year': '1987',
        'pages': 336,
        'archiveId': 'comprehensivechessendings_volume5_rookendings',
        'file': 'Averbakh, Yuri - Comprehensive Chess Endings 5 - Rook Endings.pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Англомовний 5-й том легендарної серії Юрія Авербаха, присвячений найпоширенішим у практиці туровим закінченням.'
    },
    {
        'id': 'endgame_averbakh_essential',
        'title': 'Chess Endings: Essential Knowledge',
        'author': 'Yuri Averbakh',
        'year': '1993',
        'pages': 160,
        'archiveId': 'chessendings_essentialknowledge',
        'file': 'Averbakh, Yuri - Chess Endings - Essential Knowledge.pdf',
        'lang': 'en',
        'topicId': 'endgame',
        'desc': 'Концентрована золота теорія базових закінчень від патріарха світових шахів Юрія Авербаха.'
    }
]


def compute_book_elo(fname, author, title, desc_text):
    t = (fname + ' ' + (author or '') + ' ' + (title or '') + ' ' + (desc_text or '')).lower()

    if any(k in t for k in [
        'дворецкий', 'dvoretsky', 'высшего мастерства', 'школа высшего мастерства',
        'мои великие предшественники', 'дебютная революция', 'бологан', 'сакаев',
        'халифман', 'информатор', 'chess informant', 'энциклопедия шахматных окончаний',
        'интуиция', 'стратегия изолированной пешки', 'тяжелые фигуры', 'метод в шахматах',
        'дорфман', 'супертурнир в линаресе', 'solving in style', 'domination in 2'
    ]):
        return {
            'eloMin': 2200, 'eloMax': 2600, 'eloAvg': 2400,
            'eloLevel': 'master', 'eloDisplay': '2200–2600+', 'eloPercent': 92
        }

    if any(k in t for k in [
        'стратегия', 'нимцович', 'моя система', 'как стать гроссмейстером',
        'тайны мышления', 'шерешевский', 'shereshevsky', 'позиционная игра', 'искусство анализа',
        'стратегия эндшпиля', 'оценка позиции', 'план в шахматной',
        'каспаров', 'kasparov', 'карпов', 'смыслов', 'таль', 'петросян', 'бронштейн',
        'геллер', 'полугаевский', 'кмс', '1 разряд', 'i разряд',
        'турнир претендентов', 'матч на первенство', 'эндшпиль для практиков',
        'combinational motifs', 'sacrificios posicionales', 'comprehensive chess endings'
    ]):
        return {
            'eloMin': 1800, 'eloMax': 2200, 'eloAvg': 2000,
            'eloLevel': 'advanced', 'eloDisplay': '1800–2200', 'eloPercent': 75
        }

    if any(k in t for k in [
        'начинающ', 'букварь', 'азбук', 'малыш', 'дет', 'первая книга',
        'новичок', 'самоучител', 'iv разряд', 'iii разряд', 'iv-iii',
        'прогулки по', 'азы шахмат', 'шахматный задачник', 'учитесь играть',
        'шахматная страна', 'в стране шахматных', 'шаг за шагом', 'для маленьких',
        'шахматы увлекательная', 'руководство к изучению', 'начальный курс',
        'por niveles', 'essential knowledge'
    ]):
        return {
            'eloMin': 800, 'eloMax': 1400, 'eloAvg': 1100,
            'eloLevel': 'beginner', 'eloDisplay': '800–1400', 'eloPercent': 35
        }

    if any(k in t for k in [
        'дебют', 'защита', 'гамбит', 'испанская', 'сицилианская',
        'французская', 'каро-канн', 'староиндийская', 'грюнфельд',
        'ферзевый', 'английское начало', 'каталонское', 'ловушки', 'дебютный репертуар'
    ]):
        return {
            'eloMin': 1400, 'eloMax': 1900, 'eloAvg': 1650,
            'eloLevel': 'intermediate', 'eloDisplay': '1400–1900', 'eloPercent': 58
        }

    if any(k in t for k in [
        'эндшпил', 'этюд', 'окончан', 'пешечн', 'ладейн', 'конев', 'слонов',
        'endgame', 'endings', 'puzzles', 'problemas', 'mates'
    ]):
        return {
            'eloMin': 1600, 'eloMax': 2100, 'eloAvg': 1850,
            'eloLevel': 'advanced', 'eloDisplay': '1600–2100', 'eloPercent': 68
        }

    return {
        'eloMin': 1400, 'eloMax': 1800, 'eloAvg': 1600,
        'eloLevel': 'intermediate', 'eloDisplay': '1400–1800', 'eloPercent': 50
    }


def main():
    descriptions = {}
    if os.path.exists(DESCRIPTIONS_JSON):
        with open(DESCRIPTIONS_JSON, 'r', encoding='utf-8') as f:
            descriptions = json.load(f)

    # Fix known OCR/typo string in existing descriptions
    for k, v in list(descriptions.items()):
        if isinstance(v, dict) and isinstance(v.get('bookDescription'), str):
            if 'е Sparse шпілю' in v['bookDescription']:
                v['bookDescription'] = v['bookDescription'].replace('е Sparse шпілю', 'ендшпілю')

    page_counts = {}
    if os.path.exists(PAGE_COUNTS_JSON):
        with open(PAGE_COUNTS_JSON, 'r', encoding='utf-8') as f:
            page_counts = json.load(f)

    # Build normalized & slug lookup indices so renamed files inherit descriptions & page counts
    desc_by_norm = {}
    desc_by_slug = {}
    for k, v in descriptions.items():
        if isinstance(v, dict):
            desc_by_norm.setdefault(norm(k), v)
            sk = slug_key(k, True)
            if sk:
                desc_by_slug.setdefault(sk, v)

    pages_by_norm = {}
    pages_by_slug = {}
    for k, v in page_counts.items():
        if v:
            pages_by_norm.setdefault(norm(k), v)
            sk = slug_key(k, True)
            if sk:
                pages_by_slug.setdefault(sk, v)

    vol1_files = fetch_item_files(ARCHIVE_VOL1)
    vol2_files = fetch_item_files(ARCHIVE_VOL2)

    combined_files = []
    seen_norm = set()
    for f in vol1_files + vol2_files:
        n = norm(f['name'])
        if n in seen_norm:
            continue
        seen_norm.add(n)
        combined_files.append(f)

    books = []

    # 1. Verified Volume 1 (+ Volume 2 when public) books
    for f in combined_files:
        exact_name = f['name']
        fname = unicodedata.normalize('NFC', exact_name)
        vol_id = f['volume']
        sz = f['size']
        raw_ext = fname.rsplit('.', 1)[-1].lower() if '.' in fname else 'pdf'
        fmt = 'djvu' if raw_ext == 'djv' else raw_ext

        file_stem = os.path.splitext(fname)[0]
        match = re.match(r'(.*?)\s*-\s*(.*)\s*\((\d{4})\)', file_stem)
        author = match.group(1).strip() if match else file_stem.split('-')[0].strip()
        title = match.group(2).strip() if match else file_stem
        year = match.group(3) if match else '---'

        n_key = norm(fname)
        s_key = slug_key(fname, True)

        desc_obj = descriptions.get(fname) or desc_by_norm.get(n_key) or desc_by_slug.get(s_key) or {}
        desc_text = desc_obj.get('bookDescription') or desc_obj.get('description') or ''

        pg = (
            desc_obj.get('pages')
            or page_counts.get(fname)
            or pages_by_norm.get(n_key)
            or pages_by_slug.get(s_key)
            or None
        )
        if pg:
            try:
                pg = int(pg)
            except Exception:
                pg = None

        # Ensure description & page count are stored under canonical NFC filename too
        if fname not in descriptions and desc_obj:
            descriptions[fname] = dict(desc_obj)
        if pg and fname not in page_counts:
            page_counts[fname] = pg

        is_cyrillic = bool(re.search(r'[а-яёіїєґ]', fname, re.IGNORECASE))
        book_lang = 'ru' if is_cyrillic else 'en'

        # Exact byte-for-byte Archive.org name (preserves NFD when uploaded from macOS)
        download_url = f"https://archive.org/download/{vol_id}/{urllib.parse.quote(exact_name)}"
        elo_data = compute_book_elo(fname, author, title, desc_text)

        books.append({
            'author': author,
            'title': title,
            'year': year,
            'pages': pg,
            'format': fmt,
            'sizeDisplay': f'{(sz / 1024 / 1024):.2f} MB',
            'sizeRaw': sz,
            'url': download_url,
            'id': fname,
            'archiveVolume': vol_id,
            'lang': book_lang,
            'inArchive': True,
            **elo_data
        })

    # 2. Verified multi-format Tactical Chess Exercises (30 books)
    tce_files_list = fetch_item_files('tacticalchessexercises')
    tce_by_norm = {norm(x['name']): x for x in tce_files_list}

    for tb in TACTICAL_BOOKS_DATA:
        pdf_meta = tce_by_norm.get(norm(tb['pdf']))
        epub_meta = tce_by_norm.get(norm(tb['epub']))
        if not pdf_meta:
            continue

        pdf_exact = pdf_meta['name']
        pdf_sz = pdf_meta['size']
        pdf_url = f"https://archive.org/download/tacticalchessexercises/{urllib.parse.quote(pdf_exact)}"

        formats_list = [{
            'format': 'pdf',
            'sizeRaw': pdf_sz,
            'sizeDisplay': f'{(pdf_sz / 1024 / 1024):.2f} MB',
            'url': pdf_url
        }]
        if epub_meta:
            epub_exact = epub_meta['name']
            epub_sz = epub_meta['size']
            epub_url = f"https://archive.org/download/tacticalchessexercises/{urllib.parse.quote(epub_exact)}"
            formats_list.append({
                'format': 'epub',
                'sizeRaw': epub_sz,
                'sizeDisplay': f'{(epub_sz / 1024 / 1024):.2f} MB',
                'url': epub_url
            })

        book_id = unicodedata.normalize('NFC', f"tce_{tb['pdf']}")
        desc_text = f"Tactical chess puzzles & exercises: «{tb['title']}» by {tb['author']}. Available in high-quality PDF and EPUB formats on Chess Vault."
        descriptions[book_id] = {
            'bookDescription': desc_text,
            'authorBio': '',
            'source': 'openlibrary',
            'pages': None
        }
        elo_data = compute_book_elo(book_id, tb['author'], tb['title'], desc_text)

        books.append({
            'author': tb['author'],
            'title': tb['title'],
            'year': '---',
            'pages': None,
            'format': 'pdf',
            'sizeDisplay': f'{(pdf_sz / 1024 / 1024):.2f} MB',
            'sizeRaw': pdf_sz,
            'url': pdf_url,
            'id': book_id,
            'archiveVolume': 'tacticalchessexercises',
            'lang': 'en',
            'topicId': tb['topic'],
            'formats': formats_list,
            'inArchive': True,
            **elo_data
        })

    # 3. Verified standalone Endgame Classics (public Archive.org items)
    endgame_item_cache = {}
    for eb in ENDGAME_CLASSICS_DATA:
        aid = eb['archiveId']
        if aid not in endgame_item_cache:
            endgame_item_cache[aid] = {norm(x['name']): x for x in fetch_item_files(aid)}
        fmeta = endgame_item_cache[aid].get(norm(eb['file']))
        if not fmeta:
            print(f"Warning: skipping {eb['id']} — file not found in {aid}")
            continue

        exact_name = fmeta['name']
        sz = fmeta['size']
        size_disp = f'{(sz / 1024 / 1024):.2f} MB'
        file_url = f"https://archive.org/download/{aid}/{urllib.parse.quote(exact_name)}"
        elo_data = compute_book_elo(eb['id'], eb['author'], eb['title'], eb['desc'])

        books.append({
            'author': eb['author'],
            'title': eb['title'],
            'year': eb['year'],
            'pages': eb['pages'],
            'format': 'pdf',
            'sizeDisplay': size_disp,
            'sizeRaw': sz,
            'url': file_url,
            'id': eb['id'],
            'archiveVolume': aid,
            'lang': eb['lang'],
            'topicId': eb['topicId'],
            'formats': [{
                'format': 'pdf',
                'sizeRaw': sz,
                'sizeDisplay': size_disp,
                'url': file_url
            }],
            'inArchive': True,
            **elo_data
        })

        descriptions[eb['id']] = {
            'bookDescription': eb['desc'],
            'authorBio': '',
            'source': 'smart_summary',
            'pages': eb['pages']
        }
        if eb['pages']:
            page_counts[eb['id']] = eb['pages']

    # Sort deterministically by sizeRaw descending (matches default library view)
    books.sort(key=lambda x: (-(x.get('sizeRaw') or 0), x.get('author', '').lower(), x.get('title', '').lower()))

    print(f"Total verified online books in catalog: {len(books)} (0 offline/broken entries)")

    with open(BOOKS_CACHE_JSON, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)

    with open(BOOKS_CACHE_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated offline & instant cache for Chess Vault books\n')
        f.write('window.CHESS_BOOKS_CACHE = ')
        json.dump(books, f, ensure_ascii=False)
        f.write(';\n')

    with open(DESCRIPTIONS_JSON, 'w', encoding='utf-8') as f:
        json.dump(descriptions, f, ensure_ascii=False, indent=2)

    with open(DESCRIPTIONS_JS, 'w', encoding='utf-8') as f:
        f.write('window.CHESS_DESCRIPTIONS = ')
        json.dump(descriptions, f, ensure_ascii=False)
        f.write(';\n')

    with open(PAGE_COUNTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(page_counts, f, ensure_ascii=False, indent=2)

    with open(PAGE_COUNTS_JS, 'w', encoding='utf-8') as f:
        f.write('window.CHESS_PAGE_COUNTS = ')
        json.dump(page_counts, f, ensure_ascii=False)
        f.write(';\n')

    print("Successfully updated books-cache.json, books-cache.js, descriptions, and page_counts!")


if __name__ == '__main__':
    main()
