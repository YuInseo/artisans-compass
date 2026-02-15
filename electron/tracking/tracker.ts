import { powerMonitor, ipcMain, BrowserWindow } from 'electron';
// import { WindowPoller } from './window_poller'; // Removed in favor of active-win
import {
    readJson, getSettingsPath, getDailyLogPath, getUserDataPath,
    DEFAULT_SETTINGS, AppSettings, Session, DailyLogData
} from '../storage';
import { format } from 'date-fns';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';

interface TrackingState {
    isIdle: boolean;
    activeProcess: string;
    activeTitle: string;
    activeWindowPath: string;
    currentSession: Session | null;
    settings: AppSettings;
    lastScreenshotTime: number;
    activeWindowId: number;
    mainWindow: BrowserWindow | null; // Added
    logicalDate: string; // New: For Dynamic Daily Archive
}

const STATE: TrackingState = {
    isIdle: false,
    activeProcess: "",
    activeTitle: "",
    activeWindowPath: "",
    currentSession: null,
    settings: DEFAULT_SETTINGS,
    lastScreenshotTime: 0,
    activeWindowId: 0,
    mainWindow: null, // Added
    logicalDate: format(new Date(), 'yyyy-MM-dd') // Init to today
};

// Reload settings helper
function reloadSettings() {
    const loaded = readJson(getSettingsPath(), DEFAULT_SETTINGS);
    STATE.settings = { ...DEFAULT_SETTINGS, ...loaded };
    console.log(`[Tracker] Settings Reloaded. Idle Threshold: ${STATE.settings.idleThresholdSeconds}s, Mode: ${STATE.settings.screenshotMode}, RecordMode: ${STATE.settings.dailyRecordMode}`);
}

export function setupTracker(win: BrowserWindow) {
    STATE.mainWindow = win; // Store reference
    // Initial load
    console.log("!!! VERSION: TRACKER V2 ACTIVE !!!");
    reloadSettings();

    // Set logical date on startup
    STATE.logicalDate = format(new Date(), 'yyyy-MM-dd');
    console.log(`[Tracker] Logical Date initialized to: ${STATE.logicalDate}`);

    // Handler moved to bottom to include screenshot reschedule

    // Poll Active Window using active-win
    const pollActiveWindow = async () => {
        try {
            // Dynamic import for ESM package
            const activeWin = (await import('active-win')).default;
            const result = await activeWin();

            if (result) {
                STATE.activeProcess = result.owner.name || "";
                STATE.activeTitle = result.title || "";
                STATE.activeWindowId = result.id || 0;
                // active-win might return path in owner.path on some OS? 
                // types say owner: { name: string, processId: number, path?: string }
                STATE.activeWindowPath = (result.owner as any).path || "";
            } else {
                // IMPORTANT: If we cannot detect the window (e.g. desktop, secured app, or error),
                // we MUST reset the active state to prevent "sticking" to the previous app.
                STATE.activeProcess = "";
                STATE.activeTitle = "";
                STATE.activeWindowId = 0;
                STATE.activeWindowPath = "";
            }
        } catch (error) {
            console.error('Failed to get active window:', error);
            // Also reset on error to be safe
            STATE.activeProcess = "";
            STATE.activeTitle = "";
        }
    };

    // Idle checking & Active Window Polling every 1s
    setInterval(async () => {
        // 1. Check Idle
        const idleSeconds = powerMonitor.getSystemIdleTime();
        const prevIdle = STATE.isIdle;
        STATE.isIdle = idleSeconds > STATE.settings.idleThresholdSeconds;

        if (prevIdle !== STATE.isIdle) {
            console.log(`[Tracker] Idle State Changed: ${prevIdle} -> ${STATE.isIdle} (Seconds: ${idleSeconds}, Threshold: ${STATE.settings.idleThresholdSeconds})`);
        }

        // 2. Check Active Window
        await pollActiveWindow();

        // 3. Send update to renderer
        if (!win.isDestroyed()) {
            win.webContents.send('tracking-update', {
                isIdle: STATE.isIdle,
                activeProcess: STATE.activeProcess,
                currentSession: STATE.currentSession
            });
        }
    }, 1000);

    // Heartbeat for Session Logic
    setInterval(() => {
        processSessionLogic();
    }, 1000);

    // Dynamic Screenshot Scheduler
    let screenshotTimeout: NodeJS.Timeout;
    const scheduleNextScreenshot = () => {
        if (screenshotTimeout) clearTimeout(screenshotTimeout);
        // Default to 1800 if invalid (prevent rapid fire loop)
        const interval = Math.max(10, STATE.settings.screenshotIntervalSeconds || 1800);

        screenshotTimeout = setTimeout(async () => {
            await captureSmartScreenshot();
            scheduleNextScreenshot();
        }, interval * 1000);
    };

    // Listen for settings updates from Renderer (send style)
    ipcMain.on('settings-updated', () => {
        console.log("[Tracker] Settings updated (on), reloading...");
        reloadSettings();
        // Reschedule in case interval changed
        scheduleNextScreenshot();
    });

    // Listen for settings updates from Renderer (invoke style)
    ipcMain.handle('reload-settings', () => {
        console.log("[Tracker] Settings updated (handle), reloading...");
        reloadSettings();
        scheduleNextScreenshot();
    });

    scheduleNextScreenshot();
}

