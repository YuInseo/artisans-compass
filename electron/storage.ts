import { app, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';

// --- Default Data ---

// --- Types ---
export interface AppSettings {
    targetProcessPatterns: string[];
    idleThresholdSeconds: number;
    backupPaths: string[];
    projectTags: string[];
    typeColors?: Record<string, string>;
    enableCustomProjectColors?: boolean;
    defaultProjectDurationDays: number;
    screenshotIntervalSeconds: number; // New config
    enableScreenshots?: boolean;
    screenshotPath?: string; // Custom directory
    timelapseDurationSeconds: number;
    visibleProjectRows: number;
    hasCompletedOnboarding: boolean;
    widgetOpacity?: number;
    focusGoals?: {
        monthly: string;
        weekly: string;
        monthlyUpdatedAt?: number;
        weeklyUpdatedAt?: number;
    };
    startOfWeek?: string;
    screenshotMode?: 'window' | 'screen' | 'process' | 'active-app';
    screenshotDisplayId?: string;
    screenshotTargetProcess?: string;
    screenshotOnlyWhenActive?: boolean;
    googleDriveTokens?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
        email?: string;
    };
    notionTokens?: {
        accessToken: string;
        workspaceName?: string;
        workspaceIcon?: string;
        botId?: string;
        databaseId?: string;
    };
    notionConfig?: {
        clientId: string;
        clientSecret: string;
        includeScreenshots?: boolean;
    };
    autoUpdate?: boolean;
    enableSpellCheck?: boolean;
    themePreset?: 'default' | 'discord' | 'midnight' | 'custom';
    customCSS?: string;
    customThemes?: { id: string; name: string; css: string }[];
}

export interface Session {
    start: number; // timestamp
    end: number;   // timestamp
    duration: number; // seconds
    process: string;
}

export interface DailyLogData {
    sessions: Session[];
    todos: any[];
    quest_cleared: boolean;
    screenshots: string[];
    is_rest_day: boolean;
    quote?: string;
    nightTimeStart?: number;
}

// --- Default Data ---

export const DEFAULT_SETTINGS: AppSettings = {
    targetProcessPatterns: [],
    idleThresholdSeconds: 10,
    backupPaths: [],
    projectTags: ["Main", "Sub", "Practice"],
    typeColors: {
        "Main": "#3b82f6",
        "Sub": "#22c55e",
        "Practice": "#eab308"
    },
    enableCustomProjectColors: false,
    defaultProjectDurationDays: 14,
    screenshotIntervalSeconds: 10, // TEMPORARY TESTING: 10 seconds
    timelapseDurationSeconds: 5,
    visibleProjectRows: 3,
    hasCompletedOnboarding: false,
    widgetOpacity: 0.95,
    focusGoals: {
        monthly: "",
        weekly: "",
        monthlyUpdatedAt: 0,
        weeklyUpdatedAt: 0
    },
    screenshotMode: 'window',
    startOfWeek: 'sunday',
    enableScreenshots: true,
    screenshotDisplayId: '',
    screenshotTargetProcess: '',
    screenshotOnlyWhenActive: true,
    autoUpdate: false,
    enableSpellCheck: false,
    customThemes: [],
    customCSS: ""
};

// --- Storage Paths ---

export function getUserDataPath() {
    return app.getPath('userData');
}

export function getSettingsPath() {
    return path.join(getUserDataPath(), 'settings.json');
}

export function getProjectsPath() {
    return path.join(getUserDataPath(), 'projects.json');
}

// Helper kept for consistency, even if used via direct path mapping in monthly log
export function getDailyLogPath(yearMonth: string) {
    return path.join(getUserDataPath(), `daily_log_${yearMonth.replace('-', '_')}.json`);
}

// --- Helpers ---

