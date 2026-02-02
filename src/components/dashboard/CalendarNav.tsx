import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Swords, Target, Home, ArrowLeft, Check, Plus, AlertTriangle } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";
import { useTimelineStore } from "@/hooks/useTimelineStore";
import { useQuestStore } from "@/hooks/useQuestStore";
import { GoalSettingModal } from "./GoalSettingModal";
import { Project } from "@/types";
import { format, parseISO, isSameWeek, isSameDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface CalendarNavProps {
    onSelect?: (date: Date) => void;
    focusedProject?: Project | null;
    onNavigate?: (date: Date) => void;
    navigationSignal?: { date: Date, timestamp: number } | null;
}

export function CalendarNav({ onSelect, focusedProject, navigationSignal }: CalendarNavProps) {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'calendar' | 'quest'>('calendar');
    const { streak } = useQuestStore();

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

    // Derive Current Quest from Monthly Goal
    const today = new Date();
    // Check if quest was updated TODAY
    const questUpdatedToday = settings?.focusGoals?.dailyQuestUpdatedAt &&
        isSameDay(new Date(settings.focusGoals.dailyQuestUpdatedAt), today);

    // Effective Quest
    const activeQuestText = (questUpdatedToday && settings?.focusGoals?.dailyQuest) ? settings.focusGoals.dailyQuest : null;
    const activeQuestCreatedAt = (questUpdatedToday) ? settings?.focusGoals?.dailyQuestUpdatedAt : null;

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


    // Inactivity check disabled by user request
    // useEffect(() => {
    //     const checkInactivity = async () => { ... }
    //     checkInactivity();
    // }, []);

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
                    dailyQuest: newQuestText,
                    dailyQuestUpdatedAt: Date.now(),
                    monthly: settings.focusGoals?.monthly || "", // preserve monthly
                    monthlyUpdatedAt: settings.focusGoals?.monthlyUpdatedAt, // preserve monthly
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
        if (!d) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selected = new Date(d);
        selected.setHours(0, 0, 0, 0);

        // Logic check: Is it in the past?
        if (selected.getTime() < today.getTime()) {
            const dateKey = format(d, 'yyyy-MM-dd');
            const log = monthlyLogs[dateKey];

            // Check if we have meaningful data (todos, screenshots, or quest stats)
            const hasData = log && (
                (log.todos && log.todos.length > 0) ||
                (log.screenshots && log.screenshots.length > 0) ||
                (log.stats && log.stats.questAchieved) ||
                (log.closingNote)
            );

            if (!hasData) {
                toast(t('calendar.noArchiveData'), {
                    description: t('calendar.noActivity')
                });
                // Do NOT call onSelect -> Modal won't open
                setDate(d);
                return;
            }
        }

        setDate(d);
        if (onSelect) onSelect(d);
    };

    const handleGoToday = () => {
        const today = new Date();
        setDate(today);
        setDisplayedMonth(today); // Navigate calendar view to today's month
        if (onSelect) onSelect(today);
    };


    // Determine the active project (Prop or Selection)
    const activeProject = focusedProject || projects.find(p => selectedIds.has(p.id));

    const handleGoToProject = () => {
        if (activeProject) {
            const start = parseISO(activeProject.startDate);
            setDate(start);
            setDisplayedMonth(start); // Navigate calendar view to project's month
        }
    };

    // Range Highlight Logic
    const projectRangeMatcher = (date: Date) => {
        if (!focusedProject) return false;
        const currentStr = format(date, 'yyyy-MM-dd');
        return currentStr >= focusedProject.startDate && currentStr <= focusedProject.endDate;
    };

    // Selected Range Highlight Logic
    const selectedProjectRangeMatcher = (date: Date) => {
        if (selectedIds.size === 0) return false;
        const currentStr = format(date, 'yyyy-MM-dd');
        return projects.filter(p => selectedIds.has(p.id)).some(p => {
            return currentStr >= p.startDate && currentStr <= p.endDate;
        });
    };

    const selectedRangeStartMatcher = (date: Date) => {
        if (selectedIds.size === 0) return false;
        const currentStr = format(date, 'yyyy-MM-dd');
        return projects.filter(p => selectedIds.has(p.id)).some(p => p.startDate === currentStr);
    };

    const selectedRangeEndMatcher = (date: Date) => {
        if (selectedIds.size === 0) return false;
        const currentStr = format(date, 'yyyy-MM-dd');
        return projects.filter(p => selectedIds.has(p.id)).some(p => p.endDate === currentStr);
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
        <div className="h-full w-full flex flex-col p-4 bg-background select-none">
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
                                <span>{t('calendar.today')}: <span className="font-semibold text-foreground">{format(new Date(), 'MMM d')}</span></span>
                            </Button>

                            {activeProject && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs gap-2 border-blue-500/30 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                                    onClick={handleGoToProject}
                                    title={activeProject.name}
                                >
                                    <Target className="w-3.5 h-3.5" />
                                    <span className="max-w-[100px] truncate hidden sm:inline-block">{activeProject.name}</span>
                                    {activeProject.type && (
                                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider">
                                            {activeProject.type}
                                        </span>
                                    )}
                                    <span><span className="font-semibold">{format(parseISO(activeProject.startDate), 'MMM d')}</span></span>
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
                                selectedRange: selectedProjectRangeMatcher,
                                sStart: selectedRangeStartMatcher,
                                sEnd: selectedRangeEndMatcher
                            }}
                            modifiersClassNames={{
                                projectRange: "bg-blue-500/10 text-blue-600 font-bold border-y border-blue-500/20 first:rounded-l-md last:rounded-r-md first:border-l last:border-r",
                                selectedRange: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold first:rounded-l-lg last:rounded-r-lg !rounded-none mx-0 w-full relative z-0",
                                sStart: "!rounded-l-lg",
                                sEnd: "!rounded-r-lg"
                            }}
                            classNames={{
                                months: "flex flex-col w-full h-full space-y-0",
                                month: "w-full h-full flex flex-col space-y-0",
                                caption: "flex justify-start items-center mb-4 px-2 shrink-0 relative h-8",
                                caption_label: "text-base font-serif font-bold text-foreground tracking-tight pl-1",
                                nav: "flex items-center gap-1 absolute right-1 top-0 bottom-0",
                                nav_button: "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all flex items-center justify-center border border-transparent hover:border-border",
                                nav_button_previous: "static",
                                nav_button_next: "static",
                                table: "w-full h-full border-collapse flex flex-col space-y-0",
                                head_row: "grid grid-cols-7 w-full mb-2 shrink-0 gap-0",
                                head_cell: "text-muted-foreground w-full text-center font-mono text-[10px] uppercase tracking-widest opacity-60",
                                tbody: "flex-1 flex flex-col w-full gap-0 space-y-0",
                                row: "grid grid-cols-7 w-full flex-1 gap-0 mt-0",
                                cell: "relative p-0 text-center w-full h-full flex items-center justify-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
                                day: cn(
                                    "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted/50 transition-all duration-200 rounded-lg group relative flex flex-col items-center justify-start pt-2 text-sm text-foreground"
                                ),
                                day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-sm z-10",
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
                                    const hasData = log && (
                                        (log.todos && log.todos.length > 0) ||
                                        (log.screenshots && log.screenshots.length > 0) ||
                                        (log.sessions && log.sessions.length > 0) ||
                                        log.closingNote
                                    );

                                    return (
                                        <div className="w-full h-full flex flex-col items-center relative">
                                            <span className={cn("z-10 font-medium", isQuestAchieved ? "text-orange-500 font-bold" : "")}>{d.getDate()}</span>
                                            {isWorkDay(d) && !isQuestAchieved && (
                                                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary/20 rounded-full"></div>
                                            )}

                                            {/* Data Indicator (Bar) */}
                                            {hasData && !isQuestAchieved && (
                                                <div className="mt-1 w-3 h-1 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 opacity-90 shadow-[0_2px_4px_rgba(99,102,241,0.2)]"></div>
                                            )}

                                            {/* Quest Achieved Checkmark */}
                                            {isQuestAchieved && (
                                                <div className="mt-0.5 z-20 text-orange-500 dark:text-orange-400 animate-in zoom-in spin-in-90 duration-300 text-[20px] drop-shadow-sm">
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
                                    <span role="img" aria-label="fire">🔥</span> {streak} {t('calendar.streak')}
                                </div>
                            </div>
                        </div>

                        {/* Add Mode Overlay */}
                        {isAdding && (
                            <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 rounded-2xl border border-border overflow-hidden">
                                <h4 className="text-xl font-black mb-4 text-violet-500 font-serif text-center">{t('calendar.newObjective')}</h4>
                                <Input
                                    autoFocus
                                    placeholder={t('calendar.whatIsFocus')}
                                    value={newQuestText}
                                    onChange={(e) => setNewQuestText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="text-center text-lg h-12 mb-6 shadow-xl border-violet-500/30 focus-visible:ring-violet-500 bg-card w-full max-w-[90%]"
                                />
                                <div className="flex flex-col gap-3 w-full max-w-[90%]">
                                    <Button size="lg" className="w-full bg-violet-600 hover:bg-violet-700 font-bold shadow-lg shadow-violet-500/20" onClick={handleSetQuest}>{t('calendar.acceptQuest')}</Button>
                                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setIsAdding(false)}>{t('calendar.cancel')}</Button>
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
                                            {t('calendar.created')} {format(activeQuestCreatedAt, 'MMM d, h:mm a')}
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
                                                {t('calendar.completedToday')}
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                {t('calendar.completeForToday')}
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
                                <h3 className="text-xl font-bold text-foreground mb-2">{t('calendar.noActiveQuest')}</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
                                    {t('calendar.noQuestDescription')}
                                </p>
                                <Button onClick={() => setIsAdding(true)} variant="default" className="rounded-full px-8">
                                    <Plus className="w-4 h-4 mr-2" /> {t('calendar.setDailyQuest')}
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
                            {t('calendar.dailyQuest')}
                        </>
                    ) : (
                        <>
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            {t('calendar.backToCalendar')}
                        </>
                    )}
                </Button>

                {/* Focus Goals Button */}
                <Button
                    variant="outline"
                    className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary font-bold tracking-wide shadow-sm relative"
                    onClick={() => {
                        setShowGoalModal(true);
                    }}
                >
                    <Target className="w-4 h-4 mr-2" />
                    {t('calendar.goalSetting').toUpperCase()}
                    {hasMissingGoals && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-background" />
                    )}
                </Button>

            </div>

            <GoalSettingModal
                open={showGoalModal}
                onOpenChange={setShowGoalModal}
            />

            {/* Difficulty Alert Dialog */}
            <Dialog open={showDifficultyAlert} onOpenChange={setShowDifficultyAlert}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="w-5 h-5" />
                            {t('calendar.pathSteep')}
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {t('calendar.streakBroken')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowDifficultyAlert(false)}>
                            {t('calendar.tryHarder')}
                        </Button>
                        <Button onClick={() => {
                            setShowGoalModal(true);
                            setShowDifficultyAlert(false);
                        }} className="bg-violet-600 hover:bg-violet-700">
                            {t('calendar.adjustGoals')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
