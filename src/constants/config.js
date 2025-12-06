export const CONFIG = {
  // PIN Settings
  PIN_LENGTH: 4,
  PIN_MIN_LENGTH: 4,
  PIN_MAX_LENGTH: 6,

  // Timing
  TOAST_DURATION: 3000,
  SMS_RATE_LIMIT: 500,
  DEBOUNCE_DELAY: 300,
  NOTIFICATION_DURATION: 3000,

  // Limits
  MAX_CHECK_NUMBER: 9999,
  MAX_GUEST_COUNT: 100,
  DEFAULT_GUEST_COUNT: 2,

  // Roles
  ROLES: {
    ADMIN: 'admin',
    CASHIER: 'cashier',
    WAITER: 'waiter'
  },

  // Table Status
  TABLE_STATUS: {
    FREE: 'free',
    OCCUPIED: 'occupied',
    PAYMENT: 'payment'
  },

  // Payment Methods
  PAYMENT_METHODS: {
    CASH: 'cash',
    CARD: 'card',
    CLICK: 'click',
    DEBT: 'debt'
  },

  // Customer Types
  CUSTOMER_TYPES: {
    STANDARD: 'standard',
    DISCOUNT: 'discount',
    CASHBACK: 'cashback'
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // File paths
  BACKUP_DIR: 'POS_Backups',

  // Network
  API_TIMEOUT: 10000, // 10 seconds
  
  // Service Charge
  SERVICE_CHARGE_TYPES: {
    PERCENT: 'percent',
    FIXED: 'fixed'
  }
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Internet aloqasi yo'q. Qayta urinib ko'ring.",
  INVALID_PIN: "PIN kod noto'g'ri. Qayta urining.",
  TABLE_OCCUPIED: "Bu stolga boshqa ofitsiant xizmat ko'rsatmoqda.",
  PRINTER_ERROR: "Printer xatosi! Administratorga murojaat qiling.",
  UNAUTHORIZED: "Ruxsat yo'q. Iltimos qayta kiring.",
  UNKNOWN_ERROR: "Kutilmagan xatolik yuz berdi.",
  VALIDATION_ERROR: "Ma'lumotlar noto'g'ri to'ldirilgan.",
  DB_ERROR: "Ma'lumotlar bazasi xatosi."
};

export default CONFIG;