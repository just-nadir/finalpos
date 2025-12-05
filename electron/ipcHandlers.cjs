const { db, notify, hashPIN } = require('./database.cjs');
const { sendSMS, loginToEskiz } = require('./services/smsService.cjs');
const log = require('electron-log');

function registerIpcHandlers(ipcMain) {
    
    // ==========================================
    // 1. AUTH & SETTINGS (Tizim va Sozlamalar)
    // ==========================================

    // Login (PIN tekshirish)
    ipcMain.handle('login', async (event, inputPin) => {
        try {
            const users = db.prepare('SELECT * FROM users').all();
            const foundUser = users.find(u => {
                const { hash } = hashPIN(inputPin, u.salt);
                return hash === u.pin;
            });

            if (foundUser) {
                const { pin, salt, ...safeUser } = foundUser;
                return { success: true, user: safeUser };
            }
            return { success: false, error: 'PIN noto\'g\'ri' };
        } catch (error) {
            log.error('Login xatosi:', error);
            return { success: false, error: 'Tizim xatosi' };
        }
    });

    // Sozlamalarni olish
    ipcMain.handle('get-settings', () => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return settings;
    });

    // Sozlamalarni saqlash
    ipcMain.handle('save-settings', (event, newSettings) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        db.transaction(() => {
            for (const [key, value] of Object.entries(newSettings)) {
                stmt.run(key, String(value));
            }
        })();
        
        // Agar Eskiz login o'zgargan bo'lsa, qayta ulanib ko'ramiz
        if (newSettings.eskiz_email || newSettings.eskiz_password) {
            loginToEskiz();
        }

        notify('settings');
        return { success: true };
    });

    // ==========================================
    // 2. POS CORE (Zallar, Stollar, Kategoriyalar)
    // ==========================================

    // --- ZALLAR ---
    ipcMain.handle('get-halls', () => {
        return db.prepare('SELECT * FROM halls').all();
    });

    ipcMain.handle('save-hall', (event, hall) => {
        if (hall.id) {
            db.prepare('UPDATE halls SET name = ? WHERE id = ?').run(hall.name, hall.id);
        } else {
            db.prepare('INSERT INTO halls (name) VALUES (?)').run(hall.name);
        }
        notify('halls');
        return { success: true };
    });

    ipcMain.handle('delete-hall', (event, id) => {
        db.prepare('DELETE FROM halls WHERE id = ?').run(id);
        notify('halls');
        return { success: true };
    });

    // --- STOLLAR ---
    ipcMain.handle('get-tables', () => {
        return db.prepare('SELECT * FROM tables').all();
    });

    ipcMain.handle('save-table', (event, table) => {
        if (table.id) {
            db.prepare('UPDATE tables SET name = ?, hall_id = ? WHERE id = ?').run(table.name, table.hall_id, table.id);
        } else {
            db.prepare('INSERT INTO tables (name, hall_id) VALUES (?, ?)').run(table.name, table.hall_id);
        }
        notify('tables');
        return { success: true };
    });

    ipcMain.handle('delete-table', (event, id) => {
        db.prepare('DELETE FROM tables WHERE id = ?').run(id);
        notify('tables');
        return { success: true };
    });

    // --- KATEGORIYALAR ---
    ipcMain.handle('get-categories', () => {
        return db.prepare('SELECT * FROM categories').all();
    });

    ipcMain.handle('save-category', (event, cat) => {
        if (cat.id) {
            db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(cat.name, cat.id);
        } else {
            db.prepare('INSERT INTO categories (name) VALUES (?)').run(cat.name);
        }
        notify('categories');
        return { success: true };
    });

    ipcMain.handle('delete-category', (event, id) => {
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        notify('categories');
        return { success: true };
    });

    // --- MAHSULOTLAR ---
    ipcMain.handle('get-products', () => {
        return db.prepare('SELECT * FROM products WHERE status = "active"').all();
    });

    ipcMain.handle('save-product', (event, prod) => {
        if (prod.id) {
            db.prepare('UPDATE products SET name = ?, price = ?, category_id = ?, printer = ? WHERE id = ?')
              .run(prod.name, prod.price, prod.category_id, prod.printer, prod.id);
        } else {
            db.prepare('INSERT INTO products (name, price, category_id, printer) VALUES (?, ?, ?, ?)')
              .run(prod.name, prod.price, prod.category_id, prod.printer);
        }
        notify('products');
        return { success: true };
    });

    ipcMain.handle('delete-product', (event, id) => {
        db.prepare('UPDATE products SET status = "deleted" WHERE id = ?').run(id);
        notify('products');
        return { success: true };
    });

    // ==========================================
    // 3. ORDERS & SALES (Buyurtma va Savdo)
    // ==========================================

    // Stol buyurtmalarini olish
    ipcMain.handle('get-order-items', (event, tableId) => {
        if (!tableId) return [];
        return db.prepare('SELECT * FROM order_items WHERE table_id = ?').all(tableId);
    });

    // Buyurtma qo'shish
    ipcMain.handle('add-order-item', (event, item) => {
        db.prepare('INSERT INTO order_items (table_id, product_name, price, quantity, destination) VALUES (?, ?, ?, ?, ?)')
          .run(item.table_id, item.product_name, item.price, item.quantity, item.destination || 'kitchen');
        
        // Stol holatini yangilash
        db.prepare("UPDATE tables SET status = 'busy', total_amount = total_amount + ? WHERE id = ?")
          .run(item.price * item.quantity, item.table_id);
          
        notify('tables', item.table_id);
        return { success: true };
    });

    // Buyurtmani o'chirish
    ipcMain.handle('delete-order-item', (event, { id, table_id, amount }) => {
        db.prepare('DELETE FROM order_items WHERE id = ?').run(id);
        db.prepare('UPDATE tables SET total_amount = total_amount - ? WHERE id = ?').run(amount, table_id);
        
        // Agar stolda boshqa buyurtma qolmasa, statusni free qilish
        const count = db.prepare('SELECT count(*) as count FROM order_items WHERE table_id = ?').get(table_id).count;
        if (count === 0) {
            db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(table_id);
        }

        notify('tables', table_id);
        return { success: true };
    });

    // CHECKOUT (Yopish va To'lov)
    ipcMain.handle('checkout', (event, { table_id, total_amount, payment_method, customer_id, waiter_name, discount, items, due_date }) => {
        const date = new Date().toISOString();
        const check_number = Math.floor(Date.now() / 1000); // Simple check number
        
        const insertSale = db.transaction(() => {
            // 1. Sales jadvaliga yozish
            const info = db.prepare(`
                INSERT INTO sales (check_number, date, total_amount, subtotal, discount, payment_method, customer_id, waiter_name, items_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(check_number, date, total_amount, total_amount + discount, discount, payment_method, customer_id || null, waiter_name, JSON.stringify(items));

            const sale_id = info.lastInsertRowid;

            // 2. Sale Items yozish
            const itemStmt = db.prepare(`
                INSERT INTO sale_items (sale_id, product_name, price, quantity, total_price, date)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const item of items) {
                itemStmt.run(sale_id, item.product_name, item.price, item.quantity, item.price * item.quantity, date);
            }

            // 3. Stolni bo'shatish
            db.prepare("UPDATE tables SET status = 'free', total_amount = 0, current_check_number = 0, guests = 0 WHERE id = ?").run(table_id);
            db.prepare("DELETE FROM order_items WHERE table_id = ?").run(table_id);

            // 4. Agar NASIYA bo'lsa
            if (payment_method === 'debt' && customer_id) {
                // Customer balansini yangilash (qarzini oshirish)
                db.prepare("UPDATE customers SET debt = debt + ? WHERE id = ?").run(total_amount, customer_id);
                
                // Debt history
                db.prepare("INSERT INTO debt_history (customer_id, amount, type, date, comment) VALUES (?, ?, 'debt', ?, ?)")
                  .run(customer_id, total_amount, date, `Check #${check_number}`);

                // YANGI: Debt Tracking (SMS uchun)
                if (due_date) {
                    db.prepare(`
                        INSERT INTO customer_debts (customer_id, amount, due_date, created_at)
                        VALUES (?, ?, ?, datetime('now', 'localtime'))
                    `).run(customer_id, total_amount, due_date);
                }
            }
        });

        try {
            insertSale();
            notify('tables');
            notify('sales');
            return { success: true, check_number };
        } catch (err) {
            log.error('Checkout error:', err);
            return { success: false, error: err.message };
        }
    });

    // ==========================================
    // 4. CUSTOMERS (Mijozlar)
    // ==========================================
    ipcMain.handle('get-customers', () => {
        return db.prepare('SELECT * FROM customers').all();
    });

    ipcMain.handle('save-customer', (event, cust) => {
        if (cust.id) {
            db.prepare('UPDATE customers SET name = ?, phone = ?, notes = ?, birthday = ? WHERE id = ?')
              .run(cust.name, cust.phone, cust.notes, cust.birthday, cust.id);
        } else {
            db.prepare('INSERT INTO customers (name, phone, notes, birthday) VALUES (?, ?, ?, ?)')
              .run(cust.name, cust.phone, cust.notes, cust.birthday);
        }
        notify('customers');
        return { success: true };
    });

    ipcMain.handle('delete-customer', (event, id) => {
        db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        notify('customers');
        return { success: true };
    });

    // ==========================================
    // 5. SMS MARKETING & LOGS (Yangi Modul)
    // ==========================================
    
    ipcMain.handle('get-sms-templates', () => {
        return db.prepare("SELECT * FROM sms_templates").all();
    });

    ipcMain.handle('save-sms-template', (event, { type, content, title, is_active }) => {
        db.prepare("UPDATE sms_templates SET content = ?, title = ?, is_active = ? WHERE type = ?")
          .run(content, title, is_active ? 1 : 0, type);
        return { success: true };
    });

    ipcMain.handle('get-sms-logs', () => {
        return db.prepare("SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100").all();
    });

    ipcMain.handle('send-mass-sms', async (event, { message, filter }) => {
        let customers = [];
        if (filter === 'all') {
            customers = db.prepare("SELECT name, phone FROM customers WHERE phone IS NOT NULL AND phone != ''").all();
        } else if (filter === 'debtors') {
            customers = db.prepare("SELECT name, phone FROM customers WHERE debt > 0 AND phone IS NOT NULL").all();
        }

        let sentCount = 0;
        for (const cust of customers) {
            const finalMsg = message.replace('{name}', cust.name);
            const res = await sendSMS(cust.phone, finalMsg, 'bulk');
            if (res.success) sentCount++;
        }
        return { success: true, count: sentCount, total: customers.length };
    });
}

module.exports = registerIpcHandlers;