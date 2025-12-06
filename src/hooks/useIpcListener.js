import { useEffect, useRef } from 'react';

/**
 * OPTIMIZED: IPC listener hook with proper cleanup
 */
export const useIpcListener = (channel, listener) => {
  const savedHandler = useRef();

  useEffect(() => {
    savedHandler.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!window.electron) return;

    const eventHandler = (event, ...args) => {
      if (savedHandler.current) {
        savedHandler.current(event, ...args);
      }
    };

    const removeListener = window.electron.ipcRenderer.on(channel, eventHandler);

    return () => {
      if (removeListener) removeListener();
    };
  }, [channel]);
};