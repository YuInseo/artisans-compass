import { useState } from 'react';
import { Project } from "@/types";
import { AppSearchBar } from "./AppSearchBar";
import { AppTitle } from "./AppTitle";
import { AppTitleBarControls } from "./AppTitleBarControls";

interface AppTitleBarProps {
    dashboardView: string;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    focusedProject: Project | null;
    onFocusProject: (project: Project | null) => void;
    setIsAddPomodoroTaskOpen: (isOpen: boolean) => void;
}

export function AppTitleBar({
    dashboardView,
    isSidebarOpen,
    setIsSidebarOpen,
    focusedProject,
    onFocusProject,
    setIsAddPomodoroTaskOpen
}: AppTitleBarProps) {
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    return (
        <div className="h-10 shrink-0 bg-muted/50 border-b border-border flex items-center justify-between pl-4 select-none z-10 transition-all duration-300 ease-in-out relative" style={{ WebkitAppRegion: 'drag' } as any}>
            {/* Left: App Title / Drag Area */}
            <AppTitle
                dashboardView={dashboardView}
                setIsAddPomodoroTaskOpen={setIsAddPomodoroTaskOpen}
            />

            {/* Mobile Expandable Search Bar */}
            <AppSearchBar
                focusedProject={focusedProject}
                onFocusProject={onFocusProject}
                isMobile={true}
                isOpen={isMobileSearchOpen && dashboardView === 'daily'}
                onClose={() => setIsMobileSearchOpen(false)}
            />

            {/* Large Screen: Full Search Bar */}
            {dashboardView === 'daily' && (
                <AppSearchBar
                    focusedProject={focusedProject}
                    onFocusProject={onFocusProject}
                />
            )}

            {/* Top Toolbar Portal: Acts as flexible spacer and container for right-aligned navs */}
            <div id="top-toolbar-portal" className="flex-1 flex items-center h-full min-w-0" style={{ WebkitAppRegion: 'drag' } as any}></div>

            <AppTitleBarControls
                dashboardView={dashboardView}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                onFocusProject={onFocusProject}
                setIsMobileSearchOpen={setIsMobileSearchOpen}
            />
        </div>
    );
}
