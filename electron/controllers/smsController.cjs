const { db } = require('../database.cjs');
const { sendSMS, resetToken } = require('../services/smsService.cjs');
const log = require('electron-log');

const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
};

const saveSettings = (data) => {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Noto\'g\'ri ma\'lumot formati');
        }

        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const update = db.transaction((settings) => {
            for (const [key, value] of Object.entries(settings)) {
                if (key && value !== undefined) {
                    stmt.run(key, String(value));
                }
            }
        });
        update(data);
        
        resetToken();
        log.info("SMS Controller: Sozlamalar saqlandi");
        return { success: true };
    } catch (error) {
        log.error("SMS Controller: Sozlamalarni saqlashda xato:", error.message);
        return { success: false, error: error.message };
    }
};

const getSettings = () => {
    const email = getSetting('eskiz_email') || '';
    const nickname = getSetting('eskiz_nickname') || '4546';
    return { email, eskiz_nickname: nickname };
};

const getTemplates = () => {
    try {
      return db.prepare('SELECT * FROM sms_templates').all();
    } catch (error) {
      log.error('getTemplates xatosi:', error);
      return [];
    }
};

const updateTemplate = (type, text) => {
    try {
        if (!type || !text) {
          throw new Error('Type va text majburiy');
        }
        
        db.prepare('UPDATE sms_templates SET content = ? WHERE type = ?').run(text, type);
        log.info(`SMS Controller: Shablon yangilandi - ${type}`);
        return { success: true };
    } catch (error) {
        log.error("SMS Controller: Shablonni yangilashda xato:", error.message);
        return { success: false, error: error.message };
    }
};

const getHistory = () => {
    try {
      return db.prepare('SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100').all();
    } catch (error) {
      log.error('getHistory xatosi:', error);
      return [];
    }
};

const sendBroadcast = async (message) => {
    try {
        if (!message || message.trim().length === 0) {
          throw new Error('Xabar matni bo\'sh bo\'lishi mumkin emas');
        }

        const customers = db.prepare('SELECT phone, name FROM customers WHERE phone IS NOT NULL AND phone != ""').all();
        
        let sentCount = 0;
        let failedCount = 0;
        const totalCustomers = customers.length;

        if (totalCustomers === 0) {
          return { success: false, error: 'Telefon raqami bo\'lgan mijozlar yo\'q' };
        }

        log.info(`SMS Controller: Ommaviy yuborish boshlandi - ${totalCustomers} ta mijoz`);

        for (const customer of customers) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const result = await sendSMS(customer.phone, message, 'news');
            
            if (result.success) {
                sentCount++;
            } else {
                failedCount++;
                log.warn(`SMS Controller: Xato - ${customer.name} (${customer.phone}): ${result.error}`);
            }
        }

        log.info(`SMS Controller: Ommaviy yuborish tugadi - Yuborildi: ${sentCount}, Xato: ${failedCount}`);
        
        return { 
            success: true, 
            count: sentCount,
            failed: failedCount,
            total: totalCustomers
        };
    } catch (error) {
        log.error("SMS Controller: Ommaviy yuborishda xato:", error.message);
        return { success: false, error: error.message };
    }
};

const sendOne = async (phone, message, type = 'manual') => {
    return await sendSMS(phone, message, type);
};

module.exports = {
    saveSettings,
    getSettings,
    getTemplates,
    updateTemplate,
    getHistory,
    sendBroadcast,
    sendSMS: sendOne
};