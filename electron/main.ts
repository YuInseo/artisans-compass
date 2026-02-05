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

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;

// Configure electron-log to save to logs.txt
// Note: File path will be set after app is ready
log.transports.file.level = 'info';
log.transports.file.fileName = 'logs.txt';
log.transports.console.level = 'debug';

// Redirect console methods to electron-log (so they also save to file)
Object.assign(console, log.functions);

// Hook into electron-log to stream logs to renderer
log.hooks.push((message: any) => {
  if (win && !win.isDestroyed()) {
    try {
      // message.data is array of args
      win.webContents.send('backend-log', {
        level: message.level,
        message: message.data.map((d: any) => typeof d === 'object' ? JSON.stringify(d) : String(d)).join(' ')
      });
    } catch (e) {
      // ignore
    }
  }
  return message;
});

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

function createSplashWindow() {
  splash = new BrowserWindow({
    width: 300,
    height: 350,
    backgroundColor: '#0f172a', // Slate 900
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.mjs'), // We'll need to make sure this is built/copied or just use tsc
      contextIsolation: true,
      nodeIntegration: false
    }
  });


  // For production, we might need to adjust this path if electron folder isn't copied as is.
  // Actually, standard vite-plugin-electron might require us to put splash in public or build it.
  // For now, let's assume direct file access or simpler serving.

  if (app.isPackaged) {
    // In packaged app, we can try to serve it from resources or just use data URL for simplicity if small?
    // Or better, let's serve it via the app protocol or file protocol if it exists in dist-electron
    // But we just created it in 'electron/' which might not be in dist-electron by default unless we config vite.
    // Let's rely on it being copied or just put it in a known place.
    // A safer bet for now is to write the HTML content directly here or assume it's next to main.js? 
    // Let's assume the user will ensure it's there. 
    // Actually, let's use a data URL for the splash to be safe and self-contained, OR read the file payload.

    // Let's try loading from resources/app.asar/electron/splash.html if we can't ensure it's in dist.
    // Actually, simpler: define the HTML string here if it's small, or read it.

    // Attempt to load from parallel directory
    splash.loadFile(path.join(__dirname, '..', 'electron', 'splash.html'));
  } else {
    splash.loadFile(path.join(__dirname, '..', 'electron', 'splash.html'));
  }

  splash.on('closed', () => {
    splash = null;
  });
}

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

import { getRunningApps } from './process-utils'; // Added import

ipcMain.handle('get-running-apps', async () => {
  return await getRunningApps();
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

ipcMain.on('toggle-dev-tools', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.webContents.toggleDevTools();
});

ipcMain.on('toggle-always-on-top', (_event, flag?: boolean) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (typeof flag === 'boolean') {
      win.setAlwaysOnTop(flag, 'screen-saver');
    } else {
      const newState = !win.isAlwaysOnTop();
      win.setAlwaysOnTop(newState, 'screen-saver');
    }
  }
});

// Added set-widget-mode handler
// Added set-widget-mode handler
ipcMain.on('set-widget-mode', (_event, { mode, height }: { mode: boolean, height?: number }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (mode) {
      // Store original size if needed? For now just hardcode standard/widget sizes.
      // Widget Size: 435xHeight (Vertical Strip)
      const targetHeight = height || 800;
      win.setSize(435, targetHeight);
      win.setAlwaysOnTop(true, 'screen-saver');
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
  console.log('[Main] set-auto-launch called with:', enable);
  console.log('[Main] isPackaged:', app.isPackaged);
  console.log('[Main] exe path:', app.getPath('exe'));

  // Prevent enabling auto-launch in dev mode to avoid registering raw electron binary
  if (!app.isPackaged && enable) {
    console.warn('[Main] Blocked enabling auto-launch in dev mode');
    dialog.showErrorBox(
      'Development Mode',
      'Auto-launch cannot be enabled in development mode.\n\nThis feature typically requires a packaged application to register the correct executable path. Enabling it now would register the generic Electron binary, causing the app to launch incorrectly.'
    );
    return false;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe') // Explicitly point to the executable
    });
    return true;
  } catch (err) {
    console.error('[Main] Failed to set login item settings:', err);
    return false;
  }
});

ipcMain.handle('get-auto-launch', async () => {
  return app.getLoginItemSettings().openAtLogin;
});


// Flag to prevent multiple launches
let isAppLaunched = false;

function launchApp() {
  if (isAppLaunched) return;
  isAppLaunched = true;

  if (splash) {
    splash.close();
    splash = null;
  }
  createWindow();
}