export function readJson<T>(filePath: string, defaultValue: T): T {
    try {
        if (!fs.existsSync(filePath)) {
            return defaultValue;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        return (parsed === null || parsed === undefined) ? defaultValue : parsed;
    } catch (error) {
        log.error(`[Storage] Error reading ${filePath}:`, error);
        return defaultValue;
    }
}

export function writeJson(filePath: string, data: any) {
    const tempPath = filePath + '.tmp';
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 1. Write to temp file with explicit sync to ensure data is on disk
        // using low-level file descriptors for better control
        const fd = fs.openSync(tempPath, 'w');
        try {
            fs.writeSync(fd, JSON.stringify(data));
            fs.fsyncSync(fd); // Flush to physical storage
        } finally {
            fs.closeSync(fd);
        }

        // 2. Atomic Rename
        fs.renameSync(tempPath, filePath);

        return true;
    } catch (error) {
        log.error(`[Storage] Error writing ${filePath}:`, error);

        // Cleanup temp file
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        } catch (cleanupError) {
            // Ignore cleanup errors
        }

        return false;
    }
}

// --- Handlers ---

// Internal function to standardise saving, backing up, and syncing
export function saveDailyLogInternal(dateStr: string, newData: any) {
    const yearMonth = dateStr.slice(0, 7); // "YYYY-MM"
    const filePath = getDailyLogPath(yearMonth);
    const currentData = readJson(filePath, {}) as Record<string, any>;

    // Get existing day data or init
    const dayData = currentData[dateStr] || {
        sessions: [],
        todos: [],
        stats: { totalWorkSeconds: 0, questAchieved: false },
        assets: [],
        isRestDay: false
    };

    // Merge logic
    const mergedData = {
        ...dayData,
        ...newData,
        stats: {
            ...dayData.stats,
            ...(newData.stats || {})
        },
        // Arrays should probably be replaced if provided in newData, or we can't delete items.
        // Assuming newData contains the AUTHORITATIVE arrays if present.
        sessions: newData.sessions || dayData.sessions,
        todos: newData.todos || dayData.todos,
        screenshots: newData.screenshots || dayData.screenshots,
        nightTimeStart: newData.nightTimeStart !== undefined ? newData.nightTimeStart : dayData.nightTimeStart
    };

    currentData[dateStr] = mergedData;

    const saved = writeJson(filePath, currentData);

    if (saved) {
        // --- Backup Hook ---
        try {
            const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
            if (settings.backupPaths && settings.backupPaths.length > 0) {
                const fileName = path.basename(filePath);
                settings.backupPaths.forEach(backupDir => {
                    try {
                        if (!fs.existsSync(backupDir)) return;
                        const destPath = path.join(backupDir, fileName);
                        fs.copyFileSync(filePath, destPath);
                    } catch (e) {
                        console.error(`Backup failed for ${backupDir}:`, e);
                    }
                });
            }
        } catch (e) {
            console.error("Backup trigger failed", e);
        }

        // --- Notion Sync Hook ---
        // DISABLED: Prevents aggressive syncing on every screenshot/background save.
        // Sync is now handled manually via 'manual-sync-notion' in App.tsx (Closing Ritual).
        /*
        try {
            const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
            if (settings.notionTokens?.accessToken && settings.notionTokens?.databaseId) {
                // Fire and forget - don't await/block
                import('./notion-ops').then(mod => {
                    mod.syncDailyLog(
                        settings.notionTokens!.accessToken,
                        settings.notionTokens!.databaseId!,
                        dateStr,
                        mergedData
                    );
                }).catch(err => log.error("[Storage] Failed to load notion-ops", err));
            }
        } catch (e) {
            log.error("[Storage] Notion hook error", e);
        }
        */
    }

    return saved;
}

