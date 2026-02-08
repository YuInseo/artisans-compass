import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  removeListener(...args: Parameters<typeof ipcRenderer.removeListener>) {
    const [channel, ...omit] = args
    return ipcRenderer.removeListener(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    // Internal Log for Debug Overlay
    console.log(`[IPC Send] ${channel}`, ...omit);
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    // Internal Log for Debug Overlay
    console.log(`[IPC Invoke] ${channel}`, ...omit);
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Specific APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProjects: (projects: any) => ipcRenderer.invoke('save-projects', projects),
  getMonthlyLog: (yearMonth: string) => ipcRenderer.invoke('get-monthly-log', yearMonth),
  saveMonthlyLog: (data: { yearMonth: string, data: any }) => ipcRenderer.invoke('save-monthly-log', data),
  saveDailyLog: (dateStr: string, data: any) => ipcRenderer.invoke('save-daily-log', dateStr, data),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  showNotification: (offset: { title: string, body: string }) => ipcRenderer.invoke('show-notification', offset),

  onTrackingUpdate: (callback: (state: any) => void) => {
    const listener = (_event: any, state: any) => callback(state);
    ipcRenderer.on('tracking-update', listener);
    return () => ipcRenderer.off('tracking-update', listener);
  },
  onSessionCompleted: (callback: (session: any) => void) => {
    const listener = (_event: any, session: any) => callback(session);
    ipcRenderer.on('session-completed', listener);
    return () => ipcRenderer.off('session-completed', listener);
  },
  onUpdateState: (callback: (state: any) => void) => {
    const listener = (_event: any, state: any) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.off('update-state', listener);
  },
  onBackendLog: (callback: (log: any) => void) => {
    const listener = (_event: any, log: any) => callback(log);
    ipcRenderer.on('backend-log', listener);
    return () => ipcRenderer.off('backend-log', listener);
  },
})
