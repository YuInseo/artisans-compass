import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Swords, Target, Home, ArrowLeft, Check, Plus, AlertTriangle, Flame, FlameIcon, FlameKindlingIcon } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";
import { useTimelineStore } from "@/hooks/useTimelineStore";
import { useQuestStore } from "@/hooks/useQuestStore";
import { GoalSettingModal } from "./GoalSettingModal";
import { Project } from "@/types";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays, isSameWeek } from "date-fns";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CalendarNavProps {
    onSelect?: (date: Date) => void;
    focusedProject?: Project | null;
    onNavigate?: (date: Date) => void;
    navigationSignal?: { date: Date, timestamp: number } | null;
}

export function CalendarNav({ onSelect, focusedProject, navigationSignal }: CalendarNavProps) {
    const [viewMode, setViewMode] = useState<'calendar' | 'quest'>('calendar');
    const { streak } = useQuestStore();
    // Note: useQuestStore definition seen earlier didn't export setters for streak, only todos. 
    // We might need to just accept we can't update streak easily without modifying store, 
    // or we assume useQuestStore has a `set` or we ignore streak update for this step.
    // Actually, I'll just keep reading streak and assume it's managed elsewhere or I'll add `incrementStreak` later.
    // For now, I'll just read it.

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());
    const { settings, projects, saveSettings } = useDataStore();
    const { selectedIds } = useTimelineStore();
    const [showGoalModal, setShowGoalModal] = useState(false);

    // New State for Features
    const [isAdding, setIsAdding] = useState(false);
    const [newQuestText, setNewQuestText] = useState("");
    const [showDifficultyAlert, setShowDifficultyAlert] = useState(false);
    const [monthlyLogs, setMonthlyLogs] = useState<Record<string, any>>({}); // Store monthly logs
    const [forceUnlockGoals, setForceUnlockGoals] = useState(false); // State to allow editing goals if stuck

    // Derive Current Quest from Monthly Goal
    const today = new Date();
    const currentMonthKey = format(today, 'yyyy-MM');
    // Check if goal was updated this month
    const goalUpdatedThisMonth = settings?.focusGoals?.monthlyUpdatedAt &&
        format(new Date(settings.focusGoals.monthlyUpdatedAt), 'yyyy-MM') === currentMonthKey;

    // Effective Quest
    const activeQuestText = (goalUpdatedThisMonth && settings?.focusGoals?.monthly) ? settings.focusGoals.monthly : null;
    const activeQuestCreatedAt = (goalUpdatedThisMonth) ? settings?.focusGoals?.monthlyUpdatedAt : null;

    // Check if TODAY is completed
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayLog = monthlyLogs[todayKey];
    const isTodayAchieved = todayLog?.stats?.questAchieved;

    // Sync with Navigation Signal (External Control)
    useEffect(() => {
        if (navigationSignal) {
            setDate(navigationSignal.date);
            setDisplayedMonth(navigationSignal.date); // Also navigate view
            setViewMode('calendar'); // Force back to calendar on nav
        }
    }, [navigationSignal]);

    // Auto-focus calendar month on project select
    useEffect(() => {
        if (focusedProject) {
            const start = parseISO(focusedProject.startDate);
            setDate(start);
            setDisplayedMonth(start); // Also navigate view
            setViewMode('calendar'); // Force back to calendar
        }
    }, [focusedProject]);

    // Fetch Monthly Logs
    useEffect(() => {
        const fetchLogs = async () => {
            if (!(window as any).ipcRenderer) return;
            const monthKey = format(displayedMonth, 'yyyy-MM');
            try {
                const logs = await (window as any).ipcRenderer.getMonthlyLog(monthKey);
                if (logs) setMonthlyLogs(logs);
            } catch (error) {
                console.error("Error fetching logs:", error);
            }
        };
        fetchLogs();
    }, [displayedMonth]);


    // Check for Inactivity (2 days missed)
    useEffect(() => {
        const checkInactivity = async () => {
            if (!(window as any).ipcRenderer) return;

            const today = new Date();
            const yesterday = subDays(today, 1);
            const dayBefore = subDays(today, 2);

            const monthStr = format(today, 'yyyy-MM');

            try {
                const logs = await (window as any).ipcRenderer.getMonthlyLog(monthStr);
                if (!logs) return;

                const yKey = format(yesterday, 'yyyy-MM-dd');
                const dbKey = format(dayBefore, 'yyyy-MM-dd');

                const yLog = logs[yKey];
                const dbLog = logs[dbKey];

                const yFailed = !yLog || !yLog.stats?.questAchieved;
                const dbFailed = !dbLog || !dbLog.stats?.questAchieved;

                if (yFailed && dbFailed) {
                    setShowDifficultyAlert(true);
                }
            } catch (e) {
                console.error("Failed to check inactivity", e);
            }
        };

        // Run only once on mount
        checkInactivity();
    }, []);

    const handleSetQuest = async () => {
        if (!newQuestText.trim()) {
            setIsAdding(false);
            return;
        }

        if (settings) {
            await saveSettings({
                ...settings,
                focusGoals: {
                    ...settings.focusGoals,
                    monthly: newQuestText,
                    monthlyUpdatedAt: Date.now(),
                    weekly: settings.focusGoals?.weekly || "", // preserve weekly
                    weeklyUpdatedAt: settings.focusGoals?.weeklyUpdatedAt // preserve weekly
                }
            });
        }
        setNewQuestText("");
        setIsAdding(false);
    };

    const handleCompleteForToday = async () => {
        if (!(window as any).ipcRenderer) return;

        try {
            const dateStr = format(new Date(), 'yyyy-MM-dd');

            // Save to daily log
            await (window as any).ipcRenderer.saveDailyLog(dateStr, {
                stats: { questAchieved: true }
            });

            // Optimistic Update
            setMonthlyLogs(prev => ({
                ...prev,
                [dateStr]: {
                    ...prev[dateStr],
                    stats: {
                        ...prev[dateStr]?.stats,
                        questAchieved: true
                    }
                }
            }));

        } catch (e) {
            console.error("Failed to complete quest", e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSetQuest();
        if (e.key === 'Escape') setIsAdding(false);
    };

    const handleSelect = (d: Date | undefined) => {
        setDate(d);
        if (d && onSelect) onSelect(d);
    };

    const handleGoToday = () => {
        const today = new Date();
        setDate(today);
        setDisplayedMonth(today); // Navigate calendar view to today's month
        if (onSelect) onSelect(today);
    };

    const handleGoToProject = () => {
        if (focusedProject) {
            const start = parseISO(focusedProject.startDate);
            setDate(start);
            setDisplayedMonth(start); // Navigate calendar view to project's month
        }
    };

    // Range Highlight Logic
    const projectRangeMatcher = (date: Date) => {
        if (!focusedProject) return false;
        const start = startOfDay(parseISO(focusedProject.startDate));
        const end = endOfDay(parseISO(focusedProject.endDate));
        return isWithinInterval(date, { start, end });
    };

    // Selected Range Highlight Logic
    const selectedProjectRangeMatcher = (date: Date) => {
        if (selectedIds.size === 0) return false;

        // Find visible projects that are selected
        const selectedProjects = projects.filter(p => selectedIds.has(p.id));

        return selectedProjects.some(p => {
            const start = startOfDay(parseISO(p.startDate));
            const end = endOfDay(parseISO(p.endDate));
            return isWithinInterval(date, { start, end });
        });
    };

    const isWorkDay = (day: Date) => {
        if (!settings?.workDays) return false;
        const dayStr = format(day, 'yyyy-MM-dd');
        return settings.workDays.includes(dayStr);
    };

    const hasMissingGoals = (() => {
        if (!settings?.focusGoals) return true;
        const now = new Date();

        // Check Monthly
        const monthlySet = settings.focusGoals.monthly && settings.focusGoals.monthlyUpdatedAt;
        const isCurrentMonth = monthlySet &&
            new Date(settings.focusGoals.monthlyUpdatedAt!).getMonth() === now.getMonth() &&
            new Date(settings.focusGoals.monthlyUpdatedAt!).getFullYear() === now.getFullYear();

        if (!isCurrentMonth) return true;

        // Check Weekly
        const weeklySet = settings.focusGoals.weekly && settings.focusGoals.weeklyUpdatedAt;
        const weekStart = settings.startOfWeek === 'monday' ? 1 : 0;

        const isCurrentWeek = weeklySet && isSameWeek(new Date(settings.focusGoals.weeklyUpdatedAt!), now, { weekStartsOn: weekStart });

        if (!isCurrentWeek) return true;

        return false;
    })();

    return (
        <div className="h-full w-full flex flex-col p-4 bg-background">
            <div className="flex-1 border border-border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col p-4 min-h-[300px] relative">

                {viewMode === 'calendar' ? (
                    <>
                        {/* Navigation Quick Jump */}
                        <div className="flex flex-wrap gap-2 mb-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs gap-2 border-muted-foreground/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={handleGoToday}
                            >
                                <Home className="w-3.5 h-3.5" />
                                <span>Today: <span className="font-semibold text-foreground">{format(new Date(), 'MMM d')}</span></span>
                            </Button>

                            {focusedProject && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs gap-2 border-blue-500/30 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                                    onClick={handleGoToProject}
                                >
                                    <Target className="w-3.5 h-3.5" />
                                    <span>Project: <span className="font-semibold">{format(parseISO(focusedProject.startDate), 'MMM d')}</span></span>
                                </Button>
                            )}
                        </div>

                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleSelect}
                            month={displayedMonth}
                            onMonthChange={setDisplayedMonth}
                            className="w-full h-full flex flex-col"
                            modifiers={{
                                projectRange: projectRangeMatcher,
                                selectedRange: selectedProjectRangeMatcher
                            }}
                            modifiersClassNames={{
                                projectRange: "bg-blue-500/10 text-blue-600 font-bold border-y border-blue-500/20 first:rounded-l-md last:rounded-r-md first:border-l last:border-r",
                                selectedRange: "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/50 z-20"
                            }}
                            classNames={{
                                months: "flex flex-col w-full h-full",
                                month: "w-full h-full flex flex-col",
                                caption: "flex justify-start items-center mb-4 px-2 shrink-0 relative h-8",
                                caption_label: "text-lg font-serif font-bold text-foreground tracking-tight pl-1",
                                nav: "flex items-center gap-1 absolute right-16 top-0 bottom-0",
                                nav_button: "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all flex items-center justify-center border border-transparent hover:border-border",
                                nav_button_previous: "static",
                                nav_button_next: "static",
                                table: "w-full h-full border-collapse flex flex-col",
                                head_row: "flex justify-between w-full mb-2 px-1 shrink-0",
                                head_cell: "text-muted-foreground w-full text-center font-mono text-[10px] uppercase tracking-widest opacity-60",
                                tbody: "flex-1 flex flex-col justify-between w-full",
                                row: "flex w-full justify-between flex-1 items-center",
                                cell: "relative p-0 text-center w-full h-full flex items-center justify-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
                                day: cn(
                                    "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted/50 transition-all duration-200 rounded-lg group relative flex flex-col items-center justify-start pt-2 text-sm text-foreground"
                                ),
                                day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-md shadow-primary/20 scale-[0.95] z-10",
                                day_today: "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/5 border border-blue-500/20",
                                day_outside: "text-muted-foreground/30 opacity-50",
                                day_disabled: "text-muted-foreground opacity-30",
                                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                                day_hidden: "invisible",
                            }}
                            components={{
                                DayContent: ({ date: d }) => {
                                    const dateKey = format(d, 'yyyy-MM-dd');
                                    const log = monthlyLogs[dateKey];
                                    const isQuestAchieved = log?.stats?.questAchieved;

                                    return (
                                        <div className="w-full h-full flex flex-col items-center relative">
                                            <span className="z-10 font-medium">{d.getDate()}</span>
                                            {isWorkDay(d) && (
                                                <div className="mt-1 w-1 h-1 bg-primary rounded-full opacity-80"></div>
                                            )}
                                            {/* Quest Achieved Checkmark */}
                                            {isQuestAchieved && (
                                                <div className="mt-0.5 z-20 text-orange-500 dark:text-orange-400 animate-in zoom-in spin-in-90 duration-300 text-[20px]">
                                                    🔥
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            }}
                        />
                    </>
                ) : (
                    <div className="h-full w-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 relative gap-4">
                        {/* Header: Back & Title */}
                        <div className="flex items-center justify-between shrink-0 mb-2">
                            {/* Back button technically not needed if we have the toggle at bottom, but good for context */}
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                <div className="text-amber-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                                    <span role="img" aria-label="fire">🔥</span> {streak} Day Streak
                                </div>
                            </div>
                        </div>

                        {/* Add Mode Overlay */}
                        {isAdding && (
                            <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 rounded-2xl border border-border">
                                <h4 className="text-2xl font-black mb-6 text-violet-500 font-serif">New Objective</h4>
                                <Input
                                    autoFocus
                                    placeholder="What must be done for this month?"
                                    value={newQuestText}
                                    onChange={(e) => setNewQuestText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="text-center text-xl h-14 mb-6 shadow-xl border-violet-500/30 focus-visible:ring-violet-500 bg-card"
                                />
                                <div className="flex gap-4 w-full max-w-xs">
                                    <Button variant="outline" size="lg" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                                    <Button size="lg" className="flex-1 bg-violet-600 hover:bg-violet-700 font-bold" onClick={handleSetQuest}>Accept Quest for {format(new Date(), 'MMMM')}</Button>
                                </div>
                            </div>
                        )}

                        {/* Quest Content */}
                        {activeQuestText ? (
                            <div className="flex-1 flex flex-col w-full h-full relative">
                                <div className="flex-1 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-white/10 shadow-xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group">

                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.15),transparent_70%)]" />
                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full" />

                                    {activeQuestCreatedAt && (
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-mono text-zinc-500 uppercase tracking-widest border border-zinc-700/50 rounded-full px-2 py-1 bg-zinc-900/50 whitespace-nowrap">
                                            Created {format(activeQuestCreatedAt, 'MMM d, h:mm a')}
                                        </div>
                                    )}

                                    <div className="relative mb-4 mt-6 transform group-hover:scale-110 transition-transform duration-700">
                                        <div className="absolute inset-0 bg-violet-500 blur-[30px] opacity-30 rounded-full animate-pulse" />
                                        <Swords className="w-12 h-12 text-white relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" strokeWidth={1.5} />
                                    </div>

                                    <h2 className="text-xl md:text-2xl font-black font-serif tracking-tight leading-tight text-white drop-shadow-lg mb-3 max-w-xs break-words">
                                        {activeQuestText}
                                    </h2>

                                    <div className="w-8 h-1 bg-violet-500/50 rounded-full mb-6" />

                                    {/* Completion Button */}
                                    <Button
                                        size="default"
                                        disabled={isTodayAchieved}
                                        className={cn(
                                            "h-12 w-full max-w-[200px] rounded-xl text-sm font-bold tracking-wide shadow-xl transition-all duration-300 z-20",
                                            isTodayAchieved
                                                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50"
                                                : "bg-white text-black hover:bg-zinc-200 hover:scale-105 group-hover:shadow-violet-500/20"
                                        )}
                                        onClick={handleCompleteForToday}
                                    >
                                        {isTodayAchieved ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                COMPLETED TODAY
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                COMPLETE FOR TODAY
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 bg-zinc-50 border border-dashed border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/50 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                    <Target className="w-10 h-10 text-zinc-400" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">No Active Quest</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
                                    You have not set a specific goal for this month yet.
                                </p>
                                <Button onClick={() => setIsAdding(true)} variant="default" className="rounded-full px-8">
                                    <Plus className="w-4 h-4 mr-2" /> Set Monthly Quest
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quest Button */}
            <div className="mt-4 shrink-0 px-1 space-y-2">
                <Button
                    className={cn(
                        "w-full border-none shadow-sm hover:shadow-md font-bold tracking-wide transition-all duration-300",
                        viewMode === 'quest'
                            ? "bg-violet-600 hover:bg-violet-700 text-white"
                            : "bg-zinc-800 dark:bg-zinc-700 hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-600 text-white"
                    )}
                    size="lg"
                    onClick={() => setViewMode(viewMode === 'calendar' ? 'quest' : 'calendar')}
                >
                    {viewMode === 'calendar' ? (
                        <>
                            <Swords className="w-5 h-5 mr-2" />
                            DAILY QUEST
                        </>
                    ) : (
                        <>
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            BACK TO CALENDAR
                        </>
                    )}
                </Button>

                {/* Focus Goals Button */}
                <Button
                    variant="outline"
                    className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary font-bold tracking-wide shadow-sm relative"
                    onClick={() => {
                        setForceUnlockGoals(false); // Normal open
                        setShowGoalModal(true);
                    }}
                >
                    <Target className="w-4 h-4 mr-2" />
                    GOAL SETTING
                    {hasMissingGoals && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-background" />
                    )}
                </Button>

            </div>

            <GoalSettingModal
                open={showGoalModal}
                onOpenChange={(val) => {
                    setShowGoalModal(val);
                    if (!val) setForceUnlockGoals(false); // Reset on close
                }}
                forceUnlock={forceUnlockGoals}
            />

            {/* Difficulty Alert Dialog */}
            <Dialog open={showDifficultyAlert} onOpenChange={setShowDifficultyAlert}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="w-5 h-5" />
                            The Path Seems Steep
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            It looks like you haven't completed your Daily Quests for 2 days in a row.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowDifficultyAlert(false)}>
                            I'll Try Harder
                        </Button>
                        <Button onClick={() => {
                            setForceUnlockGoals(true); // Unlock for edit
                            setShowGoalModal(true);
                            setShowDifficultyAlert(false);
                        }} className="bg-violet-600 hover:bg-violet-700">
                            Adjust Goals
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
