import { ReactNode, useState, useCallback, useEffect } from 'react';
import { FocusGoalsSection } from "../dashboard/FocusGoalsSection";
import { Button } from "@/components/ui/button";
import { UpdateChecker } from "./UpdateChecker";
import { Settings, Minus, Square, X, Plus, Eye, Search, Lock, Loader2, Bell } from "lucide-react";
import { toast } from "@/lib/toast";
import { useNotificationStore } from "@/hooks/useNotificationStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Trash2, AlertTriangle, Info, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from "date-fns";


import { Project } from "@/types";
import { useTranslation } from 'react-i18next';



interface AppLayoutProps {
    timeline: ReactNode;
    calendar: ReactNode;
    dailyPanel: ReactNode;
    viewMode: 'timeline' | 'list';
    onViewModeChange: (mode: 'timeline' | 'list') => void;
    onOpenSettings: () => void;
    timelineHeight?: number;

    focusedProject: Project | null;
    onFocusProject: (project: Project | null) => void;

    // Responsive Props
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

export function AppLayout({ timeline, calendar, dailyPanel, viewMode, onViewModeChange: _onViewModeChange, onOpenSettings, timelineHeight: _timelineHeight = 150, focusedProject, onFocusProject, isSidebarOpen, setIsSidebarOpen }: AppLayoutProps) {
    const { t } = useTranslation();
    const { projects, saveProjects, settings, isWidgetMode, searchQuery, setSearchQuery, addToHistory } = useDataStore();
    // const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Lifted to App.tsx
    const [sidebarWidth, setSidebarWidth] = useState(400);

    // Notifications (Moved from conditional IIFE + inline)
    const notifications = useNotificationStore(state => state.notifications);
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const markAsRead = useNotificationStore(state => state.markAsRead);
    const removeNotification = useNotificationStore(state => state.removeNotification);
    const [isResizing, setIsResizing] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

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

    const [_, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Show Focus Goals when sidebar is closed in timeline mode (regardless of screen size)
    const showFocusGoals = !isSidebarOpen && viewMode === 'timeline';

    return (
        <div className={cn("flex flex-col h-screen w-screen text-foreground overflow-hidden select-none", !isWidgetMode ? "bg-background" : "bg-transparent")}>

            {/* Custom Title Bar - Hidden in Widget Mode */}
            {!isWidgetMode && (
                <div className="h-10 bg-muted/50 border-b border-border flex items-center justify-between pl-4 select-none fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out" style={{ WebkitAppRegion: 'drag' } as any}>
                    {/* Left: App Title / Drag Area */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <Eye className="w-4 h-4" />
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

                                    <div className="overflow-y-auto custom-scrollbar flex-1">
                                        {sortedProjects.length > 0 ? (
                                            sortedProjects.map(project => (
                                                <div
                                                    key={project.id}
                                                    className={cn(
                                                        "px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between group transition-colors border-b border-border/40 last:border-0",
                                                        focusedProject?.id === project.id && "bg-primary/10 border-l-2 border-l-primary pl-[14px]"
                                                    )}
                                                    onMouseDown={(e) => {
                                                        // Prevent blur before click
                                                        e.preventDefault();
                                                    }}
                                                    onClick={() => {
                                                        setSearchQuery(project.name);
                                                        onFocusProject(project);
                                                        setIsSearchFocused(false);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {project.locked ? (
                                                            <div className="w-2.5 h-2.5 flex items-center justify-center">
                                                                <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                                                            </div>
                                                        ) : (
                                                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", project.type === 'Main' ? "bg-blue-500" : project.type === 'Sub' ? "bg-green-500" : "bg-orange-500")} />
                                                        )}
                                                        {focusedProject?.id === project.id && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className={cn("text-sm font-medium leading-none", project.locked && "text-muted-foreground line-through decoration-border/50")}>{project.name}</span>
                                                            <span className="text-[10px] text-muted-foreground mt-1">
                                                                {project.startDate} ~ {project.endDate}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-2 py-1 rounded">
                                                        {t('sidebar.jump')}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-8 text-sm text-muted-foreground italic text-center flex flex-col items-center gap-2">
                                                <Search className="w-8 h-8 opacity-20" />
                                                <span>{t('sidebar.noProjects')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center h-full">
                        {/* Search Button (small screens only) */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="lg:hidden h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg mr-1 no-drag"
                            onClick={() => setIsMobileSearchOpen(true)}
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <Search className="w-4 h-4" />
                        </Button>

                        {/* New Project Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 mr-2 no-drag"
                            disabled={isCreating}
                            onClick={async () => {
                                if (isCreating) return;
                                setIsCreating(true);
                                const toastId = toast.loading(t('sidebar.creatingProject') || "Creating project...");

                                try {
                                    // Small artificial delay to let the user see the feedback (optional, but good for "feeling")
                                    await new Promise(resolve => setTimeout(resolve, 500));

                                    addToHistory();
                                    const newProject = {
                                        id: uuidv4(),
                                        name: `Project ${projects.length + 1}`,
                                        type: (settings?.projectTags && settings.projectTags.length > 0 ? settings.projectTags[0] : "Main"),
                                        startDate: format(new Date(), 'yyyy-MM-dd'),
                                        endDate: format(addDays(new Date(), settings?.defaultProjectDurationDays || 14), 'yyyy-MM-dd'),
                                        isCompleted: false
                                    };
                                    await saveProjects([...projects, newProject]);
                                    toast.success(t('sidebar.projectCreated') || "Project created!", { id: toastId });
                                } catch (error) {
                                    console.error("Failed to create project", error);
                                    toast.error(t('sidebar.projectCreateFailed') || "Failed to create project", { id: toastId });
                                } finally {
                                    setIsCreating(false);
                                }
                            }}
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            {isCreating ? (
                                <Loader2 className="w-3.5 h-3.5 lg:mr-1 animate-spin" />
                            ) : (
                                <Plus className="w-3.5 h-3.5 lg:mr-1" />
                            )}
                            <span className="hidden lg:inline">
                                {isCreating ? (t('dashboard.workingOn') || "Progressing...") : t('sidebar.newProject')}
                            </span>
                        </Button>

                        {/* View Toggle Buttons & Settings */}
                        <div className="flex items-center gap-2 no-drag mr-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                            {/* Focus Mode Toggle */}




                            {/* Update Checker */}
                            <UpdateChecker />

                            {/* Notification Button */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg relative"
                                        title={t('notifications.title')}
                                    >
                                        <Bell className="w-4 h-4" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-[340px] p-0 overflow-hidden shadow-2xl bg-card/95 backdrop-blur-md border border-border/50">
                                    <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <Bell className="w-3.5 h-3.5" />
                                            {t('notifications.title')}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                title={t('notifications.markAllRead')}
                                                onClick={() => useNotificationStore.getState().markAllAsRead()}
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                title={t('notifications.clearAll')}
                                                onClick={() => useNotificationStore.getState().clearAll()}
                                            >
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
                                                {notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        className={cn(
                                                            "relative group flex gap-3 p-3 rounded-lg transition-colors border-b border-border/30 last:border-0 hover:bg-muted/50",
                                                            !n.read ? "bg-primary/5" : "bg-transparent"
                                                        )}
                                                        onMouseEnter={() => !n.read && markAsRead(n.id)}
                                                    >
                                                        <div className="mt-1 shrink-0">
                                                            {n.type === 'success' && <Check className="w-3.5 h-3.5 text-green-500" />}
                                                            {n.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                                            {n.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                                                            {n.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500" />}
                                                            {n.type === 'default' && <Bell className="w-3.5 h-3.5 text-muted-foreground" />}
                                                        </div>
                                                        <div className="flex-1 space-y-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className={cn("text-xs font-semibold leading-none", !n.read ? "text-foreground" : "text-muted-foreground")}>
                                                                    {n.title}
                                                                </p>
                                                                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                                                                    {format(n.timestamp, 'HH:mm')}
                                                                </span>
                                                            </div>
                                                            {n.description && (
                                                                <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                                                                    {n.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded-md"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeNotification(n.id);
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                        {!n.read && (
                                                            <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary rounded-full group-hover:opacity-0 transition-opacity" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>

                            {/* Settings Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onOpenSettings}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                            >
                                <Settings className="w-4 h-4" />
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

            {/* Top Section: Project Timeline/List (Hide in Widget Mode) */}
            {!isWidgetMode && (
                <div
                    className="mt-10 shrink-0 border-b border-border bg-background transition-all duration-300 ease-in-out"
                    style={{ height: _timelineHeight }}
                >
                    {showFocusGoals ? (
                        <FocusGoalsSection />
                    ) : (
                        timeline
                    )}
                </div>
            )}

            {/* Bottom Section */}
            <div className={cn("flex-1 flex min-h-0")}>
                {/* Left: Calendar Navigator (Collapsible & Resizable) - Hide in Widget Mode */}
                {!isWidgetMode && (
                    <div
                        className={cn(
                            "border-r border-border bg-card flex flex-col shrink-0 overflow-hidden",
                            !isResizing && "transition-all duration-300 ease-in-out"
                        )}
                        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
                    >
                        <div className="h-full w-full flex flex-col min-w-[300px]">
                            {calendar}
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

                {/* Right: Interactive Daily Panel */}
                <div className={cn("flex-1 relative bg-muted/40 text-foreground", isWidgetMode ? "p-0" : "p-4")}>

                    {dailyPanel}
                </div>
            </div>


        </div>
    );
}
