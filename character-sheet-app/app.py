from flask import Flask, jsonify, request, render_template, send_file, abort, session, Response
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, json, os, secrets
from datetime import datetime, timedelta

# How long a soft-deleted character can be recovered before permanent deletion
RECOVERY_DAYS = 7

app = Flask(__name__)

# Secret key for session cookies. Persisted to a sibling file so it survives
# restarts; do NOT change after users have signed in (it invalidates sessions).
_SECRET_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.flask_secret')
if os.path.exists(_SECRET_FILE):
    with open(_SECRET_FILE, 'r') as f:
        app.secret_key = f.read().strip() or secrets.token_hex(32)
else:
    app.secret_key = secrets.token_hex(32)
    with open(_SECRET_FILE, 'w') as f:
        f.write(app.secret_key)

# Sessions persist for 30 days across browser restarts ("autosave last session")
app.permanent_session_lifetime = timedelta(days=30)

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, 'shadowdark.db')
DATA_DIR = os.path.join(BASE, 'static', 'data')

JSON_FIELDS = {'talents', 'spells', 'gear', 'gear_tags', 'gear_spans', 'gear_types', 'free_carry_items', 'mount_names', 'mounts_saved', 'panel_order', 'finesse_pref', 'spells_failed', 'talent_bonuses', 'race_bonuses'}

VALID_TABLES = [
    'weapons', 'armor', 'spells', 'gear', 'magic_items', 'gems',
    'plants_poisons', 'traps', 'mounts', 'mount_gear', 'spell_catalysts',
    'classes', 'class_titles', 'class_talents', 'races', 'backgrounds',
    'languages', 'monsters', 'gods', 'glossary', 'spell_mishape_table'
]

ALLOWED_FIELDS = [
    'name','ancestry','class_name','level','xp','xp_target','title',
    'alignment','background','deity',
    'str_score','dex_score','con_score','int_score','wis_score','cha_score',
    'hp_max','hp_current','armor_class','attacks',
    'talents','spells','gear','free_carry','free_carry_items',
    'gp','sp','cp','eth',
    'notes','description','wearing','panel_order','portrait',
    'gear_tags','gear_spans','gear_types','spellcasting_ability','mount_names','mounts_saved',
    'finesse_pref', 'spells_failed', 'talent_bonuses', 'race_bonuses',
    'weapon_mastery', 'languages_manual'
]