function setupAutoUpdater() {
  log.info('App starting...');

  // Read settings
  const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
  const autoUpdateEnabled = settings.autoUpdate !== false;

  // Configure logger
  autoUpdater.logger = log;
  (autoUpdater.logger as any).transports.file.level = 'info';

  // Allow updates to pre-release versions
  autoUpdater.allowPrerelease = true;
  // Disable auto-download to give user control in main app
  // But we might want it auto in splash? Let's handle via logic.
  autoUpdater.autoDownload = false;

  // Register Event Listeners
  const sendToWindows = (channel: string, ...args: any[]) => {
    splash?.webContents.send(channel, ...args);
    win?.webContents.send(channel, ...args);
  };

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    sendToWindows('update-status', 'Checking for updates...');
    sendToWindows('update-state', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    sendToWindows('update-status', 'Update available.');
    sendToWindows('update-state', { status: 'available', info });

    // If we are in splash screen (app not fully launched), auto download
    if (splash) {
      splash.webContents.send('update-status', 'Update available. Downloading...');
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
    sendToWindows('update-status', 'Up to date.');
    if (splash) {
      splash.webContents.send('update-status', 'Starting...');
      setTimeout(launchApp, 500);
    } else {
      // Only trigger toast for main window manually if desired, or let UI handle it via state
      sendToWindows('update-state', { status: 'idle', message: 'up-to-date' });
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    sendToWindows('update-status', 'Error checking updates.');
    sendToWindows('update-state', { status: 'error', error: err.message });

    if (splash) {
      splash.webContents.send('update-status', 'Error checking updates. Starting...');
      setTimeout(launchApp, 500);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    // log.info(log_message); // Reduce spam
    sendToWindows('download-progress', progressObj);
    sendToWindows('update-state', { status: 'downloading', progress: progressObj });
    if (splash) {
      splash.webContents.send('update-status', `Downloading: ${Math.round(progressObj.percent)}%`);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', info);
    sendToWindows('update-status', 'Update ready.');
    sendToWindows('update-state', { status: 'ready', info });

    if (splash) {
      console.log('Update downloaded in splash mode. Installing...');
      splash.webContents.send('update-status', 'Update ready. Restarting...');
      setTimeout(() => {
        autoUpdater.quitAndInstall();
      }, 1000);
    }
  });

  // IPC Handlers for Main Window Control
  // IPC Handlers for Main Window Control
  ipcMain.handle('check-for-updates', () => {
    return autoUpdater.checkForUpdates().catch(err => log.error(err));
  });

  ipcMain.handle('download-update', () => {
    return autoUpdater.downloadUpdate().catch(err => log.error(err));
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  // Initial Check (Splash Screen Flow)
  if (splash) {
    // Ensure we don't hold the user hostage forever in splash
    const safetyTimeout = setTimeout(() => {
      if (splash) {
        log.warn('Update check timed out, launching app.');
        launchApp();
      }
    }, 10000); // 10 seconds timeout

    // Hook into events to clear timeout
    autoUpdater.once('update-available', () => clearTimeout(safetyTimeout));
    autoUpdater.once('update-not-available', () => clearTimeout(safetyTimeout));
    autoUpdater.once('error', () => clearTimeout(safetyTimeout));

    if (!autoUpdateEnabled) {
      log.info('Auto-update disabled, launching app immediately.');
      clearTimeout(safetyTimeout);
      launchApp();
      return;
    }

    autoUpdater.checkForUpdates().catch(err => {
      log.warn('Update check failed:', err);
      clearTimeout(safetyTimeout);
      launchApp();
    });
  }
}

app.whenReady().then(async () => {
  // Handle 'app://' protocol
  // Handle 'app://' protocol
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    // Request for app://./index.html parses to pathname '/index.html'
    // Remove leading slash to join correctly
    let pathName = url.pathname;
    if (pathName.startsWith('/')) pathName = pathName.slice(1);

    const filePath = path.join(RENDERER_DIST, decodeURIComponent(pathName));
    // console.log('[App Protocol] Serving:', filePath);

    try {
      const data = fs.readFileSync(filePath);
      // Determine mime type strictly if needed, but Response usually guesses or we can set it.
      // For simple usage, just returning body works, but setting Content-Type is better.
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.html') contentType = 'text/html';
      else if (ext === '.js') contentType = 'text/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.json') contentType = 'application/json';

      return new Response(data, {
        headers: { 'content-type': contentType }
      });
    } catch (err) {
      console.error('[App Protocol] Failed to read file:', filePath, err);
      return new Response('File not found', { status: 404 });
    }
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

  const { getTrackerState } = await import('./tracking/tracker');
  setupStorageHandlers(getTrackerState);
  setupGoogleAuth();
  setupNotionAuth();
  setupNotionOps(); // Added

  // Decide launch flow
  if (true || app.isPackaged) {
    createSplashWindow();
    setupAutoUpdater(); // This will eventually call launchApp()
  } else {
    // In dev, skip splash/updater to save time (or uncomment to test)
    // setupAutoUpdater(); // Uncomment to test logic in dev
    // For now, launch directly:
    createWindow();
  }

  // setupAutoUpdater(); // MOVED above conditionally

  // Safety Check: If in Dev mode and Auto-Launch is somehow enabled (pointing to electron.exe), disable it to fix the user's registry.
  if (!app.isPackaged) {
    const loginSettings = app.getLoginItemSettings();
    if (loginSettings.openAtLogin) {
      console.warn('[Main] Detected Auto-Launch enabled in Dev Mode. Disabling to prevent "Electron Default App" issue...');
      try {
        app.setLoginItemSettings({ openAtLogin: false });
        console.log('[Main] Successfully reset Auto-Launch to false.');
      } catch (e) {
        console.error('[Main] Failed to reset Auto-Launch:', e);
      }
    }
  }


  if (win) {
    setupTracker(win);
  }
});

ipcMain.handle('open-external', async (_, url: string) => {
  if (url && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
    await shell.openExternal(url);
  }
});

ipcMain.on('toggle-devtools', (_event, show) => {
  if (win) {
    if (show) {
      win.webContents.openDevTools();
    } else {
      win.webContents.closeDevTools();
    }
  }
});
