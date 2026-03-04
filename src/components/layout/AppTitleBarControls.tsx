import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Plus, Loader2, GanttChart, Eye, Search } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";
import { Project } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { WindowControls } from "./WindowControls";

interface AppTitleBarControlsProps {
    dashboardView: 'weekly' | 'daily' | 'pomodoro' | 'statistics';
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    onFocusProject: (project: Project | null) => void;
    setIsMobileSearchOpen: (isOpen: boolean) => void;
}

export function AppTitleBarControls({
    dashboardView,
    isSidebarOpen,
    setIsSidebarOpen,
    onFocusProject,
    setIsMobileSearchOpen
}: AppTitleBarControlsProps) {
    const { t } = useTranslation();
    const { projects, saveProjects, addToHistory } = useDataStore();
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="flex items-center h-full z-50 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-1 pr-2">
                {/* Toggle Sidebar Button (Daily View Only) */}
                {dashboardView === 'daily' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors no-drag"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        title={isSidebarOpen ? t('sidebar.hideSidebar', 'Hide Sidebar') : t('sidebar.showSidebar', 'Show Sidebar')}
                        style={{ WebkitAppRegion: 'no-drag' } as any}
                    >
                        {isSidebarOpen ? <GanttChart className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                )}

                {/* New Project Button */}
                {dashboardView === 'daily' && (
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

            </div>

            {/* Window Controls (Custom) */}
            <WindowControls />
        </div>
    );
}
