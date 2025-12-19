import { app, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// --- Default Data ---

// --- Types ---
export interface AppSettings {
    targetProcessPatterns: string[];
    idleThresholdSeconds: number;
    backupPaths: string[];
    projectTags: string[];
    defaultProjectDurationDays: number;
    screenshotIntervalSeconds: number; // New config
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
    screenshotMode?: 'window' | 'screen' | 'process';
    screenshotDisplayId?: string;
    screenshotTargetProcess?: string;
    googleDriveTokens?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
        email?: string;
    };
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
    targetProcessPatterns: ["CLIPStudioPaint", "Photoshop", "Code", "Chrome"],
    idleThresholdSeconds: 10,
    backupPaths: [],
    projectTags: ["Main", "Sub", "Practice"],
    defaultProjectDurationDays: 14,
    screenshotIntervalSeconds: 10, // TEMPORARY TESTING: 10 seconds
    timelapseDurationSeconds: 5,
    visibleProjectRows: 8,
    hasCompletedOnboarding: false,
    widgetOpacity: 0.95,
    focusGoals: {
        monthly: "",
        weekly: "",
        monthlyUpdatedAt: 0,
        weeklyUpdatedAt: 0
    },
    screenshotMode: 'window',
    screenshotDisplayId: '',
    screenshotTargetProcess: ''
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
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return defaultValue;
    }
}

export function writeJson(filePath: string, data: any) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// --- Handlers ---

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
        // dateStr: "YYYY-MM-DD"
        // newData: Partial object to merge, e.g. { stats: { questAchieved: true } }

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

        // Merge logic (Deep merge might be better but simple merge for now)
        // Specific handling for stats merge if needed
        const mergedData = {
            ...dayData,
            ...newData,
            stats: {
                ...dayData.stats,
                ...(newData.stats || {})
            }
        };

        currentData[dateStr] = mergedData;

        return writeJson(filePath, currentData);
    });

    // Also expose a helper to get data path for debugging
    ipcMain.handle('get-user-data-path', () => getUserDataPath());
}
