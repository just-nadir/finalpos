const Joi = require('joi');
const log = require('electron-log');

// Validation schemas
const schemas = {
  product: Joi.object({
    id: Joi.number().integer().optional(),
    category_id: Joi.number().integer().positive().required(),
    name: Joi.string().trim().min(1).max(100).required(),
    price: Joi.number().positive().required(),
    destination: Joi.string().required(),
    is_active: Joi.number().integer().valid(0, 1).optional()
  }),

  category: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().trim().min(1).max(50).required()
  }),

  table: Joi.object({
    id: Joi.number().integer().optional(),
    hall_id: Joi.number().integer().positive().required(),
    name: Joi.string().trim().min(1).max(50).required()
  }),

  hall: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().trim().min(1).max(50).required()
  }),

  customer: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().trim().min(1).max(100).required(),
    phone: Joi.string().trim().pattern(/^\d{9,12}$/).required(),
    type: Joi.string().valid('discount', 'cashback', 'standard').required(),
    value: Joi.number().min(0).max(100).required(),
    birthday: Joi.string().allow('', null).optional()
  }),

  user: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().trim().min(1).max(50).required(),
    pin: Joi.string().pattern(/^\d{4,6}$/).required(),
    role: Joi.string().valid('admin', 'cashier', 'waiter').required()
  }),

  kitchen: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().trim().min(1).max(50).required(),
    printer_ip: Joi.string().allow('', null).optional(),
    printer_port: Joi.number().integer().optional(),
    printer_type: Joi.string().valid('lan', 'driver').optional()
  }),

  orderItem: Joi.object({
    tableId: Joi.number().integer().positive().required(),
    productName: Joi.string().required(),
    price: Joi.number().positive().required(),
    quantity: Joi.number().integer().positive().required(),
    destination: Joi.string().required()
  }),

  bulkOrder: Joi.object({
    tableId: Joi.number().integer().positive().required(),
    waiterId: Joi.number().integer().positive().optional(),
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        price: Joi.number().positive().required(),
        qty: Joi.number().integer().positive().required(),
        destination: Joi.string().optional()
      })
    ).min(1).required()
  }),

  checkout: Joi.object({
    tableId: Joi.number().integer().positive().required(),
    total: Joi.number().positive().required(),
    subtotal: Joi.number().positive().required(),
    discount: Joi.number().min(0).required(),
    paymentMethod: Joi.string().valid('cash', 'card', 'click', 'debt').required(),
    customerId: Joi.number().integer().positive().allow(null).optional(),
    items: Joi.array().required(),
    dueDate: Joi.string().allow(null).optional()
  }),

  debtPayment: Joi.object({
    customerId: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().required(),
    comment: Joi.string().max(200).optional()
  })
};

// Validation function
const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(d => d.message).join(', ');
    log.error('Validation error:', errorMessage);
    throw new Error(errorMessage);
  }
  
  return value;
};

module.exports = {
  schemas,
  validate
};