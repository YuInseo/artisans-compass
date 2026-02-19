export interface AppSettings {
    targetProcessPatterns: string[]; // e.g., ["CLIPStudioPaint.exe", "Photoshop.exe"]
    idleThresholdSeconds: number; // default: 10
    backupPaths: string[]; // list of directories
    projectTags: string[]; // ["Main", "Sub", "Practice"]
    typeColors?: Record<string, string>; // { "Main": "#3b82f6", ... }
    enableCustomProjectColors?: boolean; // default: false
    defaultProjectDurationDays: number; // default: 14
    visibleProjectRows: number;
    hasCompletedOnboarding: boolean;
    screenshotIntervalSeconds: number; // default: 1800 (30m)
    screenshotPath?: string; // Custom directory for screenshots
    timelapseDurationSeconds: number; // default: 5
    showIndentationGuides?: boolean; // default: true
    showTimelinePreview?: boolean; // default: true
    focusGoals?: {
        monthly: string;
        weekly: string;
        dailyQuest?: string;
        dailyQuestUpdatedAt?: number;
        monthlyUpdatedAt?: number;
        weeklyUpdatedAt?: number;
    };
    widgetOpacity?: number; // 0.1 to 1.0
    widgetDisplayMode?: 'none' | 'quote' | 'goals' | 'timer'; // default: 'none'
    widgetBounds?: { x: number; y: number; width: number; height: number };
    widgetPositionLocked?: boolean; // default: false
    widgetHeaderAutoHide?: boolean; // default: false
    widgetMaxHeight?: number; // default: 800
    widgetAutoResize?: boolean; // default: true
    widgetCustomHeight?: number; // default: undefined
    startOfWeek?: 'sunday' | 'monday'; // default: 'sunday'
    workDays?: string[]; // List of specific dates "YYYY-MM-DD" that are work days
    screenshotMode?: 'window' | 'screen' | 'process' | 'active-app';
    screenshotDisplayId?: string;
    screenshotTargetProcess?: string;
    screenshotOnlyWhenActive?: boolean; // default: true
    googleDriveTokens?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
        email?: string;
    };
    notionTokens?: {
        accessToken: string;
        botId?: string;
        workspaceId?: string;
        workspaceName?: string;
        owner?: any;
        databaseId?: string;
    };
    notionConfig?: {
        clientId: string;
        clientSecret: string;
        includeScreenshots?: boolean;
    };
    enableScreenshots?: boolean;
    autoLaunch?: boolean;
    autoUpdate?: boolean;
    developerMode?: boolean; // toggle for F12 devtools
    debuggerMode?: boolean; // toggle for visual debug overlay
    enableSpellCheck?: boolean; // default: false
    themePreset?: 'default' | 'discord' | 'midnight' | 'sunset' | 'ocean' | 'forest' | 'custom'; // default: 'default'
    customCSS?: string; // User-defined CSS injection
    customThemes?: { id: string; name: string; css: string }[];
    workApps?: string[]; // List of app names to filter timeline by
    knownApps?: AppInfo[]; // History of detected apps
    ignoredApps?: string[]; // List of app names to exclude or mark as non-work
    ignoredAppsColor?: string; // Color override for ignored apps in visualization
    filterTimelineByWorkApps?: boolean; // default: false
    nightTimeStart?: number; // default: 22 (10 PM)
    enableUnresolvedTodoNotifications?: boolean; // default: false
    mainTheme?: 'dark' | 'light' | 'system';
    widgetTheme?: 'dark' | 'light' | 'system';
    separateWidgetTheme?: boolean; // default: false
    widgetThemePreset?: string; // For separate color themes
    editorAlignment?: 'left' | 'center'; // default: 'left'
    customQuotes?: string[]; // User defined quotes
    timelineShowDetail?: boolean; // default: false
    showCurrentTimeIndicator?: boolean; // default: true
    nightTimeStartSnapInterval?: number; // default: 30 (minutes)
    dailyRecordMode?: 'fixed' | 'dynamic'; // 'fixed' = 00:00 rollover, 'dynamic' = until app close
    runningAppsDisplayMode?: 'title' | 'process' | 'both'; // default: 'both'
    todayTargetHours?: number; // Target focus hours for today
    timelineGridMode?: 'continuous' | '15min'; // default: '15min'
    reminders?: string[]; // User defined reminders
    weeklyRoutine?: RoutineSession[]; // Recurring weekly schedule
    calendarSettings?: {
        showNonWorkApps: boolean;
        showNighttime: boolean;
        nonWorkColor?: string;
        nighttimeColor?: string;
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
    color?: string; // Hex code or tailwind class
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
    process?: string;
}

export interface PlannedSession {
    id: string;
    start: number; // Unix timestamp (ms)
    duration: number; // seconds
    title: string;
    description?: string;
    isCompleted?: boolean;
    color?: string;
    priority?: 'high' | 'medium' | 'low';
    tag?: string;
    location?: string;
    alert?: number; // minutes before
    recurrence?: RecurrenceRule;
}

export interface RecurrenceRule {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    byWeekDay?: number[]; // 0=Sunday
    until?: number; // timestamp
    count?: number;
}

export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    children?: Todo[];
    isCollapsed?: boolean;
    createdAt?: number; // Timestamp
    carriedOver?: boolean;
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
    projectTodos?: Record<string, Todo[]>;
    carriedOver?: boolean;
    quote?: string;
    nightTimeStart?: number;
    plannedSessions?: PlannedSession[];
}

export interface RoutineSession {
    id: string;
    dayOfWeek: number; // 0=Sunday, 1=Monday, ... 6=Saturday
    startSeconds: number; // Seconds from midnight (0 - 86400)
    durationSeconds: number;
    title: string;
    description?: string;
    color?: string;
    priority?: 'high' | 'medium' | 'low';
    location?: string;
    alert?: number; // minutes before
}

export interface MonitorInfo {
    id: string; // InstanceName
    name: string; // UserFriendlyName
    manufacturer: string; // ManufacturerName
}

export interface AppInfo {
    id?: string;
    name: string;
    process: string;
    appIcon?: string;
}
