#!/usr/bin/env python3
"""
Chess Vault — Page Count Scraper & Extractor
Extracts page counts from local PDF/DJVU files on flash drive,
and optionally from Google Books / Open Library for books without local files.
Outputs:
  - page_counts.json
  - page_counts.js (window.CHESS_PAGE_COUNTS)
  - updates descriptions.json & descriptions.js
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.parse
import re

try:
    import pypdf
except ImportError:
    pypdf = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FLASH_DRIVE_PATH = '/Volumes/NO NAME/Chess'
PAGE_COUNTS_JSON = os.path.join(BASE_DIR, 'page_counts.json')
PAGE_COUNTS_JS = os.path.join(BASE_DIR, 'page_counts.js')
DESCRIPTIONS_JSON = os.path.join(BASE_DIR, 'descriptions.json')
DESCRIPTIONS_JS = os.path.join(BASE_DIR, 'descriptions.js')

ALLOWED_EXTS = ('.pdf', '.djvu', '.epub')

def load_page_counts():
    if os.path.exists(PAGE_COUNTS_JSON):
        try:
            with open(PAGE_COUNTS_JSON, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Помилка читання {PAGE_COUNTS_JSON}: {e}")
    return {}

def save_page_counts(counts):
    with open(PAGE_COUNTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(counts, f, ensure_ascii=False, indent=2)

    # Також генеруємо компактний page_counts.js для фронтенду
    js_content = f"// Auto-generated page counts for Chess Vault books\nwindow.CHESS_PAGE_COUNTS = {json.dumps(counts, ensure_ascii=False)};\n"
    with open(PAGE_COUNTS_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)

def extract_pdf_pages(file_path):
    if not pypdf:
        return None
    try:
        reader = pypdf.PdfReader(file_path)
        count = len(reader.pages)
        if count > 0:
            return count
    except Exception:
        pass
    return None

def extract_djvu_pages(file_path):
    try:
        res = subprocess.run(['djvused', '-e', 'n', file_path], capture_output=True, text=True, timeout=10)
        out = res.stdout.strip()
        if out.isdigit():
            count = int(out)
            if count > 0:
                return count
    except Exception:
        pass
    return None

def extract_single_file_pages(file_path):
    lower = file_path.lower()
    if lower.endswith('.pdf'):
        return extract_pdf_pages(file_path)
    elif lower.endswith('.djvu'):
        return extract_djvu_pages(file_path)
    return None

def fetch_online_page_count(title, author=""):
    """Fetch page count from Google Books API as fallback"""
    if not title or len(title) < 3:
        return None
    clean_title = re.sub(r'[^\w\s]', ' ', title).strip()
    clean_author = re.sub(r'[^\w\s]', ' ', author).strip()
    
    q = f"intitle:{clean_title}"
    if clean_author and len(clean_author) > 2:
        q += f"+inauthor:{clean_author}"
        
    url = f"https://www.googleapis.com/books/v1/volumes?q={urllib.parse.quote(q)}&maxResults=3"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ChessVault/1.0'})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode())
            for item in data.get('items', []):
                vol = item.get('volumeInfo', {})
                p = vol.get('pageCount')
                if p and p > 0:
                    return int(p)
    except Exception:
        pass
    return None

def sync_descriptions_with_pages(counts):
    """Update descriptions.json and descriptions.js with page count if present"""
    if not os.path.exists(DESCRIPTIONS_JSON):
        return
    try:
        with open(DESCRIPTIONS_JSON, 'r', encoding='utf-8') as f:
            descs = json.load(f)
        
        updated = 0
        for book_id, info in descs.items():
            if book_id in counts and counts[book_id]:
                if info.get('pages') != counts[book_id]:
                    info['pages'] = counts[book_id]
                    updated += 1
            else:
                lower_id = book_id.lower()
                for k, cnt in counts.items():
                    if k.lower() == lower_id and cnt:
                        if info.get('pages') != cnt:
                            info['pages'] = cnt
                            updated += 1
                        break

        if updated > 0:
            with open(DESCRIPTIONS_JSON, 'w', encoding='utf-8') as f:
                json.dump(descs, f, ensure_ascii=False, indent=2)
            with open(DESCRIPTIONS_JS, 'w', encoding='utf-8') as f:
                f.write(f"// Auto-generated descriptions for Chess Vault books\nwindow.CHESS_DESCRIPTIONS = {json.dumps(descs, ensure_ascii=False)};\n")
            print(f"📖 Оновлено описів з кількістю сторінок: {updated}")
    except Exception as e:
        print(f"Помилка синхронізації з описами: {e}")

def main():
    print("=" * 60)
    print("📖 CHESS VAULT — СКРАПЕР ТА ЕКСТРАКТОР КІЛЬКОСТІ СТОРІНОК")
    print("=" * 60)

    counts = load_page_counts()
    print(f"Знайдено в кеші: {len(counts)} записів")

    # 1. Скануємо флешку, якщо підключена
    if os.path.exists(FLASH_DRIVE_PATH):
        print(f"📂 Сканування флешки: {FLASH_DRIVE_PATH}...")
        found_files = []
        for root, _, files in os.walk(FLASH_DRIVE_PATH):
            for f in files:
                if f.startswith('.'):
                    continue
                if f.lower().endswith(ALLOWED_EXTS):
                    found_files.append((f, os.path.join(root, f)))
        
        print(f"Знайдено книг на флешці: {len(found_files)}")
        to_process = [(name, path) for name, path in found_files if name not in counts and name.lower() not in counts]
        print(f"Потребують визначення сторінок: {len(to_process)}")

        limit = None
        if '--limit' in sys.argv:
            try:
                idx = sys.argv.index('--limit')
                limit = int(sys.argv[idx + 1])
                to_process = to_process[:limit]
            except (IndexError, ValueError):
                pass

        from concurrent.futures import ThreadPoolExecutor, as_completed
        success = 0
        total = len(to_process)
        print(f"🚀 Початок швидкого аналізу сторінок у 4 потоки ({total} книг)...", flush=True)

        def worker(item):
            name, path = item
            pages = extract_single_file_pages(path)
            return name, pages

        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_item = {executor.submit(worker, item): item for item in to_process}
            done_count = 0
            for future in as_completed(future_to_item):
                done_count += 1
                try:
                    name, pages = future.result()
                    if pages:
                        counts[name] = pages
                        counts[name.lower()] = pages
                        success += 1
                except Exception:
                    pass

                if done_count % 50 == 0 or done_count == total:
                    print(f"[{done_count}/{total}] Оброблено (успішно: {success})...", flush=True)
                    save_page_counts(counts)

        save_page_counts(counts)
        print(f"✅ Успішно визначено сторінок для {success} книг з флешки!", flush=True)

    # 2. Оновлюємо descriptions.json / descriptions.js
    sync_descriptions_with_pages(counts)
    print("=" * 60, flush=True)
    print(f"🏁 Готово! Всього визначено сторінок: {len(counts) // 2 if any(k.islower() for k in counts) else len(counts)}", flush=True)

if __name__ == '__main__':
    main()
