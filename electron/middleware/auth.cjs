const jwt = require('jsonwebtoken');
const log = require('electron-log');

// JWT Secret (Production da .env dan olinadi)
const JWT_SECRET = process.env.JWT_SECRET || 'pos_secret_key_change_in_production_123456';
const JWT_EXPIRES_IN = '24h';

// Token yaratish
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      name: user.name, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Token tekshirish middleware
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token topilmadi' });
    }

    // "Bearer TOKEN" formatidan tokenni olish
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    log.error('Auth middleware xatosi:', error.message);
    return res.status(403).json({ error: 'Noto\'g\'ri yoki muddati o\'tgan token' });
  }
};

// Role-based middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    next();
  };
};

module.exports = {
  generateToken,
  authMiddleware,
  requireRole,
  JWT_SECRET
};