const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const crypto = require('crypto');

// --- Baza manzilini aniqlash ---
const isDev = !app.isPackaged;
const dbPath = isDev
    ? path.join(__dirname, '../pos.db') 
    : path.join(app.getPath('userData'), 'pos.db');

console.log("📂 BAZA MANZILI:", dbPath);

const db = new Database(dbPath, { verbose: null });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
let changeListeners = [];

function onChange(callback) {
  changeListeners.push(callback);
}

function notify(type, id = null) {
  changeListeners.forEach(cb => cb(type, id));
}

// Hashlash funksiyasi
function hashPIN(pin, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function initDB() {
  try {
    // --- MIGRATSIYA 1: Eski SMS jadvalini yangilash ---
    const smsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sms_templates'").get();
    if (smsTableExists) {
        const columns = db.prepare("PRAGMA table_info(sms_templates)").all();
        if (!columns.some(c => c.name === 'content')) {
            db.prepare("DROP TABLE sms_templates").run();
            console.log("♻️ Eski SMS jadvali o'chirildi va yangisi yaratiladi.");
        }
    }

    // --- JADVALLARNI YARATISH ---

    // 1. Zallar va Stollar
    db.prepare(`CREATE TABLE IF NOT EXISTS halls (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hall_id INTEGER,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'free',
        start_time TEXT,
        total_amount REAL DEFAULT 0,
        current_check_number INTEGER DEFAULT 0,
        waiter_id INTEGER DEFAULT 0,
        waiter_name TEXT,
        guests INTEGER DEFAULT 0,
        FOREIGN KEY(hall_id) REFERENCES halls(id) ON DELETE CASCADE
      )
    `).run();

    // 2. Kategoriyalar va Mahsulotlar (YANGILANGAN STRUKTURA)
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        destination TEXT, 
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      )
    `).run();

    // 3. Buyurtmalar
    db.prepare(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER,
        product_name TEXT,
        price REAL,
        quantity INTEGER,
        destination TEXT DEFAULT 'kitchen',
        FOREIGN KEY(table_id) REFERENCES tables(id) ON DELETE CASCADE
      )
    `).run();

    // 4. Savdolar
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        check_number INTEGER,
        date TEXT,
        total_amount REAL,
        subtotal REAL,
        discount REAL,
        payment_method TEXT,
        customer_id INTEGER,
        waiter_name TEXT,
        guest_count INTEGER,
        items_json TEXT
      )
    `).run();
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_name TEXT,
        category_name TEXT,
        price REAL,
        quantity REAL,
        total_price REAL,
        date TEXT,
        FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
      )
    `).run();

    // 5. Mijozlar va Qarzlar
    db.prepare(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        debt REAL DEFAULT 0,
        notes TEXT,
        type TEXT DEFAULT 'standard', 
        value INTEGER DEFAULT 0, 
        balance REAL DEFAULT 0, 
        birthday TEXT
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS debt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        amount REAL,
        type TEXT,
        date TEXT,
        comment TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        amount REAL,
        due_date TEXT,
        last_sms_date TEXT,
        is_paid INTEGER DEFAULT 0,
        created_at TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `).run();

    // 6. Xodimlar
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin TEXT UNIQUE,
        role TEXT DEFAULT 'waiter',
        salt TEXT
      )
    `).run();

    // 7. Sozlamalar
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();

    // 8. Oshxona
    db.prepare(`CREATE TABLE IF NOT EXISTS kitchens (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, printer_ip TEXT, printer_port INTEGER DEFAULT 9100, printer_type TEXT DEFAULT 'driver')`).run();

    // 9. SMS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sms_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            type TEXT UNIQUE, 
            title TEXT,
            content TEXT, 
            is_active INTEGER DEFAULT 1
        )
    `).run();
    
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            phone TEXT, 
            message TEXT, 
            status TEXT, 
            date TEXT, 
            type TEXT
        )
    `).run();

    // --- INDEKSLAR ---
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tables_hall ON tables(hall_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_items_table ON order_items(table_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_debt_history_customer ON debt_history(customer_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_customer_debts_status ON customer_debts(is_paid, due_date)`).run();

    // --- MIGRATSIYALAR (Yangi ustunlarni qo'shish) ---
    
    // 1. Users jadvali uchun
    const userCols = db.prepare(`PRAGMA table_info(users)`).all();
    if (!userCols.some(c => c.name === 'salt')) db.prepare(`ALTER TABLE users ADD COLUMN salt TEXT`).run();

    // 2. Products jadvali uchun (XATOLIKNI TUZATUVCHI QISM)
    const productCols = db.prepare("PRAGMA table_info(products)").all();
    if (!productCols.some(c => c.name === 'destination')) {
        db.prepare("ALTER TABLE products ADD COLUMN destination TEXT").run();
        console.log("✅ 'destination' ustuni products jadvaliga qo'shildi.");
    }
    if (!productCols.some(c => c.name === 'is_active')) {
        db.prepare("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1").run();
        console.log("✅ 'is_active' ustuni products jadvaliga qo'shildi.");
    }

    // --- SEEDING: Default Admin yaratish ---
    const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
    const { salt, hash } = hashPIN('1111'); 

    if (!adminUser) {
        db.prepare("INSERT INTO users (name, pin, role, salt) VALUES ('Admin', ?, 'admin', ?)").run(hash, salt);
        console.log("✅ Yangi Admin yaratildi (PIN: 1111)");
    } else {
        db.prepare("UPDATE users SET pin = ?, salt = ? WHERE id = ?").run(hash, salt, adminUser.id);
        console.log("♻️ Admin paroli 1111 ga qayta tiklandi.");
    }

    // Default SMS Shablonlari
    const templateCount = db.prepare('SELECT count(*) as count FROM sms_templates').get().count;
    if (templateCount === 0) {
        const insert = db.prepare('INSERT INTO sms_templates (type, title, content) VALUES (?, ?, ?)');
        insert.run('debt_reminder', 'Qarz Eslatmasi', 'Hurmatli {name}, sizning {amount} so\'m qarzingiz muddati keldi. Iltimos, to\'lovni amalga oshiring.');
        insert.run('new_menu', 'Yangi Menyular', 'Assalomu alaykum {name}! Bizda yangi ajoyib taomlar bor. Tatib ko\'rishga taklif qilamiz!');
        insert.run('birthday', 'Tug\'ilgan Kun', 'Hurmatli {name}, tug\'ilgan kuningiz bilan tabriklaymiz! Siz uchun bugun maxsus chegirmamiz bor.');
        console.log("✅ SMS shablonlari yaratildi.");
    }

    log.info("Bazalar tekshirildi va yuklandi.");

  } catch (err) {
    log.error("Baza yaratishda xatolik:", err);
    console.error("Baza xatosi:", err);
  }
}

module.exports = { db, initDB, onChange, notify, hashPIN };