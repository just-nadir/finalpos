const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { onChange } = require('./database.cjs');
const ip = require('ip');
const log = require('electron-log');

const { authMiddleware, generateToken } = require('./middleware/auth.cjs');
const { handleError } = require('./utils/errorHandler.cjs');

// Controllers
const tableController = require('./controllers/tableController.cjs');
const productController = require('./controllers/productController.cjs');
const orderController = require('./controllers/orderController.cjs');
const settingsController = require('./controllers/settingsController.cjs');
const staffController = require('./controllers/staffController.cjs');

function startServer() {
  const app = express();
  const PORT = 3000; 

  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  // Real-time updates
  onChange((type, id) => {
    log.info(`📡 Update: ${type} ${id || ''}`);
    io.emit('update', { type, id });
  });

  io.on('connection', (socket) => {
    log.info('📱 Yangi qurilma ulandi:', socket.id);
    socket.on('disconnect', () => log.info('❌ Qurilma uzildi:', socket.id));
  });

  // --- ERROR HANDLING WRAPPER ---
  const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const errorResponse = handleError(error, req.path);
      res.status(error.code === 'INVALID_PIN' ? 401 : 500).json(errorResponse);
    });
  };

  // --- PUBLIC ROUTES ---
  app.post('/api/login', asyncHandler(async (req, res) => {
    const { pin } = req.body;
    const user = staffController.login(pin);
    const token = generateToken(user);
    res.json({ ...user, token });
  }));

  // --- PROTECTED ROUTES ---
  
  // Halls
  app.get('/api/halls', authMiddleware, asyncHandler(async (req, res) => {
    res.json(tableController.getHalls());
  }));

  // Tables
  app.get('/api/tables', authMiddleware, asyncHandler(async (req, res) => {
    res.json(tableController.getTables());
  }));

  app.post('/api/tables/guests', authMiddleware, asyncHandler(async (req, res) => {
    const { tableId, count } = req.body;
    tableController.updateTableGuests(tableId, count);
    res.json({ success: true });
  }));

  // Categories
  app.get('/api/categories', authMiddleware, asyncHandler(async (req, res) => {
    res.json(productController.getCategories());
  }));

  // Products
  app.get('/api/products', authMiddleware, asyncHandler(async (req, res) => {
    const products = productController.getProducts().filter(p => p.is_active === 1);
    res.json(products);
  }));

  // Order Items
  app.get('/api/tables/:id/items', authMiddleware, asyncHandler(async (req, res) => {
    res.json(orderController.getTableItems(req.params.id));
  }));

  app.post('/api/orders/add', authMiddleware, asyncHandler(async (req, res) => {
    orderController.addItem(req.body);
    res.json({ success: true });
  }));

  app.post('/api/orders/bulk-add', authMiddleware, asyncHandler(async (req, res) => {
    const { tableId, items, waiterId } = req.body;
    orderController.addBulkItems(tableId, items, waiterId);
    res.json({ success: true });
  }));

  // Settings
  app.get('/api/settings', authMiddleware, asyncHandler(async (req, res) => {
    res.json(settingsController.getSettings());
  }));

  // --- ERROR HANDLING MIDDLEWARE ---
  app.use((err, req, res, next) => {
    const errorResponse = handleError(err, 'Global Error Handler');
    res.status(500).json(errorResponse);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const localIp = ip.address();
    log.info(`============================================`);
    log.info(`📡 SERVER: http://${localIp}:${PORT}`);
    log.info(`============================================`);
  });
}

module.exports = startServer;