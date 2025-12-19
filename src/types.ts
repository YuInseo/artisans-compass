export interface AppSettings {
    targetProcessPatterns: string[]; // e.g., ["CLIPStudioPaint.exe", "Photoshop.exe"]
    idleThresholdSeconds: number; // default: 10
    backupPaths: string[]; // list of directories
    projectTags: string[]; // ["Main", "Sub", "Practice"]
    defaultProjectDurationDays: number; // default: 14
    visibleProjectRows: number;
    hasCompletedOnboarding: boolean;
    screenshotIntervalSeconds: number; // default: 1800 (30m)
    screenshotPath?: string; // Custom directory for screenshots
    timelapseDurationSeconds: number; // default: 5
    checkboxVisibility: 'high' | 'low'; // default: 'high'
    focusGoals?: {
        monthly: string;
        weekly: string;
        monthlyUpdatedAt?: number;
        weeklyUpdatedAt?: number;
    };
    widgetOpacity?: number; // 0.1 to 1.0
    widgetDisplayMode?: 'none' | 'quote' | 'goals'; // default: 'none'
    widgetMaxHeight?: number; // default: 800
    startOfWeek?: 'sunday' | 'monday'; // default: 'sunday'
    workDays?: string[]; // List of specific dates "YYYY-MM-DD" that are work days
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

export interface Project {
    id: string; // UUID
    name: string;
    type: string; // "Main" | "Sub" | "Practice" etc.
    startDate: string; // ISO Date "YYYY-MM-DD"
    endDate: string; // ISO Date "YYYY-MM-DD"
    isCompleted: boolean;
    locked?: boolean;
}

export interface Session {
    start: number; // timestamp
    end: number; // timestamp
    duration: number; // seconds
    process?: string;
}

export interface WorkSession {
    startTime: string; // ISO timestamp
    endTime: string; // ISO timestamp
    durationSeconds: number;
}

export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    children?: Todo[];
    isCollapsed?: boolean;
    createdAt?: number; // Timestamp
}

export interface DailyLog {
    date: string; // "YYYY-MM-DD"
    sessions: WorkSession[];
    todos: Todo[];
    stats: {
        totalWorkSeconds: number;
        questAchieved: boolean;
    };
    assets: string[]; // Paths to screenshots
    isRestDay: boolean; // if true, treated as rest
}
