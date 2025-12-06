const { db, notify } = require('../database.cjs');
const { validate, schemas } = require('../utils/validator.cjs');
const { AppError } = require('../utils/errorHandler.cjs');
const log = require('electron-log');

module.exports = {
  getCustomers: () => {
    try {
      return db.prepare('SELECT * FROM customers').all();
    } catch (error) {
      log.error('getCustomers xatosi:', error);
      throw error;
    }
  },
  
  addCustomer: (c) => {
    try {
      const validated = validate(schemas.customer, c);
      const res = db.prepare('INSERT INTO customers (name, phone, type, value, balance, birthday, debt) VALUES (?, ?, ?, ?, ?, ?, 0)').run(validated.name, validated.phone, validated.type, validated.value, 0, validated.birthday || null);
      notify('customers', null);
      return res;
    } catch (error) {
      log.error('addCustomer xatosi:', error);
      throw error;
    }
  },
  
  deleteCustomer: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      const res = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      notify('customers', null);
      return res;
    } catch (error) {
      log.error('deleteCustomer xatosi:', error);
      throw error;
    }
  },

  getDebtors: () => {
    try {
      const query = `
          SELECT 
              c.*,
              MIN(CASE WHEN cd.is_paid = 0 THEN cd.due_date ELSE NULL END) as next_due_date
          FROM customers c
          LEFT JOIN customer_debts cd ON c.id = cd.customer_id
          WHERE c.debt > 0
          GROUP BY c.id
      `;
      return db.prepare(query).all();
    } catch (error) {
      log.error('getDebtors xatosi:', error);
      throw error;
    }
  },
  
  getDebtHistory: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      return db.prepare('SELECT * FROM debt_history WHERE customer_id = ? ORDER BY id DESC').all(id);
    } catch (error) {
      log.error('getDebtHistory xatosi:', error);
      throw error;
    }
  },
  
  payDebt: (customerId, amount, comment) => {
    try {
      const validated = validate(schemas.debtPayment, { customerId, amount, comment });
      
      const customer = db.prepare('SELECT debt FROM customers WHERE id = ?').get(validated.customerId);
      if (!customer) throw new AppError('DB_NOT_FOUND', 'Mijoz topilmadi');
      if (validated.amount > customer.debt) throw new AppError('INVALID_INPUT', 'To\'lov summasi qarzdan oshib ketdi');
      
      const date = new Date().toISOString();
      const updateDebt = db.transaction(() => {
        db.prepare('UPDATE customers SET debt = debt - ? WHERE id = ?').run(validated.amount, validated.customerId);
        db.prepare('INSERT INTO debt_history (customer_id, amount, type, date, comment) VALUES (?, ?, ?, ?, ?)').run(validated.customerId, validated.amount, 'payment', date, validated.comment || 'Qarz to\'lovi');
      });
      
      const res = updateDebt();
      notify('customers', null);
      notify('debtors', null);
      return res;
    } catch (error) {
      log.error('payDebt xatosi:', error);
      throw error;
    }
  }
};