const cron = require('node-cron');
const { db } = require('../database.cjs');
const { sendSMS } = require('./smsService.cjs');
const log = require('electron-log');

const initScheduler = () => {
    log.info("Scheduler xizmati ishga tushdi");

    // Har kuni ertalab 09:00 da
    cron.schedule('0 9 * * *', async () => {
        log.info("Kunlik vazifalar bajarilmoqda...");
        runBirthdayCheck();
        runDebtReminderCheck();
    });
};

// 1. Tug'ilgan kun tabrigi
const runBirthdayCheck = async () => {
    const template = db.prepare("SELECT content FROM sms_templates WHERE type = 'birthday' AND is_active = 1").get();
    if (!template) return;

    // Bugungi sana (MM-DD formatida, chunki yili har xil bo'lishi mumkin)
    const today = new Date().toISOString().slice(5, 10); // "12-05"

    const customers = db.prepare(`SELECT * FROM customers WHERE strftime('%m-%d', birthday) = ?`).all(today);

    for (const customer of customers) {
        if (customer.phone) {
            const msg = template.content.replace('{name}', customer.name);
            await sendSMS(customer.phone, msg, 'birthday');
            log.info(`Tug'ilgan kun SMS yuborildi: ${customer.name}`);
        }
    }
};

// 2. Qarz Eslatmasi
const runDebtReminderCheck = async () => {
    const template = db.prepare("SELECT content FROM sms_templates WHERE type = 'debt_reminder' AND is_active = 1").get();
    if (!template) return;

    const today = new Date().toISOString().slice(0, 10);

    // Qarz muddati kelgan (due_date <= today) va to'lanmagan (is_paid = 0)
    // Va oxirgi eslatmadan 3 kun o'tgan yoki umuman yuborilmagan
    const debts = db.prepare(`
        SELECT d.*, c.name, c.phone 
        FROM customer_debts d
        JOIN customers c ON d.customer_id = c.id
        WHERE d.is_paid = 0 
        AND d.due_date <= ?
        AND (d.last_sms_date IS NULL OR date(d.last_sms_date) <= date('now', '-3 days'))
    `).all(today);

    for (const debt of debts) {
        if (debt.phone) {
            const msg = template.content
                .replace('{name}', debt.name)
                .replace('{amount}', debt.amount.toLocaleString());
            
            const res = await sendSMS(debt.phone, msg, 'debt_reminder');
            
            if (res.success) {
                db.prepare("UPDATE customer_debts SET last_sms_date = datetime('now', 'localtime') WHERE id = ?").run(debt.id);
                log.info(`Qarz eslatmasi yuborildi: ${debt.name}`);
            }
        }
    }
};

module.exports = initScheduler;