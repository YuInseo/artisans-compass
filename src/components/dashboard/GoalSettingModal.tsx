import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDataStore } from "@/hooks/useDataStore";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Or Input if single line, but goals can be long
import { Target, Calendar, CalendarClock } from "lucide-react";
import { isSameWeek } from "date-fns";

interface GoalSettingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GoalSettingModal({ open, onOpenChange, forceUnlock = false }: GoalSettingModalProps & { forceUnlock?: boolean }) {
    const { settings, saveSettings } = useDataStore();
    const [monthlyGoal, setMonthlyGoal] = useState("");
    const [weeklyGoal, setWeeklyGoal] = useState("");

    // Lock Logic
    const isMonthlyLocked = !forceUnlock && settings?.focusGoals?.monthlyUpdatedAt &&
        new Date(settings.focusGoals.monthlyUpdatedAt).getMonth() === new Date().getMonth() &&
        new Date(settings.focusGoals.monthlyUpdatedAt).getFullYear() === new Date().getFullYear();

    const isWeeklyLocked = !forceUnlock && settings?.focusGoals?.weeklyUpdatedAt &&
        isSameWeek(new Date(settings.focusGoals.weeklyUpdatedAt), new Date(), { weekStartsOn: settings.startOfWeek === 'monday' ? 1 : 0 });

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-serif">
                        <Target className="w-5 h-5 text-primary" />
                        Set Your Focus Goals
                    </DialogTitle>
                    <div className="sr-only">
                        <DialogDescription>
                            Set your monthly and weekly goals to keep your focus sharp.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Monthly Goal - Red Theme */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-red-600 dark:text-red-400 font-bold text-sm tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Monthly Goal
                            </div>
                            {/* Lock indicator */}
                            {isMonthlyLocked && (
                                <span className="text-[10px] bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 animate-in fade-in">
                                    Locked for this month
                                </span>
                            )}
                        </div>
                        <div className="relative group">
                            <Textarea
                                value={monthlyGoal}
                                onChange={(e) => setMonthlyGoal(e.target.value)}
                                placeholder="Example: Mastering Human Anatomy..."
                                disabled={!!isMonthlyLocked}
                                className="min-h-[100px] text-lg font-medium border-red-200 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900 resize-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            />
                            <div className="absolute top-0 right-0 w-1 h-full bg-red-500 rounded-r-md opacity-20 pointer-events-none" />
                        </div>
                    </div>

                    {/* Weekly Goal - Blue Theme */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 font-bold text-sm tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                Weekly Goal
                            </div>
                            {/* Lock indicator */}
                            {isWeeklyLocked && (
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 animate-in fade-in">
                                    Locked for this week
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Textarea
                                value={weeklyGoal}
                                onChange={(e) => setWeeklyGoal(e.target.value)}
                                placeholder="Example: 30 croquis per day..."
                                disabled={!!isWeeklyLocked}
                                className="min-h-[100px] text-lg font-medium border-blue-200 focus:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 resize-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            />
                            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-r-md opacity-20 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} className="min-w-[100px] font-bold">
                        Save Goals
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
