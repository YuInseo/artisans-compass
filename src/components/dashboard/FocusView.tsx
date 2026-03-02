import { useState, useEffect, useMemo } from "react";
import { format, subDays, isSameDay, startOfWeek, endOfWeek, subWeeks, startOfMonth, subMonths, endOfMonth, eachDayOfInterval } from "date-fns";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { usePomodoroStore } from "@/hooks/usePomodoroStore";

interface FocusViewProps {
    className?: string;
    date: Date;
}

// Format helpers
const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

// SVG Donut Component (Reusable)
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

export function FocusView({ className, date }: FocusViewProps) {
    const { t } = useTranslation();
    const { getDailyLog } = useDataStore();

    const [donutPeriod, setDonutPeriod] = useState<'day' | 'week' | 'month'>('day');
    const [donutOffset, setDonutOffset] = useState<number>(0);
    const [donutCategoryBy, setDonutCategoryBy] = useState<'process' | 'project'>('process');
    const pomodoro = usePomodoroStore();

    const [monthlyData, setMonthlyData] = useState<Record<string, any>>({});
    const [todayData, setTodayData] = useState<any>(null);
    const [yesterdayData, setYesterdayData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch data for the last 365 days + selected date
    useEffect(() => {
        let isMounted = true;
        const fetchRecentLogs = async () => {
            setIsLoading(true);
            const today = new Date();
            const monthsToFetch = new Set<string>();

            // Collect months for the last 365 days
            for (let i = 0; i <= 365; i++) {
                const d = subDays(today, i);
                monthsToFetch.add(format(d, 'yyyy-MM'));
            }
            monthsToFetch.add(format(date, 'yyyy-MM')); // make sure selected date month is included

            const data: Record<string, any> = {};
            if ((window as any).ipcRenderer) {
                for (const ym of Array.from(monthsToFetch)) {
                    try {
                        const monthLog = await (window as any).ipcRenderer.invoke('get-monthly-log', ym);
                        Object.assign(data, monthLog);
                    } catch (e) {
                        console.error('Failed to fetch monthly log for', ym, e);
                    }
                }
            }

            if (isMounted) {
                setMonthlyData(data);

                // Set today/yest specific data
                const todayStr = format(date, 'yyyy-MM-dd');
                const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

                // Always try to fetch from store directly for the most current 'today' memory state if it's actually today
                const [todayLog, yesterdayLog] = await Promise.all([
                    getDailyLog(todayStr),
                    getDailyLog(yesterdayStr)
                ]);

                // Merge with monthly data if missing, preferring memory for today
                setTodayData(todayLog || data[todayStr] || {});
                setYesterdayData(yesterdayLog || data[yesterdayStr] || {});

                setIsLoading(false);
            }
        };

        fetchRecentLogs();
        return () => { isMounted = false; };
    }, [date, getDailyLog]);

    const stats = useMemo(() => {
        const isSelectedDateToday = isSameDay(date, new Date());

        // 1. Overview Stats
        const todayFocusTime = todayData?.stats?.totalWorkSeconds || 0;
        const yestFocusTime = yesterdayData?.stats?.totalWorkSeconds || 0;
        const focusTimeDiff = todayFocusTime - yestFocusTime;

        // Total Focus Time (All time parsed from monthlyData)
        let totalFocusAllTime = 0;
        Object.values(monthlyData).forEach((dayLog: any) => {
            if (dayLog?.stats?.totalWorkSeconds) {
                totalFocusAllTime += dayLog.stats.totalWorkSeconds;
            }
        });

        // Pomodoros. Note: The app currently stores completedPomodoros globally, not per day.
        // We will mock today's pomodoros for historical dates if it's not saved locally.
        // If it's today, we use the store. 
        const todayPomos = isSelectedDateToday ? pomodoro.completedPomodoros : (Math.floor(todayFocusTime / (25 * 60))); // fallback interpolation
        const yestPomos = Math.floor(yestFocusTime / (25 * 60)); // approximation since we lack historical pomo tracking
        const pomoDiff = todayPomos - yestPomos;

        // 2. Detailed Focus (Category Breakdown of Sessions)
        const detailedStatsMap: Record<string, number> = {};
        let donutTotalFocusTime = 0;

        const originDate = date; // Base offset off the currently selected date in the wrapper panel.
        let targetDates: Date[] = [];

        if (donutPeriod === 'day') {
            targetDates = [subDays(originDate, donutOffset)];
        } else if (donutPeriod === 'week') {
            const start = startOfWeek(subWeeks(originDate, donutOffset), { weekStartsOn: 1 });
            const end = endOfWeek(subWeeks(originDate, donutOffset), { weekStartsOn: 1 });
            targetDates = eachDayOfInterval({ start, end });
        } else if (donutPeriod === 'month') {
            const start = startOfMonth(subMonths(originDate, donutOffset));
            const end = endOfMonth(subMonths(originDate, donutOffset));
            targetDates = eachDayOfInterval({ start, end });
        }

        targetDates.forEach(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            const log = (isSameDay(d, date) && todayData) ? todayData : (isSameDay(d, subDays(date, 1)) && yesterdayData) ? yesterdayData : monthlyData[dStr];

            if (log?.sessions) {
                log.sessions.forEach((s: any) => {
                    const categoryName = s[donutCategoryBy] || 'Unknown';
                    const duration = s.durationSeconds ?? Math.round(s.duration || 0);
                    detailedStatsMap[categoryName] = (detailedStatsMap[categoryName] || 0) + duration;
                    donutTotalFocusTime += duration;
                });
            }
        });

        const detailedStats = Object.entries(detailedStatsMap).map(([name, value], index) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
            return {
                name,
                value,
                color: colors[index % colors.length]
            };
        }).sort((a, b) => b.value - a.value);

        // Compute Label for Donut
        let donutDateLabel = '';
        if (donutOffset === 0) {
            donutDateLabel = donutPeriod === 'day' ? '오늘' : donutPeriod === 'week' ? '이번 주' : '이번 달';
        } else {
            donutDateLabel = donutPeriod === 'day' ? format(targetDates[0], 'M월 d일')
                : donutPeriod === 'week' ? `${format(targetDates[0], 'M/d')} - ${format(targetDates[targetDates.length - 1], 'M/d')}`
                    : format(targetDates[0], 'yyyy년 M월');
        }

        // 3. Trend (Weekly Bar Chart)
        const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
            // Get last 7 days ending on the selected `date`
            const d = subDays(date, 6 - i);
            const dateStr = format(d, 'yyyy-MM-dd');
            // Prefer todayData if d is today, else monthlyData
            const dayLog = (isSameDay(d, date) && todayData) ? todayData : monthlyData[dateStr];

            const seconds = dayLog?.stats?.totalWorkSeconds || 0;
            return {
                date: d,
                label: format(d, 'eeeee'), // S, M, T, W, T, F, S
                hours: seconds / 3600
            };
        });

        const weeklyTrendTotal = weeklyTrend.reduce((sum, d) => sum + d.hours, 0);
        const weeklyTrendAvgHours = weeklyTrendTotal / 7;
        const trendAvgText = formatHours(weeklyTrendAvgHours * 3600);

        // 4. Timeline (Gantt Chart style blocks for the selected week)
        // Design shows X: Days (Mon-Sun), Y: Hours (00:00 - 24:00)
        // We will map each session directly to a block.
        const timelineData: { dayIndex: number; startHour: number; durationHours: number; tooltip: string }[] = [];

        Array.from({ length: 7 }).forEach((_, i) => {
            const d = subDays(date, 6 - i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayLog = (isSameDay(d, date) && todayData) ? todayData : monthlyData[dateStr];

            if (dayLog && dayLog.sessions) {
                dayLog.sessions.forEach((s: any) => {
                    const startTime = new Date(s.startTime || s.start);
                    if (isNaN(startTime.getTime())) return;

                    const durationSeconds = s.durationSeconds ?? Math.round(s.duration || 0);
                    if (durationSeconds <= 0) return;

                    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                    const durationHours = durationSeconds / 3600;

                    // Ensure it doesn't spill past midnight for the same day block
                    const displayDuration = Math.min(durationHours, 24 - startHour);

                    if (displayDuration > 0) {
                        timelineData.push({
                            dayIndex: i, // 0 to 6
                            startHour,
                            durationHours: displayDuration,
                            tooltip: `${format(startTime, 'HH:mm')} - ${Math.round(durationSeconds / 60)}m, ${s.process || 'Focus'}`
                        });
                    }
                });
            }
        });

        // 5. Optimal Focus Time (Sum of last 30 days by hour)
        const optimalData = new Array(24).fill(0);
        Array.from({ length: 30 }).forEach((_, i) => {
            const d = subDays(date, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayLog = (isSameDay(d, date) && todayData) ? todayData : monthlyData[dateStr];

            if (dayLog && dayLog.sessions) {
                dayLog.sessions.forEach((s: any) => {
                    const startTime = new Date(s.startTime || s.start);
                    const hour = isNaN(startTime.getTime()) ? 0 : startTime.getHours();
                    const duration = s.durationSeconds ?? Math.round(s.duration || 0);
                    optimalData[hour] += duration; // sum up seconds per hour
                });
            }
        });

        let bestHour = 0;
        let maxOptimalFocus = 0;
        optimalData.forEach((val, i) => {
            if (val > maxOptimalFocus) {
                maxOptimalFocus = val;
                bestHour = i;
            }
        });

        // 6. Yearly Grid (Contribution Map)
        // [ { date, intensity (0-4), tooltip } ] based on last 364 days (52 weeks * 7 days)
        const yearlyData: { date: Date, intensity: number, tooltip: string }[] = [];
        const endDate = new Date(date);
        let maxDailyYearly = 1; // to avoid div by zero

        // Find max to scale intensities correctly
        for (let i = 0; i < 364; i++) {
            const d = subDays(endDate, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayLog = (isSameDay(d, date) && todayData) ? todayData : (isSameDay(d, subDays(date, 1)) && yesterdayData) ? yesterdayData : monthlyData[dateStr];
            const secs = dayLog?.stats?.totalWorkSeconds || 0;
            if (secs > maxDailyYearly) {
                maxDailyYearly = secs;
            }
        }

        // We want a 52 column x 7 row grid.
        // It flows top to bottom, left to right.
        // So index 0 = 364 days ago (start of grid)
        for (let i = 0; i < 364; i++) {
            // Go backwards from 363 days ago to today to build left-to-right grid
            const d = subDays(endDate, 363 - i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayLog = (isSameDay(d, date) && todayData) ? todayData : (isSameDay(d, subDays(date, 1)) && yesterdayData) ? yesterdayData : monthlyData[dateStr];

            let focusSeconds = dayLog?.stats?.totalWorkSeconds || 0;

            // Intensity bucket 0-4
            let intensity = 0;
            if (focusSeconds > 0) {
                // Typical max threshold for intense color: either max recorded or 8 hours
                const clampMax = Math.min(Math.max(28800, maxDailyYearly), 28800 * 1.5);
                const ratio = focusSeconds / clampMax;
                if (ratio < 0.25) intensity = 1;
                else if (ratio < 0.5) intensity = 2;
                else if (ratio < 0.75) intensity = 3;
                else intensity = 4;
            }

            yearlyData.push({
                date: d,
                intensity,
                tooltip: `${format(d, 'M/d')}: ${formatHours(focusSeconds)}`
            });
        }

        return {
            todayFocusTime,
            yestFocusTime,
            focusTimeDiff,
            totalFocusAllTime,
            todayPomos,
            totalPomos: pomodoro.completedPomodoros + Math.floor(totalFocusAllTime / (25 * 60)), // mock total pomo for now
            pomoDiff,
            detailedStats,
            donutTotalFocusTime,
            donutDateLabel,
            weeklyTrend,
            trendAvgText,
            timelineData,
            optimalData,
            bestHour,
            yearlyData
        };
    }, [date, todayData, yesterdayData, monthlyData, pomodoro.completedPomodoros, donutPeriod, donutOffset, donutCategoryBy]);


    if (isLoading) {
        return (
            <div className={cn("w-full h-full flex items-center justify-center p-8", className)}>
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 rounded w-48 bg-muted mb-4"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full h-full p-6 md:p-8 overflow-y-auto custom-scrollbar bg-background text-foreground font-sans", className)}>
            <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-20">

                {/* ---------- ROW 1: Overview ---------- */}
                <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:bg-card/60 transition-colors">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/90 mb-6">{t('statistics.overview', '개요')}</h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 h-full pb-2">
                        {/* Today Pomos */}
                        <div className="flex flex-col items-center justify-center border-r border-border/10">
                            <span className="text-4xl lg:text-5xl font-bold tracking-tighter text-foreground mb-1">
                                {stats.todayPomos}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium mb-2 mt-1">
                                오늘의 포모
                            </span>
                            <div className={cn("flex items-center text-[11px] font-semibold",
                                stats.pomoDiff > 0 ? "text-emerald-500" : stats.pomoDiff < 0 ? "text-rose-500" : "text-muted-foreground"
                            )}>
                                <span className="mr-1 text-muted-foreground/50 font-medium">어제의 {stats.todayPomos - stats.pomoDiff}</span>
                                {stats.pomoDiff > 0 ? <ArrowUp className="w-2.5 h-2.5 ml-0.5" /> : stats.pomoDiff < 0 ? <ArrowDown className="w-2.5 h-2.5 ml-0.5" /> : <Minus className="w-2.5 h-2.5 ml-0.5 opacity-50" />}
                            </div>
                        </div>

                        {/* Total Pomos */}
                        <div className="flex flex-col items-center justify-center md:border-r border-border/10">
                            <span className="text-4xl lg:text-5xl font-bold tracking-tighter text-foreground mb-1">
                                {stats.totalPomos}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium mb-2 mt-1">
                                토탈 포모스
                            </span>
                        </div>

                        {/* Today Focus */}
                        <div className="flex flex-col items-center justify-center border-r border-border/10">
                            <span className="text-3xl lg:text-4xl font-bold tracking-tighter text-foreground mb-1 flex items-baseline gap-0.5">
                                {Math.floor(stats.todayFocusTime / 3600)}<span className="text-lg lg:text-xl font-medium tracking-normal opacity-80">h</span>
                                {Math.floor((stats.todayFocusTime % 3600) / 60)}<span className="text-lg lg:text-xl font-medium tracking-normal opacity-80">m</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium mb-2 mt-1">
                                오늘의 포커스
                            </span>
                            <div className={cn("flex items-center text-[11px] font-semibold",
                                stats.focusTimeDiff > 0 ? "text-emerald-500" : stats.focusTimeDiff < 0 ? "text-rose-500" : "text-muted-foreground"
                            )}>
                                <span className="mr-1 text-muted-foreground/50 font-medium">어제의 {formatHours(stats.yestFocusTime)}</span>
                                {stats.focusTimeDiff > 0 ? <ArrowUp className="w-2.5 h-2.5 ml-0.5" /> : stats.focusTimeDiff < 0 ? <ArrowDown className="w-2.5 h-2.5 ml-0.5" /> : <Minus className="w-2.5 h-2.5 ml-0.5 opacity-50" />}
                            </div>
                        </div>

                        {/* Total Focus */}
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-3xl lg:text-4xl font-bold tracking-tighter text-foreground mb-1 flex items-baseline gap-0.5">
                                {Math.floor(stats.totalFocusAllTime / 3600)}<span className="text-lg lg:text-xl font-medium tracking-normal opacity-80">h</span>
                                {Math.floor((stats.totalFocusAllTime % 3600) / 60)}<span className="text-lg lg:text-xl font-medium tracking-normal opacity-80">m</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium mb-2 mt-1">
                                총 집중 시간
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---------- ROW 2: Detailed Focus & Focus Log ---------- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Detailed Focus (Donut) */}
                    <div className="lg:col-span-2 bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors">
                        <div className="flex items-center justify-between w-full mb-6 relative z-30">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">세부 사항에 집중하세요.</h3>
                            <div className="flex gap-2 relative">
                                <div className="relative flex items-center rounded-sm border border-border/10 hover:bg-muted/10 cursor-pointer overflow-hidden px-2">
                                    <select value={donutCategoryBy} onChange={e => setDonutCategoryBy(e.target.value as any)} className="bg-transparent text-xs text-muted-foreground/60 outline-none appearance-none pr-3 relative cursor-pointer z-10 w-full">
                                        <option value="process" className="bg-popover text-popover-foreground">앱</option>
                                        <option value="project" className="bg-popover text-popover-foreground">리스트</option>
                                    </select>
                                    <span className="pointer-events-none absolute right-1 text-[8px] text-muted-foreground/60 z-0">∨</span>
                                </div>
                                <div className="relative flex items-center rounded-sm border border-border/10 hover:bg-muted/10 cursor-pointer overflow-hidden px-2">
                                    <select value={donutPeriod} onChange={e => { setDonutPeriod(e.target.value as any); setDonutOffset(0); }} className="bg-transparent text-xs text-muted-foreground/60 outline-none appearance-none pr-3 relative cursor-pointer z-10 w-full">
                                        <option value="day" className="bg-popover text-popover-foreground">일</option>
                                        <option value="week" className="bg-popover text-popover-foreground">주</option>
                                        <option value="month" className="bg-popover text-popover-foreground">월</option>
                                    </select>
                                    <span className="pointer-events-none absolute right-1 text-[8px] text-muted-foreground/60 z-0">∨</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/10">
                                    <button onClick={() => setDonutOffset(prev => prev + 1)} className="hover:text-foreground relative z-10">&lt;</button>
                                    <span className="text-foreground/80 font-medium px-1 min-w-[34px] text-center">{stats.donutDateLabel}</span>
                                    <button onClick={() => setDonutOffset(prev => Math.max(0, prev - 1))} className={cn("hover:text-foreground relative z-10", donutOffset === 0 && "opacity-30 pointer-events-none")}>&gt;</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center min-h-[160px] gap-8">
                            <DonutChart data={stats.detailedStats} size={200} strokeWidth={20} />

                            {/* Legend */}
                            {stats.detailedStats.length > 0 && (
                                <div className="flex flex-col justify-start max-w-[200px] w-full max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="flex flex-col gap-3 w-full">
                                        {stats.detailedStats.map((cat, i) => (
                                            <div key={i} className="flex flex-col gap-1 w-full">
                                                <div className="flex items-center justify-between text-xs font-medium">
                                                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                                                        <span className="text-muted-foreground truncate">{cat.name}</span>
                                                    </div>
                                                    <span className="text-foreground/80 whitespace-nowrap">{formatHours(cat.value)}</span>
                                                </div>
                                                <div className="w-full bg-muted/20 h-1.5 rounded-full overflow-hidden shrink-0">
                                                    <div className="h-full rounded-full" style={{ width: `${(cat.value / Math.max(stats.donutTotalFocusTime, 1)) * 100}%`, backgroundColor: cat.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Focus Log */}
                    <div className="lg:col-span-1 bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col max-h-[400px] hover:bg-card/60 transition-colors">
                        <div className="flex items-center justify-between w-full mb-6 relative shrink-0">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">집중 기록</h3>
                            <div className="flex gap-2 text-muted-foreground/60">
                                <button className="hover:text-foreground">+</button>
                                <button className="hover:text-foreground">···</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
                            {todayData?.sessions && todayData.sessions.length > 0 ? (
                                <div>
                                    <div className="text-xs font-bold text-muted-foreground mb-3">{format(date, 'M월 d일')}</div>
                                    {todayData.sessions.slice().reverse().map((session: any, index: number) => {
                                        const startTime = new Date(session.startTime || session.start);
                                        const endTime = new Date(session.endTime || session.end);
                                        const validStart = !isNaN(startTime.getTime());
                                        const validEnd = !isNaN(endTime.getTime());
                                        const startTimeStr = validStart ? format(startTime, 'HH:mm') : '--:--';
                                        const endTimeStr = validEnd ? format(endTime, 'HH:mm') : '--:--';
                                        const duration = session.durationSeconds ?? Math.round(session.duration || 0);
                                        const mins = Math.round(duration / 60);

                                        return (
                                            <div key={index} className="pl-4 border-l-2 border-border/30 relative pb-4 last:pb-0 pt-1 group">
                                                <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full -left-[6px] top-2 ring-4 ring-background transition-transform group-hover:scale-110"></div>
                                                <div className="flex justify-between items-start mb-1 leading-none">
                                                    <span className="text-[11px] font-medium text-muted-foreground/80">{startTimeStr} - {endTimeStr}</span>
                                                    <span className="text-[11px] text-muted-foreground/60">{mins}m</span>
                                                </div>
                                                <div className="text-sm font-medium text-foreground/90 mt-1">{session.process || "Unknown Area"}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                                        <span className="text-xl">☕</span>
                                    </div>
                                    <span className="text-xs font-medium">기록된 집중 세션이 없습니다.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ---------- ROW 3: Trend & Timeline ---------- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Trend (Weekly Bar Chart) */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px] hover:bg-card/60 transition-colors">
                        <div className="flex items-center justify-between w-full mb-1">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">트렌드</h3>
                            <div className="flex gap-2 text-muted-foreground/60">
                                <span className="text-xs px-2 flex items-center rounded-sm border border-border/10 hover:bg-muted/10 cursor-pointer">주 ∨</span>
                                <div className="flex items-center gap-2 text-xs px-2 py-0.5 rounded-sm border border-border/10">
                                    <button className="hover:text-foreground">&lt;</button>
                                    <span className="text-foreground/80 font-medium">이번 주</span>
                                    <button className="hover:text-foreground">&gt;</button>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-6">일일 평균: {stats.trendAvgText}</p>

                        <div className="flex-1 flex flex-col justify-end pt-4 pb-2 w-full">
                            <div className="flex flex-1 items-end justify-between gap-2 h-full relative">
                                {/* Mock Grid lines behind bars */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
                                    <div className="w-full border-t border-dashed border-border/20"></div>
                                    <div className="w-full border-t border-dashed border-border/20"></div>
                                    <div className="w-full border-t border-dashed border-border/20"></div>
                                    <div className="w-full border-t border-dashed border-border/20"></div>
                                </div>

                                {stats.weeklyTrend.map((day, i) => {
                                    const maxWeeklyHour = Math.max(0.1, ...stats.weeklyTrend.map(d => d.hours));
                                    const heightPercent = Math.max(2, (day.hours / maxWeeklyHour) * 100);
                                    const isSelected = isSameDay(day.date, date);
                                    const isToday = isSameDay(day.date, new Date());

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group z-10 h-full justify-end">
                                            <div className="w-full max-w-[32px] md:max-w-[48px] relative flex items-end justify-center rounded-md bg-transparent h-full mx-auto">
                                                <div
                                                    className={cn(
                                                        "w-full rounded-md transition-all duration-500 cursor-pointer",
                                                        isSelected ? "bg-blue-500" : "bg-muted/30 group-hover:bg-blue-500/50",
                                                        isToday ? "bg-emerald-500 hover:bg-emerald-400" : "bg-blue-500/80 hover:bg-blue-400"
                                                    )}
                                                    style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                                                >
                                                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-10 shadow-md">
                                                        {formatHours(day.hours * 3600)}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={cn(
                                                "text-xs font-medium",
                                                isSelected ? "text-foreground" : "text-muted-foreground/60"
                                            )}>
                                                {['일', '월', '화', '수', '목', '금', '토'][day.date.getDay()]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Timeline (X/Y Scatter/Heatmap) */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px] hover:bg-card/60 transition-colors">
                        <div className="flex items-center justify-between w-full mb-6 relative z-10">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">타임라인</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/10">
                                <button className="hover:text-foreground">&lt;</button>
                                <span className="text-foreground/80 font-medium">이번 주</span>
                                <button className="hover:text-foreground">&gt;</button>
                            </div>
                        </div>

                        {/* the grid area */}
                        <div className="flex-1 relative flex min-h-[180px] w-full">
                            {/* Y-axis Labels (00:00, 04:00, 08:00...) */}
                            <div className="w-12 shrink-0 flex flex-col justify-between text-[10px] text-muted-foreground/50 pb-6 pr-2 text-right">
                                <span>00:00</span>
                                <span>04:00</span>
                                <span>08:00</span>
                                <span>12:00</span>
                                <span>16:00</span>
                                <span>20:00</span>
                            </div>

                            <div className="flex-1 relative pb-6 border-l border-b border-border/30 w-full">
                                {/* Horizontal Grid lines (00:00, 04:00, 08:00, 12:00, 16:00, 20:00) */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {[0, 4, 8, 12, 16, 20].map((hour) => (
                                        <div
                                            key={hour}
                                            className="absolute w-full border-t border-dashed border-border/10"
                                            style={{ top: `${(hour / 24) * 100}%` }}
                                        />
                                    ))}
                                </div>

                                {/* Data blocks */}
                                {stats.timelineData.map((pt, i) => {
                                    // Day index goes 0-6. The columns are evenly spaced.
                                    // The Day labels are in a flex box with justify-between.
                                    const leftPercent = (pt.dayIndex / 7) * 100;
                                    const widthPercent = (1 / 7) * 100;
                                    const topPercent = (pt.startHour / 24) * 100;
                                    const heightPercent = Math.max(0.5, (pt.durationHours / 24) * 100);

                                    return (
                                        <div
                                            key={i}
                                            className="absolute group z-10 flex justify-center"
                                            style={{
                                                left: `${leftPercent}%`,
                                                width: `${widthPercent}%`,
                                                top: `${topPercent}%`,
                                                height: `${heightPercent}%`
                                            }}
                                        >
                                            <div className="w-[60%] h-full bg-[#C6D2FD] hover:bg-[#A9BBFF] transition-all cursor-pointer"></div>

                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-20 shadow-md">
                                                {pt.tooltip}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* X-axis Labels (Mon, Tue...) */}
                                <div className="absolute top-full left-0 right-0 flex justify-between pt-2 text-[10px] text-muted-foreground/60 font-medium">
                                    {stats.weeklyTrend.map((day, i) => (
                                        <div key={i} className="flex-1 text-center">
                                            {['일', '월', '화', '수', '목', '금', '토'][day.date.getDay()]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ---------- ROW 4: Optimal Focus Time & Yearly Grid ---------- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Optimal Focus Time (24h Bar Chart) */}
                <div className="lg:col-span-1 bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px] hover:bg-card/60 transition-colors">
                    <div className="flex items-center justify-between w-full mb-1">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground/90">최적의 집중 시간</h3>
                        <button className="text-muted-foreground/60 hover:text-foreground">···</button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-6">최고 시간: <span className="font-medium text-foreground">{stats.bestHour}:00</span></p>

                    <div className="flex-1 flex items-end justify-between gap-0.5 min-h-[160px] relative pt-2 pb-6">
                        {stats.optimalData.map((val, i) => {
                            const maxVal = Math.max(0.1, ...stats.optimalData);
                            const heightPercent = Math.max(1, (val / maxVal) * 100);
                            const isBest = i === stats.bestHour && val > 0;

                            return (
                                <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end group">
                                    <div className="w-full relative flex md:items-end justify-center rounded-sm h-full">
                                        <div
                                            className={cn(
                                                "w-1.5 md:w-full rounded-sm transition-all duration-500 cursor-pointer",
                                                isBest ? "bg-emerald-500" : "bg-blue-500/40 group-hover:bg-blue-500/70"
                                            )}
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-10 shadow-md">
                                            {i}:00<br />{Math.round(val / 60)}m avg
                                        </div>
                                    </div>
                                    {(i === 0 || i === 6 || i === 12 || i === 18) && (
                                        <span className="text-[10px] font-medium text-muted-foreground/60 absolute -bottom-6 left-1/2 -translate-x-1/2">
                                            {i}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Yearly Grid (Contribution Map) */}
                <div className="lg:col-span-2 bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px] hover:bg-card/60 transition-colors">
                    <div className="flex items-center justify-between w-full mb-6">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground/90">연간 그리드</h3>
                        <div className="flex gap-2">
                            <span className="text-xs text-muted-foreground/60 px-2 flex items-center rounded-sm border border-border/10 hover:bg-muted/10 cursor-pointer">1년 ∨</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center min-h-[180px]">
                        {/* Scrollable container for grid */}
                        <div className="overflow-x-auto custom-scrollbar pb-2">
                            <div className="inline-block pr-6 pt-2">
                                <div className="grid grid-flow-col grid-rows-7 gap-1 w-max">
                                    {/* Offset filler blocks so that the first day aligns with its correct day of week */}
                                    {Array.from({ length: stats.yearlyData.length > 0 ? Object.assign(new Date(stats.yearlyData[0].date)).getDay() : 0 }).map((_, i) => (
                                        <div key={`filler-${i}`} className="w-3 h-3 transparent pointer-events-none" />
                                    ))}
                                    {stats.yearlyData.map((day, i) => {
                                        const bgClass = [
                                            "bg-muted/10 border-border/5", // 0
                                            "bg-blue-500/20 border-blue-500/20", // 1
                                            "bg-blue-500/40 border-blue-500/40", // 2
                                            "bg-blue-500/70 border-blue-500/70", // 3
                                            "bg-blue-500 border-blue-500", // 4
                                        ][day.intensity];

                                        return (
                                            <div
                                                key={i}
                                                className={cn("w-3 h-3 rounded-sm border group relative transition-colors cursor-pointer", bgClass)}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-10 shadow-md">
                                                    {day.tooltip}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground/60 mt-4">
                            <span>Less</span>
                            <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-sm bg-muted/10"></div>
                                <div className="w-3 h-3 rounded-sm bg-blue-500/20"></div>
                                <div className="w-3 h-3 rounded-sm bg-blue-500/40"></div>
                                <div className="w-3 h-3 rounded-sm bg-blue-500/70"></div>
                                <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                            </div>
                            <span>More</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
