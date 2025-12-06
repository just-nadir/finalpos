const { db, notify } = require('../database.cjs');
const { validate, schemas } = require('../utils/validator.cjs');
const { AppError } = require('../utils/errorHandler.cjs');
const log = require('electron-log');

module.exports = {
  getCategories: () => {
    try {
      return db.prepare('SELECT * FROM categories').all();
    } catch (error) {
      log.error('getCategories xatosi:', error);
      throw error;
    }
  },
  
  addCategory: (name) => {
    try {
      const validated = validate(schemas.category, { name });
      const res = db.prepare('INSERT INTO categories (name) VALUES (?)').run(validated.name);
      notify('products', null);
      notify('categories', null);
      return res;
    } catch (error) {
      log.error('addCategory xatosi:', error);
      throw error;
    }
  },

  updateCategory: (id, name) => {
    try {
      const validated = validate(schemas.category, { id, name });
      const exists = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(validated.id);
      if (!exists) throw new AppError('DB_NOT_FOUND', 'Kategoriya topilmadi');
      
      const res = db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(validated.name, validated.id);
      notify('products', null);
      notify('categories', null);
      return res;
    } catch (error) {
      log.error('updateCategory xatosi:', error);
      throw error;
    }
  },

  deleteCategory: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      db.prepare('DELETE FROM products WHERE category_id = ?').run(id);
      const res = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      
      notify('products', null);
      notify('categories', null);
      return res;
    } catch (error) {
      log.error('deleteCategory xatosi:', error);
      throw error;
    }
  },

  getProducts: () => {
    try {
      return db.prepare(`
        SELECT p.*, c.name as category_name, k.name as kitchen_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        LEFT JOIN kitchens k ON p.destination = CAST(k.id AS TEXT)
      `).all();
    } catch (error) {
      log.error('getProducts xatosi:', error);
      throw error;
    }
  },
  
  addProduct: (p) => {
    try {
      const validated = validate(schemas.product, p);
      
      // Category mavjudligini tekshirish
      const categoryExists = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(validated.category_id);
      if (!categoryExists) throw new AppError('DB_NOT_FOUND', 'Kategoriya topilmadi');
      
      const res = db.prepare('INSERT INTO products (category_id, name, price, destination, is_active) VALUES (?, ?, ?, ?, ?)').run(validated.category_id, validated.name, validated.price, String(validated.destination), 1);
      notify('products', null);
      return res;
    } catch (error) {
      log.error('addProduct xatosi:', error);
      throw error;
    }
  },
  
  toggleProductStatus: (id, status) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      if (![0, 1].includes(Number(status))) throw new AppError('INVALID_INPUT', 'Status 0 yoki 1 bo\'lishi kerak');
      
      const res = db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(status, id);
      notify('products', null);
      return res;
    } catch (error) {
      log.error('toggleProductStatus xatosi:', error);
      throw error;
    }
  },
  
  deleteProduct: (id) => {
    try {
      if (!id || isNaN(id)) throw new AppError('INVALID_INPUT', 'Noto\'g\'ri ID');
      
      const res = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      notify('products', null);
      return res;
    } catch (error) {
      log.error('deleteProduct xatosi:', error);
      throw error;
    }
  }
};