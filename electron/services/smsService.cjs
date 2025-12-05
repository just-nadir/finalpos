const axios = require('axios');
const FormData = require('form-data');
const { db } = require('../database.cjs');
const log = require('electron-log');

let token = null;

// Sozlamalardan login/parolni olish
const getCredentials = () => {
    const email = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_email'").get()?.value;
    const password = db.prepare("SELECT value FROM settings WHERE key = 'eskiz_password'").get()?.value;
    return { email, password };
};

// Eskizga Login qilish va Token olish
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

// SMS yuborish
const sendSMS = async (phone, message, type = 'manual') => {
    if (!token) await loginToEskiz();
    if (!token) return { success: false, error: "Avtorizatsiya yo'q" };

    // Telefon raqamni tozalash (+998...)
    const cleanPhone = phone.replace(/\D/g, ''); 

    try {
        const formData = new FormData();
        formData.append('mobile_phone', cleanPhone);
        formData.append('message', message);
        formData.append('from', '4546'); // Yoki o'z nikingiz

        const response = await axios.post('https://notify.eskiz.uz/api/message/sms/send', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        // Logga yozish
        const status = 'sent';
        db.prepare("INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)").run(phone, message, status, type);
        
        return { success: true, data: response.data };

    } catch (error) {
        const status = 'failed';
        db.prepare("INSERT INTO sms_logs (phone, message, status, date, type) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)").run(phone, message, status, type);
        
        log.error("SMS Yuborish Xatosi:", error.response?.data || error.message);
        
        // Agar token eskirgan bo'lsa, qayta urinib ko'rish (bir marta)
        if (error.response?.status === 401) {
            token = null;
            // Rekursiya ehtiyotkorlik bilan
            return { success: false, error: "Token expired" };
        }
        
        return { success: false, error: error.message };
    }
};

module.exports = { sendSMS, loginToEskiz };