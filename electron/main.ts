import { app, BrowserWindow, ipcMain, protocol, net, desktopCapturer, shell } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
// @ts-ignore
import * as dotenv from 'dotenv';
// Configure electron-log to save to logs.txt
// Note: File path will be set after app is ready
log.transports.file.level = 'info';
log.transports.file.fileName = 'logs.txt';
log.transports.console.level = 'debug';

// Redirect console methods to electron-log (so they also save to file)
Object.assign(console, log.functions);

// Load .env file (in packaged app, it's at app root)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '..', '.env')
  : path.join(__dirname, '..', '.env');

// Load .env if it exists
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('[Main] Loaded .env from:', envPath);
} else {
  console.warn('[Main] .env file not found at:', envPath);
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  log.error('Uncaught Exception:', error);
});

// Register custom protocol 'app://' as privileged/standard
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')

// Note: RENDERER_DIST will be resolved at runtime in createWindow
let RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  // In packaged app, __dirname points to dist-electron inside app.asar
  // So we go up one level to get to app.asar root, then into dist
  if (app.isPackaged) {
    // __dirname = app.asar/dist-electron, so ../dist = app.asar/dist
    RENDERER_DIST = path.join(__dirname, '..', 'dist')
    process.env.VITE_PUBLIC = RENDERER_DIST
  }

  console.log('[Main] __dirname:', __dirname);
  console.log('[Main] RENDERER_DIST:', RENDERER_DIST);
  console.log('[Main] app.isPackaged:', app.isPackaged);

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'appLOGO.ico'),
    titleBarStyle: 'hidden',
    width: 1500,
    height: 900,
    show: false, // Don't show until ready
    backgroundColor: '#00000000', // Fully transparent
    transparent: true,
    frame: false, // Needed for transparent window on some platforms, keeping existing titleBarStyle logic in mind
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Show window when ready to prevent white flash
  win.once('ready-to-show', () => {
    win?.show();
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(RENDERER_DIST, 'index.html');
    console.log('[Main] Loading:', indexPath);

    if (app.isPackaged) {
      // Use custom 'app://' protocol to load resources
      // This bypasses file:// protocol restrictions and robustly handles paths with spaces
      win.loadURL('app://./index.html');
    } else {
      win.loadFile(indexPath);
    }
  }

  win.on('closed', () => {
    win = null;
    app.quit();
  });
}

import { setupStorageHandlers } from './storage';
import { setupTracker } from './tracking/tracker';
import { setupGoogleAuth } from './google-auth'; // Added
import { setupNotionAuth } from './notion-auth';
import { setupNotionOps } from './notion-ops'; // Added
import { getMonitorNames } from './monitor-utils';


ipcMain.on('log-message', (_, msg) => {
  console.log(msg); // Will show in terminal
  log.info(msg);    // Will log to file
});

ipcMain.on('quit-app', () => {
  app.quit();
});

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

ipcMain.handle('get-running-apps', async () => {
  try {
    // Set UTF-8 encoding to properly handle Korean and other Unicode characters
    const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process | Where-Object {$_.MainWindowTitle -ne \"\"} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });

    let activeApps = [];
    try {
      if (stdout.trim()) {
        activeApps = JSON.parse(stdout);
        if (!Array.isArray(activeApps)) {
          activeApps = [activeApps];
        }
      }
    } catch (e) {
      console.error("Failed to parse running apps JSON", e);
    }

    return activeApps.map((a: any) => ({
      id: a.ProcessName,
      name: a.MainWindowTitle || a.ProcessName,
      process: a.ProcessName,
      appIcon: null
    }));
  } catch (e) {
    console.error("Failed to get running apps", e);
    return [];
  }
});

ipcMain.handle('get-monitor-names', async () => {
  return await getMonitorNames();
});

ipcMain.on('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.minimize();
});

ipcMain.on('toggle-maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.close();
});

ipcMain.on('toggle-always-on-top', (_event, flag?: boolean) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (typeof flag === 'boolean') {
      win.setAlwaysOnTop(flag);
    } else {
      win.setAlwaysOnTop(!win.isAlwaysOnTop());
    }
  }
});

// Added set-widget-mode handler
ipcMain.on('set-widget-mode', (_event, isWidgetMode: boolean) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (isWidgetMode) {
      // Store original size if needed? For now just hardcode standard/widget sizes.
      // Widget Size: 435x800 (Vertical Strip)
      win.setSize(435, 800);
      win.setAlwaysOnTop(true, 'floating');
      // Opacity will be set by the frontend via `set-window-opacity` immediately or stored setting
    } else {
      // Restore Standard Size: 1500x900 (as defined in createWindow)
      win.setSize(1500, 900);
      win.setAlwaysOnTop(false);
      win.setOpacity(1.0); // Always restore full opacity
      win.center(); // Optional: Center it back
    }
  }
});

ipcMain.on('set-window-opacity', (_event, opacity: number) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setOpacity(opacity);
  }
});

ipcMain.on('resize-widget', (_event, { width, height }: { width: number, height: number }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    // Optional: Add constraints (min height etc)
    const newHeight = Math.max(height, 200); // Minimum height
    win.setSize(width || 400, newHeight, true); // true for animate (on macOS, ignored on Win/Linux usually but harmless)
  }
});