function processSessionLogic() {
    if (STATE.isIdle) {
        if (STATE.currentSession) {
            // Update duration one last time to capture the 'wait' threshold time
            const now = Date.now();
            STATE.currentSession.end = now;
            STATE.currentSession.duration = Math.floor((now - STATE.currentSession.start) / 1000);

            closeAndSaveSession(STATE.currentSession);
            STATE.currentSession = null;
        }
        return;
    }

    const { activeProcess, activeTitle, activeWindowPath, settings } = STATE;

    // Improved Target Detection (Case-insensitive, Title or Process)
    const isTarget = settings.targetProcessPatterns.some(pattern => {
        const p = pattern.toLowerCase();
        const matched = (activeProcess && activeProcess.toLowerCase().includes(p)) ||
            (activeTitle && activeTitle.toLowerCase().includes(p)) ||
            (activeWindowPath && activeWindowPath.toLowerCase().includes(p));
        return matched;
    }) || (settings.screenshotMode === 'process' && settings.screenshotTargetProcess && activeProcess.toLowerCase().includes(settings.screenshotTargetProcess.toLowerCase()));

    const now = Date.now();

    // Check Screenshot Interval: Removed (Handled by dedicated interval)

    if (isTarget) {
        if (STATE.currentSession) {
            // Check if process switched (e.g. from Chrome to Notion, both valid targets)
            if (STATE.currentSession.process !== activeProcess) {
                closeAndSaveSession(STATE.currentSession);
                STATE.currentSession = {
                    start: now,
                    end: now,
                    duration: 0,
                    process: activeProcess
                };
            } else {
                // Normal update (extend current session)
                STATE.currentSession.end = now;
                STATE.currentSession.duration = Math.floor((now - STATE.currentSession.start) / 1000);
            }

        } else {
            // Start new session
            STATE.currentSession = {
                start: now,
                end: now,
                duration: 0,
                process: activeProcess
            };
        }
    } else {
        // Not a target app
        if (STATE.currentSession) {
            // Update duration one last time to capture the time until this check
            // This prevents a 'drop' of ~1s (or more if blocked) when switching away/minimizing.
            const now = Date.now();
            STATE.currentSession.end = now;
            STATE.currentSession.duration = Math.floor((now - STATE.currentSession.start) / 1000);

            closeAndSaveSession(STATE.currentSession);
            STATE.currentSession = null;
        }
    }
}

