#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chess Vault — Scraper & Inventory Checker
Перевіряє всі шахові книги на флешці "NO NAME" у папці Chess,
групує їх за папками та підпапками, звіряє з базою Internet Archive
(live API або локальний кеш) і формує наочний текстовий документ зі статусами [✓] / [ ],
форматами файлів та розмірами.
"""

import os
import sys
import json
import unicodedata
import urllib.request
import urllib.parse
from datetime import datetime
from collections import defaultdict, Counter

DEFAULT_FLASH_PATHS = [
    '/Volumes/NO NAME/Chess',
    '/Volumes/NO NAME/Chess Book',
    '/Volumes/NO NAME'
]
DEFAULT_ARCHIVE_ID = '1971_20260223'
DEFAULT_OUTPUT_FILE = 'books_inventory.txt'

ALLOWED_EXTENSIONS = (
    '.pdf', '.djvu', '.djv', '.epub', '.cbr', '.cbz',
    '.txt', '.doc', '.docx', '.chm', '.rtf'
)
IGNORED_FILES = {
    '1-порядок.txt', 'інфо.rtf', 'інфо.txt', 'info.txt',
    'readme.txt', '.ds_store', 'thumbs.db'
}

def normalize_name(name):
    """Нормалізація імені для точного зіставлення (NFC, нижній регістр, без зайвих пробілів)."""
    if not name:
        return ''
    return unicodedata.normalize('NFC', name).strip().lower()

def format_size(bytes_size):
    """Красиве форматування розміру файлу."""
    if bytes_size >= 1024 * 1024 * 1024:
        return f"{bytes_size / (1024 * 1024 * 1024):.2f} GB"
    elif bytes_size >= 1024 * 1024:
        return f"{bytes_size / (1024 * 1024):.2f} MB"
    elif bytes_size >= 1024:
        return f"{bytes_size / 1024:.1f} KB"
    else:
        return f"{bytes_size} B"

def find_flash_drive_path(custom_path=None):
    """Пошук директорії з книгами на флешці."""
    if custom_path and os.path.exists(custom_path):
        return custom_path
    for p in DEFAULT_FLASH_PATHS:
        if os.path.exists(p):
            return p
    return None

def fetch_archive_books(archive_id=DEFAULT_ARCHIVE_ID):
    """
    Отримує множину назв файлів, які вже завантажені в Internet Archive.
    Спочатку робить запит до live API. Якщо сервери архіву недоступні (502/503),
    безпечно використовує локальну базу (descriptions.json / books-cache.json).
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    desc_path = os.path.join(base_dir, 'descriptions.json')
    cache_path = os.path.join(base_dir, 'books-cache.json')
    prog_path = os.path.join(base_dir, 'upload_progress.json')

    archive_files = set()
    archive_normalized = set()
    source_info = ""

    # Спроба отримати з live API archive.org
    url = f"https://archive.org/metadata/{archive_id}"
    print(f"🌐 Опитування Internet Archive ({url})...")
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVaultInventory/2.0'})
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for f in data.get('files', []):
                fname = f.get('name', '')
                if fname.lower().endswith(ALLOWED_EXTENSIONS):
                    archive_files.add(fname)
                    archive_normalized.add(normalize_name(fname))
            source_info = f"Internet Archive Live API ({len(archive_files)} файлів)"
            print(f"✅ Успішно отримано з Internet Archive: {len(archive_files)} книг")
    except Exception as e:
        print(f"⚠️  Live API Archive.org недоступний ({e}). Використовуємо локальну базу...")
        
        # Fallback 1: descriptions.json
        if os.path.exists(desc_path):
            try:
                with open(desc_path, 'r', encoding='utf-8') as f:
                    desc_data = json.load(f)
                    for k in desc_data.keys():
                        archive_files.add(k)
                        archive_normalized.add(normalize_name(k))
                source_info = f"Локальна база descriptions.json ({len(archive_files)} книг)"
            except Exception as ex:
                print(f"Помилка читання descriptions.json: {ex}")

        # Fallback 2: books-cache.json
        if not archive_files and os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                    for item in cache_data:
                        fname = item.get('id', '')
                        if fname:
                            archive_files.add(fname)
                            archive_normalized.add(normalize_name(fname))
                source_info = f"Локальна база books-cache.json ({len(archive_files)} книг)"
            except Exception as ex:
                print(f"Помилка читання books-cache.json: {ex}")

        # Fallback 3: upload_progress.json
        if os.path.exists(prog_path):
            try:
                with open(prog_path, 'r', encoding='utf-8') as f:
                    prog_data = json.load(f)
                    for k in prog_data:
                        archive_files.add(k)
                        archive_normalized.add(normalize_name(k))
            except Exception:
                pass

        print(f"ℹ️  Завантажено з резервного сховища: {len(archive_files)} книг")

    return archive_normalized, source_info, len(archive_files)

