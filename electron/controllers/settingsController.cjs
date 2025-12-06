const { db, notify } = require('../database.cjs');
const { validate, schemas } = require('../utils/validator.cjs');
const { AppError } = require('../utils/errorHandler.cjs');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

module.exports = {
  getSettings: () => {
    try {
      const rows = db.prepare('SELECT * FROM settings').all();
      return rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
    } catch (error) {
      log.error('getSettings xatosi:', error);
      throw error;
    }
  },

  saveSettings: (settingsObj) => {
    try {
      if (!settingsObj || typeof settingsObj !== 'object') {
        throw new AppError('INVALID_INPUT', 'Noto\'g\'ri sozlamalar formati');
      }

      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const saveTransaction = db.transaction((settings) => {
        for (const [key, value] of Object.entries(settings)) {
          if (key && value !== undefined) {
            stmt.run(key, String(value));
          }
        }
      });
      
      const res = saveTransaction(settingsObj);
      notify('settings', null);
      log.info('Sozlamalar saqlandi');
      return res;
    } catch (error) {
      log.error('saveSettings xatosi:', error);
      throw error;
    }
  },

  getKitchens: () => {
    try {
      return db.prepare('SELECT * FROM kitchens').all();
    } catch (error) {
      log.error('getKitchens xatosi:', error);
      throw error;
    }
  },
  
  saveKitchen: (data) => {
    try {
      const validated = validate(schemas.kitchen, data);
      const type = validated.printer_type || 'driver';
      
      if (validated.id) {
          db.prepare('UPDATE kitchens SET name = ?, printer_ip = ?, printer_port = ?, printer_type = ? WHERE id = ?')
            .run(validated.name, validated.printer_ip || '', validated.printer_port || 9100, type, validated.id);
          log.info(`Oshxona yangilandi: ${validated.name}`);
      } else {
          db.prepare('INSERT INTO kitchens (name, printer_ip, printer_port, printer_type) VALUES (?, ?, ?, ?)')
            .run(validated.name, validated.printer_ip || '', validated.printer_port || 9100, type);
          log.info(`Yangi oshxona qo'shildi: ${validated.name}`);
      }
      notify('kitchens', null);
    } catch (error) {
      log.error('saveKitchen xatosi:', error);
      throw error;
    }
  },
  
  deleteKitchen: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      db.prepare("UPDATE products SET destination = NULL WHERE destination = ?").run(String(id));
      const res = db.prepare('DELETE FROM kitchens WHERE id = ?').run(id);
      notify('kitchens', null);
      log.info(`Oshxona o'chirildi: ID ${id}`);
      return res;
    } catch (error) {
      log.error('deleteKitchen xatosi:', error);
      throw error;
    }
  },

  backupDB: () => {
      try {
          const dbPath = path.join(app.getAppPath(), 'pos.db');
          
          if (!fs.existsSync(dbPath)) {
            throw new AppError('DB_NOT_FOUND', 'Ma\'lumotlar bazasi topilmadi');
          }

          const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const backupName = `pos_backup_${dateStr}.db`;
          const backupPath = path.join(app.getPath('documents'), 'POS_Backups', backupName);
          const backupDir = path.dirname(backupPath);

          if (!fs.existsSync(backupDir)) {
              fs.mkdirSync(backupDir, { recursive: true });
          }
          
          db.backup(backupPath)
            .then(() => {
                log.info('Backup muvaffaqiyatli:', backupPath);
            })
            .catch((err) => {
                log.error('Backup xatosi:', err);
                throw err;
            });

          return { success: true, path: backupPath };
      } catch (err) {
          log.error('backupDB xatosi:', err);
          throw new AppError('DB_CONNECTION', "Backup qilib bo'lmadi: " + err.message);
      }
  }
};