const { db, notify, hashPIN } = require('../database.cjs');
const { validate, schemas } = require('../utils/validator.cjs');
const { AppError } = require('../utils/errorHandler.cjs');
const log = require('electron-log');

module.exports = {
  getUsers: () => {
    try {
      return db.prepare('SELECT id, name, role FROM users').all();
    } catch (error) {
      log.error('getUsers xatosi:', error);
      throw error;
    }
  },

  saveUser: (user) => {
    try {
      const validated = validate(schemas.user, user);

      if (validated.id) {
        // Userni yangilash
        if (validated.pin) {
           const { salt, hash } = hashPIN(validated.pin);
           db.prepare('UPDATE users SET name = ?, pin = ?, role = ?, salt = ? WHERE id = ?')
             .run(validated.name, hash, validated.role, salt, validated.id);
        } else {
           db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
             .run(validated.name, validated.role, validated.id);
        }
        log.info(`XODIM: ${validated.name} (${validated.role}) ma'lumotlari o'zgartirildi.`);
      } else {
        // Yangi user qo'shish
        const allUsers = db.prepare('SELECT pin, salt FROM users').all();
        const isDuplicate = allUsers.some(u => {
            if (!u.salt) return u.pin === validated.pin; // Eski format
            const { hash } = hashPIN(validated.pin, u.salt);
            return hash === u.pin;
        });

        if (isDuplicate) throw new AppError('DB_CONSTRAINT', 'Bu PIN kod allaqachon ishlatilmoqda');
        
        const { salt, hash } = hashPIN(validated.pin);
        db.prepare('INSERT INTO users (name, pin, role, salt) VALUES (?, ?, ?, ?)')
          .run(validated.name, hash, validated.role, salt);
        
        log.info(`XODIM: Yangi xodim qo'shildi: ${validated.name} (${validated.role})`);
      }
      notify('users', null);
    } catch (error) {
      log.error('saveUser xatosi:', error);
      throw error;
    }
  },

  deleteUser: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) throw new AppError('DB_NOT_FOUND', 'Xodim topilmadi');
      
      if (user.role === 'admin') {
         const adminCount = db.prepare("SELECT count(*) as count FROM users WHERE role = 'admin'").get().count;
         if (adminCount <= 1) throw new AppError('LAST_ADMIN', "Oxirgi adminni o'chirib bo'lmaydi!");
      }
      
      const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      log.warn(`XODIM: Xodim o'chirildi. ID: ${id}, Ism: ${user?.name}`);
      notify('users', null);
      return res;
    } catch (error) {
      log.error('deleteUser xatosi:', error);
      throw error;
    }
  },

  login: (pin) => {
    try {
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        throw new AppError('INVALID_PIN', 'PIN kod 4-6 raqamdan iborat bo\'lishi kerak');
      }

      const users = db.prepare('SELECT * FROM users').all();
      
      const foundUser = users.find(u => {
          if (!u.salt) return u.pin === pin; // Eski format (migratsiya uchun)
          const { hash } = hashPIN(pin, u.salt);
          return hash === u.pin;
      });

      if (!foundUser) {
          log.warn(`LOGIN: Noto'g'ri PIN kod bilan kirishga urinish.`);
          throw new AppError('INVALID_PIN', "Noto'g'ri PIN kod");
      }
      
      log.info(`LOGIN: ${foundUser.name} (${foundUser.role}) tizimga kirdi.`);
      return { id: foundUser.id, name: foundUser.name, role: foundUser.role };
    } catch (error) {
      log.error('login xatosi:', error);
      throw error;
    }
  }
};