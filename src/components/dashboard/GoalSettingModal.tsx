import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useDataStore } from "@/hooks/useDataStore";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Or Input if single line, but goals can be long
import { Target, Calendar, CalendarClock } from "lucide-react";

interface GoalSettingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GoalSettingModal({ open, onOpenChange }: GoalSettingModalProps) {
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [monthlyGoal, setMonthlyGoal] = useState("");
    const [weeklyGoal, setWeeklyGoal] = useState("");

    // Lock Logic (DISABLED as per user request to never lock)
    const isMonthlyLocked = false;
    const isWeeklyLocked = false;

    // Load initial values
    useEffect(() => {
        if (open && settings?.focusGoals) {
            setMonthlyGoal(settings.focusGoals.monthly || "");
            setWeeklyGoal(settings.focusGoals.weekly || "");
        }
    }, [open, settings?.focusGoals]);

    const handleSave = async () => {
        if (!settings) return;

        const now = Date.now();

        // Only update timestamp if text changed OR if explicitly saving (maybe re-confirming?)
        // User says "1st of month" prompt logic. If user just opens and saves same text, does it count?
        // Probably yes, acknowledging the goal.

        await saveSettings({
            ...settings,
            focusGoals: {
                monthly: monthlyGoal,
                weekly: weeklyGoal,
                monthlyUpdatedAt: now, // Always update timestamp on explicit save to acknowledge
                weeklyUpdatedAt: now
            }
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] select-none">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-serif">
                        <Target className="w-5 h-5 text-primary" />
                        {t('modals.goalSetting.title')}
                    </DialogTitle>
                    <div className="sr-only">
                        <DialogDescription>
                            {t('modals.goalSetting.description')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Monthly Goal - Violet Theme */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-violet-600 dark:text-violet-400 font-bold text-sm tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {t('modals.goalSetting.monthly')}
                            </div>
                            {/* Lock indicator */}
                            {isMonthlyLocked && (
                                <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 animate-in fade-in">
                                    {t('modals.goalSetting.monthlyLocked')}
                                </span>
                            )}
                        </div>
                        <div className="relative group">
                            <Textarea
                                value={monthlyGoal}
                                onChange={(e) => setMonthlyGoal(e.target.value)}
                                placeholder={t('modals.goalSetting.monthlyPlaceholder')}
                                disabled={!!isMonthlyLocked}
                                className="min-h-[100px] text-lg font-medium border-violet-200 focus:border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-900 resize-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            />
                            <div className="absolute top-0 right-0 w-1 h-full bg-violet-500 rounded-r-md opacity-20 pointer-events-none" />
                        </div>
                    </div>

                    {/* Weekly Goal - Blue Theme */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 font-bold text-sm tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                {t('modals.goalSetting.weekly')}
                            </div>
                            {/* Lock indicator */}
                            {isWeeklyLocked && (
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 animate-in fade-in">
                                    {t('modals.goalSetting.weeklyLocked')}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Textarea
                                value={weeklyGoal}
                                onChange={(e) => setWeeklyGoal(e.target.value)}
                                placeholder={t('modals.goalSetting.weeklyPlaceholder')}
                                disabled={!!isWeeklyLocked}
                                className="min-h-[100px] text-lg font-medium border-blue-200 focus:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 resize-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            />
                            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-r-md opacity-20 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('modals.goalSetting.cancel')}</Button>
                    <Button onClick={handleSave} className="min-w-[100px] font-bold">
                        {t('modals.goalSetting.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
