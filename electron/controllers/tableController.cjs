const { db, notify } = require('../database.cjs');
const { validate, schemas } = require('../utils/validator.cjs');
const { AppError } = require('../utils/errorHandler.cjs');
const log = require('electron-log');

module.exports = {
  getHalls: () => {
    try {
      return db.prepare('SELECT * FROM halls').all();
    } catch (error) {
      log.error('getHalls xatosi:', error);
      throw error;
    }
  },
  
  addHall: (name) => {
    try {
      const validated = validate(schemas.hall, { name });
      const res = db.prepare('INSERT INTO halls (name) VALUES (?)').run(validated.name);
      notify('halls', null);
      return res;
    } catch (error) {
      log.error('addHall xatosi:', error);
      throw error;
    }
  },
  
  deleteHall: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      db.prepare('DELETE FROM tables WHERE hall_id = ?').run(id);
      const res = db.prepare('DELETE FROM halls WHERE id = ?').run(id);
      notify('halls', null);
      notify('tables', null);
      return res;
    } catch (error) {
      log.error('deleteHall xatosi:', error);
      throw error;
    }
  },

  getTables: () => {
    try {
      return db.prepare('SELECT * FROM tables').all();
    } catch (error) {
      log.error('getTables xatosi:', error);
      throw error;
    }
  },
  
  getTablesByHall: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri zal ID');
      return db.prepare('SELECT * FROM tables WHERE hall_id = ?').all(id);
    } catch (error) {
      log.error('getTablesByHall xatosi:', error);
      throw error;
    }
  },
  
  addTable: (hallId, name) => {
    try {
      const validated = validate(schemas.table, { hall_id: hallId, name });
      
      // Hall mavjudligini tekshirish
      const hallExists = db.prepare('SELECT 1 FROM halls WHERE id = ?').get(validated.hall_id);
      if (!hallExists) throw new AppError('DB_NOT_FOUND', 'Zal topilmadi');
      
      const res = db.prepare('INSERT INTO tables (hall_id, name) VALUES (?, ?)').run(validated.hall_id, validated.name);
      notify('tables', null);
      return res;
    } catch (error) {
      log.error('addTable xatosi:', error);
      throw error;
    }
  },
  
  deleteTable: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      const res = db.prepare('DELETE FROM tables WHERE id = ?').run(id);
      notify('tables', null);
      return res;
    } catch (error) {
      log.error('deleteTable xatosi:', error);
      throw error;
    }
  },

  updateTableGuests: (id, count) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri stol ID');
      if (!count || isNaN(count) || count < 0) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri mehmonlar soni');
      
      const res = db.prepare("UPDATE tables SET guests = ?, status = 'occupied', start_time = COALESCE(start_time, ?) WHERE id = ?")
               .run(count, new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), id);
      notify('tables', null);
      return res;
    } catch (error) {
      log.error('updateTableGuests xatosi:', error);
      throw error;
    }
  },

  updateTableStatus: (id, status) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      if (!['free', 'occupied', 'payment'].includes(status)) {
        throw new AppError('INVALID_INPUT', 'Noto\'g\'ri status');
      }
      
      const res = db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, id);
      notify('tables', null);
      return res;
    } catch (error) {
      log.error('updateTableStatus xatosi:', error);
      throw error;
    }
  },
  
  closeTable: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      db.prepare('DELETE FROM order_items WHERE table_id = ?').run(id);
      const res = db.prepare(`UPDATE tables SET status = 'free', guests = 0, start_time = NULL, total_amount = 0 WHERE id = ?`).run(id);
      notify('tables', null);
      notify('table-items', id);
      return res;
    } catch (error) {
      log.error('closeTable xatosi:', error);
      throw error;
    }
  }
};