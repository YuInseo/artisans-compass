import { useState, useEffect, useMemo } from "react";
import { format, subDays, isSameDay } from "date-fns";

export function useOverviewStats(projects?: any[]) {
    const [monthlyData, setMonthlyData] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Fetch up to 365 days of data for the "All time" counts
    useEffect(() => {
        let isMounted = true;
        const fetchAllLogs = async () => {
            setIsLoading(true);
            const today = new Date();
            const monthsToFetch = new Set<string>();

            for (let i = 0; i <= 365; i++) {
                const date = subDays(today, i);
                monthsToFetch.add(format(date, 'yyyy-MM'));
            }

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
                setIsLoading(false);
            }
        };

        fetchAllLogs();
        return () => { isMounted = false; };
    }, []);

    const stats = useMemo(() => {
        const today = new Date();

        let allTimeTodos = 0;
        let allTimeCompleted = 0;
        let allTimePomos = 0;
        let allTimeFocus = 0;
        let allTimeDays = 0; // Days with any activity

        // Count across history
        Object.entries(monthlyData).forEach(([, log]: [string, any]) => {
            if (!log) return;

            let hasActivity = false;

            const seconds = log.stats?.totalWorkSeconds || 0;
            allTimeFocus += seconds;
            allTimePomos += Math.floor(seconds / (25 * 60)); // Proxy total pomos
            if (seconds > 0) hasActivity = true;

            // Count todos
            const todos = log.todos || [];
            if (log.projectTodos) {
                Object.values(log.projectTodos).forEach((arr: any) => todos.push(...arr));
            }
            if (todos.length > 0) hasActivity = true;

            allTimeTodos += todos.length;
            allTimeCompleted += todos.filter((t: any) => t.completed).length;

            if (hasActivity || log.stats?.questAchieved) {
                allTimeDays++;
            }
        });

        // 7 days for charts
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(today, 6 - i);
            const ds = format(d, 'yyyy-MM-dd');
            const log = monthlyData[ds];

            const seconds = log?.stats?.totalWorkSeconds || 0;
            const pomos = Math.floor(seconds / (25 * 60));

            const todos = log?.todos || [];
            if (log?.projectTodos) {
                Object.values(log.projectTodos).forEach((arr: any) => todos.push(...arr));
            }

            const total = todos.length;
            const completed = todos.filter((t: any) => t.completed).length;
            const completionRate = total > 0 ? (completed / total) * 100 : 0;

            const isTdy = isSameDay(d, today);

            return {
                date: d,
                label: isTdy ? '오늘' : format(d, 'd'),
                seconds,
                pomos,
                completed,
                completionRate
            };
        });

        const todayLog = last7Days[6];

        // Ensure "Lists" represents total projects conceptually
        const allTimeProjects = projects?.length || 0;

        // Let's compute a mock achievement score that goes up steadily based on days
        const baseScore = 3100;
        const achievementScore = baseScore + (allTimeDays * 5) + (allTimeCompleted * 2);

        // Score map for chart (let's show it slightly growing over the week)
        const scoreCurve = last7Days.map((d, i) => {
            const pastScore = achievementScore - ((6 - i) * 12) + (Math.random() * 5);
            return { label: d.label, value: Math.floor(pastScore) };
        });

        return {
            allTimeTodos,
            allTimeCompleted,
            allTimeProjects,
            allTimeDays,
            allTimePomos,
            allTimeFocus,
            todayCompleted: todayLog.completed,
            todayPomos: todayLog.pomos,
            todayFocusTime: todayLog.seconds,
            last7Days,
            achievementScore,
            scoreCurve
        };
    }, [monthlyData, projects]);

    return { isLoading, stats };
}
