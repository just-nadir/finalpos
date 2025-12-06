const log = require('electron-log');

const ERROR_MESSAGES = {
  // Database errors
  DB_NOT_FOUND: "Ma'lumot topilmadi",
  DB_CONSTRAINT: "Ma'lumotlar bazasi cheklovi buzildi",
  DB_CONNECTION: "Ma'lumotlar bazasiga ulanishda xatolik",
  
  // Validation errors
  VALIDATION_FAILED: "Kiritilgan ma'lumotlar noto'g'ri",
  INVALID_INPUT: "Noto'g'ri ma'lumot kiritilgan",
  
  // Auth errors
  INVALID_PIN: "PIN kod noto'g'ri",
  UNAUTHORIZED: "Ruxsat yo'q",
  LAST_ADMIN: "Oxirgi adminni o'chirib bo'lmaydi",
  
  // Business logic errors
  TABLE_OCCUPIED: "Stol band",
  PRINTER_ERROR: "Printer xatosi",
  NETWORK_ERROR: "Tarmoq xatosi",
  
  // Generic
  UNKNOWN_ERROR: "Kutilmagan xatolik yuz berdi"
};

class AppError extends Error {
  constructor(code, message, details = null) {
    super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

const handleError = (error, context = '') => {
  const errorInfo = {
    context,
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  log.error(`[${context}]`, errorInfo);
  
  // User-friendly message
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  
  // SQLite errors
  if (error.code === 'SQLITE_CONSTRAINT') {
    return { success: false, error: ERROR_MESSAGES.DB_CONSTRAINT };
  }
  
  // Generic error
  return { 
    success: false, 
    error: ERROR_MESSAGES.UNKNOWN_ERROR,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  };
};

module.exports = {
  AppError,
  handleError,
  ERROR_MESSAGES
};