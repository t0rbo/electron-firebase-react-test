import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  logs: {
    onMainProcessLog: (callback: (log: {type: string, message: string}) => void) => {
      const listener = (_event: any, log: {type: string, message: string}) => {
        callback(log);
      };
      ipcRenderer.on('main-process-log', listener);
      return () => {
        ipcRenderer.removeListener('main-process-log', listener);
      };
    }
  },
}); 