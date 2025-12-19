import { ReactNode, useState, useCallback, useEffect } from 'react';
import { FocusGoalsSection } from "../dashboard/FocusGoalsSection";
import { Button } from "@/components/ui/button";
import { GanttChartSquare, Settings, Minus, Square, X, Plus, Eye, Search, ArrowUpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from "date-fns";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { Project } from "@/types";

interface AppLayoutProps {
    timeline: ReactNode; // This prop might be unused if we render TimelineSection directly here, but let's keep it for compatibility if passed
    calendar: ReactNode;
    dailyPanel: ReactNode;
    viewMode: 'timeline' | 'list';
    onViewModeChange: (mode: 'timeline' | 'list') => void;
    onOpenSettings: () => void;
    timelineHeight?: number;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    focusedProject: Project | null;
    onFocusProject: (project: Project | null) => void;
}

export function AppLayout({ timeline, calendar, dailyPanel, viewMode, onViewModeChange, onOpenSettings, timelineHeight = 150, searchQuery, onSearchChange, focusedProject, onFocusProject }: AppLayoutProps) {
    const { projects, saveProjects, saveSettings, settings, isWidgetMode } = useDataStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    // Filter projects for suggestions
    const matchingProjects = searchQuery.trim()
        ? projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : [];

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
            const newWidth = Math.max(250, Math.min(800, startWidth + deltaX));
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

    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Only switch to Focus Goals (hiding timeline) if screen is smaller than 1350px
    const showFocusGoals = !isSidebarOpen && viewMode === 'timeline' && windowWidth < 1350;

    return (
        <div className={cn("flex flex-col h-screen w-screen text-foreground overflow-hidden", !isWidgetMode ? "bg-background" : "bg-transparent")}>

            {/* Custom Title Bar - Hidden in Widget Mode */}
            {!isWidgetMode && (
                <div className="h-10 bg-muted/50 border-b border-border flex items-center justify-between px-4 select-none fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out" style={{ WebkitAppRegion: 'drag' } as any}>
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
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
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
                                    onSearchChange('');
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
                                className="w-full h-9 pl-9 pr-4 text-sm font-medium bg-background/50 border border-border/50 rounded-full focus:bg-background focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm hover:bg-background/80"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            />

                            {/* Suggestions Dropdown */}
                            {isSearchFocused && matchingProjects.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border">Suggestions</div>
                                    {matchingProjects.map(project => (
                                        <div
                                            key={project.id}
                                            className="px-4 py-2.5 hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between group transition-colors"
                                            onClick={() => {
                                                onSearchChange(project.name);
                                                onFocusProject(project);
                                                setIsSearchFocused(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", project.type === 'Main' ? "bg-blue-500" : project.type === 'Sub' ? "bg-green-500" : "bg-orange-500")} />
                                                <span className="text-sm font-medium">{project.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Jump to Project</span>
                                        </div>
                                    ))}
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
                            onClick={async () => {
                                const newProject = {
                                    id: uuidv4(),
                                    name: `Project ${projects.length + 1}`,
                                    type: "Main" as const,
                                    startDate: format(new Date(), 'yyyy-MM-dd'),
                                    endDate: format(addDays(new Date(), settings?.defaultProjectDurationDays || 14), 'yyyy-MM-dd'),
                                    isCompleted: false
                                };
                                await saveProjects([...projects, newProject]);
                            }}
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <Plus className="w-3.5 h-3.5 lg:mr-1" /><span className="hidden lg:inline"> New Project</span>
                        </Button>

                        {/* View Toggle Buttons & Settings */}
                        <div className="flex items-center gap-2 no-drag mr-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                            {/* Focus Mode Toggle */}


                            <div className="flex p-0.5 bg-muted rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onViewModeChange('timeline')}
                                    className={`h-7 px-2 lg:px-3 text-xs font-medium rounded-md transition-all ${viewMode === 'timeline' ? 'bg-background shadow-sm text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <GanttChartSquare className="w-3.5 h-3.5 lg:mr-1.5" /><span className="hidden lg:inline"> Timeline</span>
                                </Button>

                            </div>

                            {/* Settings Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onOpenSettings}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                            >
                                <Settings className="w-4 h-4" />
                            </Button>

                            {/* Update Button (Test) */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    alert("Check for updates clicked (Placeholder)");
                                    if ((window as any).ipcRenderer) {
                                        // (window as any).ipcRenderer.send('check-for-updates'); // Future implementation
                                    }
                                }}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10 rounded-lg"
                                title="Check for Updates"
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Window Controls (Custom) */}
                        <div className="flex items-center h-full no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                            <button
                                onClick={() => (window as any).ipcRenderer?.send('minimize-window')}
                                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => (window as any).ipcRenderer?.send('toggle-maximize-window')}
                                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                            >
                                <Square className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => (window as any).ipcRenderer?.send('close-window')}
                                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
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
                    style={{ height: timelineHeight }}
                >
                    {showFocusGoals ? (
                        <FocusGoalsSection />
                    ) : (
                        timeline
                    )}
                </div>
            )}

            {/* Bottom Section */}
            <div className={cn("flex-1 flex overflow-hidden", isWidgetMode && "mt-10")}>
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
                <div className="flex-1 p-4 relative bg-muted/40 text-foreground">
                    <div className="absolute top-2 right-2 z-20">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-background/80 shadow-sm"
                            title="Help / Replay Tutorial"
                            onClick={() => {
                                if (settings) {
                                    saveSettings({ ...settings, hasCompletedOnboarding: false });
                                }
                            }}
                        >
                            <span className="text-xs font-bold">?</span>
                        </Button>
                    </div>
                    {dailyPanel}
                </div>
            </div>

            <OnboardingOverlay />
        </div>
    );
}
