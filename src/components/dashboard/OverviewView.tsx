import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { useOverviewStats } from "./hooks/useOverviewStats";
import { SmoothAreaChart, SimpleBarChart } from "./overview/OverviewCharts";

interface OverviewViewProps {
    className?: string;
}

export function OverviewView({ className }: OverviewViewProps) {
    const { projects } = useDataStore();
    const { isLoading, stats } = useOverviewStats(projects);

    if (isLoading) {
        return (
            <div className={cn("w-full h-full flex flex-col gap-6 p-8 items-center justify-center bg-background", className)}>
                <div className="animate-pulse h-8 rounded w-48 bg-muted mb-4"></div>
                <div className="animate-pulse h-64 rounded-xl w-full max-w-4xl bg-muted/60"></div>
            </div>
        );
    }

    const chartColor = "#3b82f6"; // Blue matching screenshot

    return (
        <div className={cn("w-full h-full p-6 md:p-8 overflow-y-auto custom-scrollbar bg-background text-foreground font-sans", className)}>
            <div className="flex flex-col gap-6 max-w-[1240px] mx-auto pb-20">

                {/* 1. Header Info Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between w-full pb-2 mb-2 border-b border-border/20 text-xs font-semibold gap-4">
                    <div className="flex items-center gap-5 text-muted-foreground/60 w-full overflow-x-auto whitespace-nowrap custom-scrollbar pb-1">
                        <span className="flex items-center gap-1.5"><strong className="text-foreground text-sm tracking-tight">{stats.allTimeTodos}</strong> 할일</span>
                        <span className="flex items-center gap-1.5"><strong className="text-foreground text-sm tracking-tight">{stats.allTimeCompleted}</strong> 완료</span>
                        <span className="flex items-center gap-1.5"><strong className="text-foreground text-sm tracking-tight">{stats.allTimeProjects}</strong> 리스트</span>
                        <span className="flex items-center gap-1.5"><strong className="text-foreground text-sm tracking-tight">{stats.allTimeDays}</strong> 날들</span>
                    </div>
                </div>

                {/* 2. Grid Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">

                    {/* Overview Card */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground/90 mb-4">개요</h3>

                        <div className="flex-1 grid grid-cols-3 grid-rows-2 h-full">
                            <div className="flex flex-col items-center justify-center border-r border-border/10 border-b border-border/10 pb-4 relative">
                                <span className="text-3xl lg:text-4xl font-bold tracking-tighter text-blue-500 mb-1">{stats.todayCompleted}</span>
                                <span className="text-[11px] text-muted-foreground font-medium">오늘의 완료</span>
                            </div>
                            <div className="flex flex-col items-center justify-center border-r border-border/10 border-b border-border/10 pb-4 relative">
                                <span className="text-3xl lg:text-4xl font-bold tracking-tighter text-blue-500 mb-1">{stats.todayPomos}</span>
                                <span className="text-[11px] text-muted-foreground font-medium">오늘의 포모</span>
                            </div>
                            <div className="flex flex-col items-center justify-center border-b border-border/10 pb-4 relative">
                                <span className="text-3xl lg:text-4xl font-bold tracking-tighter text-blue-500 mb-1 flex items-baseline gap-0.5">
                                    {Math.floor(stats.todayFocusTime / 3600)}<span className="text-sm font-medium opacity-80">h</span>
                                    {Math.floor((stats.todayFocusTime % 3600) / 60)}<span className="text-sm font-medium opacity-80">m</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium">오늘의 포커스</span>
                            </div>

                            <div className="flex flex-col items-center justify-center border-r border-border/10 pt-4 relative">
                                <span className="text-2xl lg:text-3xl font-bold tracking-tighter text-blue-500 mb-1">{stats.allTimeCompleted}</span>
                                <span className="text-[11px] text-muted-foreground font-medium">전체 완료</span>
                            </div>
                            <div className="flex flex-col items-center justify-center border-r border-border/10 pt-4 relative">
                                <span className="text-2xl lg:text-3xl font-bold tracking-tighter text-blue-500 mb-1">{stats.allTimePomos}</span>
                                <span className="text-[11px] text-muted-foreground font-medium">토탈 포모스</span>
                            </div>
                            <div className="flex flex-col items-center justify-center pt-4 relative">
                                <span className="text-2xl lg:text-3xl font-bold tracking-tighter text-blue-500 mb-1 flex items-baseline gap-0.5">
                                    {Math.floor(stats.allTimeFocus / 3600)}<span className="text-sm font-medium opacity-80">h</span>
                                    {Math.floor((stats.allTimeFocus % 3600) / 60)}<span className="text-sm font-medium opacity-80">m</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium">총 집중 기간</span>
                            </div>
                        </div>
                    </div>

                    {/* Achievement Score */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <div className="flex items-center justify-between w-full mb-6">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">내 성취도 점수</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-emerald-500">{stats.achievementScore}</span>
                                <div className="p-1 rounded bg-yellow-500/20 text-yellow-500">
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full pl-2">
                            <SmoothAreaChart
                                data={stats.scoreCurve}
                                color={chartColor}
                                maxY={stats.achievementScore + 5}
                            />
                        </div>
                    </div>

                    {/* Recent Completion Curve */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <div className="flex items-center justify-between w-full mb-6">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">최근 완료 곡선</h3>
                            <div className="text-[11px] text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/30 cursor-pointer hover:bg-muted/10">일 ∨</div>
                        </div>
                        <div className="flex-1 w-full pl-2">
                            <SmoothAreaChart
                                data={stats.last7Days.map(d => ({ label: d.label, value: d.completed }))}
                                color={chartColor}
                                maxY={Math.max(...stats.last7Days.map(d => d.completed), 5)}
                            />
                        </div>
                    </div>

                    {/* Recent Completion Rate Curve */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <div className="flex items-center justify-between w-full mb-6">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">최근 완료율 곡선</h3>
                            <div className="text-[11px] text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/30 cursor-pointer hover:bg-muted/10">일 ∨</div>
                        </div>
                        <div className="flex-1 w-full pl-2">
                            <SimpleBarChart
                                data={stats.last7Days.map(d => ({ label: d.label, value: d.completionRate, tooltip: `${Math.round(d.completionRate)}%` }))}
                                color={chartColor}
                                maxY={100}
                                valueFormatter={(v) => `${Math.round(v)}%`}
                            />
                        </div>
                    </div>

                    {/* Recent Pomo Curve */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <div className="flex items-center justify-between w-full mb-6">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">최근 포모 곡선</h3>
                            <div className="text-[11px] text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/30 cursor-pointer hover:bg-muted/10">일 ∨</div>
                        </div>
                        <div className="flex-1 w-full pl-2">
                            <SmoothAreaChart
                                data={stats.last7Days.map(d => ({ label: d.label, value: d.pomos }))}
                                color={chartColor}
                                maxY={Math.max(...stats.last7Days.map(d => d.pomos), 5)}
                            />
                        </div>
                    </div>

                    {/* Recent Focus Time Curve */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col hover:bg-card/60 transition-colors col-span-1 min-h-[300px]">
                        <div className="flex items-center justify-between w-full mb-6">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">최근 집중 기간 곡선</h3>
                            <div className="text-[11px] text-muted-foreground/60 px-2 py-0.5 rounded-sm border border-border/30 cursor-pointer hover:bg-muted/10">일 ∨</div>
                        </div>
                        <div className="flex-1 w-full pl-2">
                            <SimpleBarChart
                                data={stats.last7Days.map(d => ({
                                    label: d.label,
                                    value: d.seconds / 3600, // rendering in hours
                                    tooltip: `${Math.round(d.seconds / 60)}m`
                                }))}
                                color={chartColor}
                                maxY={Math.max(...stats.last7Days.map(d => d.seconds / 3600), 1)}
                                valueFormatter={(hours) => `${Math.round(hours * 60)}m`} // Show Y-axis in minutes instead of fraction of hours if preferred?
                            // To match design, let's use 'm' string appending
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
