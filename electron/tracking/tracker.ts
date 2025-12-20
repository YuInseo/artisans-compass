import { powerMonitor, ipcMain, BrowserWindow, desktopCapturer } from 'electron';
// import { WindowPoller } from './window_poller'; // Removed in favor of active-win
import {
    readJson, writeJson, getSettingsPath, getDailyLogPath, getUserDataPath,
    DEFAULT_SETTINGS, AppSettings, Session, DailyLogData
} from '../storage';
import { format } from 'date-fns';
import path from 'node:path';
import fs from 'node:fs';

interface TrackingState {
    isIdle: boolean;
    activeProcess: string;
    activeTitle: string;
    activeWindowPath: string;
    currentSession: Session | null;
    settings: AppSettings;
    lastScreenshotTime: number;
    activeWindowId: number;
}

const STATE: TrackingState = {
    isIdle: false,
    activeProcess: "",
    activeTitle: "",
    activeWindowPath: "",
    currentSession: null,
    settings: DEFAULT_SETTINGS,
    lastScreenshotTime: 0,
    activeWindowId: 0
};

// Reload settings helper
function reloadSettings() {
    const loaded = readJson(getSettingsPath(), DEFAULT_SETTINGS);
    STATE.settings = { ...DEFAULT_SETTINGS, ...loaded };
}