DEFAULT_GEAR = json.dumps([""] * 20)
DEFAULT_ORDER = json.dumps(["identity","abilities","combat","details","talents","inventory","currency"])

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    # ── Users table ─────────────────────────────────────────────────
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        theme         TEXT DEFAULT "charcoal",
        mode          TEXT DEFAULT "light",
        is_gm         INTEGER DEFAULT 0,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    # Migrate existing user DBs: add is_gm if missing
    user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if 'is_gm' not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_gm INTEGER DEFAULT 0")
    # Backfill GM access on every startup:
    #   1) The reserved username 'game master' is ALWAYS a GM.
    #   2) If no GM exists at all, promote the lowest-ID user so the system
    #      always has at least one operator.
    conn.execute("UPDATE users SET is_gm=1 WHERE username='game master' COLLATE NOCASE")
    n_gms = conn.execute("SELECT COUNT(*) FROM users WHERE is_gm=1").fetchone()[0]
    if n_gms == 0:
        row = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        if row:
            conn.execute("UPDATE users SET is_gm=1 WHERE id=?", (row[0],))
    # ── GM custom-data table (shared pool of GM-added entries) ──────
    conn.execute('''CREATE TABLE IF NOT EXISTS custom_data (
        id            TEXT PRIMARY KEY,
        table_name    TEXT NOT NULL,
        owner_user_id INTEGER NOT NULL,
        data_json     TEXT NOT NULL,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_custom_data_table ON custom_data(table_name)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_custom_data_owner ON custom_data(owner_user_id)')
    # ── GM boards (Game Master Screen) ──────────────────────────────
    conn.execute('''CREATE TABLE IF NOT EXISTS gm_boards (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        gm_user_id     INTEGER NOT NULL,
        name           TEXT NOT NULL,
        snap_to_grid   INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
        last_opened_at TEXT
    )''')
    # ── GM cards on those boards ────────────────────────────────────
    conn.execute('''CREATE TABLE IF NOT EXISTS gm_cards (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id  INTEGER NOT NULL,
        type      TEXT NOT NULL,
        x         INTEGER DEFAULT 40,
        y         INTEGER DEFAULT 40,
        w         INTEGER DEFAULT 240,
        h         INTEGER DEFAULT 160,
        color     TEXT,
        data_json TEXT NOT NULL DEFAULT '{}'
    )''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_gm_cards_board ON gm_cards(board_id)')
    # ── GM-card image uploads (stored as blobs, no filesystem) ──────
    conn.execute('''CREATE TABLE IF NOT EXISTS gm_images (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL,
        mime          TEXT NOT NULL,
        byte_size     INTEGER NOT NULL,
        blob          BLOB NOT NULL,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_gm_images_owner ON gm_images(owner_user_id)')
    # ── VTT maps ─────────────────────────────────────────────────────
    conn.execute('''CREATE TABLE IF NOT EXISTS vtt_maps (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL DEFAULT 'Untitled Map',
        user_id    INTEGER NOT NULL,
        img_url    TEXT DEFAULT '',
        grid_size  INTEGER DEFAULT 50,
        grid_on    INTEGER DEFAULT 1,
        fog_cells  TEXT DEFAULT '[]',
        free_fog   TEXT DEFAULT '[]',
        tokens     TEXT DEFAULT '[]',
        img_blob   BLOB,
        img_mime   TEXT DEFAULT 'image/png',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    # Migrate vtt_maps: add missing columns
    vtt_cols = {row[1] for row in conn.execute("PRAGMA table_info(vtt_maps)").fetchall()}
    for col, defn in (
        ('grid_off_x', 'REAL DEFAULT 0'),
        ('grid_off_y', 'REAL DEFAULT 0'),
        ('free_fog',   "TEXT DEFAULT '[]'"),
        ('img_blob',   'BLOB'),
        ('img_mime',   "TEXT DEFAULT 'image/png'"),
    ):
        if col not in vtt_cols:
            conn.execute(f'ALTER TABLE vtt_maps ADD COLUMN {col} {defn}')
    # ── Characters table ─────────────────────────────────────────────
    conn.execute(f'''CREATE TABLE IF NOT EXISTS characters (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL DEFAULT "New Character",
        ancestry    TEXT DEFAULT "",
        class_name  TEXT DEFAULT "",
        level       INTEGER DEFAULT 1,
        xp          INTEGER DEFAULT 0,
        xp_target   INTEGER DEFAULT 10,
        title       TEXT DEFAULT "",
        alignment   TEXT DEFAULT "Neutral",
        background  TEXT DEFAULT "",
        deity       TEXT DEFAULT "",
        str_score   INTEGER DEFAULT 10,
        dex_score   INTEGER DEFAULT 10,
        con_score   INTEGER DEFAULT 10,
        int_score   INTEGER DEFAULT 10,
        wis_score   INTEGER DEFAULT 10,
        cha_score   INTEGER DEFAULT 10,
        hp_max      INTEGER DEFAULT 8,
        hp_current  INTEGER DEFAULT 8,
        armor_class INTEGER DEFAULT 10,
        attacks     TEXT DEFAULT "",
        talents     TEXT DEFAULT "[]",
        spells      TEXT DEFAULT "[]",
        gear        TEXT DEFAULT '{DEFAULT_GEAR}',
        gear_tags   TEXT DEFAULT '[]',
        gear_spans  TEXT DEFAULT '[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]',
        gear_types  TEXT DEFAULT '[]',
        free_carry  TEXT DEFAULT "",
        free_carry_items TEXT DEFAULT '[]',
        spellcasting_ability TEXT DEFAULT "",
        gp          INTEGER DEFAULT 0,
        sp          INTEGER DEFAULT 0,
        cp          INTEGER DEFAULT 0,
        eth         INTEGER DEFAULT 0,
        notes       TEXT DEFAULT "",
        description TEXT DEFAULT "",
        wearing     TEXT DEFAULT "",
        panel_order TEXT DEFAULT '{DEFAULT_ORDER}',
        portrait    TEXT DEFAULT "",
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    # Migrate existing DBs: add new columns if missing
    existing = {row[1] for row in conn.execute("PRAGMA table_info(characters)").fetchall()}
    migrations = [
        ("gear_types",           "TEXT DEFAULT '[]'"),
        ("free_carry_items",     "TEXT DEFAULT '[]'"),
        ("spellcasting_ability", "TEXT DEFAULT ''"),
        ("mount_names",          "TEXT DEFAULT '{}'"),
        ("mounts_saved",         "TEXT DEFAULT '[]'"),
        ("finesse_pref",          "TEXT DEFAULT '{}'"),
        ("spells_failed",         "TEXT DEFAULT '[]'"),
        ("talent_bonuses",        "TEXT DEFAULT '[]'"),
        ("race_bonuses",          "TEXT DEFAULT '[]'"),
        ("weapon_mastery",        "TEXT DEFAULT ''"),
        ("languages_manual",      "TEXT DEFAULT ''"),
        ("deleted_at",            "TEXT DEFAULT NULL"),
        ("user_id",               "INTEGER DEFAULT NULL"),
    ]
    for col, definition in migrations:
        if col not in existing:
            conn.execute(f"ALTER TABLE characters ADD COLUMN {col} {definition}")
    conn.commit()
    conn.close()

# ── Auth helpers ────────────────────────────────────────────────────────
def current_user_id():
    return session.get('user_id')

def current_user():
    uid = current_user_id()
    if not uid: return None
    conn = get_db()
    row = conn.execute('SELECT id,username,is_gm FROM users WHERE id=?', (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def is_gm():
    u = current_user()
    return bool(u and u.get('is_gm'))

def login_required_json(fn):
    """Wrap a JSON endpoint so it returns 401 if not signed in."""
    from functools import wraps
    @wraps(fn)
    def wrapper(*a, **kw):
        if not current_user_id():
            return jsonify({'error': 'auth_required'}), 401
        return fn(*a, **kw)
    return wrapper

def gm_required_json(fn):
    """JSON endpoints — return 403 if not a GM."""
    from functools import wraps
    @wraps(fn)
    def wrapper(*a, **kw):
        if not current_user_id():
            return jsonify({'error': 'auth_required'}), 401
        if not is_gm():
            return jsonify({'error': 'gm_required'}), 403
        return fn(*a, **kw)
    return wrapper

def gm_required_page(fn):
    """Page routes — return 403 page if not a GM."""
    from functools import wraps
    @wraps(fn)
    def wrapper(*a, **kw):
        if not is_gm():
            return render_template('gm/forbidden.html'), 403
        return fn(*a, **kw)
    return wrapper

def purge_expired(conn):
    """Permanently remove soft-deleted characters older than the recovery window."""
    cutoff = (datetime.now() - timedelta(days=RECOVERY_DAYS)).isoformat()
    conn.execute(
        'DELETE FROM characters WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        (cutoff,)
    )
    conn.commit()

def row_to_dict(row):
    d = dict(row)
    for f in JSON_FIELDS:
        if f in d and isinstance(d[f], str):
            try:
                d[f] = json.loads(d[f])
            except Exception:
                pass
    return d

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/characters')
def characters():
    return render_template('index.html')

@app.route('/classes')
def classes_page():
    return render_template('rules/classes.html')

@app.route('/classes/<name>')
def class_detail(name):
    return render_template('rules/class_detail.html', class_name=name)

@app.route('/species')
def species_page():
    return render_template('rules/species.html')

@app.route('/species/<name>')
def species_detail(name):
    return render_template('rules/species_detail.html', race_name=name)

@app.route('/backgrounds')
def backgrounds_page():
    return render_template('rules/backgrounds.html')

@app.route('/spells')
def spells_page():
    return render_template('rules/spells.html')

@app.route('/equipment')
def equipment_page():
    return render_template('rules/equipment.html')

@app.route('/magic-items')
def magic_items_page():
    return render_template('rules/magic_items.html')

@app.route('/monsters')
def monsters_page():
    return render_template('rules/monsters.html')

@app.route('/gods')
def gods_page():
    return render_template('rules/gods.html')

@app.route('/rules-glossary')
def glossary_page():
    return render_template('rules/glossary.html')

@app.route('/library')
def library_page():
    return render_template('library.html')

@app.route('/library/read/<book_id>')
def library_reader(book_id):
    return render_template('reader.html', book_id=book_id)

PDF_ROOT = os.path.dirname(BASE)  # RPGs/Shadowdark RPG/

@app.route('/api/books')
def list_books():
    path = os.path.join(DATA_DIR, 'books.json')
    if not os.path.exists(path):
        return jsonify([])
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/books/<book_id>/pdf')
def serve_pdf(book_id):
    bpath = os.path.join(DATA_DIR, 'books.json')
    if not os.path.exists(bpath):
        abort(404)
    with open(bpath, 'r', encoding='utf-8') as f:
        books = json.load(f)
    book = next((b for b in books if b['id'] == book_id), None)
    if not book:
        abort(404)
    pdf_path = os.path.join(PDF_ROOT, book['path'])
    if not os.path.exists(pdf_path):
        abort(404)
    return send_file(pdf_path, mimetype='application/pdf')

@app.route('/vtt')
def vtt_page():
    return render_template('vtt.html')

# ══ Auth API ═══════════════════════════════════════════════════════════
@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if len(username) < 2:
        return jsonify({'error': 'Username must be at least 2 characters.'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters.'}), 400
    conn = get_db()
    existing = conn.execute('SELECT id FROM users WHERE username=? COLLATE NOCASE', (username,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Username already taken.'}), 409
    cur = conn.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        (username, generate_password_hash(password))
    )
    user_id = cur.lastrowid
    # First user claims any pre-existing orphan characters AND becomes GM.
    is_first = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 1
    if is_first:
        conn.execute('UPDATE characters SET user_id=? WHERE user_id IS NULL', (user_id,))
        conn.execute('UPDATE users SET is_gm=1 WHERE id=?', (user_id,))
    # The reserved username 'game master' is always a GM regardless of order.
    if username.strip().lower() == 'game master':
        conn.execute('UPDATE users SET is_gm=1 WHERE id=?', (user_id,))
    conn.commit()
    conn.close()
    session.permanent = True
    session['user_id'] = user_id
    return jsonify({'id': user_id, 'username': username})

@app.route('/api/auth/signin', methods=['POST'])
def auth_signin():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE username=? COLLATE NOCASE', (username,)).fetchone()
    conn.close()
    if not row or not check_password_hash(row['password_hash'], password):
        return jsonify({'error': 'Invalid username or password.'}), 401
    session.permanent = True
    session['user_id'] = row['id']
    return jsonify({
        'id': row['id'], 'username': row['username'],
        'theme': row['theme'], 'mode': row['mode']
    })

@app.route('/api/auth/signout', methods=['POST'])
def auth_signout():
    session.pop('user_id', None)
    return jsonify({'ok': True})

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    uid = current_user_id()
    if not uid:
        return jsonify({'user': None})
    conn = get_db()
    row = conn.execute('SELECT id,username,theme,mode,is_gm FROM users WHERE id=?', (uid,)).fetchone()
    conn.close()
    if not row:
        session.pop('user_id', None)
        return jsonify({'user': None})
    return jsonify({'user': dict(row)})

@app.route('/api/auth/theme', methods=['PUT'])
@login_required_json
def auth_save_theme():
    data = request.get_json() or {}
    theme = data.get('theme') if data.get('theme') in ('charcoal','blue','green','crimson') else None
    mode  = data.get('mode')  if data.get('mode')  in ('light','dark') else None
    sets, vals = [], []
    if theme: sets.append('theme=?'); vals.append(theme)
    if mode:  sets.append('mode=?');  vals.append(mode)
    if not sets:
        return jsonify({'error': 'No valid fields'}), 400
    vals.append(current_user_id())
    conn = get_db()
    conn.execute(f'UPDATE users SET {", ".join(sets)} WHERE id=?', vals)
    conn.commit()
    conn.close()
    return jsonify({'ok': True, 'theme': theme, 'mode': mode})

# ══ Character API (scoped to current user) ═════════════════════════════
@app.route('/api/characters', methods=['GET'])
@login_required_json
def list_characters():
    conn = get_db()
    purge_expired(conn)
    rows = conn.execute(
        'SELECT id,name,class_name,ancestry,level,hp_current,hp_max,alignment,updated_at '
        'FROM characters WHERE deleted_at IS NULL AND user_id=? ORDER BY updated_at DESC',
        (current_user_id(),)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/characters/deleted', methods=['GET'])
@login_required_json
def list_deleted_characters():
    """Soft-deleted characters still within the recovery window."""
    conn = get_db()
    purge_expired(conn)
    rows = conn.execute(
        'SELECT id,name,class_name,ancestry,level,hp_current,hp_max,alignment,deleted_at '
        'FROM characters WHERE deleted_at IS NOT NULL AND user_id=? ORDER BY deleted_at DESC',
        (current_user_id(),)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        # Compute remaining recovery time so the UI can show "N days left"
        try:
            expires = datetime.fromisoformat(d['deleted_at']) + timedelta(days=RECOVERY_DAYS)
            d['expires_at'] = expires.isoformat()
            d['seconds_left'] = max(0, int((expires - datetime.now()).total_seconds()))
        except Exception:
            d['expires_at'] = None
            d['seconds_left'] = None
        out.append(d)
    return jsonify(out)

@app.route('/api/characters', methods=['POST'])
@login_required_json
def create_character():
    conn = get_db()
    cur = conn.execute('INSERT INTO characters (name, user_id) VALUES ("New Character", ?)',
                       (current_user_id(),))
    conn.commit()
    char = conn.execute('SELECT * FROM characters WHERE id=?', (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(char)), 201


@app.route('/api/characters/<int:cid>', methods=['GET'])
@login_required_json
def get_character(cid):
    conn = get_db()
    char = conn.execute('SELECT * FROM characters WHERE id=? AND user_id=?',
                        (cid, current_user_id())).fetchone()
    conn.close()
    if not char:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(char))

@app.route('/api/characters/<int:cid>', methods=['PUT'])
@login_required_json
def update_character(cid):
    data = request.get_json() or {}
    updates = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if not updates:
        return jsonify({'error': 'No valid fields'}), 400
    for f in JSON_FIELDS:
        if f in updates and not isinstance(updates[f], str):
            updates[f] = json.dumps(updates[f], ensure_ascii=False)
    updates['updated_at'] = datetime.now().isoformat()
    clause = ', '.join(f'{k}=?' for k in updates)
    vals = list(updates.values()) + [cid, current_user_id()]
    conn = get_db()
    cur = conn.execute(f'UPDATE characters SET {clause} WHERE id=? AND user_id=?', vals)
    conn.commit()
    if cur.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    char = conn.execute('SELECT * FROM characters WHERE id=?', (cid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(char))

@app.route('/api/characters/<int:cid>', methods=['DELETE'])
@login_required_json
def delete_character(cid):
    """Soft delete — moves the character to Recently Deleted (recoverable for RECOVERY_DAYS)."""
    conn = get_db()
    conn.execute(
        'UPDATE characters SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL',
        (datetime.now().isoformat(), cid, current_user_id())
    )
    conn.commit()
    conn.close()
    return jsonify({'deleted': cid, 'recoverable_days': RECOVERY_DAYS})

@app.route('/api/characters/<int:cid>/restore', methods=['POST'])
@login_required_json
def restore_character(cid):
    """Recover a soft-deleted character."""
    conn = get_db()
    conn.execute('UPDATE characters SET deleted_at=NULL WHERE id=? AND user_id=?',
                 (cid, current_user_id()))
    conn.commit()
    char = conn.execute('SELECT * FROM characters WHERE id=? AND user_id=?',
                        (cid, current_user_id())).fetchone()
    conn.close()
    if not char:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(char))

@app.route('/api/characters/<int:cid>/permanent', methods=['DELETE'])
@login_required_json
def permanent_delete_character(cid):
    """Permanently remove a character (skips the recovery window)."""
    conn = get_db()
    conn.execute('DELETE FROM characters WHERE id=? AND user_id=?',
                 (cid, current_user_id()))
    conn.commit()
    conn.close()
    return jsonify({'permanently_deleted': cid})

@app.route('/api/data/<table>')
def get_data(table):
    if table not in VALID_TABLES:
        return jsonify({'error': 'Invalid table'}), 404
    path = os.path.join(DATA_DIR, f'{table}.json')
    core = []
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            core = json.load(f)
    # Merge in GM-added custom entries for this table (global, visible to all).
    conn = get_db()
    rows = conn.execute(
        'SELECT cd.id, cd.data_json, cd.owner_user_id, u.username AS owner_username '
        'FROM custom_data cd LEFT JOIN users u ON u.id = cd.owner_user_id '
        'WHERE cd.table_name = ?',
        (table,)
    ).fetchall()
    conn.close()
    extras = []
    for r in rows:
        try:
            d = json.loads(r['data_json'])
        except Exception:
            continue
        if not isinstance(d, dict): continue
        d['id'] = r['id']
        d['_owner_id'] = r['owner_user_id']
        d['_owner'] = r['owner_username']
        d['_custom'] = True
        extras.append(d)
    return jsonify(core + extras)

# ══ GM custom data — list/create/update/delete ═════════════════════════
@app.route('/api/custom_data/<table>', methods=['GET'])
@gm_required_json
def custom_data_list(table):
    """Return only the current GM's own custom entries for this table."""
    if table not in VALID_TABLES:
        return jsonify({'error': 'invalid_table'}), 404
    uid = current_user_id()
    conn = get_db()
    rows = conn.execute(
        'SELECT id, data_json, created_at, updated_at FROM custom_data '
        'WHERE table_name=? AND owner_user_id=? ORDER BY id',
        (table, uid)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        try:
            d = json.loads(r['data_json'])
        except Exception:
            d = {}
        d['id'] = r['id']
        out.append(d)
    return jsonify(out)

@app.route('/api/custom_data/<table>', methods=['POST'])
@gm_required_json
def custom_data_create(table):
    if table not in VALID_TABLES:
        return jsonify({'error': 'invalid_table'}), 404
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        return jsonify({'error': 'bad_payload'}), 400
    uid = current_user_id()
    u = current_user()
    uname = (u['username'] or 'gm').lower().replace(' ', '_')
    table_slug = table.replace(' ', '_')
    conn = get_db()
    # Compute next per-(GM, table) sequence by scanning existing IDs.
    prefix = f"{uname}_{table_slug}_"
    rows = conn.execute(
        'SELECT id FROM custom_data WHERE owner_user_id=? AND table_name=?',
        (uid, table)
    ).fetchall()
    max_n = 0
    for r in rows:
        try:
            n = int(str(r['id']).rsplit('_', 1)[-1])
            if n > max_n: max_n = n
        except Exception:
            pass
    new_id = f"{prefix}{max_n + 1}"
    # Strip any client-supplied id; we own it.
    payload.pop('id', None); payload.pop('_owner', None); payload.pop('_owner_id', None); payload.pop('_custom', None)
    conn.execute(
        'INSERT INTO custom_data (id, table_name, owner_user_id, data_json) VALUES (?,?,?,?)',
        (new_id, table, uid, json.dumps(payload, ensure_ascii=False))
    )
    conn.commit(); conn.close()
    return jsonify({'id': new_id, **payload})

@app.route('/api/custom_data/<table>/<entry_id>', methods=['PUT'])
@gm_required_json
def custom_data_update(table, entry_id):
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        return jsonify({'error': 'bad_payload'}), 400
    uid = current_user_id()
    conn = get_db()
    row = conn.execute('SELECT owner_user_id FROM custom_data WHERE id=? AND table_name=?',
                       (entry_id, table)).fetchone()
    if not row:
        conn.close(); return jsonify({'error': 'not_found'}), 404
    if row['owner_user_id'] != uid:
        conn.close(); return jsonify({'error': 'not_owner'}), 403
    payload.pop('id', None); payload.pop('_owner', None); payload.pop('_owner_id', None); payload.pop('_custom', None)
    conn.execute(
        'UPDATE custom_data SET data_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        (json.dumps(payload, ensure_ascii=False), entry_id)
    )
    conn.commit(); conn.close()
    return jsonify({'id': entry_id, **payload})

@app.route('/api/custom_data/<table>/<entry_id>', methods=['DELETE'])
@gm_required_json
def custom_data_delete(table, entry_id):
    uid = current_user_id()
    conn = get_db()
    row = conn.execute('SELECT owner_user_id FROM custom_data WHERE id=? AND table_name=?',
                       (entry_id, table)).fetchone()
    if not row:
        conn.close(); return jsonify({'error': 'not_found'}), 404
    if row['owner_user_id'] != uid:
        conn.close(); return jsonify({'error': 'not_owner'}), 403
    conn.execute('DELETE FROM custom_data WHERE id=?', (entry_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

# ══ Admin / user management ════════════════════════════════════════════
@app.route('/api/admin/users', methods=['GET'])
@gm_required_json
def admin_users_list():
    conn = get_db()
    rows = conn.execute(
        'SELECT id, username, is_gm, created_at FROM users ORDER BY id'
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/admin/users/<int:uid>/gm', methods=['PUT'])
@gm_required_json
def admin_users_set_gm(uid):
    payload = request.get_json() or {}
    flag = 1 if payload.get('is_gm') else 0
    me = current_user_id()
    conn = get_db()
    # Don't let a GM revoke their own GM unless another GM exists.
    if uid == me and flag == 0:
        n_gms = conn.execute('SELECT COUNT(*) FROM users WHERE is_gm=1').fetchone()[0]
        if n_gms <= 1:
            conn.close()
            return jsonify({'error': 'cannot_revoke_last_gm'}), 400
    conn.execute('UPDATE users SET is_gm=? WHERE id=?', (flag, uid))
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'id': uid, 'is_gm': flag})

# ══ GM boards & cards ══════════════════════════════════════════════════
@app.route('/api/gm/boards', methods=['GET'])
@gm_required_json
def gm_boards_list():
    uid = current_user_id()
    conn = get_db()
    rows = conn.execute(
        'SELECT id, name, snap_to_grid, created_at, last_opened_at '
        'FROM gm_boards WHERE gm_user_id=? ORDER BY last_opened_at DESC, id DESC',
        (uid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/gm/boards', methods=['POST'])
@gm_required_json
def gm_boards_create():
    data = request.get_json() or {}
    name = (data.get('name') or 'New Board').strip()[:120]
    uid = current_user_id()
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO gm_boards (gm_user_id, name) VALUES (?,?)', (uid, name)
    )
    bid = cur.lastrowid
    conn.commit(); conn.close()
    return jsonify({'id': bid, 'name': name, 'snap_to_grid': 0})

def _board_owner_or_404(board_id):
    """Return board row if owned by current user, else (None, error_response)."""
    uid = current_user_id()
    conn = get_db()
    row = conn.execute('SELECT * FROM gm_boards WHERE id=?', (board_id,)).fetchone()
    conn.close()
    if not row: return None
    if row['gm_user_id'] != uid: return None
    return dict(row)

@app.route('/api/gm/boards/<int:bid>', methods=['PUT'])
@gm_required_json
def gm_boards_update(bid):
    if not _board_owner_or_404(bid):
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json() or {}
    sets, vals = [], []
    if 'name' in data:
        sets.append('name=?'); vals.append((data.get('name') or '').strip()[:120])
    if 'snap_to_grid' in data:
        sets.append('snap_to_grid=?'); vals.append(1 if data.get('snap_to_grid') else 0)
    if 'last_opened_at' in data:
        sets.append('last_opened_at=CURRENT_TIMESTAMP')
    if not sets:
        return jsonify({'ok': True})
    vals.append(bid)
    conn = get_db()
    conn.execute(f'UPDATE gm_boards SET {", ".join(sets)} WHERE id=?', vals)
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/gm/boards/<int:bid>', methods=['DELETE'])
@gm_required_json
def gm_boards_delete(bid):
    if not _board_owner_or_404(bid):
        return jsonify({'error': 'not_found'}), 404
    conn = get_db()
    conn.execute('DELETE FROM gm_cards WHERE board_id=?', (bid,))
    conn.execute('DELETE FROM gm_boards WHERE id=?', (bid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/gm/boards/<int:bid>/cards', methods=['GET'])
@gm_required_json
def gm_cards_list(bid):
    if not _board_owner_or_404(bid):
        return jsonify({'error': 'not_found'}), 404
    conn = get_db()
    rows = conn.execute(
        'SELECT id, type, x, y, w, h, color, data_json FROM gm_cards WHERE board_id=?',
        (bid,)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        try: d['data'] = json.loads(d.pop('data_json') or '{}')
        except Exception: d['data'] = {}
        out.append(d)
    return jsonify(out)

@app.route('/api/gm/boards/<int:bid>/cards', methods=['POST'])
@gm_required_json
def gm_cards_create(bid):
    if not _board_owner_or_404(bid):
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json() or {}
    ctype = data.get('type') or 'note'
    if ctype not in ('note', 'image', 'monster', 'spell', 'rule', 'custom'):
        return jsonify({'error': 'bad_type'}), 400
    payload = data.get('data') or {}
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO gm_cards (board_id,type,x,y,w,h,color,data_json) VALUES (?,?,?,?,?,?,?,?)',
        (bid, ctype, int(data.get('x') or 40), int(data.get('y') or 40),
         int(data.get('w') or 240), int(data.get('h') or 160),
         data.get('color'), json.dumps(payload, ensure_ascii=False))
    )
    cid = cur.lastrowid
    conn.commit(); conn.close()
    return jsonify({'id': cid, 'type': ctype, 'x': data.get('x') or 40, 'y': data.get('y') or 40,
                    'w': data.get('w') or 240, 'h': data.get('h') or 160,
                    'color': data.get('color'), 'data': payload})

@app.route('/api/gm/cards/<int:cid>', methods=['PUT'])
@gm_required_json
def gm_cards_update(cid):
    uid = current_user_id()
    conn = get_db()
    row = conn.execute(
        'SELECT c.*, b.gm_user_id FROM gm_cards c JOIN gm_boards b ON b.id=c.board_id WHERE c.id=?',
        (cid,)
    ).fetchone()
    if not row or row['gm_user_id'] != uid:
        conn.close(); return jsonify({'error': 'not_found'}), 404
    data = request.get_json() or {}
    sets, vals = [], []
    for k in ('x', 'y', 'w', 'h'):
        if k in data: sets.append(f'{k}=?'); vals.append(int(data[k]))
    if 'color' in data:
        sets.append('color=?'); vals.append(data['color'])
    if 'data' in data:
        sets.append('data_json=?'); vals.append(json.dumps(data['data'], ensure_ascii=False))
    if 'type' in data:
        if data['type'] not in ('note', 'image', 'monster', 'spell', 'rule', 'custom'):
            return jsonify({'error': 'bad_type'}), 400
        sets.append('type=?'); vals.append(data['type'])
    if not sets:
        conn.close(); return jsonify({'ok': True})
    vals.append(cid)
    conn.execute(f'UPDATE gm_cards SET {", ".join(sets)} WHERE id=?', vals)
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/gm/cards/<int:cid>', methods=['DELETE'])
@gm_required_json
def gm_cards_delete(cid):
    uid = current_user_id()
    conn = get_db()
    row = conn.execute(
        'SELECT c.id FROM gm_cards c JOIN gm_boards b ON b.id=c.board_id WHERE c.id=? AND b.gm_user_id=?',
        (cid, uid)
    ).fetchone()
    if not row:
        conn.close(); return jsonify({'error': 'not_found'}), 404
    conn.execute('DELETE FROM gm_cards WHERE id=?', (cid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

# ══ Image upload — stored directly in the map row (no filesystem) ══════
ALLOWED_IMG_MIME = {
    'image/png': 'image/png', 'image/jpeg': 'image/jpeg',
    'image/webp': 'image/webp', 'image/gif': 'image/gif',
}
EXT_TO_MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
}

# Per-request image size cap (also used for GM card images stored in gm_images).
MAX_IMAGE_BYTES = 12 * 1024 * 1024  # 12 MB

@app.route('/api/gm/upload-image', methods=['POST'])
@gm_required_json
def gm_upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'no_file'}), 400
    f    = request.files['file']
    ct   = (f.content_type or '').split(';')[0].strip().lower()
    ext  = os.path.splitext(f.filename or '')[1].lower()
    mime = ALLOWED_IMG_MIME.get(ct) or EXT_TO_MIME.get(ext)
    if not mime:
        return jsonify({'error': 'bad_type'}), 400
    blob = f.read()
    if not blob:
        return jsonify({'error': 'empty_file'}), 400
    if len(blob) > MAX_IMAGE_BYTES:
        return jsonify({'error': 'too_large', 'max_bytes': MAX_IMAGE_BYTES}), 413

    map_id = request.form.get('map_id', type=int)
    conn = get_db()

    # Route 1 — VTT map upload: replace the blob on an existing vtt_maps row.
    if map_id:
        owner = conn.execute('SELECT user_id FROM vtt_maps WHERE id=?', (map_id,)).fetchone()
        if not owner or owner['user_id'] != current_user_id():
            conn.close(); return jsonify({'error': 'not_found'}), 404
        img_url = f'/api/vtt/maps/{map_id}/img'
        conn.execute(
            'UPDATE vtt_maps SET img_blob=?, img_mime=?, img_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            (blob, mime, img_url, map_id)
        )
        conn.commit(); conn.close()
        return jsonify({'url': img_url})

    # Route 2 — GM card image: store in gm_images and return a URL pointing at it.
    cur = conn.execute(
        'INSERT INTO gm_images (owner_user_id, mime, byte_size, blob) VALUES (?, ?, ?, ?)',
        (current_user_id(), mime, len(blob), blob)
    )
    conn.commit()
    img_id = cur.lastrowid
    conn.close()
    return jsonify({'url': f'/api/gm/images/{img_id}', 'id': img_id})

@app.route('/api/gm/images/<int:iid>', methods=['GET'])
def gm_image_get(iid):
    conn = get_db()
    row  = conn.execute('SELECT blob, mime FROM gm_images WHERE id=?', (iid,)).fetchone()
    conn.close()
    if not row or not row['blob']:
        abort(404)
    resp = Response(bytes(row['blob']), mimetype=row['mime'] or 'image/png')
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp

@app.route('/api/vtt/maps/<int:mid>/img', methods=['GET'])
def vtt_map_img(mid):
    conn = get_db()
    row  = conn.execute('SELECT img_blob, img_mime FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    conn.close()
    if not row or not row['img_blob']:
        abort(404)
    resp = Response(bytes(row['img_blob']), mimetype=row['img_mime'] or 'image/png')
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp

# ══ GM page routes ═════════════════════════════════════════════════════
@app.route('/gm/add')
@gm_required_page
def gm_add_page():
    return render_template('gm/add.html')

@app.route('/gm-screen')
@gm_required_page
def gm_screen_index():
    return render_template('gm/boards.html')

@app.route('/gm-screen/<int:bid>')
@gm_required_page
def gm_screen_board(bid):
    return render_template('gm/board.html', board_id=bid)

@app.route('/admin/users')
@gm_required_page
def admin_users_page():
    return render_template('gm/admin_users.html')

# ══ VTT maps ═══════════════════════════════════════════════════════════

def _vtt_row(row):
    d = dict(row)
    # Never send binary over JSON — synthesise URL if blob is stored
    has_blob = bool(d.pop('img_blob', None))
    d.pop('img_mime', None)
    if has_blob and not d.get('img_url'):
        d['img_url'] = f'/api/vtt/maps/{d["id"]}/img'
    for f in ('fog_cells', 'free_fog', 'tokens'):
        try: d[f] = json.loads(d[f] or '[]')
        except Exception: d[f] = []
    d['grid_on'] = bool(d['grid_on'])
    return d

@app.route('/api/vtt/maps', methods=['GET'])
@login_required_json
def vtt_list_maps():
    conn = get_db()
    if is_gm():
        rows = conn.execute(
            'SELECT id,name,img_url,grid_size,grid_on,updated_at FROM vtt_maps '
            'WHERE user_id=? ORDER BY updated_at DESC', (current_user_id(),)
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT id,name,img_url,grid_size,grid_on,updated_at FROM vtt_maps '
            'ORDER BY updated_at DESC'
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/vtt/maps', methods=['POST'])
@gm_required_json
def vtt_create_map():
    data = request.get_json() or {}
    name = (data.get('name') or 'Untitled Map').strip()[:120]
    conn = get_db()
    cur = conn.execute('INSERT INTO vtt_maps (name,user_id) VALUES (?,?)',
                       (name, current_user_id()))
    mid = cur.lastrowid
    conn.commit()
    row = conn.execute('SELECT * FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    conn.close()
    return jsonify(_vtt_row(row)), 201

@app.route('/api/vtt/maps/<int:mid>', methods=['GET'])
@login_required_json
def vtt_get_map(mid):
    conn = get_db()
    row = conn.execute('SELECT * FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'not_found'}), 404
    return jsonify(_vtt_row(row))

def _vtt_apply_update(data):
    """Build aligned (column, value) pairs from a save payload. Returns ([sql_fragments], [values])."""
    sets, vals = [], []
    def add(col, val):
        sets.append(f'{col}=?'); vals.append(val)
    if 'name' in data:
        add('name',       (data.get('name') or 'Untitled Map').strip()[:120])
    if 'img_url' in data:
        add('img_url',    str(data['img_url'])[:500])
    if 'grid_size' in data:
        add('grid_size',  max(20, min(200, int(data.get('grid_size') or 50))))
    if 'grid_on' in data:
        add('grid_on',    1 if data['grid_on'] else 0)
    if 'grid_off_x' in data:
        add('grid_off_x', float(data.get('grid_off_x') or 0))
    if 'grid_off_y' in data:
        add('grid_off_y', float(data.get('grid_off_y') or 0))
    if 'fog_cells' in data:
        add('fog_cells',  json.dumps(data['fog_cells']))
    if 'free_fog' in data:
        add('free_fog',   json.dumps(data['free_fog']))
    if 'tokens' in data:
        add('tokens',     json.dumps(data['tokens']))
    return sets, vals

@app.route('/api/vtt/maps/<int:mid>', methods=['PUT'])
@gm_required_json
def vtt_update_map(mid):
    conn = get_db()
    owner = conn.execute('SELECT user_id FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    if not owner or owner['user_id'] != current_user_id():
        conn.close(); return jsonify({'error': 'not_found'}), 404
    data = request.get_json() or {}
    sets, vals = _vtt_apply_update(data)
    sets.append('updated_at=CURRENT_TIMESTAMP')  # not parametrised
    vals.append(mid)
    conn.execute(f'UPDATE vtt_maps SET {", ".join(sets)} WHERE id=?', vals)
    conn.commit()
    row = conn.execute('SELECT * FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    conn.close()
    return jsonify(_vtt_row(row))

@app.route('/api/vtt/maps/<int:mid>/beacon', methods=['POST'])
@gm_required_json
def vtt_beacon_save(mid):
    """Receives navigator.sendBeacon saves on page unload (POST, no response needed)."""
    conn = get_db()
    owner = conn.execute('SELECT user_id FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    if not owner or owner['user_id'] != current_user_id():
        conn.close(); return ('', 204)
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        conn.close(); return ('', 204)
    sets, vals = _vtt_apply_update(data)
    if not sets:
        conn.close(); return ('', 204)
    sets.append('updated_at=CURRENT_TIMESTAMP')
    vals.append(mid)
    conn.execute(f'UPDATE vtt_maps SET {", ".join(sets)} WHERE id=?', vals)
    conn.commit(); conn.close()
    return ('', 204)

@app.route('/api/vtt/maps/<int:mid>', methods=['DELETE'])
@gm_required_json
def vtt_delete_map(mid):
    conn = get_db()
    owner = conn.execute('SELECT user_id FROM vtt_maps WHERE id=?', (mid,)).fetchone()
    if not owner or owner['user_id'] != current_user_id():
        conn.close(); return jsonify({'error': 'not_found'}), 404
    conn.execute('DELETE FROM vtt_maps WHERE id=?', (mid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

if __name__ == '__main__':
    init_db()
    print('\n  Shadowdark Character Sheet')
    print('  Open: http://localhost:5000\n')
    app.run(host='0.0.0.0', debug=True, port=5000, use_reloader=False)
