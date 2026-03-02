import { useState, useEffect, useMemo } from "react";
import { format, subDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Todo } from "@/types";

interface TasksViewProps {
    className?: string;
    date: Date;
}

// Helper to count total and completed tasks
const countTasks = (projectTodos?: Record<string, Todo[]>, legacyTodos?: Todo[]) => {
    let total = 0;
    let completed = 0;

    const countRecursive = (todos: Todo[]) => {
        todos.forEach(t => {
            total++;
            if (t.completed) completed++;
            if (t.children && t.children.length > 0) countRecursive(t.children);
        });
    };

    if (projectTodos) {
        Object.values(projectTodos).forEach(todos => countRecursive(todos));
    }
    if (legacyTodos && (!projectTodos || Object.keys(projectTodos).length === 0)) {
        countRecursive(legacyTodos);
    }

    return { total, completed };
};

const getCategoryStats = (projectTodos?: Record<string, Todo[]>, projects?: any[]) => {
    const stats: { name: string; value: number; color: string }[] = [];
    if (!projectTodos) return stats;

    Object.entries(projectTodos).forEach(([projectId, todos]) => {
        let completed = 0;
        const countRecursive = (ts: Todo[]) => {
            ts.forEach(t => {
                if (t.completed) completed++;
                if (t.children && t.children.length > 0) countRecursive(t.children);
            });
        };
        countRecursive(todos);

        if (completed > 0) {
            const project = projects?.find(p => p.id === projectId);
            stats.push({
                name: project?.name || 'Uncategorized',
                value: completed,
                color: project?.color || '#8884d8'
            });
        }
    });

    return stats.sort((a, b) => b.value - a.value);
};

// SVG Donut Component
function DonutChart({ data, size = 160, strokeWidth = 15, emptyText = "데이터 없음" }: { data: { name: string; value: number; color: string }[], size?: number, strokeWidth?: number, emptyText?: string }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let currentOffset = 0;

    if (total === 0) {
        return (
            <div className="relative flex items-center justify-center font-sans tracking-tight" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-muted-foreground/10"
                    />
                </svg>
                <span className="absolute text-muted-foreground text-sm font-medium">{emptyText}</span>
            </div>
        );
    }

    return (
        <div className="relative flex items-center justify-center font-sans" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background Empty Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted-foreground/10"
                />

                {data.map((item, index) => {
                    const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
                    const strokeDashoffset = -currentOffset;
                    currentOffset += (item.value / total) * circumference;

                    return (
                        <circle
                            key={index}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap={data.length === 1 ? "round" : "butt"}
                            className="transition-all duration-500 ease-in-out"
                        />
                    );
                })}
            </svg>
        </div>
    );
}


