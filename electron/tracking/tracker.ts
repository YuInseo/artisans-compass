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
            // Midnight Rule: Attribution based on Start Time. 
            // We DO NOT split sessions at midnight. 
            // A session starting at 23:00 on Day X and ending at 02:00 on Day Y 
            // belongs entirely to Day X.

            // Normal update (extend current session)
            STATE.currentSession.end = now;
            STATE.currentSession.duration = Math.round((now - STATE.currentSession.start) / 1000);

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

    logData[dateKey].sessions.push(session);
    writeJson(filePath, logData);
    console.log(`Saved session: ${session.process} (${session.duration}s) to ${dateKey}`);

    // Trigger Backup
    performBackup(filePath);
}

async function captureSmartScreenshot() {
    try {
        // Prevent retry loop: Mark attempt immediately
        STATE.lastScreenshotTime = Date.now();

        // Desktop Capturer gets sources
        // If mode is 'screen', we primarily look for screen sources.
        // If mode is 'window' or 'process', we include 'window' sources.
        const types = STATE.settings.screenshotMode === 'screen' ? ['screen'] : ['window', 'screen'];
        // @ts-ignore
        const sources = await desktopCapturer.getSources({ types, thumbnailSize: { width: 1280, height: 720 } });
        console.log(`[Screenshot] Mode: ${STATE.settings.screenshotMode}. Sources found: ${sources.length}. Active Process: ${STATE.activeProcess}`);

        // DEBUG: Log all source names to see what we can match against
        if (STATE.settings.screenshotMode === 'process') {
            console.log(`[Screenshot Debug] Available Sources: ${sources.map(s => `"${s.name}"`).join(', ')}`);
        }

        let targetSource = null;

        if (STATE.settings.screenshotMode === 'screen') {
            // Screen Mode: Match ID or default to first screen
            const targetId = STATE.settings.screenshotDisplayId;
            console.log(`[Screenshot Debug] Screen Mode - Configured ID: ${targetId}`);
            console.log(`[Screenshot Debug] Available Screen IDs: ${sources.map(s => `${s.name}(${s.id})`).join(', ')}`);

            if (targetId) {
                targetSource = sources.find(s => s.id === targetId);
                if (targetSource) console.log(`[Screenshot] Matched configured screen: ${targetSource.name}`);
                else console.log(`[Screenshot] Configured ID ${targetId} not found in sources.`);
            }

            if (!targetSource) {
                targetSource = sources.find(s => s.id.startsWith('screen'));
                console.log(`[Screenshot] Fallback to first screen: ${targetSource?.name}`);
            }
        } else if (STATE.settings.screenshotMode === 'process') {
            // Process Mode: Captures SPECIFIC app window if active or present
            if (STATE.settings.screenshotTargetProcess) {
                const targetName = STATE.settings.screenshotTargetProcess.toLowerCase();
                // Try to find the window belonging to this process
                // Note: sources.name usually is Window Title, not Process Name. 
                // But desktopCapturer does not give process name directly.
                // However, we can try to heuristic match or check against active-win result if it matches.

                console.log(`[Screenshot Debug] Target: ${targetName}, Active: ${STATE.activeProcess}, ID: ${STATE.activeWindowId}`);

                // Normalization for Fuzzy Match (e.g. discordptb -> discord)
                const fuzzyTarget = targetName.replace(/(\.exe|ptb|canary|dev|beta|_x64|_x86|64|32)$/g, '');

                // 1. Try Active Window Match
                if (STATE.activeProcess.toLowerCase().includes(targetName) || STATE.activeProcess.toLowerCase().includes(fuzzyTarget)) {
                    targetSource = sources.find(s => s.id.includes(String(STATE.activeWindowId)));
                    if (!targetSource) console.log(`[Screenshot] Active process matched ${targetName} but Window ID ${STATE.activeWindowId} not found in sources.`);
                }

                // 2. Fallback: Search background windows by TITLE
                if (!targetSource) {
                    // Exact containment
                    targetSource = sources.find(s => s.name.toLowerCase().includes(targetName));

                    // Fuzzy containment
                    if (!targetSource && fuzzyTarget !== targetName && fuzzyTarget.length > 3) {
                        targetSource = sources.find(s => s.name.toLowerCase().includes(fuzzyTarget));
                        if (targetSource) console.log(`[Screenshot] Match by fuzzy target "${fuzzyTarget}": ${targetSource.name}`);
                    }

                    if (targetSource) console.log(`[Screenshot] Found background window by title: ${targetSource.name}`);
                }
            }
        } else {
            // Window Mode (Default/Legacy Smart Behavior)

            // Find match using Window ID (More reliable active-win ID vs desktopCapturer ID)
            targetSource = sources.find(s => s.id.includes(String(STATE.activeWindowId)));

            if (!targetSource) {
                targetSource = sources.find(s => s.name === STATE.activeTitle);
            }
            if (!targetSource) {
                targetSource = sources.find(s => s.name.toLowerCase().includes(STATE.activeProcess.toLowerCase()));
            }

            // Fallback to screen only if really needed
            if (!targetSource) {
                console.log("[Screenshot] No window match found. Falling back to Screen.");
                targetSource = sources.find(s => s.id.startsWith('screen'));
            }
        }

        if (targetSource) {
            console.log(`[Screenshot] Target matched: ${targetSource.name}`);
            const image = targetSource.thumbnail;
            // ... rest of code
            const now = Date.now();
            const dateStr = format(now, 'yyyy-MM-dd');
            const timeStr = format(now, 'HH-mm-ss');

            // Directory: Configured Path or UserData/screenshots/YYYY-MM-DD
            let baseDir = STATE.settings.screenshotPath;
            if (!baseDir || baseDir.trim() === '') {
                baseDir = path.join(getUserDataPath(), 'screenshots');
            }
            const screenshotsDir = path.join(baseDir, dateStr);
            if (!fs.existsSync(screenshotsDir)) {
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }

            const safeProcessName = STATE.activeProcess ? STATE.activeProcess.replace(/[^a-z0-9]/gi, '_') : "Unknown";
            const fileName = `${timeStr}_${safeProcessName}.jpg`;
            const fullPath = path.join(screenshotsDir, fileName);

            fs.writeFileSync(fullPath, image.toJPEG(80)); // 80% quality
            console.log(`Captured screenshot: ${fullPath}`);

            // Log to daily file
            const yearMonth = format(now, 'yyyy-MM');
            const logPath = getDailyLogPath(yearMonth);
            const logData = readJson<Record<string, DailyLogData>>(logPath, {});
            if (!logData[dateStr]) {
                logData[dateStr] = {
                    sessions: [],
                    todos: [],
                    quest_cleared: false,
                    screenshots: [],
                    is_rest_day: false
                };
            }
            if (!logData[dateStr].screenshots) {
                logData[dateStr].screenshots = [];
            }
            logData[dateStr].screenshots.push(fullPath);
            writeJson(logPath, logData);
        }

    } catch (e) {
        console.error("Screenshot failed:", e);
    }
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
