import { app, BrowserWindow, ipcMain, protocol, net, desktopCapturer } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    titleBarStyle: 'hidden',
    width: 1500,
    height: 900,
    transparent: true, // Enable transparency
    frame: false, // Ensure frameless for transparency to work reliably
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Enable DevTools
  win.webContents.openDevTools();

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

import { setupStorageHandlers } from './storage';
import { setupTracker } from './tracking/tracker';
import { setupGoogleAuth } from './google-auth'; // Added

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


function setupAutoUpdater() {
  log.info('App starting...');
  autoUpdater.logger = log;
  // autoUpdater.logger.transports.file.level = 'info'; // 'transports' property 'file' does not exist on type 'LevelOption' ? fix below
  (autoUpdater.logger as any).transports.file.level = 'info';

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

    // Ask user to update
    dialog.showMessageBox(win!, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart now to install?',
      buttons: ['Restart', 'Later']
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall(); // Silent install and restart
      }
    });
  });

  // Check for updates (will notify if found)
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
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
  createWindow();
  setupAutoUpdater(); // Initialize Auto Updater

  if (win) {
    setupTracker(win);
  }
});
