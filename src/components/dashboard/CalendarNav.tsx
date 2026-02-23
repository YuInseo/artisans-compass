import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, Target } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";
import { useTimelineStore } from "@/hooks/useTimelineStore";
import { Project } from "@/types";
import { format, parseISO } from "date-fns";
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

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());
    const { settings, projects } = useDataStore();
    const { selectedIds } = useTimelineStore();

    // Fetch Monthly Logs to show achievement status on Calendar Days
    const [monthlyLogs, setMonthlyLogs] = useState<Record<string, any>>({});

    // Sync with Navigation Signal (External Control)
    useEffect(() => {
        if (navigationSignal) {
            setDate(navigationSignal.date);
            setDisplayedMonth(navigationSignal.date); // Also navigate view
        }
    }, [navigationSignal]);

    // Auto-focus calendar month on project select
    useEffect(() => {
        if (focusedProject) {
            const start = parseISO(focusedProject.startDate);
            setDate(start);
            setDisplayedMonth(start); // Also navigate view
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



    const handleSelect = (d: Date | undefined) => {
        if (!d) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selected = new Date(d);
        selected.setHours(0, 0, 0, 0);

        // Logic check: Is it in the future?
        if (settings?.lockFutureDates && selected.getTime() > today.getTime()) {
            toast(t('calendar.futureLocked', 'Future navigation is locked'), {
                description: t('calendar.futureLockedDesc', 'You cannot view future dates when this setting is active.')
            });
            return;
        }

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


    return (
        <div className="h-full w-full flex flex-col p-4 bg-background select-none">
            <div className="flex-1 border border-border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col p-4 min-h-[300px] relative">
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
                            className="h-8 px-3 text-xs gap-2 border-primary/30 hover:bg-primary/10 text-primary transition-colors"
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
                    disabled={settings?.lockFutureDates ? { after: new Date() } : undefined}
                    modifiers={{
                        projectRange: projectRangeMatcher,
                        selectedRange: selectedProjectRangeMatcher,
                        sStart: selectedRangeStartMatcher,
                        sEnd: selectedRangeEndMatcher
                    }}
                    modifiersClassNames={{
                        projectRange: "bg-primary/30 !text-foreground font-bold border border-primary/40 rounded-[14px]",
                        selectedRange: "bg-accent/30 !text-foreground font-bold border border-accent/40 rounded-[14px] z-0",
                        sStart: "bg-accent text-accent-foreground shadow-sm rounded-[14px] z-10 font-bold",
                        sEnd: "bg-accent text-accent-foreground shadow-sm rounded-[14px] z-10 font-bold"
                    }}
                    classNames={{
                        months: "flex flex-col w-full h-full space-y-0",
                        month: "w-full h-full flex flex-col space-y-0",
                        caption: "flex justify-start items-center mb-6 px-4 shrink-0 relative h-10",
                        caption_label: "text-2xl font-serif font-bold text-foreground tracking-tight pl-0",
                        nav: "flex items-center gap-1.5 absolute right-2 top-0 bottom-0",
                        nav_button: "h-8 w-8 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all flex items-center justify-center border border-transparent hover:border-border/50",
                        nav_button_previous: "static",
                        nav_button_next: "static",
                        table: "w-full h-full border-collapse flex flex-col space-y-0.5",
                        head_row: "grid grid-cols-7 w-full mb-2 shrink-0 px-2",
                        head_cell: "text-muted-foreground w-full text-center font-medium text-[11px] uppercase tracking-wider opacity-50",
                        tbody: "flex-1 flex flex-col w-full gap-0.5 px-2 pb-2",
                        row: "grid grid-cols-7 w-full flex-1 gap-0.5 mt-0",
                        cell: "relative p-0 text-center w-full h-full flex items-center justify-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
                        day: cn(
                            "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted/30 transition-all duration-300 rounded-[14px] group relative flex flex-col items-center justify-start pt-1 text-sm text-muted-foreground hover:text-foreground"
                        ),
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-md scale-[0.98] transition-transform rounded-[14px]",
                        day_today: "bg-accent/5 text-accent font-bold rounded-[14px]",
                        day_outside: "text-muted-foreground/20 opacity-30",
                        day_disabled: "text-muted-foreground opacity-20",
                        day_range_middle: "aria-selected:bg-accent/10 aria-selected:text-accent-foreground rounded-[14px] my-0",
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
                                <div className="w-full h-full flex flex-col items-center relative gap-0.5">
                                    <span className={cn("z-10 text-[13px] transition-all", isQuestAchieved ? "font-bold" : "font-medium")}>{d.getDate()}</span>

                                    {/* Work day indicator (Top Right Dot) */}
                                    {isWorkDay(d) && !isQuestAchieved && (
                                        <div className="absolute top-3 right-3 w-1 h-1 bg-primary/20 rounded-full"></div>
                                    )}

                                    {/* Data Indicator (Bottom Dot) */}
                                    {hasData && !isQuestAchieved && (
                                        <div className="mt-1 w-1 h-1 rounded-full bg-primary/30 group-hover:bg-primary/50 transition-colors"></div>
                                    )}

                                    {/* Quest Achieved Checkmark */}
                                    {isQuestAchieved && (
                                        <div className="mt-0 z-20 text-primary animate-in zoom-in spin-in-90 duration-300 text-lg drop-shadow-sm leading-none">
                                            🔥
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    }}
                />
            </div>
        </div>
    );
}