// Added IPC for directory dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 400, height: 400 } });
  return sources.map((s: any) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

import { readJson, getSettingsPath, DEFAULT_SETTINGS, getUserDataPath } from './storage';

ipcMain.handle('get-daily-screenshots', async (_, dateStr: string) => {
  try {
    const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);

    let baseDir = settings.screenshotPath;
    if (!baseDir || baseDir.trim() === '') {
      baseDir = path.join(getUserDataPath(), 'screenshots');
    }

    const dailyDir = path.join(baseDir, dateStr);

    if (!fs.existsSync(dailyDir)) {
      return [];
    }

    const files = fs.readdirSync(dailyDir);
    const images = files
      .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
      .map(file => path.join(dailyDir, file)); // Return absolute paths

    return images;
  } catch (error) {
    console.error('Failed to get daily screenshots:', error);
    return [];
  }
});

ipcMain.handle('export-settings', async (_, settings: any) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Settings',
    defaultPath: 'artisans-compass-settings.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    return true;
  }
  return false;
});

ipcMain.handle('import-settings', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import Settings',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse settings file', e);
      throw e;
    }
  }
  return null;
});

ipcMain.handle('set-auto-launch', async (_, enable: boolean) => {
  // Prevent enabling auto-launch in dev mode to avoid registering raw electron binary
  if (!app.isPackaged && enable) {
    console.warn('[Main] Blocked enabling auto-launch in dev mode');
    return false;
  }

  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe') // Optional directly pointing to executable
  });
  return true;
});

ipcMain.handle('get-auto-launch', async () => {
  return app.getLoginItemSettings().openAtLogin;
});


function setupAutoUpdater() {
  log.info('App starting...');

  // Read settings
  const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
  const autoUpdateEnabled = settings.autoUpdate || false;

  log.info('[AutoUpdater] Auto-update settings state:', autoUpdateEnabled);

  // Configure logger
  autoUpdater.logger = log;
  (autoUpdater.logger as any).transports.file.level = 'info';

  // Register Event Listeners
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    if (win) win.webContents.send('update_available');
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    if (win) win.webContents.send('update_progress', progressObj.percent);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', info);
    if (win) win.webContents.send('update_downloaded');

    dialog.showMessageBox(win!, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart now to install?',
      buttons: ['Restart', 'Later']
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Register IPC Handlers
  // We use removeHandler to avoid potential double-registration errors if this function is called multiple times (though it shouldn't be)
  ipcMain.removeHandler('check-for-updates');
  ipcMain.handle('check-for-updates', async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  });

  ipcMain.removeHandler('quit-and-install');
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates if enabled
  if (autoUpdateEnabled) {
    try {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        log.warn('Update check failed (non-blocking):', err.message);
      });
    } catch (err) {
      log.warn('Update check initialization failed:', err);
    }
  } else {
    log.info('[AutoUpdater] Skipping auto-check because autoUpdate is disabled.');
  }
}

app.whenReady().then(() => {
  // Handle 'app://' protocol
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    // Request for app://./index.html parses to pathname '/index.html'
    // Remove leading slash to join correctly
    let pathName = url.pathname;
    if (pathName.startsWith('/')) pathName = pathName.slice(1);

    const filePath = path.join(RENDERER_DIST, decodeURIComponent(pathName));
    // console.log('[App Protocol] Serving:', filePath);

    return net.fetch(pathToFileURL(filePath).toString());
  });

  // Robust 'media' protocol handler
  protocol.handle('media', async (req) => {
    let rawPath = req.url.replace(/^media:\/\//i, '');
    try { rawPath = decodeURIComponent(rawPath); } catch (err) { }
    let normalizedPath = rawPath.replace(/\\/g, '/');

    // Fix: C/Users -> C:/Users
    // If it looks like 'C/Users' or 'D/Something' (Drive letter followed by slash but NO colon)
    if (normalizedPath.match(/^[a-zA-Z]\//)) {
      normalizedPath = normalizedPath.slice(0, 1) + ':' + normalizedPath.slice(1);
    }

    if (normalizedPath.match(/^\/[a-zA-Z]:\//)) {
      normalizedPath = normalizedPath.slice(1);
    }

    console.log('[Media] Request Path:', normalizedPath);

    try {
      if (fs.existsSync(normalizedPath)) {
        try {
          const fileUrl = pathToFileURL(normalizedPath).toString();
          // console.log('[Media] Fetching:', fileUrl);
          return net.fetch(fileUrl);
        } catch (fetchErr) {
          console.error('[Media] net.fetch failed, trying manual read:', fetchErr);
          const data = fs.readFileSync(normalizedPath);
          return new Response(data);
        }
      } else {
        console.error('[Media] File does not exist:', normalizedPath);
        return new Response('File not found', { status: 404 });
      }
    } catch (e) {
      console.error('[Media] Error serving file:', e);
      return new Response('Internal Error', { status: 500 });
    }
  });

  setupStorageHandlers();
  setupGoogleAuth();
  setupNotionAuth();
  setupNotionOps(); // Added
  createWindow();
  setupAutoUpdater(); // Initialize Auto Updater

  if (win) {
    setupTracker(win);
  }
});

ipcMain.handle('open-external', async (_, url: string) => {
  if (url && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
    await shell.openExternal(url);
  }
});