function closeAndSaveSession(session: Session) {
    if (session.duration < 5) return; // Ignore micro-sessions (<5s)

    // DETERMINISTIC DATE KEY SELECTION
    let dateKey: string;
    if (STATE.settings.dailyRecordMode === 'dynamic') {
        // In Dynamic Mode, we ALWAYS use the logical date (app start date)
        // regardless of the actual wall-clock time.
        dateKey = STATE.logicalDate;
    } else {
        // In Fixed Mode (Default), we use the session START time.
        // This handles sessions crossing midnight naturally (start determines the day).
        const sessionDate = new Date(session.start);
        dateKey = format(sessionDate, 'yyyy-MM-dd');
    }

    // Notify Frontend immediately to prevent UI 'drop' (race condition with tracking-update)
    if (STATE.mainWindow && !STATE.mainWindow.isDestroyed()) {
        STATE.mainWindow.webContents.send('session-completed', session);
    }

    // Use atomic append helper for storage
    import('../storage').then(mod => {
        mod.appendSession(dateKey, session);
    });

    console.log(`Saved session: ${session.process} (${session.duration}s) to ${dateKey} (Mode: ${STATE.settings.dailyRecordMode})`);
}


import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function captureSmartScreenshot() {
    if (STATE.settings.enableScreenshots === false) {
        return;
    }

    try {
        // 1. Get latest active window info
        const activeWin = (await import('active-win')).default;
        const currentWin = await activeWin();

        const activeProcess = currentWin?.owner.name || STATE.activeProcess;
        log.info(`[Screenshot] Checking capture conditions. Active: ${activeProcess}, Mode: ${STATE.settings.screenshotMode}`);

        let shouldCapture = false;

        // Condition Check based on Mode
        if (STATE.settings.screenshotMode === 'screen') {
            shouldCapture = true;
        } else if (STATE.settings.screenshotMode === 'window') {
            shouldCapture = true; // Always capture active monitor
            log.info(`[Screenshot] Active Window mode (Active Monitor): Capturing`);
        } else if (STATE.settings.screenshotMode === 'active-app') {
            shouldCapture = true;
            log.info(`[Screenshot] Active App mode: Capturing '${activeProcess}' (Unfiltered)`);
        } else if (STATE.settings.screenshotMode === 'process') {
            const targetApp = STATE.settings.screenshotTargetProcess || '';
            const normalizedActive = activeProcess.toLowerCase().replace(/\s+/g, '');
            const normalizedTarget = targetApp.toLowerCase().replace(/\s+/g, '');

            // Strict Specific App matching
            const matchesTarget = targetApp && (
                normalizedActive.includes(normalizedTarget) ||
                (targetApp.toLowerCase().includes('artisans') && activeProcess.toLowerCase() === 'electron')
            );

            if (matchesTarget) {
                shouldCapture = true;
                log.info(`[Screenshot] Specific App match found: '${activeProcess}'`);
            } else if (STATE.settings.screenshotOnlyWhenActive === false && targetApp) {
                // Background Capture Mode: Target is NOT active, but user wants to capture it anyway.
                // We will attempt to find it in background sources.
                shouldCapture = true;
                log.info(`[Screenshot] Specific App (Background) requested for: '${targetApp}'`);
            }
        }

        if (!shouldCapture) return;

        STATE.lastScreenshotTime = Date.now();

        // Prepare path
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        const timeStr = format(now, 'HH-mm-ss');

        let baseDir = STATE.settings.screenshotPath;
        if (!baseDir || baseDir.trim() === '') {
            baseDir = path.join(getUserDataPath(), 'screenshots');
        }
        const screenshotsDir = path.join(baseDir, dateStr);
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        const safeProcessName = activeProcess ? activeProcess.replace(/[^a-z0-9]/gi, '_') : "Unknown";
        const fileName = `${timeStr}_${safeProcessName}.jpg`;
        const fullPath = path.join(screenshotsDir, fileName);

        // 2. Capture Logic
        // window = Smart Screen (No Crop), process/active-app = Window Crop
        const isProcessMode = STATE.settings.screenshotMode === 'process' || STATE.settings.screenshotMode === 'active-app';
        let useBackgroundSearch = false;

        // If in 'process' mode and strict match FAILED, we must search background.
        if (STATE.settings.screenshotMode === 'process' && STATE.settings.screenshotOnlyWhenActive === false) {
            const targetApp = STATE.settings.screenshotTargetProcess || '';
            const normalizedActive = activeProcess.toLowerCase().replace(/\s+/g, '');
            const normalizedTarget = targetApp.toLowerCase().replace(/\s+/g, '');

            // If active process is NOT the target, force background search
            if (!normalizedActive.includes(normalizedTarget)) {
                useBackgroundSearch = true;
            }
        }

        if (!isProcessMode) {
            // SCREEN MODE (Fixed or Smart)
            // SCREEN MODE (Fixed or Smart)
            // const worker = getScreenshotWorker(); // Moved to Main Thread
            console.log('[Screenshot] Screen Mode: Capturing via Main Thread');

            let workerDisplayId = undefined;

            // Logic for Dynamic Monitor (Active Window Mode)
            if (STATE.settings.screenshotMode === 'window') {
                if (currentWin && currentWin.bounds) {
                    try {
                        const { screen } = await import('electron');
                        const display = screen.getDisplayMatching(currentWin.bounds as any);

                        // Map Electron Display to Screenshot Display
                        // @ts-ignore
                        const screenshot = (await import('screenshot-desktop')).default;
                        const sDisplays = await screenshot.listDisplays();

                        // Sort to match
                        const allElectronDisplays = screen.getAllDisplays().sort((a, b) => (a.bounds.y - b.bounds.y) || (a.bounds.x - b.bounds.x));
                        const currentIdx = allElectronDisplays.findIndex(d => d.id === display.id);

                        if (currentIdx >= 0 && currentIdx < sDisplays.length) {
                            const sortedScreens = sDisplays.sort((a: any, b: any) => (a.top - b.top) || (a.left - b.left));
                            workerDisplayId = sortedScreens[currentIdx].id;
                            console.log(`[Screenshot] Smart Monitor - Matched Display Index: ${currentIdx}, ID: ${workerDisplayId}`);
                        }
                    } catch (e) {
                        console.error("[Screenshot] Failed to determine smart monitor ID:", e);
                    }
                }
            }
            // Logic for Fixed Monitor
            else if (STATE.settings.screenshotMode === 'screen' && STATE.settings.screenshotDisplayId) {
                // Config ID format: "screen:INDEX:0" (e.g., "screen:1:0" for display index 1)
                const idParts = STATE.settings.screenshotDisplayId.split(':');
                const displayIndex = parseInt(idParts[1], 10); // Extract index from "screen:INDEX:0"

                console.log(`[Screenshot Debug] Config ID: ${STATE.settings.screenshotDisplayId}, Parsed Index: ${displayIndex}`);

                if (!isNaN(displayIndex)) {
                    // @ts-ignore
                    const screenshot = (await import('screenshot-desktop')).default;
                    const sDisplays = await screenshot.listDisplays();

                    if (displayIndex < sDisplays.length) {
                        workerDisplayId = sDisplays[displayIndex].id;
                    }
                }
            }

            // 3. Main Thread Capture (Direct)
            try {
                // @ts-ignore
                const screenshot = (await import('screenshot-desktop')).default;

                let imgBuffer;
                if (workerDisplayId) {
                    imgBuffer = await screenshot({ screen: workerDisplayId, format: 'jpg' });
                } else {
                    imgBuffer = await screenshot({ format: 'jpg' });
                }

                await fs.promises.writeFile(fullPath, imgBuffer);
                updateDailyLog(fullPath, now);
                log.info(`[Screenshot] Screen capture success: ${fullPath}`);
            } catch (err) {
                console.error("[Screenshot] Screen capture failed:", err);
            }

            return;
        }

        // 1.5 Determine which Display contains the window (For Cropping)
        // Skip this if we are forcing background search (since active window is NOT our target)
        if (currentWin && currentWin.bounds && !useBackgroundSearch) {
            const { screen } = await import('electron');
            try {
                const display = screen.getDisplayMatching(currentWin.bounds as any);

                // @ts-ignore
                const screenshot = (await import('screenshot-desktop')).default;

                // Robustly find the correct display ID for screenshot-desktop
                const displays = await screenshot.listDisplays();

                // 1. Try Exact/Fuzzy Coordinate Match
                let targetDisplay = displays.find((d: any) =>
                    Math.abs(d.left - display.bounds.x) < 5 && Math.abs(d.top - display.bounds.y) < 5
                );

                // 2. Fallback: Match by Index
                if (!targetDisplay) {
                    const allElectronDisplays = screen.getAllDisplays().sort((a, b) => (a.bounds.y - b.bounds.y) || (a.bounds.x - b.bounds.x));
                    const currentIdx = allElectronDisplays.findIndex(d => d.id === display.id);

                    if (currentIdx >= 0 && currentIdx < displays.length) {
                        // Sort screenshot displays by Top then Left to match reading order
                        const sortedScreens = displays.sort((a: any, b: any) => (a.top - b.top) || (a.left - b.left));
                        targetDisplay = sortedScreens[currentIdx];
                    }
                }

                if (!targetDisplay) {
                    console.warn(`[Screenshot] No matching display found for coords x:${display.bounds.x} y:${display.bounds.y}. Available:`, displays.map((d: any) => ({ id: d.id, l: d.left, t: d.top })));
                } else {
                    console.log(`[Screenshot Debug] Final Selection - Electron x:${display.bounds.x} -> Screenshot L:${targetDisplay.left} ID:${targetDisplay.id}`);
                }

                const screenId = targetDisplay ? targetDisplay.id : display.id;
                const imgBuffer = await screenshot({ screen: screenId, format: 'jpg' });

                await sendToGpuWorker({
                    imageBuffer: imgBuffer,
                    bounds: currentWin.bounds,
                    displayBounds: display.bounds,
                    scaleFactor: display.scaleFactor, // Pass scale factor
                    filePath: fullPath
                });

                updateDailyLog(fullPath, now);
                return;
            } catch (err) {
                console.warn("[Screenshot] GPU Worker failed, falling back:", err);
            }
        }

        // Fallback (Rare/Impossible if active-win works): Use desktopCapturer.
        console.log('[Screenshot] active-win bounds missing OR Background Mode. Using desktopCapturer.');

        const types: ('screen' | 'window')[] = ['window']; // Only window mode falls here
        const { desktopCapturer, screen } = await import('electron');

        // Use Primary Display size for better resolution (avoid tiny 960x540 default)
        const primarySize = screen.getPrimaryDisplay().size;
        const thumbSize = { width: primarySize.width, height: primarySize.height };

        const sources = await desktopCapturer.getSources({
            types,
            thumbnailSize: thumbSize,
            fetchWindowIcons: false
        });

        let targetSource = null;
        // Find window logic...
        const activeWinId = currentWin?.id || STATE.activeWindowId;
        console.log(`[Screenshot] Looking for window ID: ${activeWinId} (Type: ${typeof activeWinId}), Title: ${currentWin?.title}`);

        if (useBackgroundSearch) {
            const targetProcessName = STATE.settings.screenshotTargetProcess || '';
            // Search by Name
            if (targetProcessName) {
                const lowerTarget = targetProcessName.toLowerCase().replace('.exe', '');
                targetSource = sources.find(s => s.name.toLowerCase().includes(lowerTarget));
                if (targetSource) console.log(`[Screenshot] Background Search found: ${targetSource.name}`);
            }
        }
        else if (activeWinId) {
            const idStr = String(activeWinId);
            // 1. Precise Match with colons (window:123:0)
            targetSource = sources.find(s => s.id.includes(`:${idStr}:`) || s.id.endsWith(`:${idStr}`));

            // 2. Fuzzy Match (just ID)
            if (!targetSource) {
                targetSource = sources.find(s => s.id.includes(idStr));
                if (targetSource) console.log(`[Screenshot] Fuzzy ID match success: ${targetSource.id}`);
            }

            if (!targetSource) {
                const title = currentWin?.title || STATE.activeTitle;
                console.log(`[Screenshot] ID match failed. Available sources:`, sources.map(s => `${s.id} ("${s.name}")`).join(', '));

                // 3. Title Match (Case-Insensitive, Substring)
                if (title) {
                    const lowerTitle = title.toLowerCase();
                    targetSource = sources.find(s => {
                        const lowerName = s.name.toLowerCase();
                        return lowerName === lowerTitle || (lowerName.includes(lowerTitle) && lowerTitle.length > 3);
                    });
                }
            }
        }

        if (!targetSource) {
            console.log('[Screenshot] Target window not found');
            return;
        }

        // We have a NativeImage.
        const jpegBuffer = targetSource.thumbnail.toJPEG(70);
        await fs.promises.writeFile(fullPath, jpegBuffer);

        updateDailyLog(fullPath, now);

    } catch (e) {
        console.error("[Screenshot] General Failure:", e);
    }
}

