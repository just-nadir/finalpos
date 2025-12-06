/**
 * IPC Helper - Electron bilan muloqot uchun yordamchi
 */

import { ERROR_MESSAGES } from '@constants/config';

/**
 * IPC chaqiruv
 * @param {string} channel - IPC kanal nomi
 * @param  {...any} args - Argumentlar
 * @returns {Promise<any>}
 */
export const ipcCall = async (channel, ...args) => {
  if (!window.electron) {
    throw new Error('Electron muhiti topilmadi');
  }

  try {
    return await window.electron.ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC Error [${channel}]:`, error);
    
    // User-friendly error message
    if (error.message.includes('network') || error.message.includes('timeout')) {
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }
    
    if (error.message.includes('PIN')) {
      throw new Error(ERROR_MESSAGES.INVALID_PIN);
    }
    
    throw new Error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR);
  }
};

/**
 * IPC listener (useEffect uchun)
 * @param {string} channel - Kanal nomi
 * @param {Function} handler - Handler funksiya
 * @returns {Function} Cleanup function
 */
export const ipcListen = (channel, handler) => {
  if (!window.electron) {
    console.warn('Electron muhiti topilmadi, listener ishlamaydi');
    return () => {};
  }

  const removeListener = window.electron.ipcRenderer.on(channel, handler);
  return removeListener || (() => {});
};

/**
 * Barcha listenerlarni o'chirish
 * @param {string} channel - Kanal nomi
 */
export const ipcRemoveAll = (channel) => {
  if (window.electron) {
    window.electron.ipcRenderer.removeAllListeners(channel);
  }
};

export default {
  call: ipcCall,
  listen: ipcListen,
  removeAll: ipcRemoveAll
};