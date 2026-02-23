import { ReactNode, useState, useCallback, useEffect } from 'react';
import { FocusGoalsSection } from "../dashboard/FocusGoalsSection";
import { Button } from "@/components/ui/button";
import { UpdateChecker } from "./UpdateChecker";
import { LayoutDashboard, Settings, CalendarDays, Eye, GanttChart, Search, X, Check, Bell, AlertCircle, AlertTriangle, Info, Trash2, Minus, Square, FolderOpen, Plus, Loader2 } from "lucide-react";
import { useNotificationStore } from "@/hooks/useNotificationStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { format } from "date-fns";

import { Project } from "@/types";
import { useTranslation } from 'react-i18next';



interface AppLayoutProps {
    timeline: ReactNode;
    planPanel: ReactNode;
    todoPanel?: ReactNode;
    dailyPanel: ReactNode;
    viewMode: 'timeline' | 'list';
    onViewModeChange: (mode: 'timeline' | 'list') => void;
    onOpenSettings: () => void;
    timelineHeight?: number;

    focusedProject: Project | null;
    onFocusProject: (project: Project | null) => void;

    dashboardView: 'weekly' | 'daily';
    onDashboardViewChange: (view: 'weekly' | 'daily') => void;

    // Responsive Props
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

export function AppLayout({ timeline, planPanel, todoPanel, dailyPanel, viewMode, onViewModeChange: _onViewModeChange, onOpenSettings, timelineHeight: _timelineHeight = 150, focusedProject, onFocusProject, dashboardView, onDashboardViewChange, isSidebarOpen, setIsSidebarOpen }: AppLayoutProps) {
    const { t } = useTranslation();
    const { projects, saveProjects, isWidgetMode, searchQuery, setSearchQuery, addToHistory } = useDataStore();
    const [isCreating, setIsCreating] = useState(false);
    // const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Lifted to App.tsx
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(400);

    // Notifications (Moved from conditional IIFE + inline)
    const notifications = useNotificationStore(state => state.notifications);
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const markAsRead = useNotificationStore(state => state.markAsRead);
    const removeNotification = useNotificationStore(state => state.removeNotification);
    const [isResizing, setIsResizing] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'date', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Filter projects for suggestions
    const filteredProjects = projects.filter(p =>
        !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sortConfig.key === 'name') {
            return sortConfig.direction === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else {
            // Date Sort (Start Date)
            const dateA = new Date(a.startDate).getTime();
            const dateB = new Date(b.startDate).getTime();
            return sortConfig.direction === 'asc'
                ? dateA - dateB
                : dateB - dateA;
        }
    });

    // Resize Handler
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        // ...
        if (!isSidebarOpen) return;
        mouseDownEvent.preventDefault();
        setIsResizing(true);

