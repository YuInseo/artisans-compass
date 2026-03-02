import { Session, Todo, Project } from "@/types";
import { Sparkles, CheckCircle, Moon, Sun, Lock, Unlock, Settings2, Clock, Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { TodoSidebar } from "./TodoSidebar";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { TodoEditor } from "./TodoEditor";
import { TimeTableGraph } from "./TimeTableGraph";
import { WeeklyView } from "./WeeklyView";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { useDailyTodos } from "./hooks/useDailyTodos";
import { useDailyData } from "./hooks/useDailyData";
import { useDailyWidgetUI } from "./hooks/useDailyWidgetUI";

// Daily UI Components
import { DailyWidgetContent } from "./daily/DailyWidgetContent";
import { DailyHeader } from "./daily/DailyHeader";
import { DailyGeneralWorkPanel } from "./daily/DailyGeneralWorkPanel";

interface DailyPanelProps {
    onEndDay: (todos: Todo[], screenshots: string[], sessions: Session[], plannedSessions: any[], firstOpenedAt?: number) => void;
    projects?: Project[];
    isSidebarOpen?: boolean;
    onShowReminder?: () => void;
    onOpenSettings?: (tab?: 'timetable' | 'timeline' | 'general' | 'tracking' | 'integrations') => void;
}

export function DailyPanel({ onEndDay, onShowReminder, projects = [], isSidebarOpen, onOpenSettings }: DailyPanelProps) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const { activeProjectId, setActiveProjectId, clearUntitledTodos } = useTodoStore();
    const { settings, isWidgetMode, setWidgetMode, saveSettings, dailyLog } = useDataStore();

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const [isWeeklyView, setIsWeeklyView] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [timeTableViewMode, setTimeTableViewMode] = useState<'timetable' | 'app-usage'>('timetable');

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isCompactMode = !isWidgetMode && ((isSidebarOpen && windowWidth < 1200) || windowWidth < 1024);

    const {
        todos,
        isGeneralOpen,
        setIsGeneralOpen,
        uniqueGeneralTodos,
        uniqueGeneralCompletion
    } = useDailyTodos();

    const {
        isWidgetLocked,
        setIsWidgetLocked,
        isPinned,
        headerRef,
        editorContentRef,
        togglePin
    } = useDailyWidgetUI(settings, isWidgetMode, setWidgetMode, saveSettings, theme, setTheme, todos);

    const {
        sessions,
        screenshots,
        plannedSessions,
        manualQuote,
        firstOpenedAt,
        liveSession,
        displayDate,
        filteredSessions,
        filteredLiveSession
    } = useDailyData(projects, settings, now);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        "h-full w-full flex flex-row text-foreground font-sans transition-colors duration-300 select-none",
                        !isWidgetMode && "rounded-[12px] overflow-hidden border border-border/40 shadow-2xl"
                    )}
                    style={{
                        backgroundColor: isWidgetMode
                            ? (settings?.widgetOpacity === 0 ? 'transparent' : `hsl(var(--card) / ${settings?.widgetOpacity ?? 0.95})`)
                            : `hsl(var(--card))`
                    }}
                >
                    <TooltipProvider>
                        {/* Weekly View Modal */}
                        <Dialog open={isWeeklyView} onOpenChange={setIsWeeklyView}>
                            <DialogContent className="max-w-[90vw] h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
                                <WeeklyView
                                    currentDate={new Date()}
                                    onDateChange={() => { }}
                                    liveSession={liveSession}
                                    todaySessions={sessions}
                                />
                            </DialogContent>
                        </Dialog>

                        {/* Main Split Content */}
                        <div className={cn("flex-1 flex min-w-0", isWidgetMode ? "gap-6 px-2 pt-2 pb-2" : "gap-6 px-6 py-4 relative")}>
                            {/* Left Panel: Focus List */}
                            <div
                                className={cn("flex flex-col min-w-0 overflow-hidden relative transition-all duration-300", isWidgetMode ? "w-full" : "flex-1")}
                            >
                                {/* Header Wrapper for Measure */}
                                <div ref={headerRef} className="shrink-0">

                                    <div style={{ display: isWidgetMode ? 'contents' : 'none' }}>
                                        <div
                                            className={cn(
                                                "h-9 flex items-center justify-between pl-3 pr-2 select-none mb-2 transition-all duration-300",
                                                settings?.widgetHeaderAutoHide ? "opacity-0 hover:opacity-100" : ""
                                            )}
                                            style={{
                                                WebkitAppRegion: settings?.widgetPositionLocked ? 'no-drag' : 'drag',
                                                backgroundColor: isWidgetMode ? `hsl(var(--muted) / ${Math.max(0, (settings?.widgetOpacity ?? 0.95) * (settings?.widgetHeaderAutoHide ? 0.9 : 0.8))})` : `hsl(var(--muted) / ${settings?.widgetHeaderAutoHide ? 0.9 : 0.8})`,
                                                borderColor: isWidgetMode ? `hsl(var(--border) / ${settings?.widgetOpacity ?? 0.95})` : `hsl(var(--border))`,
                                                borderBottomWidth: '1px',
                                                borderBottomStyle: 'solid',
                                                backdropFilter: isWidgetMode ? `blur(${Math.max(0, (settings?.widgetOpacity ?? 0.95) * 4)}px)` : 'blur(4px)'
                                            } as any}
                                        >
                                            {/* Left: Project Select (Draggable Area with Interactive Children) */}
                                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2" style={{ WebkitAppRegion: settings?.widgetPositionLocked ? 'no-drag' : 'drag' } as any}>
                                                <div className="h-6 flex-1 max-w-[240px]">
                                                    <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                                                        <SelectTrigger
                                                            className={cn("h-6 w-full bg-transparent border-none p-0 text-xs font-bold text-muted-foreground hover:text-foreground focus:ring-0 shadow-none uppercase tracking-widest gap-1 no-drag justify-start text-left", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}
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
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                                            onClick={onShowReminder}
                                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                                        >
                                                            <Bell className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{t('dashboard.showReminder') || "Show Reminder"}</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Popover>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
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
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{t('settings.title')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <PopoverContent className="w-72 p-0 no-drag" side="bottom" align="end" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
                                                                            onClick={() => {
                                                                                const newTheme = theme === 'dark' ? 'light' : 'dark';
                                                                                setTheme(newTheme);
                                                                                if (settings) {
                                                                                    if (isWidgetMode && settings.separateWidgetTheme) {
                                                                                        saveSettings({ ...settings, widgetTheme: newTheme as 'dark' | 'light' | 'system' });
                                                                                    } else {
                                                                                        saveSettings({ ...settings, mainTheme: newTheme as 'dark' | 'light' | 'system' });
                                                                                    }
                                                                                }
                                                                            }}
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
                                                                            {t('dashboard.lockPosition')}
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
                                                                            {t('dashboard.autoHideHeader')}
                                                                        </span>
                                                                        <Switch
                                                                            checked={settings?.widgetHeaderAutoHide || false}
                                                                            onCheckedChange={(checked) => settings && saveSettings({ ...settings, widgetHeaderAutoHide: checked })}
                                                                            className="scale-75 origin-right"
                                                                        />
                                                                    </div>

                                                                    {/* Auto-Height Toggle */}
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-down"><path d="m21 16-4 4-4-4" /><path d="m17 20V4" /><path d="m3 8 4-4 4 4" /><path d="m7 4v16" /></svg>
                                                                            {t('dashboard.autoHeight')}
                                                                        </span>
                                                                        <Switch
                                                                            checked={settings?.widgetAutoResize ?? true}
                                                                            onCheckedChange={(checked) => settings && saveSettings({ ...settings, widgetAutoResize: checked })}
                                                                            className="scale-75 origin-right"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive no-drag"
                                                            onClick={togglePin}
                                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin-off"><line x1="2" x2="22" y1="2" y2="22" /><line x1="12" x2="12" y1="17" y2="22" /><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-.25-.95" /><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89" /></svg>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{t('dashboard.unpin')}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div >
                                        </div >
                                    </div >

                                    {/* Custom Widget Header Content Extracted */}
                                    <DailyWidgetContent
                                        isWidgetMode={isWidgetMode}
                                        settings={settings}
                                        saveSettings={saveSettings}
                                        manualQuote={manualQuote}
                                        now={now}
                                        filteredSessions={filteredSessions}
                                        filteredLiveSession={filteredLiveSession}
                                    />

                                    <DailyHeader
                                        isWidgetMode={isWidgetMode}
                                        activeProjectId={activeProjectId}
                                        setActiveProjectId={setActiveProjectId}
                                        projects={projects}
                                        clearUntitledTodos={clearUntitledTodos}
                                        isPinned={isPinned}
                                        togglePin={togglePin}
                                    />

                                </div> {/* End Header Wrapper */}

                                {/* Editor Area (Scrollable) */}
                                <div className={cn(
                                    "relative pr-2 custom-scrollbar overflow-x-hidden w-full",
                                    isWidgetMode
                                        ? "flex-1 overflow-y-auto -ml-2 pl-0"
                                        : "flex-1 overflow-y-auto"
                                )}
                                    style={{ scrollbarGutter: 'stable' }}
                                >
                                    <div
                                        ref={editorContentRef}
                                        className={cn(
                                            "min-h-full transition-all duration-300 ease-in-out flex flex-col w-full",
                                            (!isWidgetMode && settings?.editorAlignment === 'center') && "max-w-5xl mx-auto"
                                        )}
                                    >
                                        <div className="flex flex-col flex-1 h-full min-h-[400px]">
                                            {(!activeProjectId || activeProjectId === 'none') ? (
                                                <div className="flex-1 flex flex-col pb-6">
                                                    <TodoSidebar isEmbedded={true} />
                                                </div>
                                            ) : (
                                                <TodoEditor
                                                    key={`${isWidgetMode ? 'widget' : 'full'}-${settings?.editorAlignment}`}
                                                    todos={todos}
                                                    isWidgetMode={isWidgetMode}
                                                    isWidgetLocked={isWidgetMode && isWidgetLocked}
                                                    editorAlignment={settings?.editorAlignment || 'left'}
                                                    className={isWidgetMode ? "pb-6 flex-1 min-h-[300px]" : "pb-40"}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* General Work Floating Panel Extracted */}
                                <DailyGeneralWorkPanel
                                    isWidgetMode={isWidgetMode}
                                    isGeneralOpen={isGeneralOpen}
                                    setIsGeneralOpen={setIsGeneralOpen}
                                    uniqueGeneralTodos={uniqueGeneralTodos}
                                    uniqueGeneralCompletion={uniqueGeneralCompletion}
                                />

                                {
                                    !isWidgetMode && (projects.length > 0 && activeProjectId && activeProjectId !== 'none') && (
                                        <div className="absolute bottom-6 right-6 z-20 pointer-events-auto">
                                            <Button
                                                variant="default"
                                                size="lg"
                                                onClick={() => onEndDay(todos, screenshots, sessions, dailyLog?.plannedSessions || [], firstOpenedAt ?? undefined)}
                                                className="gap-2 shadow-lg rounded-full"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                {t('dashboard.endDay')}
                                            </Button>
                                        </div>
                                    )
                                }
                            </div >

                            {
                                !isWidgetMode && (
                                    <div className={cn(
                                        "shrink-0 border-l border-border/50 flex flex-col transition-all duration-300 ease-in-out bg-background/95 backdrop-blur z-20 group/rightpanel",
                                        isCompactMode
                                            ? "absolute right-0 top-0 bottom-0 w-2 hover:w-[350px] shadow-2xl border-l-[6px] hover:border-l border-primary"
                                            : "w-[300px] relative"
                                    )}>
                                        <div className={cn(
                                            "flex-1 pt-4 h-full overflow-y-auto custom-scrollbar px-1 transition-all duration-300",
                                            isCompactMode ? "opacity-0 group-hover/rightpanel:opacity-100 px-4" : "opacity-100"
                                        )}>
                                            <div className="flex flex-col h-full gap-6">
                                                <div className="flex-1 flex flex-col h-full bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-sm">
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20 shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-auto px-2 py-1 -ml-2 hover:bg-muted/50 transition-colors group relative"
                                                            onClick={() => setTimeTableViewMode(prev => prev === 'timetable' ? 'app-usage' : 'timetable')}
                                                        >
                                                            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                                                                <Clock className="w-3.5 h-3.5 text-primary" />
                                                                {timeTableViewMode === 'timetable' ? t('dashboard.timeTable') : t('calendar.appUsage')}

                                                                <span className="relative flex h-2 w-2 ml-1">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                                                </span>
                                                            </h3>
                                                        </Button>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                                onClick={() => onOpenSettings?.('timetable')}
                                                            >
                                                                <Settings2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 relative min-h-0 bg-background/50">
                                                        <TimeTableGraph
                                                            sessions={filteredSessions}
                                                            allSessions={sessions}
                                                            activeProjectId={activeProjectId}
                                                            liveSession={filteredLiveSession}
                                                            allLiveSession={liveSession}
                                                            projects={projects}
                                                            nightTimeStart={settings?.nightTimeStart}
                                                            settings={settings}
                                                            onUpdateSettings={saveSettings}
                                                            date={displayDate ? new Date(displayDate) : new Date()}
                                                            renderMode="dynamic"
                                                            plannedSessions={plannedSessions}
                                                            currentTime={now} // Pass live time from parent
                                                            firstOpenedAt={firstOpenedAt || undefined}
                                                            appSessions={dailyLog?.appSessions || []}
                                                            viewMode={timeTableViewMode}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </TooltipProvider>
                </div>
            </ContextMenuTrigger>
        </ContextMenu>
    );
}