export function TasksView({ className, date }: TasksViewProps) {
    const { t } = useTranslation();
    const { getDailyLog, projects } = useDataStore();
    const [todayData, setTodayData] = useState<any>(null);
    const [yesterdayData, setYesterdayData] = useState<any>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            const todayStr = format(date, 'yyyy-MM-dd');
            const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

            const [todayLog, yesterdayLog] = await Promise.all([
                getDailyLog(todayStr),
                getDailyLog(yesterdayStr)
            ]);

            setTodayData(todayLog || {});
            setYesterdayData(yesterdayLog || {});
        };

        fetchLogs();
    }, [date, getDailyLog]);

    const stats = useMemo(() => {
        const todayStats = countTasks(todayData?.projectTodos, todayData?.todos);
        const yestStats = countTasks(yesterdayData?.projectTodos, yesterdayData?.todos);

        const todayRate = todayStats.total > 0 ? Math.round((todayStats.completed / todayStats.total) * 100) : 0;
        const yestRate = yestStats.total > 0 ? Math.round((yestStats.completed / yestStats.total) * 100) : 0;

        const rateDiff = todayRate - yestRate;
        const compDiff = todayStats.completed - yestStats.completed;

        const categoryStats = getCategoryStats(todayData?.projectTodos, projects);

        // Completion Distribution
        const distStats = [
            { name: 'Completed', value: todayStats.completed, color: '#3b82f6' }, // Blue
            { name: 'Pending', value: todayStats.total - todayStats.completed, color: '#4b5563' } // Gray
        ].filter(s => s.value > 0);

        return {
            today: todayStats,
            todayRate,
            yesterday: yestStats,
            yestRate,
            rateDiff,
            compDiff,
            categoryStats,
            distStats
        };
    }, [todayData, yesterdayData, projects]);


    return (
        <div className={cn("w-full h-full p-6 md:p-8 overflow-y-auto custom-scrollbar bg-background text-foreground", className)}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 auto-rows-min max-w-6xl mx-auto">

                {/* 1. Overview Card */}
                <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:bg-card/60 transition-colors">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/80 mb-6">{t('statistics.overview', '개요')}</h3>

                    <div className="flex items-center justify-center h-full pb-4">
                        {/* Completed Count */}
                        <div className="flex-1 flex flex-col items-center justify-center border-r border-border/30">
                            <span className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground mb-1">
                                {stats.today.completed}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2 mt-1">
                                완료된 작업
                            </span>
                            <div className={cn("flex items-center text-xs font-semibold",
                                stats.compDiff > 0 ? "text-emerald-500" : stats.compDiff < 0 ? "text-rose-500" : "text-muted-foreground"
                            )}>
                                <span className="mr-1 text-muted-foreground/60 font-medium">어제의 {stats.yesterday.completed}</span>
                                {stats.compDiff > 0 ? <ArrowUp className="w-3 h-3 ml-0.5" /> : stats.compDiff < 0 ? <ArrowDown className="w-3 h-3 ml-0.5" /> : <Minus className="w-3 h-3 ml-0.5 opacity-50" />}
                            </div>
                        </div>

                        {/* Completion Rate */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <span className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground mb-1">
                                {stats.todayRate}%
                            </span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2 mt-1">
                                완료율
                            </span>
                            <div className={cn("flex items-center text-xs font-semibold",
                                stats.rateDiff > 0 ? "text-emerald-500" : stats.rateDiff < 0 ? "text-rose-500" : "text-muted-foreground"
                            )}>
                                <span className="mr-1 text-muted-foreground/60 font-medium">어제의 {stats.yestRate}%</span>
                                {stats.rateDiff > 0 ? <ArrowUp className="w-3 h-3 ml-0.5" /> : stats.rateDiff < 0 ? <ArrowDown className="w-3 h-3 ml-0.5" /> : <Minus className="w-3 h-3 ml-0.5 opacity-50" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Completion Distribution Card */}
                <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center hover:bg-card/60 transition-colors">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/80 w-full mb-2">완료율 분포</h3>
                    <div className="flex-1 flex items-center justify-center w-full min-h-[220px]">
                        <DonutChart data={stats.distStats} size={200} strokeWidth={18} />
                    </div>
                </div>

                {/* 3. Category Stats Card (Full width on small screens) */}
                <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm md:col-span-2 lg:col-span-1 lg:max-w-xl flex flex-col hover:bg-card/60 transition-colors">
                    <div className="flex items-center justify-between w-full mb-4">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground/80">분류 완료 통계</h3>
                        <div className="text-xs text-muted-foreground/60 px-2 py-1 rounded-sm border border-border/30">리스트 ∨</div>
                    </div>

                    <div className="flex-1 flex items-center justify-center min-h-[220px]">
                        <DonutChart data={stats.categoryStats} size={200} strokeWidth={18} />
                    </div>
                    {/* Optional Ledger/Legend */}
                    {stats.categoryStats.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3 justify-center">
                            {stats.categoryStats.map((cat, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                                    <span className="text-muted-foreground truncate max-w-[100px]">{cat.name} ({cat.value})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
