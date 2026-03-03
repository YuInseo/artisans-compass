import { ReactNode, useState } from 'react';
import { FocusGoalsSection } from "../dashboard/FocusGoalsSection";
import { AppSidebarRail } from "./AppSidebarRail";
import { AppTitleBar } from "./AppTitleBar";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { Project } from "@/types";
import { AddPomodoroTaskDialog } from "../dashboard/AddPomodoroTaskDialog";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { useExpiredProjectsSync } from "@/hooks/useExpiredProjectsSync";

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

    dashboardView: 'weekly' | 'daily' | 'pomodoro' | 'statistics';
    onDashboardViewChange: (view: 'weekly' | 'daily' | 'pomodoro' | 'statistics') => void;

    // Responsive Props
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    pomodoroPanel?: ReactNode;
    statisticsPanel?: ReactNode;
}

export function AppLayout({ timeline, planPanel, todoPanel, dailyPanel, viewMode, onViewModeChange: _onViewModeChange, onOpenSettings, timelineHeight: _timelineHeight = 150, focusedProject, onFocusProject, dashboardView, onDashboardViewChange, isSidebarOpen, setIsSidebarOpen, pomodoroPanel, statisticsPanel }: AppLayoutProps) {
    const { projects, saveProjects, isWidgetMode } = useDataStore();
    const [isAddPomodoroTaskOpen, setIsAddPomodoroTaskOpen] = useState(false);

    // Extracted custom hooks
    const { sidebarWidth, isResizing, startResizing } = useSidebarResize(isSidebarOpen, 400);
    useExpiredProjectsSync(projects, saveProjects);

    // Show Focus Goals when sidebar is closed in timeline mode (regardless of screen size)
    const showFocusGoals = !isSidebarOpen && viewMode === 'timeline';

    return (
        <div className={cn("flex flex-row h-screen w-screen text-foreground overflow-hidden select-none", !isWidgetMode ? "bg-background" : "bg-transparent")}>

            {/* 1. App Sidebar Rail (Activity Bar) - Full Height */}
            {!isWidgetMode && (
                <AppSidebarRail
                    dashboardView={dashboardView}
                    onDashboardViewChange={onDashboardViewChange}
                    onOpenSettings={onOpenSettings}
                />
            )}

            {/* Main Content Area (Column) */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">

                {/* Custom Title Bar - Hidden in Widget Mode */}
                {!isWidgetMode && (
                    <AppTitleBar
                        dashboardView={dashboardView}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        focusedProject={focusedProject}
                        onFocusProject={onFocusProject}
                        setIsAddPomodoroTaskOpen={setIsAddPomodoroTaskOpen}
                    />
                )}

                {/* Main App Layout (Row) */}
                <div className="flex-1 flex min-h-0 overflow-hidden relative">

                    {/* 2. Main Area (Timeline + Bottom Split) OR Plan Panel */}
                    {dashboardView === 'daily' ? (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0", !isWidgetMode ? "bg-background/50 backdrop-blur-sm" : "bg-transparent")}>
                            {/* Top Section: Full Width Project Timeline/List */}
                            {!isWidgetMode && (
                                <div
                                    className="shrink-0 w-full border-b border-border bg-background transition-all duration-300 ease-in-out z-10 relative overflow-hidden"
                                    style={{ height: _timelineHeight }}
                                >
                                    <div className={cn("absolute inset-0 transition-opacity duration-300", showFocusGoals ? "opacity-100 z-10" : "opacity-0 pointer-events-none -z-10")}>
                                        <FocusGoalsSection />
                                    </div>
                                    <div className={cn("absolute inset-0 transition-opacity duration-300 flex flex-col", !showFocusGoals ? "opacity-100 z-10" : "opacity-0 pointer-events-none -z-10")}>
                                        {timeline}
                                    </div>
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
                                        style={{ width: sidebarWidth }}
                                    >
                                        <div className="h-full w-full flex flex-col min-w-[300px]">
                                            {todoPanel}
                                        </div>
                                    </div>
                                )}

                                {/* Resize Handle */}
                                {!isWidgetMode && (
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
                    ) : dashboardView === 'weekly' ? (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0 overflow-hidden", !isWidgetMode ? "bg-background" : "bg-transparent")}>
                            {planPanel}
                        </div>
                    ) : dashboardView === 'pomodoro' ? (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0 overflow-hidden", !isWidgetMode ? "bg-background" : "bg-transparent")}>
                            {pomodoroPanel}
                        </div>
                    ) : (
                        <div className={cn("flex-1 flex flex-col min-w-0 relative z-0 overflow-hidden", !isWidgetMode ? "bg-background" : "bg-transparent")}>
                            {statisticsPanel}
                        </div>
                    )}

                </div>

            </div>

            {/* Add Pomodoro Task Modal */}
            <AddPomodoroTaskDialog
                open={isAddPomodoroTaskOpen}
                onOpenChange={setIsAddPomodoroTaskOpen}
            />
        </div>
    );
}