export function setupTracker(win: BrowserWindow) {
    // Initial load
    console.log("!!! VERSION: 30 MINUTE FIX ACTIVE (D DRIVE) !!!");
    reloadSettings();
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
                // Log only once/rarely to avoid span? No, seeing it is important now.
                // console.log("active-win returned null result (Desktop focused or Permission issue)");
            }
        } catch (error) {
            console.error('Failed to get active window:', error);
        }
    };

    // Idle checking & Active Window Polling every 1s
    setInterval(async () => {
        // 1. Check Idle
        const idleSeconds = powerMonitor.getSystemIdleTime();
        STATE.isIdle = idleSeconds > STATE.settings.idleThresholdSeconds;

        // 2. Check Active Window
        await pollActiveWindow();

        // 3. Send update to renderer
        win.webContents.send('tracking-update', {
            isIdle: STATE.isIdle,
            activeProcess: STATE.activeProcess,
            currentSession: STATE.currentSession
        });
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

    scheduleNextScreenshot();

    // Hook into reloadSettings to restart timer immediately if interval changed
    ipcMain.handle('reload-settings', () => {
        reloadSettings();
        // Refund/Restart timer with new interval
        scheduleNextScreenshot();
    });
}

function processSessionLogic() {
    if (STATE.isIdle) {
        if (STATE.currentSession) {
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
                STATE.currentSession.duration = Math.round((now - STATE.currentSession.start) / 1000);
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
            closeAndSaveSession(STATE.currentSession);
            STATE.currentSession = null;
        }
    }
}

function closeAndSaveSession(session: Session) {
    if (session.duration < 5) return; // Ignore micro-sessions (<5s)

    const sessionDate = new Date(session.start);
    const yearMonth = format(sessionDate, 'yyyy-MM');
    const filePath = getDailyLogPath(yearMonth);
    const dateKey = format(sessionDate, 'yyyy-MM-dd');

    const logData = readJson<Record<string, DailyLogData>>(filePath, {});

    // Initialize day if missing
    if (!logData[dateKey]) {
        logData[dateKey] = {
            sessions: [],
            todos: [],
            quest_cleared: false,
            screenshots: [],
            is_rest_day: false
        };
    }

    if (!logData[dateKey].sessions) logData[dateKey].sessions = [];
    logData[dateKey].sessions.push(session);
    writeJson(filePath, logData);
    console.log(`Saved session: ${session.process} (${session.duration}s) to ${dateKey}`);

    // Trigger Backup
    performBackup(filePath);
}

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let screenshotWorker: Worker | null = null;

function getScreenshotWorker(): Worker {
    if (!screenshotWorker) {
        // Path resolution for worker
        const workerPath = path.join(__dirname, 'screenshot-worker.js'); // Prod / flattened in main
        screenshotWorker = new Worker(workerPath);

        screenshotWorker.on('message', (msg) => {
            if (msg.success) {
                console.log(`[Worker] Screenshot saved: ${msg.filePath}`);
            } else {
                console.error(`[Worker] Failure: ${msg.error}`);
            }
        });

        screenshotWorker.on('error', (err) => {
            console.error('[Worker] Fatal Error:', err);
        });
    }
    return screenshotWorker;
}

async function captureSmartScreenshot() {
    try {
        // 1. Get latest active window info
        const activeWin = (await import('active-win')).default;
        const currentWin = await activeWin();

        const activeProcess = currentWin?.owner.name || STATE.activeProcess;
        console.log(`[Screenshot] Checking capture conditions. Active: ${activeProcess}, Mode: ${STATE.settings.screenshotMode}`);

        let shouldCapture = false;

        // Condition Check based on Mode
        if (STATE.settings.screenshotMode === 'screen') {
            shouldCapture = true;
        } else if (STATE.settings.screenshotMode === 'window') {
            shouldCapture = true;
            console.log(`[Screenshot] Active Window mode: Capturing '${activeProcess}'`);
        } else if (STATE.settings.screenshotMode === 'process') {
            const targetApp = STATE.settings.screenshotTargetProcess || '';
            const matchesTarget = targetApp && activeProcess.toLowerCase().includes(targetApp.toLowerCase());

            if (matchesTarget) {
                shouldCapture = true;
                console.log(`[Screenshot] Target process match found: ${matchesTarget}`);
            } else {
                console.log(`[Screenshot] Skipping. Active app '${activeProcess}' does not match target '${targetApp}'.`);
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
        const isProcessMode = STATE.settings.screenshotMode === 'process' || STATE.settings.screenshotMode === 'window';

        if (!isProcessMode) {
            // SCREEN MODE: Delegate COMPLETELY to Worker (Zero Main Thread Block)
            const worker = getScreenshotWorker();
            console.log('[Screenshot] Delegating full capture to Worker (4K Optimization)');

            worker.postMessage({
                action: 'CAPTURE_SCREEN',
                filePath: fullPath
            });

            // Optimistic Update of Daily Log (assuming success)
            // Ideally we wait for worker confirmation, but for UI responsiveness we log it now
            // or listen to worker response. For simplicity, we assume success or let next cycle pick it up?
            // Actually daily log needs to be updated.
            // Let's update daily log here optimistically. 
            updateDailyLog(fullPath, now);

            return;
        }

        // WINDOW MODE / PROCESS MODE: Also use Worker + Crop (Avoids desktopCapturer lag)
        if (currentWin && currentWin.bounds) {
            const worker = getScreenshotWorker();
            console.log('[Screenshot] Delegating Window capture to Worker (Crop Optimization)');

            worker.postMessage({
                action: 'CAPTURE_WINDOW',
                filePath: fullPath,
                bounds: currentWin.bounds // { x, y, width, height }
            });

            updateDailyLog(fullPath, now);
            return;
        }

        // Fallback (Rare/Impossible if active-win works): Use desktopCapturer.
        console.log('[Screenshot] active-win bounds missing. Falling back to desktopCapturer.');

        const types: ('screen' | 'window')[] = ['window']; // Only window mode falls here
        const thumbSize = { width: 960, height: 540 }; // Keep small for performance

        const sources = await desktopCapturer.getSources({
            types,
            thumbnailSize: thumbSize,
            fetchWindowIcons: false
        });

        let targetSource = null;
        // Find window logic...
        const activeWinId = currentWin?.id || STATE.activeWindowId;
        console.log(`[Screenshot] Looking for window ID: ${activeWinId} (Type: ${typeof activeWinId}), Title: ${currentWin?.title}`);

        if (activeWinId) {
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
        // We can't send NativeImage to worker easily.
        // We can send bitmap buffer? Too slow to extract.
        // For window mode, we accept Main Thread encoding for now, OR:
        // Main thread toJPEG (small 540p is fast).
        const jpegBuffer = targetSource.thumbnail.toJPEG(70);
        await fs.promises.writeFile(fullPath, jpegBuffer);

        updateDailyLog(fullPath, now);

    } catch (e) {
        console.error("[Screenshot] General Failure:", e);
    }
}

function updateDailyLog(fullPath: string, now: Date) {
    const yearMonth = format(now, 'yyyy-MM');
    const logPath = getDailyLogPath(yearMonth);
    const dateStr = format(now, 'yyyy-MM-dd');

    setImmediate(() => {
        try {
            const logData = readJson<Record<string, DailyLogData>>(logPath, {});
            if (!logData[dateStr]) {
                logData[dateStr] = { sessions: [], todos: [], quest_cleared: false, screenshots: [], is_rest_day: false };
            }
            if (!logData[dateStr].screenshots) logData[dateStr].screenshots = [];
            logData[dateStr].screenshots.push(fullPath);
            writeJson(logPath, logData);
        } catch (e) {
            console.error("Failed to update log", e);
        }
    });
}

function performBackup(sourceFilePath: string) {
    const { backupPaths } = STATE.settings;
    if (!backupPaths || backupPaths.length === 0) return;

    const fileName = path.basename(sourceFilePath);

    backupPaths.forEach(backupDir => {
        try {
            if (!fs.existsSync(backupDir)) return;
            const destPath = path.join(backupDir, fileName);
            fs.copyFileSync(sourceFilePath, destPath);
            console.log(`Backed up to: ${destPath}`);
        } catch (e) {
            console.error(`Backup failed for ${backupDir}:`, e);
        }
    });
}