        const startX = mouseDownEvent.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            const currentX = mouseMoveEvent.clientX;
            const deltaX = currentX - startX;
            // Limit resizing: Min 300px (stops squashing), Max 500px (stops becoming too wide)
            const newWidth = Math.max(300, Math.min(500, startWidth + deltaX));
            setSidebarWidth(newWidth);
        };

        const stopDrag = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [sidebarWidth, isSidebarOpen]);


    // Auto-complete expired projects
    useEffect(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const expiredProjects = projects.filter(p => !p.isCompleted && p.endDate < todayStr);

        if (expiredProjects.length > 0) {
            const updatedProjects = projects.map(p => {
                if (!p.isCompleted && p.endDate < todayStr) {
                    return { ...p, isCompleted: true, locked: true };
                }
                return p;
            });
            saveProjects(updatedProjects);
        }
    }, [projects, saveProjects]);

    // Handlers for TimelineSection are passed via props now (implicit in 'timeline' node)

    // Logic:
    // If viewMode === 'list': Show ProjectList
    // timeline={viewMode === 'list' ? <ProjectList ... /> : <TimelineSection ... />}

    // Show Focus Goals when sidebar is closed in timeline mode (regardless of screen size)
    const showFocusGoals = !isSidebarOpen && viewMode === 'timeline';

    return (
        <div className={cn("flex flex-row h-screen w-screen text-foreground overflow-hidden select-none", !isWidgetMode ? "bg-background" : "bg-transparent")}>

            {/* 1. App Sidebar Rail (Activity Bar) - Full Height */}
            {!isWidgetMode && (
                <div className="w-12 h-full shrink-0 flex flex-col items-center py-4 gap-4 border-r border-border/50 bg-muted/10 z-[60] overflow-visible relative window-drag">
                    {/* View Toggles */}
                    <div className="flex flex-col items-center gap-2 w-full mt-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <Button
                            variant={dashboardView === 'daily' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                            onClick={() => {
                                if (dashboardView !== 'daily') onDashboardViewChange('daily');
                            }}
                            title={t('sidebar.dailyView', 'Daily View')}
                        >
                            <LayoutDashboard className="w-5 h-5" />
                        </Button>
                        <Button
                            variant={dashboardView === 'weekly' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                            onClick={() => {
                                if (dashboardView !== 'weekly') onDashboardViewChange('weekly');
                            }}
                            title={t('sidebar.weeklyView', 'Weekly View')}
                        >
                            <CalendarDays className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Extracted Buttons from Title Bar */}
                    <div className="mt-auto flex flex-col items-center gap-2 w-full pb-2 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <UpdateChecker />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-10 h-10 shrink-0 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl relative"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" side="right" className="w-[340px] p-0 overflow-hidden shadow-2xl bg-card/95 backdrop-blur-md border border-border/50 ml-2">
                                <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Bell className="w-3.5 h-3.5" />
                                        {t('notifications.title')}
                                    </h4>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title={t('notifications.markAllRead')} onClick={() => useNotificationStore.getState().markAllAsRead()}>
                                            <Check className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title={t('notifications.clearAll')} onClick={() => useNotificationStore.getState().clearAll()}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <ScrollArea className="h-[300px]">
                                    {notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground space-y-2">
                                            <Bell className="w-8 h-8 opacity-20" />
                                            <p className="text-xs">{t('notifications.empty')}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col p-1">
                                            {notifications.map((n: any) => (
                                                <div key={n.id} className={cn("relative group flex gap-3 p-3 rounded-lg transition-colors border-b border-border/30 last:border-0 hover:bg-muted/50", !n.read ? "bg-primary/5" : "bg-transparent")} onMouseEnter={() => !n.read && markAsRead(n.id)}>
                                                    <div className="mt-1 shrink-0">
                                                        {n.type === 'success' && <Check className="w-3.5 h-3.5 text-green-500" />}
                                                        {n.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                                        {n.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                                                        {n.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500" />}
                                                        {n.type === 'default' && <Bell className="w-3.5 h-3.5 text-muted-foreground" />}
                                                    </div>
                                                    <div className="flex-1 space-y-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <p className={cn("text-xs font-semibold leading-none", !n.read ? "text-foreground" : "text-muted-foreground")}>{n.title}</p>
                                                                {n.count && n.count > 1 && <span className="text-[10px] bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">x{n.count}</span>}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{format(n.timestamp, 'HH:mm')}</span>
                                                        </div>
                                                        {n.description && <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">{n.description}</p>}
                                                    </div>
                                                    <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded-md" onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}>
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                    {!n.read && <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary rounded-full group-hover:opacity-0 transition-opacity" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onOpenSettings}
                            className="w-10 h-10 shrink-0 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content Area (Column) */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">

                {/* Custom Title Bar - Hidden in Widget Mode */}
                {!isWidgetMode && (
                    <div className="h-10 shrink-0 bg-muted/50 border-b border-border flex items-center justify-between pl-4 select-none z-10 transition-all duration-300 ease-in-out relative" style={{ WebkitAppRegion: 'drag' } as any}>
                        {/* Left: App Title / Drag Area */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                style={{ WebkitAppRegion: 'no-drag' } as any}
                            >
                                {isSidebarOpen ? <GanttChart className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase ml-2">Artisan's Compass</span>
                        </div>

                        {/* Mobile Expandable Search Bar */}
                        {isMobileSearchOpen && (
                            <div className="lg:hidden absolute left-0 top-0 right-0 h-10 bg-muted/95 backdrop-blur-sm border-b border-border flex items-center px-4 z-[60] animate-in slide-in-from-right duration-200" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        autoFocus
                                        className="w-full h-8 pl-9 pr-4 text-sm font-medium bg-background border border-border/50 rounded-full focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50"
                                        placeholder={t('sidebar.search')}
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (!e.target.value) onFocusProject(null);
                                        }}
                                        onBlur={() => {
                                            if (!searchQuery.trim()) {
                                                setTimeout(() => setIsMobileSearchOpen(false), 200);
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 ml-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setIsMobileSearchOpen(false);
                                        setSearchQuery('');
                                        onFocusProject(null);
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {/* Small Screen: Search Button - positioned in right controls */}

                        {/* Large Screen: Full Search Bar */}
                        {dashboardView !== 'weekly' && (
                            <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] no-drag z-50" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        className="w-full h-9 pl-9 pr-9 text-sm font-medium bg-background/50 border border-border/50 rounded-full focus:bg-background focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm hover:bg-background/80"
                                        placeholder={t('sidebar.search')}
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (!e.target.value) onFocusProject(null);
                                            if (!isSearchFocused) setIsSearchFocused(true);
                                        }}
                                        onFocus={() => setIsSearchFocused(true)}
                                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                    />

                                    {searchQuery && (
                                        <button
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 hover:bg-muted/50 rounded-full transition-colors"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setIsSearchFocused(false);
                                                onFocusProject(null);
                                            }}
                                            tabIndex={-1}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}

                                    {/* Suggestions Dropdown */}
                                    {isSearchFocused && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[400px]">
                                            {/* Sort Controls Header */}
                                            <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {searchQuery.trim() ? t('sidebar.results') : t('sidebar.allProjects')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className={`text-[10px] uppercase font-bold tracking-wider hover:text-foreground transition-colors ${sortConfig.key === 'name' ? 'text-primary' : 'text-muted-foreground'}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => setSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                                    >
                                                        {t('sidebar.name')} {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </button>
                                                    <div className="w-px h-3 bg-border" />
                                                    <button
                                                        className={`text-[10px] uppercase font-bold tracking-wider hover:text-foreground transition-colors ${sortConfig.key === 'date' ? 'text-primary' : 'text-muted-foreground'}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => setSortConfig(prev => ({ key: 'date', direction: prev.key === 'date' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                                                    >
                                                        {t('sidebar.date')} {sortConfig.key === 'date' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Project List */}
                                            <div className="overflow-y-auto custom-scrollbar flex-1 py-1 relative">
                                                {sortedProjects.length === 0 ? (
                                                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                                        {searchQuery.trim() ? (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <Search className="w-8 h-8 opacity-20" />
                                                                <p>{t('sidebar.noProjectsFound')}</p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <FolderOpen className="w-8 h-8 opacity-20" />
                                                                <p>{t('sidebar.noProjectsAvailable')}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="px-1">
                                                        {sortedProjects.map((p) => (
                                                            <div
                                                                key={p.id}
                                                                className={cn(
                                                                    "w-full px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-all",
                                                                    focusedProject?.id === p.id && "bg-primary/10 text-primary hover:bg-primary/15"
                                                                )}
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onFocusProject(p.id === focusedProject?.id ? null : p);
                                                                    setIsSearchFocused(false);
                                                                    if (p.id !== focusedProject?.id) {
                                                                        addToHistory();
                                                                    }
                                                                }}
                                                            >
                                                                <div
                                                                    className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-background/20"
                                                                    style={{ backgroundColor: p.color || '#3b82f6' }}
                                                                />
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <div className="text-sm font-medium truncate flex-1 block overflow-hidden text-ellipsis whitespace-nowrap">
                                                                        {p.name}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-1 shrink-0 px-2 py-0.5 max-w-[120px]">
                                                                    {p.type && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full">
                                                                            {p.type}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {focusedProject?.id === p.id && (
                                                                    <Check className="w-4 h-4 text-primary shrink-0" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Bottom gradient fade out */}
                                            <div className="h-6 bg-gradient-to-t from-popover to-transparent shrink-0 pointer-events-none -mt-6 z-10" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Right Controls */}
                        {/* Header Portal Target for WeeklyView/DailyPanel controls (Moved here) */}
                        <div id="top-toolbar-portal" className="flex items-center h-full" style={{ flex: 1, minWidth: 0 } as any}></div>

                        <div className="flex items-center gap-1 z-50 px-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                            {/* New Project Button */}
                            {dashboardView !== 'weekly' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isCreating}
                                    className="h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors"
                                    onClick={async () => {
                                        setIsCreating(true);
                                        const toastId = toast.loading(t('sidebar.creatingProject', 'Creating project...'));

                                        await new Promise(resolve => setTimeout(resolve, 500));

                                        addToHistory();
                                        const newProject: Project = {
                                            id: uuidv4(),
                                            name: t('sidebar.newProject', 'New Project'),
                                            type: 'Personal',
                                            color: '#3b82f6',
                                            startDate: format(new Date(), 'yyyy-MM-dd'),
                                            endDate: format(new Date(), 'yyyy-MM-dd'),
                                            isCompleted: false,
                                        };
                                        saveProjects([...projects, newProject]);
                                        onFocusProject(newProject);

                                        toast.success(t('sidebar.projectCreated', 'Project created successfully'), { id: toastId });
                                        setIsCreating(false);
                                    }}
                                >
                                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    <span className="hidden lg:inline">{t('sidebar.newProject', 'New Project')}</span>
                                </Button>
                            )}

                            {/* Mobile Search Toggle */}
                            <div className="lg:hidden flex items-center no-drag mr-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                    onClick={() => setIsMobileSearchOpen(true)}
                                >
                                    <Search className="w-4 h-4" />
                                </Button>
                            </div>



                            {/* Window Controls (Custom) */}
                            <div className="flex items-center h-full no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                <button
                                    onClick={() => (window as any).ipcRenderer?.send('minimize-window')}
                                    className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors pb-1"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => (window as any).ipcRenderer?.send('toggle-maximize-window')}
                                    className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors pb-1"
                                >
                                    <Square className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => (window as any).ipcRenderer?.send('close-window')}
                                    className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors pb-1"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main App Layout (Row) */}
                <div className="flex-1 flex min-h-0 overflow-hidden relative">



                    {/* 2. Main Area (Timeline + Bottom Split) OR Plan Panel */}
                    {dashboardView === 'daily' ? (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0", !isWidgetMode ? "bg-background/50 backdrop-blur-sm" : "bg-transparent")}>
                            {/* Top Section: Full Width Project Timeline/List */}
                            {!isWidgetMode && (
                                <div
                                    className="shrink-0 w-full border-b border-border bg-background transition-all duration-300 ease-in-out z-10"
                                    style={{ height: _timelineHeight }}
                                >
                                    {showFocusGoals ? (
                                        <FocusGoalsSection />
                                    ) : (
                                        timeline
                                    )}
                                </div>
                            )}

                            {/* Bottom Section: Split Sidebar and DailyPanel */}
                            <div className="flex-1 flex min-h-0 relative">
                                {/* 2a. Collapsible Sidebar Panel */}
                                {!isWidgetMode && (
                                    <div
                                        className={cn(
                                            "h-full border-r border-border flex flex-col shrink-0 overflow-hidden bg-background relative z-10",
                                            !isResizing && "transition-all duration-300 ease-in-out"
                                        )}
                                        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
                                    >
                                        <div className="h-full w-full flex flex-col min-w-[300px]">
                                            {todoPanel}
                                        </div>
                                    </div>
                                )}

                                {/* Resize Handle */}
                                {isSidebarOpen && !isWidgetMode && (
                                    <div
                                        onMouseDown={startResizing}
                                        className={cn(
                                            "w-1 hover:w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-50 flex items-center justify-center group isolate -ml-0.5",
                                            isResizing && "bg-blue-400 w-1.5"
                                        )}
                                        title="Drag to resize"
                                    >
                                        <div className="h-8 w-0.5 bg-border rounded group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )}

                                {/* 2b. Daily Panel */}
                                <div className={cn("flex-1 relative text-foreground overflow-y-auto custom-scrollbar min-w-0", !isWidgetMode ? "bg-muted/40" : "p-0")}>
                                    {dailyPanel}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0 overflow-hidden", !isWidgetMode ? "bg-background" : "bg-transparent")}>
                            {planPanel}
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}