def scan_flash_drive(flash_root):
    """
    Рекурсивно сканує флешку, групує книги за папками і підпапками.
    Повертає структуру: folder_rel_path -> [list of book info dicts].
    """
    print(f"📂 Сканування флешки: {flash_root}...")
    folders_dict = defaultdict(list)
    total_books = 0
    total_bytes = 0
    format_counter = Counter()

    for root, dirs, files in os.walk(flash_root):
        dirs.sort()
        files.sort()

        rel_path = os.path.relpath(root, flash_root)
        if rel_path == '.':
            folder_title = "Корінь каталогу (Chess)"
        else:
            folder_title = rel_path

        for filename in files:
            if filename.startswith('.'):
                continue
            
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue

            if filename.lower() in IGNORED_FILES:
                continue

            full_path = os.path.join(root, filename)
            try:
                fsize = os.path.getsize(full_path)
            except Exception:
                fsize = 0

            # Фільтруємо дрібні текстові службові файли
            if ext == '.txt' and fsize < 500:
                continue

            clean_ext = ext.lstrip('.').upper()
            book_info = {
                'filename': filename,
                'normalized': normalize_name(filename),
                'format': clean_ext,
                'size': fsize,
                'size_str': format_size(fsize),
                'full_path': full_path,
                'folder': folder_title
            }

            folders_dict[folder_title].append(book_info)
            total_books += 1
            total_bytes += fsize
            format_counter[clean_ext] += 1

    return folders_dict, total_books, total_bytes, format_counter

