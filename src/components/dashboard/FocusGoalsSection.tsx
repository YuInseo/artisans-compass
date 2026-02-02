import { useDataStore } from "@/hooks/useDataStore";
import { useTranslation } from "react-i18next";

export function FocusGoalsSection() {
    const { t } = useTranslation();
    const { settings } = useDataStore();
    const monthlyGoal = settings?.focusGoals?.monthly || "";
    const weeklyGoal = settings?.focusGoals?.weekly || "";

    return (
        <div className="flex w-full h-full gap-4 p-4 bg-background/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Monthly Goal Zone - Left (Red Content) */}
            <div className="flex-1 flex flex-col gap-2 p-4 rounded-xl border border-red-500/30 transition-all shadow-sm group hover:border-red-500/60">
                <div className="text-xs font-bold text-red-400/80 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    {t('dashboard.monthlyGoal')}
                </div>
                <div className="flex-1 text-2xl md:text-3xl font-bold text-red-500 leading-tight whitespace-pre-wrap overflow-y-auto custom-scrollbar break-keep">
                    {monthlyGoal || <span className="text-red-500/30 italic">{t('dashboard.noMonthlyGoalSet')}</span>}
                </div>
            </div>

            {/* Weekly Goal Zone - Right (Blue Content) */}
            <div className="flex-1 flex flex-col gap-2 p-4 rounded-xl border border-blue-500/30 transition-all shadow-sm group hover:border-blue-500/60">
                <div className="text-xs font-bold text-blue-400/80 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    {t('dashboard.weeklyGoal')}
                </div>
                <div className="flex-1 text-2xl md:text-3xl font-bold text-blue-500 leading-tight whitespace-pre-wrap overflow-y-auto custom-scrollbar break-keep">
                    {weeklyGoal || <span className="text-blue-500/30 italic">{t('dashboard.noWeeklyGoalSet')}</span>}
                </div>
            </div>
        </div>
    );
}
