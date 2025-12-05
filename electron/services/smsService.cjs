const axios = require('axios');
const FormData = require('form-data');
const { db } = require('../database.cjs');
const log = require('electron-log');

let token = null;

const getCredentials = () => {
    const email = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_email'").get()?.value;
    const password = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_password'").get()?.value;
    const nickname = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_nickname'").get()?.value || '4546';
    return { email, password, nickname };
};

const loginToEskiz = async () => {
    const { email, password } = getCredentials();
    if (!email || !password) {
        log.warn("Eskiz login/parol sozlanmagan");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        const response = await axios.post('https://notify.eskiz.uz/api/auth/login', formData, {
            headers: formData.getHeaders()
        });

        if (response.data && response.data.data && response.data.data.token) {
            token = response.data.data.token;
            log.info("Eskiz.uz ga muvaffaqiyatli ulandi");
            return token;
        }
    } catch (error) {
        log.error("Eskiz Login Xatosi:", error.response?.data || error.message);
        return null;
    }
};

const sendSMS = async (phone, message, type = 'manual') => {
    // --- TUZATISH: Telefon raqam va Nickname ---
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 9) cleanPhone = '998' + cleanPhone;
    
    if (cleanPhone.length !== 12) {
        log.warn(`Noto'g'ri raqam formati: ${phone}`);
        return { success: false, error: "Raqam formati xato" };
    }

    const { nickname } = getCredentials();

    if (!token) await loginToEskiz();
    if (!token) return { success: false, error: "Avtorizatsiya yo'q" };

    try {
        const formData = new FormData();
        formData.append('mobile_phone', cleanPhone);
        formData.append('message', message);
        formData.append('from', nickname);

        const response = await axios.post('https://notify.eskiz.uz/api/message/sms/send', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        const status = 'sent';
        db.prepare("INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)").run(cleanPhone, message, status, type);
        
        return { success: true, data: response.data };

    } catch (error) {
        const status = 'failed';
        db.prepare("INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)").run(cleanPhone, message, status, type);
        
        log.error("SMS Yuborish Xatosi:", error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            token = null;
            return { success: false, error: "Token expired" };
        }
        
        return { success: false, error: error.message };
    }
};

module.exports = { sendSMS, loginToEskiz };