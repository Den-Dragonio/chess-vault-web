#!/usr/bin/env python3
"""
Generates books-cache.json and books-cache.js for offline/instant loading of Chess Vault library.
"""

import os
import json
import re
import unicodedata
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DESCRIPTIONS_JSON = os.path.join(BASE_DIR, 'descriptions.json')
PAGE_COUNTS_JSON = os.path.join(BASE_DIR, 'page_counts.json')
BOOKS_CACHE_JSON = os.path.join(BASE_DIR, 'books-cache.json')
BOOKS_CACHE_JS = os.path.join(BASE_DIR, 'books-cache.js')
FLASH_DRIVE_PATH = '/Volumes/NO NAME/Chess'
ARCHIVE_ID = '1971_20260223'

def norm(s):
    return unicodedata.normalize('NFC', s).strip().lower()

def main():
    if not os.path.exists(DESCRIPTIONS_JSON):
        print(f"Error: {DESCRIPTIONS_JSON} not found.")
        return

    with open(DESCRIPTIONS_JSON, 'r', encoding='utf-8') as f:
        descriptions = json.load(f)

    page_counts = {}
    if os.path.exists(PAGE_COUNTS_JSON):
        with open(PAGE_COUNTS_JSON, 'r', encoding='utf-8') as f:
            page_counts = json.load(f)

    flash_files = {}
    if os.path.exists(FLASH_DRIVE_PATH):
        print(f"Scanning flash drive: {FLASH_DRIVE_PATH}...")
        for root, dirs, files in os.walk(FLASH_DRIVE_PATH):
            for fn in files:
                if not fn.startswith('.'):
                    try:
                        sz = os.path.getsize(os.path.join(root, fn))
                        flash_files[norm(fn)] = sz
                    except Exception:
                        pass
        print(f"Found {len(flash_files)} files on flash drive.")
    else:
        print("Flash drive not detected, using estimates/existing cache sizes if available.")

    # Load existing cache to preserve sizes if flash drive is not available in future
    existing_cache = {}
    if os.path.exists(BOOKS_CACHE_JSON):
        try:
            with open(BOOKS_CACHE_JSON, 'r', encoding='utf-8') as f:
                for b in json.load(f):
                    existing_cache[norm(b.get('id', ''))] = b.get('sizeRaw')
        except Exception:
            pass

    books = []
    for fname, desc in descriptions.items():
        fileName = os.path.splitext(fname)[0]
        match = re.match(r'(.*?)\s*-\s*(.*)\s*\((\d{4})\)', fileName)
        
        norm_name = norm(fname)
        sz = flash_files.get(norm_name) or existing_cache.get(norm_name) or (5 * 1024 * 1024)
        
        pg = desc.get('pages') or page_counts.get(fname) or page_counts.get(fname.lower()) or None
        if pg:
            try:
                pg = int(pg)
            except Exception:
                pg = None

        fmt = fname.split('.')[-1].lower() if '.' in fname else ''
        author = match.group(1).strip() if match else fileName.split('-')[0].strip()
        title = match.group(2).strip() if match else fileName
        year = match.group(3) if match else '---'

        b = {
            'author': author,
            'title': title,
            'year': year,
            'pages': pg,
            'format': fmt,
            'sizeDisplay': f'{(sz / 1024 / 1024):.2f} MB',
            'sizeRaw': sz,
            'url': f'https://archive.org/download/{ARCHIVE_ID}/{fname}',
            'id': fname
        }
        books.append(b)

    # Sort alphabetically by author by default
    books.sort(key=lambda x: (x['author'].lower(), x['title'].lower()))

    # Write JSON
    with open(BOOKS_CACHE_JSON, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)

    # Write JS
    with open(BOOKS_CACHE_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated offline & instant cache for Chess Vault books\n')
        f.write('window.CHESS_BOOKS_CACHE = ')
        json.dump(books, f, ensure_ascii=False)
        f.write(';\n')

    print(f"Successfully generated cache for {len(books)} books:")
    print(f" - {BOOKS_CACHE_JSON}")
    print(f" - {BOOKS_CACHE_JS}")

if __name__ == '__main__':
    main()