export function appendSession(dateStr: string, session: Session) {
    const yearMonth = dateStr.slice(0, 7);
    const filePath = getDailyLogPath(yearMonth);

    try {
        const currentData = readJson(filePath, {}) as Record<string, any>;

        // Init day if needed
        if (!currentData[dateStr]) {
            currentData[dateStr] = {
                sessions: [],
                todos: [],
                stats: { totalWorkSeconds: 0, questAchieved: false },
                assets: [],
                isRestDay: false
            };
        }

        // Append safely
        const dayData = currentData[dateStr];
        if (!dayData.sessions) dayData.sessions = [];
        dayData.sessions.push(session);

        // Save
        const saved = writeJson(filePath, currentData);

        // Backup Hook (Simplified from saveDailyLogInternal)
        if (saved) {
            try {
                const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
                if (settings.backupPaths && settings.backupPaths.length > 0) {
                    const fileName = path.basename(filePath);
                    settings.backupPaths.forEach(backupDir => {
                        if (fs.existsSync(backupDir)) {
                            fs.copyFileSync(filePath, path.join(backupDir, fileName));
                        }
                    });
                }
            } catch (e) {
                console.error("Backup trigger failed in appendSession", e);
            }
        }
        return saved;
    } catch (error) {
        log.error(`[Storage] Error appending session to ${filePath}:`, error);
        return false;
    }
}

export function setupStorageHandlers(getTrackerState?: () => any) {
    // Settings
    ipcMain.handle('get-settings', () => {
        return readJson(getSettingsPath(), DEFAULT_SETTINGS);
    });

    ipcMain.handle('save-settings', (_, settings) => {
        return writeJson(getSettingsPath(), settings);
    });

    // Projects
    ipcMain.handle('get-projects', () => {
        return readJson(getProjectsPath(), []);
    });

    ipcMain.handle('save-projects', (_, projects) => {
        return writeJson(getProjectsPath(), projects);
    });

    // Daily Logs (Monthly File)
    ipcMain.handle('get-monthly-log', (_, yearMonth) => {
        // yearMonth: "YYYY-MM"
        const filePath = getDailyLogPath(yearMonth);
        return readJson(filePath, {});
    });

    ipcMain.handle('save-monthly-log', (_, { yearMonth, data }) => {
        const filePath = getDailyLogPath(yearMonth);
        return writeJson(filePath, data);
    });

    ipcMain.handle('save-daily-log', (_, dateStr, newData) => {
        return saveDailyLogInternal(dateStr, newData);
    });

    // Get Single Day Log (with Live Session Merge for Today)
    ipcMain.handle('get-daily-log', (_, dateStr: string) => {
        const yearMonth = dateStr.slice(0, 7); // "YYYY-MM"
        const filePath = getDailyLogPath(yearMonth);
        const monthlyData = readJson<Record<string, any>>(filePath, {});
        const dayData = monthlyData[dateStr] || null;

        // If asking for TODAY, try to merge live session
        const todayStr = new Date().toISOString().split('T')[0];
        if (dateStr === todayStr && getTrackerState) {
            try {
                const state = getTrackerState();
                if (state && state.currentSession) {
                    // Clone dayData or init
                    const mergedDay = dayData ? JSON.parse(JSON.stringify(dayData)) : { sessions: [], todos: [], screenshots: [] };
                    if (!mergedDay.sessions) mergedDay.sessions = [];

                    // Append current live session
                    mergedDay.sessions.push(state.currentSession);

                    return mergedDay;
                }
            } catch (e) {
                console.error("[Storage] Failed to merge live session:", e);
            }
        }

        return dayData;
    });

    // Also expose a helper to get data path for debugging
    ipcMain.handle('get-user-data-path', () => getUserDataPath());

    // App History
    ipcMain.handle('get-app-history', () => {
        return getAppHistory();
    });
}

export function getAppHistory() {
    const userDataPath = getUserDataPath();
    const uniqueApps = new Set<string>();

    try {
        const files = fs.readdirSync(userDataPath).filter(f => f.startsWith('daily_log_') && f.endsWith('.json'));

        files.forEach(file => {
            const filePath = path.join(userDataPath, file);
            try {
                // Read file manually to avoid type issues with generic readJson if not needed
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                Object.values(data).forEach((dayData: any) => {
                    if (dayData.sessions && Array.isArray(dayData.sessions)) {
                        dayData.sessions.forEach((session: any) => {
                            if (session.process) {
                                uniqueApps.add(session.process);
                            }
                        });
                    }
                });
            } catch (e) {
                // Ignore read errors for individual files
            }
        });
    } catch (e) {
        console.error("Failed to read app history:", e);
    }

    return Array.from(uniqueApps).sort();
}
