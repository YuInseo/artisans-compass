import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { DailyArchiveView } from "./DailyArchiveView";
import { OverviewView } from "./OverviewView";
import { TasksView } from "./TasksView";
import { FocusView } from "./FocusView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarNav } from "./CalendarNav";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

interface StatisticsPanelProps {
    focusedProject?: any; // Kept for compatibility if needed
    navigationSignal?: { date: Date, timestamp: number } | null;
}

export function StatisticsPanel({ focusedProject, navigationSignal }: StatisticsPanelProps) {
    const { t } = useTranslation();
    const { getDailyLog, settings, saveSettings, projects } = useDataStore();
    const [date, setDate] = useState<Date>(new Date());
    const [logData, setLogData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const [tabsPortalTarget, setTabsPortalTarget] = useState<HTMLElement | null>(null);
    const [activeTab, setActiveTab] = useState<'dailyArchive' | 'overview' | 'tasks' | 'focus'>('dailyArchive');

    const formattedDate = format(date, 'yyyy-MM-dd');

    useEffect(() => {
        setPortalTarget(document.getElementById('top-toolbar-portal'));
        setTabsPortalTarget(document.getElementById('statistics-tabs-portal'));
    }, []);

    // Handle navigation signals from outside
    useEffect(() => {
        if (navigationSignal) {
            setDate(navigationSignal.date);
        }
    }, [navigationSignal]);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        getDailyLog(formattedDate).then(data => {
            if (!isMounted) return;
            // Mock data structure if none exists to prevent crashing DailyArchiveView
            const MOCK_DATA = {
                todos: [],
                projectTodos: {},
                screenshots: [],
                sessions: [],
                stats: { totalWorkSeconds: 0, questAchieved: false }
            };
            setLogData(data || MOCK_DATA);
            setIsLoading(false);
        });

        return () => { isMounted = false; };
    }, [formattedDate, getDailyLog]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[role="slider"]') || document.querySelector('.screenshot-slider-fullscreen')) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                setDate(prev => addDays(prev, -1));
            } else if (e.key === 'ArrowRight') {
                setDate(prev => {
                    const nextDay = addDays(prev, 1);
                    if (nextDay > new Date()) {
                        toast.error(t('calendar.cannotTravelFuture') || "Cannot travel to the future.");
                        return prev;
                    }
                    return nextDay;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [t]);


    return (
        <div className="w-full h-full flex flex-col bg-background relative overflow-hidden">
            {/* Render Date Navigation into Top Toolbar Portal */}
            {portalTarget && (activeTab === 'dailyArchive' || activeTab === 'tasks') && createPortal(
                <div className="ml-auto flex items-center gap-2 bg-background border border-border rounded-lg p-1 shadow-sm mr-2 h-7" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDate(d => addDays(d, -1))}>
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-6 px-2 flex items-center gap-2 font-mono text-xs font-medium hover:bg-muted transition-colors">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span>{format(date, 'MMM dd, yyyy')}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="center" className="w-[360px] p-0 border-none shadow-2xl bg-transparent mt-2">
                            <CalendarNav
                                focusedProject={focusedProject}
                                onSelect={(d) => setDate(d)}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        const nextDay = addDays(date, 1);
                        if (nextDay > new Date()) {
                            toast.error(t('calendar.cannotTravelFuture') || "Cannot travel to the future.");
                            return;
                        }
                        setDate(nextDay);
                    }}>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                </div>,
                portalTarget
            )}

            {/* Render Tabs into Header Portal */}
            {tabsPortalTarget && createPortal(
                <div className="flex bg-muted/50 p-1 rounded-full border border-border/50 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={() => setActiveTab('dailyArchive')}
                        className={cn(
                            "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                            activeTab === 'dailyArchive'
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                    >
                        {t('statistics.dailyArchive', 'DailyArchive')}
                    </button>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                            "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                            activeTab === 'overview'
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                    >
                        {t('statistics.overview', '개요')}
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={cn(
                            "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                            activeTab === 'tasks'
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                    >
                        {t('statistics.tasks', '과제')}
                    </button>
                    <button
                        onClick={() => setActiveTab('focus')}
                        className={cn(
                            "px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                            activeTab === 'focus'
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                    >
                        {t('statistics.focus', '포커스')}
                    </button>
                </div>,
                tabsPortalTarget
            )}

            {/* Main Content Area */}
            <div className="flex-1 w-full bg-background/50 overflow-hidden relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {isLoading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground animate-pulse">
                        <p>{t('common.loading') || 'Loading journey data...'}</p>
                    </div>
                ) : activeTab === 'dailyArchive' ? (
                    logData ? (
                        <DailyArchiveView
                            date={date}
                            projectTodos={logData.projectTodos || {}}
                            todos={
                                logData.projectTodos
                                    ? Object.values(logData.projectTodos as Record<string, any[]>).flat()
                                    : (logData.todos || [])
                            }
                            projects={projects}
                            screenshots={logData.screenshots || []}
                            sessions={logData.sessions || []}
                            stats={{
                                totalSeconds: logData.stats?.totalWorkSeconds || 0,
                                questAchieved: logData.stats?.questAchieved || false
                            }}
                            nightTimeStart={logData.nightTimeStart}
                            timelapseDurationSeconds={settings?.timelapseDurationSeconds || 5}
                            showIndentationGuides={settings?.showIndentationGuides}
                            className="bg-card w-full h-full"
                            readOnly={true}
                            settings={settings}
                            onUpdateSettings={saveSettings}
                            firstOpenedAt={logData.firstOpenedAt}
                        />
                    ) : null
                ) : activeTab === 'overview' ? (
                    <OverviewView />
                ) : activeTab === 'tasks' ? (
                    <TasksView date={date} />
                ) : activeTab === 'focus' ? (
                    <FocusView date={date} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60">
                        <p className="mb-2 text-sm">{t('common.comingSoon', '준비 중입니다')}</p>
                        <p className="text-xs uppercase font-mono tracking-widest block opacity-50">{activeTab}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
