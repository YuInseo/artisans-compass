import { Session, Todo, Project } from "@/types";
import { Sparkles, Lock, Unlock, Moon, Sun, Eraser, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo, useRef } from "react";
import { format, differenceInSeconds } from "date-fns";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
    ContextMenu,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { TodoEditor } from "./TodoEditor";
import { TimeTableGraph } from "./TimeTableGraph";


interface DailyPanelProps {
    onEndDay: (todos: Todo[], screenshots: string[]) => void;
    projects?: Project[];
    isSidebarOpen?: boolean;
}

export function DailyPanel({ onEndDay, projects = [], isSidebarOpen = true }: DailyPanelProps) {
    const { t } = useTranslation();
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Timer Logic for Widget Mode
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        // Only run timer if we are in widget mode and timer is displayed OR we have a live session (to be safe)
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    // Use Store
    const {
        projectTodos,
        activeProjectId,
        setActiveProjectId,
        loadTodos,
        clearUntitledTodos
    } = useTodoStore();

    // Stable Selector for Todos
    const todos = useMemo(() => projectTodos[activeProjectId] || [], [projectTodos, activeProjectId]);

    const { settings, isWidgetMode, setWidgetMode, saveSettings } = useDataStore();

    const isCompactMode = !isWidgetMode && ((isSidebarOpen && windowWidth < 1500) || windowWidth < 1280);
    const [isWidgetLocked, setIsWidgetLocked] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const { theme, setTheme } = useTheme();
    const headerRef = useRef<HTMLDivElement>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);


    // Auto-Select Logic
    useEffect(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let nextId = activeProjectId;

        if (nextId) {
            const currentProject = projects.find(p => p.id === nextId);
            if (!currentProject || todayStr < currentProject.startDate || todayStr > currentProject.endDate) {
                nextId = "";
            }
        }

        if (!nextId) {
            // Find any project that covers today
            const candidate = projects.find(p => todayStr >= p.startDate && todayStr <= p.endDate);
            if (candidate) {
                nextId = candidate.id;
            }
        }

        if (nextId !== activeProjectId) {
            setActiveProjectId(nextId || "");
        }
    }, [projects, activeProjectId, setActiveProjectId]);

    // Dynamic Widget Height Logic
    const lastHeightRef = useRef<number>(0);
    const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        if (!isWidgetMode || !headerRef.current || !editorContentRef.current || !(window as any).ipcRenderer) return;

        const calculateAndResize = () => {
            const headerHeight = headerRef.current?.offsetHeight || 0;
            const contentHeight = editorContentRef.current?.offsetHeight || 0;
            const totalHeight = headerHeight + contentHeight + 40;

            const maxHeight = settings?.widgetMaxHeight || 800;
            const finalHeight = Math.min(totalHeight, maxHeight);

            // Only send resize if height has changed significantly (prevent loops)
            if (Math.abs(finalHeight - lastHeightRef.current) > 2) {
                lastHeightRef.current = finalHeight;
                (window as any).ipcRenderer.send('resize-widget', { width: 435, height: finalHeight });
            }
        };

        const observer = new ResizeObserver(() => {
            // Debounce resize calls to prevent flickering and IPC flooding
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = setTimeout(() => {
                calculateAndResize();
            }, 100);
        });

        observer.observe(headerRef.current);
        observer.observe(editorContentRef.current);

        // Initial sizing
        calculateAndResize();

        return () => {
            observer.disconnect();
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };
    }, [isWidgetMode, todos, settings?.widgetMaxHeight]);

    const togglePin = async () => {
        const newState = !isPinned;
        setIsPinned(newState);
        setWidgetMode(newState);

        let targetHeight = 800;
        // If entering widget mode, try to respect the current height or setting
        if (newState && headerRef.current && editorContentRef.current) {
            const headerHeight = headerRef.current?.offsetHeight || 0;
            const contentHeight = editorContentRef.current?.offsetHeight || 0;
            const calculated = headerHeight + contentHeight + 40;
            targetHeight = Math.min(calculated, settings?.widgetMaxHeight || 800);
        } else if (newState) {
            targetHeight = settings?.widgetMaxHeight || 800;
        }

        await (window as any).ipcRenderer.send('set-widget-mode', { mode: newState, height: targetHeight });
    }

    const [sessions, setSessions] = useState<Session[]>([]);
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [liveSession, setLiveSession] = useState<Session | null>(null);

    useEffect(() => {
        loadTodos();

        if ((window as any).ipcRenderer) {
            const loadSessionData = async () => {
                const now = new Date();
                const yearMonth = format(now, 'yyyy-MM');
                const dateStr = format(now, 'yyyy-MM-dd');
                const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                if (logs && logs[dateStr]) {
                    if (logs[dateStr].sessions) setSessions(logs[dateStr].sessions);
                    if (logs[dateStr].screenshots) setScreenshots(logs[dateStr].screenshots);
                }
            };
            loadSessionData();

            const removeListener = (window as any).ipcRenderer.onTrackingUpdate((data: any) => {
                if (data.currentSession) {
                    setLiveSession(data.currentSession);
                } else {
                    setLiveSession(null);
                    // Refresh data logic...
                }
            });

            return () => {
                removeListener();
            };
        }
    }, [loadTodos]);


    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className="h-full w-full flex flex-row text-foreground font-sans transition-colors duration-300"
                    style={{
                        backgroundColor: isWidgetMode
                            ? (settings?.widgetOpacity === 0 ? 'transparent' : `hsl(var(--card) / ${settings?.widgetOpacity ?? 0.95})`)
                            : `hsl(var(--card))`
                    }}
                >
                    {/* Split Content */}
                    <div className={cn("flex-1 flex", isWidgetMode ? "gap-6 px-2 pt-2 pb-2" : "gap-6 px-6 py-4 relative")}>
                        {/* Left Panel: Focus List */}
                        <div
                            className={cn("flex flex-col overflow-hidden relative transition-all duration-300 min-w-[300px]", isWidgetMode ? "w-full" : "flex-1")}
                        >
                            {/* Header Wrapper for Measure */}
                            <div ref={headerRef} className="shrink-0">
                                {isWidgetMode && (
                                    <>
                                        <div
                                            className={cn(
                                                "h-9 border-b border-border flex items-center justify-between pl-3 pr-2 select-none mb-2 backdrop-blur-sm transition-all duration-300",
                                                settings?.widgetHeaderAutoHide ? "opacity-0 hover:opacity-100 bg-muted/90" : "bg-muted/80"
                                            )}
                                            style={{ WebkitAppRegion: settings?.widgetPositionLocked ? 'no-drag' : 'drag' } as any}
                                        >
                                            {/* Left: Project Select (Draggable Area with Interactive Children) */}
                                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2" style={{ WebkitAppRegion: settings?.widgetPositionLocked ? 'no-drag' : 'drag' } as any}>
                                                <div className="h-6 flex-1 max-w-[180px]">
                                                    <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                                                        <SelectTrigger
                                                            className="h-6 w-full bg-transparent border-none p-0 text-xs font-bold text-muted-foreground hover:text-foreground focus:ring-0 shadow-none uppercase tracking-widest gap-1 no-drag"
                                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0 mr-1" />
                                                            <SelectValue placeholder={t('dashboard.selectProject').toUpperCase()}>
                                                                {projects.find(p => p.id === activeProjectId)?.name || t('dashboard.focusWidget')}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(() => {
                                                                const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                                const activeProjects = projects.filter(p => p.startDate <= todayStr && p.endDate >= todayStr);

                                                                return (
                                                                    <>
                                                                        {activeProjects.length === 0 && <SelectItem value="none">{t('dashboard.noProject')}</SelectItem>}
                                                                        {activeProjects.map(p => (
                                                                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                                                                        ))}
                                                                    </>
                                                                );
                                                            })()}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Right: Controls (Consolidated Menu) */}
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive no-drag"
                                                    onClick={togglePin}
                                                    title={t('dashboard.unpin')}
                                                    style={{ WebkitAppRegion: 'no-drag' } as any}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin-off"><line x1="2" x2="22" y1="2" y2="22" /><line x1="12" x2="12" y1="17" y2="22" /><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-.25-.95" /><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89" /></svg>
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                                    onClick={clearUntitledTodos}
                                                    title={t('dashboard.clearUntitled')}
                                                    style={{ WebkitAppRegion: 'no-drag' } as any}
                                                >
                                                    <Eraser className="w-3.5 h-3.5" />
                                                </Button>

                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-2"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-0" side="bottom" align="end">
                                                        <div className="flex flex-col max-h-[300px]">
                                                            <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">

                                                                {/* Opacity Slider */}
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <span className="text-muted-foreground">{t('dashboard.opacity')}</span>
                                                                        <span>{Math.round((settings?.widgetOpacity ?? 1) * 100)}%</span>
                                                                    </div>
                                                                    <Slider
                                                                        min={0}
                                                                        max={1.0}
                                                                        step={0.05}
                                                                        value={[settings?.widgetOpacity ?? 0.95]}
                                                                        onValueChange={(val) => settings && saveSettings({ ...settings, widgetOpacity: val[0] })}
                                                                    />
                                                                </div>

                                                                {/* Max Height Slider */}
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <span className="text-muted-foreground">{t('settings.appearance.widgetMaxHeight')}</span>
                                                                        <span>{settings?.widgetMaxHeight || 800}px</span>
                                                                    </div>
                                                                    <Slider
                                                                        min={300}
                                                                        max={1200}
                                                                        step={50}
                                                                        value={[settings?.widgetMaxHeight || 800]}
                                                                        onValueChange={(val) => settings && saveSettings({ ...settings, widgetMaxHeight: val[0] })}
                                                                    />
                                                                </div>

                                                                {/* Display Mode Select */}
                                                                <div className="space-y-2">
                                                                    <div className="text-xs font-medium text-muted-foreground">{t('settings.appearance.selectDisplay')}</div>
                                                                    <Select
                                                                        value={settings?.widgetDisplayMode || 'none'}
                                                                        onValueChange={(val: any) => settings && saveSettings({ ...settings, widgetDisplayMode: val })}
                                                                    >
                                                                        <SelectTrigger className="h-7 text-xs">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none" className="text-xs">{t('settings.appearance.none')}</SelectItem>
                                                                            <SelectItem value="quote" className="text-xs">{t('settings.appearance.dailyQuote')}</SelectItem>
                                                                            <SelectItem value="goals" className="text-xs">{t('settings.appearance.focusGoals')}</SelectItem>
                                                                            <SelectItem value="timer" className="text-xs">{t('dashboard.timer') || 'Focus Timer'}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {/* Theme Toggle */}
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                                                                            {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                                                                            {t('settings.theme')}
                                                                        </span>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 text-xs px-2"
                                                                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                                                        >
                                                                            {theme === 'dark' ? 'Dark' : 'Light'}
                                                                        </Button>
                                                                    </div>

                                                                    {/* Lock Content */}
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                                                                            {isWidgetLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                                            {t('dashboard.lockWidget')}
                                                                        </span>
                                                                        <Switch
                                                                            checked={isWidgetLocked}
                                                                            onCheckedChange={setIsWidgetLocked}
                                                                            className="scale-75 origin-right"
                                                                        />
                                                                    </div>

                                                                    {/* Lock Position */}
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-anchor"><circle cx="12" cy="5" r="3" /><line x1="12" x2="12" y1="22" y2="8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /></svg>
                                                                            Lock Position
                                                                        </span>
                                                                        <Switch
                                                                            checked={settings?.widgetPositionLocked || false}
                                                                            onCheckedChange={(checked) => settings && saveSettings({ ...settings, widgetPositionLocked: checked })}
                                                                            className="scale-75 origin-right"
                                                                        />
                                                                    </div>

                                                                    {/* Auto-Hide Header */}
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-top-open"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><path d="m9 16 3-3 3 3" /></svg>
                                                                            Auto-hide Header
                                                                        </span>
                                                                        <Switch
                                                                            checked={settings?.widgetHeaderAutoHide || false}
                                                                            onCheckedChange={(checked) => settings && saveSettings({ ...settings, widgetHeaderAutoHide: checked })}
                                                                            className="scale-75 origin-right"
                                                                        />
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>


                                        {/* Custom Widget Header Content */}
                                        {settings?.widgetDisplayMode === 'quote' && (
                                            <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2 group relative">
                                                <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center relative">
                                                    <p className="text-sm font-medium font-serif italic text-muted-foreground whitespace-pre-line leading-relaxed">
                                                        "{[
                                                            "창의성은 실수를 허용하는 것이다. 예술은 어떤 것을 지킬지 아는 것이다.",
                                                            // ... (truncated for brevity, keep existing array)
                                                            "몰입은 최고의 휴식이다."
                                                        ][new Date().getDate() % 30]}"
                                                    </p>
                                                    <button
                                                        onClick={() => saveSettings({ ...settings, widgetDisplayMode: 'none' })}
                                                        className="absolute top-1 right-1 p-1 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all no-drag"
                                                        title="Remove Quote"
                                                        style={{ WebkitAppRegion: 'no-drag' } as any}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {settings?.widgetDisplayMode === 'goals' && (
                                            <div className="mb-4 px-1 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 group relative">
                                                <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                                    <div className="text-[10px] font-bold text-blue-600/70 uppercase tracking-wider mb-0.5">{t('dashboard.monthly')}</div>
                                                    <div className="text-xs font-medium truncate" title={settings.focusGoals?.monthly}>{settings.focusGoals?.monthly || t('dashboard.noGoal')}</div>
                                                </div>
                                                <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                                                    <div className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider mb-0.5">{t('dashboard.weekly')}</div>
                                                    <div className="text-xs font-medium truncate" title={settings.focusGoals?.weekly}>{settings.focusGoals?.weekly || t('dashboard.noGoal')}</div>
                                                </div>
                                                <button
                                                    onClick={() => saveSettings({ ...settings, widgetDisplayMode: 'none' })}
                                                    className="absolute -top-1 -right-1 p-1 rounded-full bg-background border border-border shadow-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all z-10 no-drag"
                                                    title="Remove Goals"
                                                    style={{ WebkitAppRegion: 'no-drag' } as any}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                </button>
                                            </div>
                                        )}

                                        {settings?.widgetDisplayMode === 'timer' && (
                                            <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2 group relative">
                                                {/* Timer Calculation */}
                                                {(() => {
                                                    let totalFocusTime = 0;
                                                    const allSessions = liveSession ? [...sessions, liveSession] : sessions;
                                                    allSessions.forEach(session => {
                                                        const s = new Date(session.start);
                                                        const isLive = session === liveSession;
                                                        const e = isLive ? now : new Date(session.end);
                                                        if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
                                                        const duration = differenceInSeconds(e, s);
                                                        if (duration > 0) totalFocusTime += duration;
                                                    });

                                                    return (
                                                        <div className="p-4 bg-muted/30 border border-border/50 rounded-lg flex items-center justify-between relative">
                                                            <div>
                                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">{t('calendar.totalFocus')}</div>
                                                                <div className="text-3xl font-bold font-mono tracking-tight text-foreground flex items-baseline gap-1">
                                                                    {Math.floor(totalFocusTime / 3600)}<span className="text-sm font-sans font-medium text-muted-foreground">h</span>
                                                                    {Math.floor((totalFocusTime % 3600) / 60)}<span className="text-sm font-sans font-medium text-muted-foreground">m</span>
                                                                    {totalFocusTime % 60}<span className="text-sm font-sans font-medium text-muted-foreground">s</span>
                                                                </div>
                                                            </div>

                                                            {liveSession && (
                                                                <div className="flex flex-col items-end justify-center">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="relative flex h-2 w-2">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">{t('calendar.focusing')}</span>
                                                                    </div>
                                                                    <div className="text-xs font-medium text-foreground max-w-[100px] truncate text-right border-t border-border/50 pt-1 mt-1" title={liveSession.process}>
                                                                        {liveSession.process || 'Unknown App'}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <button
                                                                onClick={() => saveSettings({ ...settings, widgetDisplayMode: 'none' })}
                                                                className="absolute top-1 right-1 p-1 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all no-drag"
                                                                title="Remove Timer"
                                                                style={{ WebkitAppRegion: 'no-drag' } as any}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </>
                                )}

                                {!isWidgetMode && projects.length > 0 && (
                                    <div className="flex items-end justify-between mb-6 px-1 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <h2 className="text-2xl font-bold text-foreground tracking-tight cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-2">
                                                    {t('dashboard.todayFocus')}
                                                </h2>
                                                <p className="text-sm text-muted-foreground font-medium mt-1">{format(new Date(), 'MMM dd, yyyy')}</p>
                                            </div>
                                        </div>

                                        {/* Controls: Project Dropdown + Pin */}
                                        <div className="flex items-center gap-3">
                                            {/* Project Dropdown */}
                                            <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                                <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder={t('dashboard.selectProject')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(() => {
                                                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                            const activeProjects = projects.filter(p => p.startDate <= todayStr && p.endDate >= todayStr);

                                                            return (
                                                                <>
                                                                    {activeProjects.length === 0 && <SelectItem value="none">No Project</SelectItem>}
                                                                    {activeProjects.map(p => (
                                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                    ))}
                                                                </>
                                                            );
                                                        })()}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Action Buttons Group */}
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                                    onClick={clearUntitledTodos}
                                                    title={t('dashboard.clearUntitled')}
                                                >
                                                    <Eraser className="w-[18px] h-[18px]" />
                                                </Button>

                                                {/* Pin Button (Only show if NOT in widget mode) */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("h-9 w-9 transition-all", isPinned ? "text-primary bg-primary/10 rotate-45" : "text-muted-foreground hover:text-foreground")}
                                                    onClick={togglePin}
                                                    title={isPinned ? t('dashboard.unpin') : t('dashboard.pin')}
                                                >
                                                    <span className="sr-only">Pin</span>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div> {/* End Header Wrapper */}

                            {/* Editor Area (Scrollable) - Only show if projects exist or in widget mode */}
                            {(isWidgetMode || (projects.length > 0 && activeProjectId && activeProjectId !== 'none')) ? (
                                <div className={cn(
                                    "relative pr-2 custom-scrollbar overflow-x-hidden",
                                    isWidgetMode ? "flex-1 overflow-y-auto pb-6" : "flex-1 overflow-y-auto pb-20"
                                )}
                                    style={{ scrollbarGutter: 'stable' }}
                                >
                                    {/* Content Wrapper for Measure & Lock Logic */}
                                    <div
                                        ref={editorContentRef}
                                        className="min-h-full"
                                    >
                                        <TodoEditor
                                            activeProjectId={activeProjectId}
                                            todos={todos}
                                            isWidgetMode={isWidgetMode}
                                            isWidgetLocked={isWidgetLocked}
                                        />
                                    </div>

                                    {/* FOOTER AREA - REMOVED, moving to Right Panel */}
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center flex-col text-muted-foreground gap-4">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                                        <Sparkles className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="text-sm">{t('dashboard.noActiveProject')}</p>
                                    <div className="text-xs opacity-60 max-w-[200px] text-center">
                                        {t('dashboard.createProjectHint')}
                                    </div>
                                </div>
                            )}

                            {/* End Day Floating Button in Left Panel */}
                            {!isWidgetMode && (projects.length > 0 && activeProjectId && activeProjectId !== 'none') && (
                                <div className="absolute bottom-6 right-6 z-20 pointer-events-auto">
                                    <Button
                                        variant="default"
                                        size="lg"
                                        onClick={() => onEndDay(todos, screenshots)}
                                        className="gap-2 shadow-lg rounded-full"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        {t('dashboard.endDay')}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* RIGHT PANEL - TIMETABLE GRAPH & END DAY */}
                        {/* Only visible in desktop/non-widget mode */}
                        {!isWidgetMode && (
                            <div className={cn(
                                "shrink-0 border-l border-border/50 flex flex-col transition-all duration-300 ease-in-out bg-background/95 backdrop-blur z-20",
                                isCompactMode
                                    ? "absolute right-0 top-0 bottom-0 w-2 hover:w-[300px] shadow-2xl border-l-4 hover:border-l border-primary/50"
                                    : "w-[300px] relative pl-6"
                            )}>
                                <div className={cn("flex-1 pt-4 h-full", isCompactMode ? "opacity-0 hover:opacity-100 transition-opacity duration-300 px-4" : "")}>
                                    <TimeTableGraph
                                        sessions={sessions}
                                        activeProjectId={activeProjectId}
                                        liveSession={liveSession}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>
        </ContextMenu >
    );
}
