/**
 * Ma'lumotlarni formatlash uchun yordamchi funksiyalar
 */

/**
 * Summani formatlash (1000 -> "1,000")
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '0';
  return Number(amount).toLocaleString('uz-UZ');
};

/**
 * Sanani formatlash
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Vaqtni formatlash
 */
export const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Sana va vaqtni formatlash
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Telefon raqamni formatlash (+998 90 123 45 67)
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0,3)} ${cleaned.slice(3,5)} ${cleaned.slice(5,8)} ${cleaned.slice(8,10)} ${cleaned.slice(10)}`;
  }
  
  if (cleaned.length === 9) {
    return `+998 ${cleaned.slice(0,2)} ${cleaned.slice(2,5)} ${cleaned.slice(5,7)} ${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * Foizni formatlash
 */
export const formatPercent = (value, decimals = 0) => {
  if (value === null || value === undefined) return '0%';
  return `${Number(value).toFixed(decimals)}%`;
};

export default {
  currency: formatCurrency,
  date: formatDate,
  time: formatTime,
  dateTime: formatDateTime,
  phone: formatPhone,
  percent: formatPercent
};