def generate_inventory_report(folders_dict, archive_normalized, source_info, total_books, total_bytes, format_counter, output_path):
    """Формує структурований текстовий документ зі статусами та статистикою."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    uploaded_count = 0
    missing_count = 0
    uploaded_bytes = 0
    missing_bytes = 0

    folder_stats = []

    # Попередня розмітка статусу для кожної книги
    for folder, books in folders_dict.items():
        f_up = 0
        f_sz = 0
        f_miss_sz = 0
        for b in books:
            is_uploaded = b['normalized'] in archive_normalized
            b['is_uploaded'] = is_uploaded
            f_sz += b['size']
            if is_uploaded:
                uploaded_count += 1
                uploaded_bytes += b['size']
                f_up += 1
            else:
                missing_count += 1
                missing_bytes += b['size']
                f_miss_sz += b['size']
        
        f_miss = len(books) - f_up
        folder_stats.append({
            'folder': folder,
            'total': len(books),
            'uploaded': f_up,
            'missing': f_miss,
            'size': f_sz,
            'missing_size': f_miss_sz
        })

    lines = []
    w = 95
    lines.append("=" * w)
    lines.append(" 📚 CHESS VAULT — ЗВЕДЕНИЙ ЗВІТ НАЯВНОСТІ ТА СИНХРОНІЗАЦІЇ КНИГ")
    lines.append("=" * w)
    lines.append(f" Дата генерації : {now_str}")
    lines.append(f" Джерело архіву : {source_info}")
    lines.append(f" Загалом книг   : {total_books:,} шт. ({format_size(total_bytes)})")
    lines.append(f" [✓] В архіві   : {uploaded_count:,} шт. ({format_size(uploaded_bytes)}) — {(uploaded_count/total_books*100) if total_books else 0:.1f}%")
    lines.append(f" [ ] Залишилось : {missing_count:,} шт. ({format_size(missing_bytes)}) — {(missing_count/total_books*100) if total_books else 0:.1f}%")
    lines.append("-" * w)
    
    # Формати (розширення)
    fmt_str = " | ".join([f"{fmt}: {cnt}" for fmt, cnt in format_counter.most_common()])
    lines.append(f" Розширення файлів : {fmt_str}")
    lines.append("=" * w)
    lines.append("")
    lines.append("ПОЗНАЧЕННЯ:")
    lines.append("  [✓] — Книга вже додана до Internet Archive (доступна в каталозі)")
    lines.append("  [ ] — Книга ще НЕ додана до Internet Archive (очікує завантаження)")
    lines.append("")

    # Топ папок, де найбільше незавантажених книг
    top_missing_folders = sorted([fs for fs in folder_stats if fs['missing'] > 0], key=lambda x: x['missing'], reverse=True)
    if top_missing_folders:
        lines.append("=" * w)
        lines.append(f" ⏳ ТОП-15 ПАПОК, ЯКІ ЩЕ ПОТРЕБУЮТЬ ЗАВАНТАЖЕННЯ (всього незавантажених: {missing_count})")
        lines.append("=" * w)
        for idx, fs in enumerate(top_missing_folders[:15], 1):
            pct = (fs['uploaded'] / fs['total'] * 100) if fs['total'] else 0
            lines.append(f" {idx:>2}. {fs['folder']}")
            lines.append(f"     Залишилось: {fs['missing']} з {fs['total']} ({pct:.0f}% готово) | Вага залишку: {format_size(fs['missing_size'])}")
        lines.append("")

    lines.append("=" * w)
    lines.append(" ДЕТАЛЬНИЙ ЗМІСТ ПО ПАПКАХ ТА ПІДПАПКАХ")
    lines.append("=" * w)

    # Сортування папок за назвою
    sorted_folders = sorted(folders_dict.keys())

    for folder in sorted_folders:
        books = folders_dict[folder]
        f_uploaded = sum(1 for b in books if b['is_uploaded'])
        f_total = len(books)
        f_pct = (f_uploaded / f_total * 100) if f_total else 0
        f_size = sum(b['size'] for b in books)

        lines.append("")
        lines.append("-" * w)
        lines.append(f"📁 {folder}")
        lines.append(f"   Прогрес: {f_uploaded}/{f_total} ({f_pct:.0f}%) | Загальна вага папки: {format_size(f_size)}")
        lines.append("-" * w)

        # Сортуємо книги в папці за алфавітом
        books_sorted = sorted(books, key=lambda x: x['filename'].lower())
        for b in books_sorted:
            mark = "[✓]" if b['is_uploaded'] else "[ ]"
            fmt = f"[{b['format']:<4}]"
            sz = f"({b['size_str']:>9})"
            lines.append(f"  {mark} {fmt} {b['filename']} {sz}")

    lines.append("")
    lines.append("=" * w)
    lines.append(f" КІНЕЦЬ ЗВІТУ — Всього перевірено {total_books} книг у {len(sorted_folders)} папках")
    lines.append("=" * w)

    report_text = "\n".join(lines)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_text)

    return uploaded_count, missing_count, len(sorted_folders)

def main():
    print("=" * 70)
    print("♟️  CHESS VAULT — СКРАПЕР ТА ІНВЕНТАРИЗАТОР КНИГ")
    print("=" * 70)

    # 1. Пошук флешки
    flash_path = None
    if len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        flash_path = sys.argv[1]

    flash_root = find_flash_drive_path(flash_path)
    if not flash_root:
        print("❌ Помилка: флешку 'NO NAME' з папкою Chess не знайдено.")
        print(f"   Перевірені шляхи: {DEFAULT_FLASH_PATHS}")
        print("   Ви можете вказати шлях вручну: python3 check_books_inventory.py /path/to/folder")
        sys.exit(1)

    print(f"📍 Виявлено шлях: {flash_root}")

    # 2. Опитування Internet Archive
    archive_normalized, source_info, archive_count = fetch_archive_books(DEFAULT_ARCHIVE_ID)

    # 3. Сканування файлів на флешці
    folders_dict, total_books, total_bytes, format_counter = scan_flash_drive(flash_root)

    if total_books == 0:
        print("⚠️  У вказаній папці не знайдено шахових книг.")
        sys.exit(0)

    # 4. Формування звіту
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, DEFAULT_OUTPUT_FILE)

    uploaded, missing, folder_count = generate_inventory_report(
        folders_dict, archive_normalized, source_info,
        total_books, total_bytes, format_counter, output_path
    )

    print("\n" + "=" * 70)
    print("🎉 ЗВІТ УСПІШНО ЗГЕНЕРОВАНО!")
    print(f"📄 Файл звіту: {output_path}")
    print(f"📁 Оброблено папок  : {folder_count}")
    print(f"📚 Всього книг      : {total_books:,}")
    print(f"✅ Вже в архіві [✓] : {uploaded:,} ({(uploaded/total_books*100):.1f}%)")
    print(f"⏳ Залишилось   [ ] : {missing:,} ({(missing/total_books*100):.1f}%)")
    print("=" * 70)

if __name__ == '__main__':
    main()
