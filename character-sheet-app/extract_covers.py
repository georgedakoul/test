"""Extract page-1 covers from PDF books for the library."""
import fitz, json, os

BASE = os.path.dirname(os.path.abspath(__file__))
PDF_ROOT = os.path.dirname(BASE)  # RPGs/Shadowdark RPG/
BOOKS_JSON = os.path.join(BASE, 'static', 'data', 'books.json')
COVERS_DIR = os.path.join(BASE, 'static', 'images', 'covers')

os.makedirs(COVERS_DIR, exist_ok=True)

with open(BOOKS_JSON, 'r', encoding='utf-8') as f:
    books = json.load(f)

for book in books:
    pdf_path = os.path.join(PDF_ROOT, book['path'])
    cover_file = book['id'] + '.jpg'
    cover_path = os.path.join(COVERS_DIR, cover_file)

    if os.path.exists(cover_path):
        print(f"  SKIP {book['id']} (exists)")
        continue

    if not os.path.exists(pdf_path):
        print(f"  MISS {book['id']} — {pdf_path}")
        continue

    try:
        doc = fitz.open(pdf_path)
        page = doc[0]
        # Render at 2x for decent quality, then save as JPEG
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        # Crop to a book-cover-like aspect ratio if wider than tall
        w, h = pix.width, pix.height
        if w > h * 0.8:
            # Trim width to ~0.7 * height (portrait book ratio)
            target_w = int(h * 0.7)
            offset = (w - target_w) // 2
            clip = fitz.IRect(offset, 0, offset + target_w, h)
            pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(clip) / 2)
        pix.save(cover_path)
        doc.close()
        print(f"  OK   {book['id']} ({pix.width}x{pix.height})")
    except Exception as e:
        print(f"  ERR  {book['id']} — {e}")

print(f"\nDone. Covers in {COVERS_DIR}")
