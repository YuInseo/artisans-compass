import { useDataStore } from "@/hooks/useDataStore";
import { useTranslation } from "react-i18next";
import { Target, Check, Plus, ArrowLeft, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
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
    const [viewMode, setViewMode] = useState<'calendar' | 'quest'>('quest');
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
                                <div className="flex-1 bg-card dark:bg-card border border-border shadow-sm rounded-3xl flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group transition-all hover:shadow-md">
                                    {activeQuestCreatedAt && (
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full whitespace-nowrap">
                                            {t('calendar.created')} {format(activeQuestCreatedAt, 'MMM d, h:mm a')}
                                        </div>
                                    )}

                                    {/* Developer Mode Actions */}
                                    {settings?.developerMode && (
                                        <div className="absolute top-3 right-3 flex gap-1 z-50 p-1 bg-background/80 backdrop-blur rounded-lg border border-border shadow-sm">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" onClick={() => { setIsAdding(true); setNewQuestText(activeQuestText || ""); }} title="Edit Quest">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" onClick={async () => {
                                                if (!settings) return;
                                                const newDate = new Date(settings.focusGoals?.dailyQuestUpdatedAt || Date.now());
                                                newDate.setDate(newDate.getDate() - 1);
                                                await saveSettings({ ...settings, focusGoals: { ...settings.focusGoals, dailyQuestUpdatedAt: newDate.getTime(), monthly: settings.focusGoals?.monthly || "", weekly: settings.focusGoals?.weekly || "" } });
                                            }} title="이전 날짜로 변경 (-1일)">
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" onClick={async () => {
                                                if (!settings) return;
                                                const newDate = new Date(settings.focusGoals?.dailyQuestUpdatedAt || Date.now());
                                                newDate.setDate(newDate.getDate() + 1);
                                                await saveSettings({ ...settings, focusGoals: { ...settings.focusGoals, dailyQuestUpdatedAt: newDate.getTime(), monthly: settings.focusGoals?.monthly || "", weekly: settings.focusGoals?.weekly || "" } });
                                            }} title="이후 날짜로 변경 (+1일)">
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={async () => {
                                                if (!settings) return;
                                                await saveSettings({ ...settings, focusGoals: { ...settings.focusGoals, dailyQuest: "", dailyQuestUpdatedAt: 0, monthly: settings.focusGoals?.monthly || "", weekly: settings.focusGoals?.weekly || "" } });
                                            }} title="Reset Quest">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    )}

                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500">
                                        <Target className="w-10 h-10 text-primary" strokeWidth={2} />
                                    </div>

                                    <h2 className="text-2xl font-bold tracking-tight text-foreground mb-8 max-w-sm break-words px-4 leading-relaxed">
                                        {activeQuestText}
                                    </h2>

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

            {/* Bottom Actions */}
            <div className="shrink-0 pt-0 pb-4 px-4 flex flex-col gap-2">
                <Button
                    className={cn(
                        "w-full border-none shadow-sm hover:shadow-md font-bold tracking-wide transition-all duration-300",
                        viewMode === 'quest'
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "bg-muted/50 hover:bg-primary hover:text-primary-foreground text-foreground"
                    )}
                    size="lg"
                    onClick={() => setViewMode(viewMode === 'calendar' ? 'quest' : 'calendar')}
                >
                    {viewMode === 'calendar' ? (
                        <>
                            <Target className="w-5 h-5 mr-2" />
                            {t('calendar.dailyQuest')}
                        </>
                    ) : (
                        <>
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            {t('calendar.backToCalendar')}
                        </>
                    )}
                </Button>

                <Button
                    variant="outline"
                    className="w-full border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary font-bold tracking-wide shadow-sm relative h-10 bg-muted/20"
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
