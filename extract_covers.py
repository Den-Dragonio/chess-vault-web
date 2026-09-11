#!/usr/bin/env python3
"""
Extract page 1 cover images from PDF and DJVU books on flash drive.
Outputs high quality thumbnail JPEGs into covers/ directory.
"""

import os
import sys
import subprocess
import shutil
import re

FLASH_PATH = '/Volumes/NO NAME/Chess'
COVERS_DIR = os.path.join(os.path.dirname(__file__), 'covers')
DDJVU_BIN = shutil.which('ddjvu') or '/opt/homebrew/bin/ddjvu'
SIPS_BIN = '/usr/bin/sips'

os.makedirs(COVERS_DIR, exist_ok=True)

def sanitize_cover_filename(name):
    """Normalize filename to a clean cover image filename."""
    base = os.path.splitext(name)[0]
    return base + '.jpg'

def extract_pdf_cover(pdf_path, out_jpg):
    """Extract page 1 of PDF using macOS sips."""
    try:
        subprocess.run(
            [SIPS_BIN, '-s', 'format', 'jpeg', '-Z', '600', pdf_path, '--out', out_jpg],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        return os.path.exists(out_jpg) and os.path.getsize(out_jpg) > 0
    except Exception:
        return False

def extract_djvu_cover(djvu_path, out_jpg):
    """Extract page 1 of DJVU using ddjvu + sips."""
    ppm_temp = f'/tmp/temp_page_{os.getpid()}.ppm'
    try:
        # 1. ddjvu page 1 to PPM
        subprocess.run(
            [DDJVU_BIN, '-format=ppm', '-page=1', djvu_path, ppm_temp],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        if not os.path.exists(ppm_temp):
            return False
            
        # 2. Convert PPM to resized JPEG
        subprocess.run(
            [SIPS_BIN, '-s', 'format', 'jpeg', '-Z', '600', ppm_temp, '--out', out_jpg],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        return os.path.exists(out_jpg) and os.path.getsize(out_jpg) > 0
    except Exception:
        return False
    finally:
        if os.path.exists(ppm_temp):
            try:
                os.remove(ppm_temp)
            except OSError:
                pass

def check_and_crop_spread(image_path):
    """If image is a double spread (width > height), crop the front cover (right part, excluding spine)."""
    try:
        from PIL import Image
        with Image.open(image_path) as im:
            w, h = im.size
            if w > h:
                # In standard book jacket spreads: [back] [spine] [front]
                # Spine is in the middle (~6% width).
                # Front cover is on the right.
                x_start = max(int(w * 0.55), w - int(h * 0.70))
                front = im.crop((x_start, 0, w, h))
                front.save(image_path, quality=92)
                return True
    except Exception:
        pass
    return False

def extract_single_cover(book_path, filename=None):
    """Extract cover for a single book file."""
    if not filename:
        filename = os.path.basename(book_path)
    out_name = sanitize_cover_filename(filename)
    out_path = os.path.join(COVERS_DIR, out_name)
    
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        return out_name, True # already exists
        
    lower = filename.lower()
    success = False
    if lower.endswith('.pdf'):
        success = extract_pdf_cover(book_path, out_path)
    elif lower.endswith('.djvu'):
        success = extract_djvu_cover(book_path, out_path)
        
    if success and os.path.exists(out_path):
        check_and_crop_spread(out_path)
        
    return out_name, success

def main():
    print('=' * 60)
    print('🎨 CHESS VAULT — АВТОМАТИЧНЕ ВИЛУЧЕННЯ ОБКЛАДИНОК')
    print('   Джерело: Флешка (PDF / DJVU)')
    print(f'   Цільова папка: {COVERS_DIR}')
    print('=' * 60)
    
    if not os.path.exists(FLASH_PATH):
        print(f'❌ Помилка: флешку не знайдено: {FLASH_PATH}')
        sys.exit(1)
        
    all_books = []
    for root, dirs, files in os.walk(FLASH_PATH):
        for f in files:
            if not f.startswith('.') and f.lower().endswith(('.pdf', '.djvu')):
                all_books.append((f, os.path.join(root, f)))
                
    print(f'Знайдено {len(all_books)} книг для вилучення обкладинок.\n')
    
    success = 0
    skipped = 0
    failed = 0
    
    for idx, (fname, full_path) in enumerate(all_books, 1):
        cover_file = sanitize_cover_filename(fname)
        target = os.path.join(COVERS_DIR, cover_file)
        
        if os.path.exists(target) and os.path.getsize(target) > 1000:
            skipped += 1
            continue
            
        print(f'[{idx}/{len(all_books)}] Вилучення: {fname[:45]}...', end='', flush=True)
        _, ok = extract_single_cover(full_path, fname)
        if ok:
            print(' ✅ OK')
            success += 1
        else:
            print(' ❌ Помилка')
            failed += 1
            
    print('\n' + '=' * 60)
    print(f'🏁 ЗАВЕРШЕНО! Нових: {success}, Вже було: {skipped}, Помилок: {failed}')
    print('=' * 60)

if __name__ == '__main__':
    main()
