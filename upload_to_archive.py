#!/usr/bin/env python3
"""
Upload script for Chess Vault books from flash drive to Internet Archive.
Target item: 1971_20260223
"""

import os
import sys
import json
import time
import urllib.request
import re

ARCHIVE_ITEM = '1971_20260223'
FLASH_DRIVE_PATH = '/Volumes/NO NAME/Chess'
ALLOWED_EXTS = ('.pdf', '.djvu', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx', '.chm')
IGNORED_NAMES = {'1-порядок.txt', 'інфо.rtf', 'інфо.txt', 'info.txt', 'readme.txt'}
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), 'upload_progress.json')

def get_current_archive_files():
    """Fetch all files currently in the Internet Archive item."""
    url = f'https://archive.org/metadata/{ARCHIVE_ITEM}'
    print(f'🔍 Опитування Internet Archive ({ARCHIVE_ITEM})...')
    req = urllib.request.Request(url, headers={'User-Agent': 'ChessVaultUploader/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode('utf-8'))
    
    files = set()
    for f in data.get('files', []):
        fname = f.get('name', '')
        if fname.lower().endswith(ALLOWED_EXTS):
            files.add(fname.lower())
    print(f'✅ В архіві вже знаходиться: {len(files)} книг')
    return files

def scan_flash_drive():
    """Scan flash drive for all book files."""
    if not os.path.exists(FLASH_DRIVE_PATH):
        print(f'❌ Помилка: флешку не знайдено за шляхом: {FLASH_DRIVE_PATH}')
        print('Будь ласка, перевірте чи підключено флешку "NO NAME".')
        sys.exit(1)
        
    print(f'📂 Сканування флешки: {FLASH_DRIVE_PATH}...')
    files_by_name = {} # lowercase filename -> (original_name, full_path, size)
    
    for root, dirs, files in os.walk(FLASH_DRIVE_PATH):
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
                    lower = f.lower()
                    if lower not in files_by_name:
                        files_by_name[lower] = (f, full_path, size)
                except OSError:
                    continue
                    
    print(f'✅ Знайдено унікальних книг на флешці: {len(files_by_name)}')
    return files_by_name

def check_auth():
    """Verify Internet Archive credentials."""
    try:
        import internetarchive as ia
        session = ia.get_session()
        # Check if s3 config exists
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
                return set(json.load(f))
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
    
    print('=' * 60)
    print(f'♟️  CHESS VAULT — СИНХРОНІЗАЦІЯ З INTERNET ARCHIVE')
    print(f'   Цільовий репозиторій: {ARCHIVE_ITEM}')
    if dry_run:
        print('   РЕЖИМ: ТЕСТОВИЙ (DRY-RUN, без реального завантаження)')
    print('=' * 60)
    
    # 1. Перевірка авторизації
    if not dry_run:
        is_authed, auth_msg = check_auth()
        if not is_authed:
            print('\n⚠️  Увага: відсутня авторизація в Internet Archive!')
            print(f'Деталі: {auth_msg}\n')
            sys.exit(1)
            
    # 2. Отримуємо файли з архіву та флешки
    archive_files = get_current_archive_files()
    flash_files = scan_flash_drive()
    progress_saved = load_progress()
    
    # 3. Визначаємо список до завантаження
    to_upload = []
    already_uploaded_count = 0
    
    for lower_name, (orig_name, full_path, size) in flash_files.items():
        if lower_name in archive_files or lower_name in progress_saved:
            already_uploaded_count += 1
        else:
            to_upload.append((orig_name, full_path, size))
            
    total_upload_bytes = sum(s for _, _, s in to_upload)
    total_gb = total_upload_bytes / (1024 ** 3)
    
    print('\n📊 ПІДСУМОК ЗВІРКИ:')
    print(f'   • Вже завантажено (пропускаються): {already_uploaded_count} книг')
    print(f'   • Залишилося завантажити:          {len(to_upload)} книг ({total_gb:.2f} ГБ)')
    
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
        print('\nТестовий запуск завершено. Перші книги черги:')
        for orig, path, size in to_upload[:10]:
            print(f'   - {orig} ({(size/1024/1024):.1f} MB)')
        print(f'\nЩоб почати реальне завантаження, запустіть без прапорця --dry-run:')
        print('  python3 upload_to_archive.py')
        return

    # 4. Процес завантаження
    import internetarchive as ia
    print('\n🚀 ПОЧАТОК ЗАВАНТАЖЕННЯ...')
    print('   (Можна будь-коли зупинити комбінацією Ctrl+C і продовжити пізніше)\n')
    
    success_count = 0
    fail_count = 0
    
    for idx, (orig_name, full_path, size) in enumerate(to_upload, 1):
        mb = size / 1024 / 1024
        print(f'\n[{idx}/{len(to_upload)}] ({(idx/len(to_upload)*100):.1f}%) {orig_name} ({mb:.1f} MB):')
        
        try:
            # Автоматично вилучаємо обкладинку (1-шу сторінку) у папку covers/
            try:
                import extract_covers
                cover_name, has_cover = extract_covers.extract_single_cover(full_path, orig_name)
                if has_cover:
                    print(f'   🎨 Обкладинка: збережена у covers/{cover_name}')
            except Exception as ce:
                pass

            # Автоматично зберігаємо кількість сторінок книги
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

            ia.upload(
                ARCHIVE_ITEM,
                files={orig_name: full_path},
                retries=5,
                verify=True,
                verbose=True
            )
            print('✅ OK')
            success_count += 1
            progress_saved.add(orig_name.lower())
            save_progress(progress_saved)
        except KeyboardInterrupt:
            print('\n\n⏸️  Завантаження призупинено користувачем.')
            print(f'Успішно передано у цій сесії: {success_count} книг.')
            print('При наступному запуску скрипт автоматично продовжить з потрібного місця!')
            sys.exit(0)
        except Exception as e:
            print(f' ❌ Помилка: {e}')
            fail_count += 1
            time.sleep(2)
            
    print('\n' + '=' * 60)
    print(f'🏁 ЗАВЕРШЕНО! Успішно завантажено: {success_count}, Помилок: {fail_count}')
    print('Всі нові книги вже доступні на сайті http://localhost:3000/library.html')
    print('=' * 60)

if __name__ == '__main__':
    main()
