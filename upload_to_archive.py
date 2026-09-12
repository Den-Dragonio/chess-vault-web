#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Upload script for Chess Vault books from flash drive to Internet Archive.
Target repository: Volume 2 (1971_20260223_vol2)
Automatically skips all books already present in Volume 1 (1971_20260223)
or already uploaded to Volume 2.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import unicodedata
import re

ARCHIVE_VOL1 = '1971_20260223'
ARCHIVE_VOL2 = '1971_20260223_vol2'
TARGET_ITEM = ARCHIVE_VOL2

FLASH_DRIVE_PATHS = [
    '/Volumes/NO NAME/Chess',
    '/Volumes/NO NAME/Chess Book',
    '/Volumes/NO NAME'
]
ALLOWED_EXTS = ('.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx', '.chm', '.djv')
IGNORED_NAMES = {'1-порядок.txt', 'інфо.rtf', 'інфо.txt', 'info.txt', 'readme.txt'}
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), 'upload_progress.json')

VOL2_METADATA = {
    'title': 'Chess Vault — Library (Volume 2)',
    'mediatype': 'texts',
    'collection': 'opensource',
    'creator': 'Chess Vault',
    'description': 'Chess Vault digital chess book collection — Volume 2 / Шахова бібліотека (Том 2)'
}

def normalize_name(s):
    if not s:
        return ''
    return unicodedata.normalize('NFC', s).strip().lower()

def get_item_files(item_id, fallback_local=False):
    """Fetch files currently in a specific Internet Archive item."""
    url = f'https://archive.org/metadata/{item_id}'
    print(f'🔍 Опитування Internet Archive ({item_id})...')
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVaultUploader/2.0'})
    
    files = set()
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode('utf-8'))
            for f in data.get('files', []):
                fname = f.get('name', '')
                if fname.lower().endswith(ALLOWED_EXTS):
                    files.add(normalize_name(fname))
        print(f'✅ В архіві ({item_id}) знайдено: {len(files)} книг')
    except Exception as e:
        print(f'⚠️  Не вдалося опитати live API {item_id} ({e}).')
        if fallback_local and item_id == ARCHIVE_VOL1:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            desc_path = os.path.join(base_dir, 'descriptions.json')
            if os.path.exists(desc_path):
                try:
                    with open(desc_path, 'r', encoding='utf-8') as f:
                        desc_data = json.load(f)
                        for k in desc_data.keys():
                            files.add(normalize_name(k))
                    print(f'ℹ️  Використано локальний каталог для {item_id}: {len(files)} книг')
                except Exception:
                    pass
    return files

def find_flash_drive():
    for p in FLASH_DRIVE_PATHS:
        if os.path.exists(p):
            return p
    return None

def scan_flash_drive(flash_root):
    """Scan flash drive for all book files."""
    print(f'📂 Сканування флешки: {flash_root}...')
    files_by_norm = {} # normalized name -> (original_name, full_path, size)
    
    for root, dirs, files in os.walk(flash_root):
        for f in files:
            if f.startswith('.'):
                continue
            if f.lower().endswith(ALLOWED_EXTS):
                if f.lower() in IGNORED_NAMES:
                    continue
                full_path = os.path.join(root, f)
                try:
                    size = os.path.getsize(full_path)
                    if size < 500 and f.lower().endswith('.txt'):
                        continue
                    norm = normalize_name(f)
                    if norm not in files_by_norm:
                        files_by_norm[norm] = (f, full_path, size)
                except OSError:
                    continue
                    
    print(f'✅ Знайдено унікальних книг на флешці: {len(files_by_norm)}')
    return files_by_norm

def check_auth():
    """Verify Internet Archive credentials."""
    try:
        import internetarchive as ia
        session = ia.get_session()
        s3 = session.config.get('s3', {})
        if not s3.get('access') or not s3.get('secret'):
            return False, 'Ключі S3 не знайдено у конфігурації (~/.config/ia.ini)'
        return True, 'OK'
    except Exception as e:
        return False, str(e)

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                return set(normalize_name(x) for x in json.load(f))
        except Exception:
            pass
    return set()