function updateDailyLog(fullPath: string, now: Date) {
    // Determine Date Key based on Mode
    let dateStr = format(now, 'yyyy-MM-dd');
    let yearMonth = format(now, 'yyyy-MM');

    if (STATE.settings.dailyRecordMode === 'dynamic') {
        dateStr = STATE.logicalDate;
        yearMonth = dateStr.slice(0, 7); // Use logical month too
    }

    const logPath = getDailyLogPath(yearMonth);

    setImmediate(() => {
        try {
            const logData = readJson<Record<string, DailyLogData>>(logPath, {});
            if (!logData[dateStr]) {
                logData[dateStr] = { sessions: [], todos: [], quest_cleared: false, screenshots: [], is_rest_day: false };
            }
            const screenshots = logData[dateStr].screenshots || [];
            screenshots.push(fullPath);

            import('../storage').then(mod => {
                mod.saveDailyLogInternal(dateStr, { screenshots });
            });
        } catch (e) {
            console.error("Failed to update log", e);
        }
    });
}



// --- GPU WORKER MANAGEMENT ---
let gpuWorkerWin: BrowserWindow | null = null;

async function createGpuWorker() {
    if (gpuWorkerWin !== null && !gpuWorkerWin.isDestroyed()) return gpuWorkerWin;

    const { BrowserWindow } = await import('electron');

    gpuWorkerWin = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple worker communication
            backgroundThrottling: false // Important! Keep it active in background
        }
    });

    const workerHtmlPath = path.join(__dirname, 'gpu-worker.html');
    gpuWorkerWin!.loadFile(workerHtmlPath);

    gpuWorkerWin!.webContents.on('console-message', (_event, _level, message) => {
        console.log(`[GPU Worker Remote] ${message}`);
    });

    return gpuWorkerWin;
}

async function sendToGpuWorker(data: any): Promise<void> {
    const workerWin = await createGpuWorker();
    if (!workerWin) throw new Error("Failed to create worker");

    return new Promise((resolve, reject) => {
        const requestId = Date.now().toString() + Math.random().toString();
        data.requestId = requestId;

        // One-time listener for this request
        const responseHandler = (_event: any, response: any) => {
            if (response.requestId === requestId) {
                ipcMain.removeListener('PROCESS_IMAGE_DONE', responseHandler);
                if (response.success) {
                    const buffer = Buffer.from(response.base64Data, 'base64');
                    fs.promises.writeFile(data.filePath, buffer)
                        .then(() => resolve())
                        .catch(err => reject(err));
                } else {
                    reject(new Error(response.error));
                }
            }
        };

        ipcMain.on('PROCESS_IMAGE_DONE', responseHandler);
        workerWin.webContents.send('PROCESS_IMAGE', data);
    });
}

// --- 3. Export ---
// Export helper if needed
export function getTrackerState() {
    return STATE;
}
