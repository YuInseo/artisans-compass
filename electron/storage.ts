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
    };
    autoUpdate?: boolean;
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
    autoUpdate: false
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
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
        return true;
    } catch (error) {
        log.error(`[Storage] Error writing ${filePath}:`, error);
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
        screenshots: newData.screenshots || dayData.screenshots
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

export function setupStorageHandlers() {
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

    // Also expose a helper to get data path for debugging
    ipcMain.handle('get-user-data-path', () => getUserDataPath());
}