def save_progress(progress_set):
    try:
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(sorted(list(progress_set)), f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def main():
    dry_run = '--dry-run' in sys.argv
    
    print('=' * 65)
    print('♟️  CHESS VAULT — СИНХРОНІЗАЦІЯ З INTERNET ARCHIVE (ТОМ №2)')
    print(f'   Базовий архів (Том 1):  {ARCHIVE_VOL1}')
    print(f'   Цільовий архів (Том 2): {TARGET_ITEM}')
    if dry_run:
        print('   РЕЖИМ: ТЕСТОВИЙ (DRY-RUN, без реального завантаження)')
    print('=' * 65)
    
    # 1. Перевірка авторизації
    if not dry_run:
        is_authed, auth_msg = check_auth()
        if not is_authed:
            print('\n⚠️  Увага: відсутня авторизація в Internet Archive!')
            print(f'Деталі: {auth_msg}\n')
            sys.exit(1)
            
    # 2. Отримуємо файли з обох томів та флешки
    vol1_files = get_item_files(ARCHIVE_VOL1, fallback_local=True)
    vol2_files = get_item_files(ARCHIVE_VOL2, fallback_local=False)
    
    flash_path = find_flash_drive()
    if not flash_path:
        print(f'❌ Помилка: флешку не знайдено за шляхами: {FLASH_DRIVE_PATHS}')
        sys.exit(1)

    flash_files = scan_flash_drive(flash_path)
    progress_saved = load_progress()
    
    # 3. Визначаємо список до завантаження у Том №2
    to_upload = []
    already_vol1_count = 0
    already_vol2_count = 0
    
    for norm_name, (orig_name, full_path, size) in flash_files.items():
        if norm_name in vol2_files or norm_name in progress_saved:
            already_vol2_count += 1
        elif norm_name in vol1_files:
            already_vol1_count += 1
        else:
            to_upload.append((orig_name, full_path, size))
            
    total_upload_bytes = sum(s for _, _, s in to_upload)
    total_gb = total_upload_bytes / (1024 ** 3)
    
    print('\n📊 ПІДСУМОК ЗВІРКИ:')
    print(f'   • Вже завантажено у Том 1 ({ARCHIVE_VOL1}): {already_vol1_count} книг')
    print(f'   • Вже завантажено у Том 2 ({ARCHIVE_VOL2}): {already_vol2_count} книг')
    print(f'   • Залишилося завантажити у Том 2:         {len(to_upload)} книг ({total_gb:.2f} ГБ)')
    
    if not to_upload:
        print('\n🎉 Всі книги з флешки вже повністю завантажені в архів!')
        return

    limit = None
    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            limit = 10

    if limit and limit < len(to_upload):
        print(f'   ⚙️  Встановлено ліміт: {limit} книг для цієї сесії')
        to_upload = to_upload[:limit]

    if dry_run:
        print('\nТестовий запуск завершено. Перші книги черги для Тому 2:')
        for orig, path, size in to_upload[:15]:
            print(f'   - {orig} ({(size/1024/1024):.1f} MB)')
        print(f'\nЩоб почати завантаження, запустіть без прапорця --dry-run:')
        print('  python3 upload_to_archive.py')
        print('Або завантажте тестову партію з 5 книг:')
        print('  python3 upload_to_archive.py --limit 5')
        return

    # 4. Процес завантаження
    import internetarchive as ia
    print(f'\n🚀 ПОЧАТОК ЗАВАНТАЖЕННЯ У ТОМ №2 ({TARGET_ITEM})...')
    print('   (Можна будь-коли зупинити комбінацією Ctrl+C і продовжити пізніше)\n')
    
    # Перевіряємо чи існує Том 2, якщо ні — передаємо початкові метадані
    item = ia.get_item(TARGET_ITEM)
    item_exists = item.exists
    if not item_exists:
        print(f'✨ Ініціалізація нового тому: {TARGET_ITEM} з метаданими...')

    success_count = 0
    fail_count = 0
    
    for idx, (orig_name, full_path, size) in enumerate(to_upload, 1):
        mb = size / 1024 / 1024
        print(f'\n[{idx}/{len(to_upload)}] ({(idx/len(to_upload)*100):.1f}%) {orig_name} ({mb:.1f} MB):')
        
        try:
            # 1. Обкладинка (1-ша сторінка) у папку covers/
            try:
                import extract_covers
                cover_name, has_cover = extract_covers.extract_single_cover(full_path, orig_name)
                if has_cover:
                    print(f'   🎨 Обкладинка: збережена у covers/{cover_name}')
            except Exception:
                pass

            # 2. Кількість сторінок книги
            try:
                import extract_page_counts
                p_cnt = extract_page_counts.extract_single_file_pages(full_path)
                if p_cnt:
                    counts = extract_page_counts.load_page_counts()
                    counts[orig_name] = p_cnt
                    counts[orig_name.lower()] = p_cnt
                    extract_page_counts.save_page_counts(counts)
                    print(f'   📖 Обсяг: {p_cnt} сторінок')
            except Exception:
                pass

            # 3. Завантаження в Internet Archive
            upload_kwargs = {
                'files': {orig_name: full_path},
                'retries': 5,
                'verify': True,
                'verbose': True
            }
            if not item_exists and idx == 1:
                upload_kwargs['metadata'] = VOL2_METADATA

            ia.upload(TARGET_ITEM, **upload_kwargs)
            item_exists = True

            print('✅ OK')
            success_count += 1
            progress_saved.add(normalize_name(orig_name))
            save_progress(progress_saved)

            # Пауза між завантаженнями для уникнення перевантаження черги Archive.org
            time.sleep(1.5)

        except KeyboardInterrupt:
            print('\n\n⏸️  Завантаження призупинено користувачем.')
            print(f'Успішно передано у цій сесії: {success_count} книг.')
            print('При наступному запуску скрипт автоматично продовжить з потрібного місця!')
            sys.exit(0)
        except Exception as e:
            print(f' ❌ Помилка: {e}')
            fail_count += 1
            time.sleep(3)
            
    # Автоматичне оновлення кешу після завантаження
    try:
        import generate_books_cache
        generate_books_cache.main()
    except Exception:
        pass

    print('\n' + '=' * 65)
    print(f'🏁 ЗАВЕРШЕНО! Успішно завантажено у Том 2: {success_count}, Помилок: {fail_count}')
    print('=' * 65)

if __name__ == '__main__':
    main()
