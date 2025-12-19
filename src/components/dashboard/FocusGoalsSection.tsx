import { useDataStore } from "@/hooks/useDataStore";

export function FocusGoalsSection() {
    const { settings } = useDataStore();
    const monthlyGoal = settings?.focusGoals?.monthly || "";
    const weeklyGoal = settings?.focusGoals?.weekly || "";

    return (
        <div className="flex w-full h-full gap-4 p-4 bg-background/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Monthly Goal Zone - Left (Amber/Gold for Vision) */}
            <div className="flex-1 flex flex-col gap-2 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all shadow-sm group">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Monthly Goal
                </div>
                <div className="flex-1 text-2xl md:text-3xl font-bold font-serif text-amber-900/80 dark:text-amber-100/90 leading-tight whitespace-pre-wrap overflow-y-auto custom-scrollbar">
                    {monthlyGoal || <span className="text-amber-500/20 italic">No monthly goal set...</span>}
                </div>
            </div>

            {/* Weekly Goal Zone - Right (Sky/Cyan for Clarity) */}
            <div className="flex-1 flex flex-col gap-2 p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 transition-all shadow-sm group">
                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                    Weekly Goal
                </div>
                <div className="flex-1 text-2xl md:text-3xl font-bold font-serif text-sky-900/80 dark:text-sky-100/90 leading-tight whitespace-pre-wrap overflow-y-auto custom-scrollbar">
                    {weeklyGoal || <span className="text-sky-500/20 italic">No weekly goal set...</span>}
                </div>
            </div>
        </div>
    );
}
