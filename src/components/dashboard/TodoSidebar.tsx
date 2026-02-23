import { useDataStore } from "@/hooks/useDataStore";
import { useTranslation } from "react-i18next";
import { Target, Swords, Check, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalSettingModal } from "./GoalSettingModal";
import { useState, useEffect } from "react";
import { isSameWeek, isSameDay, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarNav } from "./CalendarNav";
import { Project } from "@/types";

interface TodoSidebarProps {
    onSelect?: (date: Date) => void;
    focusedProject?: Project | null;
    navigationSignal?: { date: Date, timestamp: number } | null;
}

export function TodoSidebar({ onSelect, focusedProject, navigationSignal }: TodoSidebarProps) {
    const [viewMode, setViewMode] = useState<'calendar' | 'quest'>('calendar');
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [showGoalModal, setShowGoalModal] = useState(false);

    // Quest Internal State
    const [isAdding, setIsAdding] = useState(false);
    const [newQuestText, setNewQuestText] = useState("");
    const [monthlyLogs, setMonthlyLogs] = useState<Record<string, any>>({});

    const today = new Date();

    // Fetch Monthly Logs
    useEffect(() => {
        const fetchLogs = async () => {
            if (!(window as any).ipcRenderer) return;
            const monthKey = format(today, 'yyyy-MM');
            try {
                const logs = await (window as any).ipcRenderer.getMonthlyLog(monthKey);
                if (logs) setMonthlyLogs(logs);
            } catch (error) {
                console.error("Error fetching logs:", error);
            }
        };
        fetchLogs();
    }, []);

    // Derived State
    const questUpdatedToday = settings?.focusGoals?.dailyQuestUpdatedAt &&
        isSameDay(new Date(settings.focusGoals.dailyQuestUpdatedAt), today);
    const activeQuestText = (questUpdatedToday && settings?.focusGoals?.dailyQuest) ? settings.focusGoals.dailyQuest : null;
    const activeQuestCreatedAt = (questUpdatedToday) ? settings?.focusGoals?.dailyQuestUpdatedAt : null;
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayLog = monthlyLogs[todayKey];
    const isTodayAchieved = todayLog?.stats?.questAchieved;

    const hasMissingGoals = (() => {
        if (!settings?.focusGoals) return true;

        const monthlySet = settings.focusGoals.monthly && settings.focusGoals.monthlyUpdatedAt;
        const isCurrentMonth = monthlySet &&
            new Date(settings.focusGoals.monthlyUpdatedAt!).getMonth() === today.getMonth() &&
            new Date(settings.focusGoals.monthlyUpdatedAt!).getFullYear() === today.getFullYear();
        if (!isCurrentMonth) return true;

        const weeklySet = settings.focusGoals.weekly && settings.focusGoals.weeklyUpdatedAt;
        const weekStart = settings.startOfWeek === 'monday' ? 1 : 0;
        const isCurrentWeek = weeklySet && isSameWeek(new Date(settings.focusGoals.weeklyUpdatedAt!), today, { weekStartsOn: weekStart });
        if (!isCurrentWeek) return true;

        return false;
    })();

    const handleSetQuest = async () => {
        if (!newQuestText.trim() || !settings) {
            setIsAdding(false);
            return;
        }
        await saveSettings({
            ...settings,
            focusGoals: {
                ...settings.focusGoals,
                dailyQuest: newQuestText,
                dailyQuestUpdatedAt: Date.now(),
                monthly: settings.focusGoals?.monthly || "",
                monthlyUpdatedAt: settings.focusGoals?.monthlyUpdatedAt,
                weekly: settings.focusGoals?.weekly || "",
                weeklyUpdatedAt: settings.focusGoals?.weeklyUpdatedAt
            }
        });
        setNewQuestText("");
        setIsAdding(false);
    };

    const handleCompleteForToday = async () => {
        if (!(window as any).ipcRenderer) return;
        try {
            await (window as any).ipcRenderer.saveDailyLog(todayKey, {
                stats: { questAchieved: true }
            });
            setMonthlyLogs(prev => ({
                ...prev,
                [todayKey]: {
                    ...prev[todayKey],
                    stats: {
                        ...prev[todayKey]?.stats,
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

    return (
        <div className="h-full flex flex-col bg-background relative z-10 w-full min-w-[300px]">
            {/* Content Range */}
            <div className="flex-1 min-h-0 relative bg-muted/5 flex flex-col px-0">
                {viewMode === 'calendar' ? (
                    <CalendarNav
                        onSelect={onSelect}
                        focusedProject={focusedProject}
                        navigationSignal={navigationSignal}
                    />
                ) : (
                    <div className="h-full w-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 relative p-4 bg-muted/10">

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
                                    className="text-center text-lg h-12 mb-6 shadow-xl border-primary/30 focus-visible:ring-primary bg-card w-full max-w-[90%]"
                                />
                                <div className="flex flex-col gap-3 w-full max-w-[90%]">
                                    <Button size="lg" className="w-full bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20" onClick={handleSetQuest}>{t('calendar.acceptQuest')}</Button>
                                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => setIsAdding(false)}>{t('calendar.cancel')}</Button>
                                </div>
                            </div>
                        )}

                        {/* Quest Content */}
                        {activeQuestText ? (
                            <div className="flex-1 flex flex-col w-full h-full relative">
                                <div className="flex-1 bg-gradient-to-br from-card via-muted/50 to-card rounded-3xl border border-border shadow-xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.15),transparent_70%)]" />
                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] rounded-full" />

                                    {activeQuestCreatedAt && (
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-mono text-muted-foreground uppercase tracking-widest border border-border rounded-full px-2 py-1 bg-background/50 whitespace-nowrap">
                                            {t('calendar.created')} {format(activeQuestCreatedAt, 'MMM d, h:mm a')}
                                        </div>
                                    )}

                                    <div className="relative mb-4 mt-6 transform group-hover:scale-110 transition-transform duration-700">
                                        <div className="absolute inset-0 bg-primary blur-[30px] opacity-30 rounded-full animate-pulse" />
                                        <Swords className="w-12 h-12 text-primary relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" strokeWidth={1.5} />
                                    </div>

                                    <h2 className="text-xl md:text-2xl font-black font-serif tracking-tight leading-tight text-foreground drop-shadow-lg mb-3 max-w-xs break-words">
                                        {activeQuestText}
                                    </h2>
                                    <div className="w-8 h-1 bg-primary/50 rounded-full mb-6" />

                                    {/* Completion Button */}
                                    <Button
                                        size="default"
                                        disabled={isTodayAchieved}
                                        className={cn(
                                            "h-12 w-full max-w-[200px] rounded-xl text-sm font-bold tracking-wide shadow-xl transition-all duration-300 z-20",
                                            isTodayAchieved
                                                ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50"
                                                : "bg-card text-card-foreground hover:bg-muted hover:scale-105 group-hover:shadow-primary/20"
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
                            <div className="flex-1 bg-card/50 border border-dashed border-border dark:bg-card/30 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                    <Target className="w-10 h-10 text-muted-foreground/50" />
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

            {/* Toggle Button */}
            <div className="shrink-0 px-4 pt-4">
                <Button
                    className={cn(
                        "w-full border-none shadow-sm hover:shadow-md font-bold tracking-wide transition-all duration-300",
                        viewMode === 'quest'
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground"
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
            </div>

            {/* Goal Setting Button */}
            <div className="shrink-0 pt-3 pb-4 px-4 border-t-0 mt-2">
                <Button
                    variant="outline"
                    className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary font-bold tracking-wide shadow-sm relative"
                    onClick={() => setShowGoalModal(true)}
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
        </div>
    );
}
