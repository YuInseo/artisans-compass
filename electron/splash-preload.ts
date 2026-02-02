import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    onUpdateStatus: (callback: (message: string) => void) => {
        ipcRenderer.on('update-status', (_, message) => callback(message));
    },
    onDownloadProgress: (callback: (percent: number) => void) => {
        ipcRenderer.on('download-progress', (_, percent) => callback(percent));
    }
});
