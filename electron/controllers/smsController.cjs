const { db, notify } = require('../database.cjs');
const axios = require('axios');
const FormData = require('form-data');
const log = require('electron-log');

// Tokenni xotirada ushlab turamiz
let ESKIZ_TOKEN = null;

// Sozlamalarni olish (Database yordamchi)
const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
};

// 1. Eskiz.uz Login
const loginEskiz = async () => {
    const email = getSetting('eskiz_email');
    const password = getSetting('eskiz_password');

    if (!email || !password) {
        log.warn("SMS: Eskiz login/parol sozlanmagan.");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        const res = await axios.post('https://notify.eskiz.uz/api/auth/login', formData, {
            headers: formData.getHeaders()
        });

        if (res.data && res.data.data && res.data.data.token) {
            ESKIZ_TOKEN = res.data.data.token;
            log.info("SMS: Token yangilandi.");
            return ESKIZ_TOKEN;
        }
    } catch (err) {
        log.error("SMS Login Error:", err.message);
        return null;
    }
};

// 2. Yagona SMS yuborish
const sendOneSMS = async (phone, message, type = 'manual') => {
    // --- TUZATISH: Telefon raqamni formatlash ---
    let cleanPhone = phone.replace(/\D/g, ''); // Faqat raqamlarni qoldirish
    if (cleanPhone.length === 9) {
        cleanPhone = '998' + cleanPhone; // 998 ni qo'shish
    }

    if (cleanPhone.length !== 12) {
        return { success: false, error: `Raqam noto'g'ri: ${cleanPhone} (12 ta raqam bo'lishi kerak)` };
    }

    // --- TUZATISH: Nickname ni sozlamadan olish ---
    const nickname = getSetting('eskiz_nickname') || '4546';

    if (!ESKIZ_TOKEN) await loginEskiz();
    if (!ESKIZ_TOKEN) return { success: false, error: "Avtorizatsiya xatosi (Login qilinmadi)" };

    try {
        const formData = new FormData();
        formData.append('mobile_phone', cleanPhone);
        formData.append('message', message);
        formData.append('from', nickname); 

        const res = await axios.post('https://notify.eskiz.uz/api/message/sms/send', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${ESKIZ_TOKEN}`
            }
        });

        const status = 'sent';
        db.prepare('INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, ?, ?)').run(cleanPhone, message, status, new Date().toISOString(), type);
        
        return { success: true, data: res.data };

    } catch (err) {
        // Token eskirgan bo'lsa, qayta urinib ko'rish
        if (err.response && err.response.status === 401) {
            log.info("SMS: Token eskirgan, yangilanmoqda...");
            ESKIZ_TOKEN = null;
            return sendOneSMS(phone, message, type);
        }

        const status = 'failed';
        db.prepare('INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, ?, ?)').run(cleanPhone, message, status, new Date().toISOString(), type);
        
        // --- TUZATISH: Aniq xatoni log qilish ---
        const errorDetail = err.response?.data?.message || err.message;
        log.error("SMS Send Error:", errorDetail);
        if (err.response?.data) log.error("Eskiz Response:", JSON.stringify(err.response.data));

        return { success: false, error: errorDetail };
    }
};

module.exports = {
    // Sozlamalarni saqlash
    saveSettings: (data) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const update = db.transaction((settings) => {
            for (const [key, value] of Object.entries(settings)) stmt.run(key, String(value));
        });
        update(data);
        ESKIZ_TOKEN = null; // Sozlama o'zgarsa tokenni yangilash uchun null qilamiz
        return { success: true };
    },

    // Sozlamalarni o'qish
    getSettings: () => {
        const email = getSetting('eskiz_email');
        const nickname = getSetting('eskiz_nickname');
        return { email: email || '', eskiz_nickname: nickname || '4546' };
    },

    // Shablonlarni olish
    getTemplates: () => db.prepare('SELECT * FROM sms_templates').all(),
    
    // Shablonni yangilash
    updateTemplate: (type, text) => {
        db.prepare('UPDATE sms_templates SET content = ? WHERE type = ?').run(text, type);
        return { success: true };
    },

    // Tarixni olish
    getHistory: () => {
        return db.prepare('SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100').all();
    },

    // Ommaviy yuborish
    sendBroadcast: async (message) => {
        const customers = db.prepare('SELECT phone FROM customers').all();
        let sentCount = 0;
        
        for (const c of customers) {
            if (c.phone) {
                // Rate limit (sekundiga 2-3 ta sms)
                await new Promise(r => setTimeout(r, 500)); 
                const res = await sendOneSMS(c.phone, message, 'news');
                if (res.success) sentCount++;
            }
        }
        return { success: true, count: sentCount };
    },

    sendSMS: sendOneSMS
};