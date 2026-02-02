import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { format, differenceInSeconds, getHours } from "date-fns";
import { Session } from "@/types";
import { useMemo, useState, useEffect } from "react";
import { BarChart2, Clock, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityAnalysisModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessions: Session[];
    liveSession?: Session | null;
}

export function ActivityAnalysisModal({ open, onOpenChange, sessions, liveSession }: ActivityAnalysisModalProps) {
    const { t } = useTranslation();

    const analysis = useMemo(() => {
        const buckets: Record<number, { total: number; apps: Record<string, number> }> = {};
        // Initialize 24 hours
        for (let i = 0; i < 24; i++) {
            buckets[i] = { total: 0, apps: {} };
        }

        const allSessions = liveSession ? [...sessions, liveSession] : sessions;
        const now = new Date();

        allSessions.forEach(session => {
            const s = new Date(session.start);
            const e = session === liveSession ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

            let current = s;
            while (current < e) {
                const hour = getHours(current);
                const nextHour = new Date(current);
                nextHour.setHours(hour + 1, 0, 0, 0);

                const segmentEnd = nextHour < e ? nextHour : e;
                const duration = differenceInSeconds(segmentEnd, current);

                if (duration > 0) {
                    buckets[hour].total += duration;
                    const appName = session.process || "Unknown";
                    buckets[hour].apps[appName] = (buckets[hour].apps[appName] || 0) + duration;
                }

                current = segmentEnd;
            }
        });

        const rows = Object.entries(buckets)
            .map(([hourStr, data]) => {
                const hour = parseInt(hourStr);
                const totalMinutes = Math.floor(data.total / 60);

                // Find primary app for this hour
                let primaryApp = "-";
                let maxAppDuration = 0;
                Object.entries(data.apps).forEach(([app, dur]) => {
                    if (dur > maxAppDuration) {
                        maxAppDuration = dur;
                        primaryApp = app;
                    }
                });

                return {
                    hour,
                    totalMinutes,
                    primaryApp,
                    intensity: Math.min(100, (totalMinutes / 60) * 100)
                };
            })
            .filter(item => item.totalMinutes > 0)
            .sort((a, b) => a.hour - b.hour);

        // Day/Night Calculation
        let dayMinutes = 0;
        let nightMinutes = 0;

        rows.forEach(row => {
            if (row.hour >= 6 && row.hour < 18) {
                dayMinutes += row.totalMinutes;
            } else {
                nightMinutes += row.totalMinutes;
            }
        });

        const totalMinutes = dayMinutes + nightMinutes;

        return {
            rows,
            day: { minutes: dayMinutes, percent: totalMinutes > 0 ? Math.round((dayMinutes / totalMinutes) * 100) : 0 },
            night: { minutes: nightMinutes, percent: totalMinutes > 0 ? Math.round((nightMinutes / totalMinutes) * 100) : 0 }
        };

    }, [sessions, liveSession]);

    const [selectedHour, setSelectedHour] = useState<number | null>(null);

    // Set initial selected hour to current hour or first active hour when data loads
    useEffect(() => {
        if (open && analysis.rows.length > 0) {
            const currentHour = new Date().getHours();
            const hasDataForCurrent = analysis.rows.find(r => r.hour === currentHour);
            if (hasDataForCurrent) {
                setSelectedHour(currentHour);
            } else {
                setSelectedHour(analysis.rows[0].hour);
            }
        }
    }, [open, analysis.rows]);

    const selectedData = useMemo(() => {
        if (selectedHour === null) return null;
        return analysis.rows.find(r => r.hour === selectedHour);
    }, [selectedHour, analysis.rows]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <BarChart2 className="w-6 h-6 text-indigo-500" />
                        {t('analysis.title') || "Daily Activity Analysis"}
                    </DialogTitle>
                    <DialogDescription>
                        {t('analysis.description') || "Breakdown of your major activities by hour."}
                    </DialogDescription>
                </DialogHeader>

                {/* Day/Night Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sun className="w-24 h-24 -mr-8 -mt-8 text-orange-500" />
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="p-3 bg-orange-500/20 rounded-xl text-orange-500 shadow-inner">
                                <Sun className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase text-orange-500/70 tracking-wider mb-0.5">{t('analysis.dayTime') || "Day Time"}</div>
                                <div className="text-3xl font-black text-foreground tracking-tight">
                                    {Math.floor(analysis.day.minutes / 60)}<span className="text-sm font-bold text-muted-foreground ml-1">h</span> {analysis.day.minutes % 60}<span className="text-sm font-bold text-muted-foreground ml-1">m</span>
                                </div>
                            </div>
                        </div>
                        <div className="relative z-10 text-2xl font-black text-orange-500">{analysis.day.percent}%</div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Moon className="w-24 h-24 -mr-8 -mt-8 text-indigo-500" />
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-500 shadow-inner">
                                <Moon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase text-indigo-500/70 tracking-wider mb-0.5">{t('analysis.nightTime') || "Night Time"}</div>
                                <div className="text-3xl font-black text-foreground tracking-tight">
                                    {Math.floor(analysis.night.minutes / 60)}<span className="text-sm font-bold text-muted-foreground ml-1">h</span> {analysis.night.minutes % 60}<span className="text-sm font-bold text-muted-foreground ml-1">m</span>
                                </div>
                            </div>
                        </div>
                        <div className="relative z-10 text-2xl font-black text-indigo-500">{analysis.night.percent}%</div>
                    </div>
                </div>

                {/* Main Content Area: Graph + Details */}
                <div className="bg-card/50 rounded-2xl border border-border/50 p-6 flex flex-col gap-8">

                    {/* Rhythm Graph */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-end justify-between h-[160px] gap-1 px-1">
                            {Array.from({ length: 24 }).map((_, hour) => {
                                const row = analysis.rows.find(r => r.hour === hour);
                                const intensity = row ? row.intensity : 0;
                                const isSelected = selectedHour === hour;

                                return (
                                    <div
                                        key={hour}
                                        className="flex-1 flex flex-col items-center justify-end h-full gap-2 group cursor-pointer relative"
                                        onClick={() => setSelectedHour(hour)}
                                        onMouseEnter={() => setSelectedHour(hour)}
                                    >
                                        {/* Tooltip-ish indicator on hover */}
                                        <div className={cn(
                                            "absolute -top-8 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 transition-opacity whitespace-nowrap z-20 pointer-events-none",
                                            isSelected ? "opacity-100" : "group-hover:opacity-100"
                                        )}>
                                            {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                                        </div>

                                        {/* The Bar */}
                                        <div className="w-full relative flex items-end justify-center h-full rounded-t-sm overflow-hidden bg-secondary/30">
                                            <div
                                                className={cn(
                                                    "w-full transition-all duration-300 ease-out relative",
                                                    isSelected ? "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" : "bg-primary/20 group-hover:bg-primary/40"
                                                )}
                                                style={{ height: `${Math.max(intensity, 4)}%` }} // Minimum visual height
                                            >
                                                {/* Top Glow line */}
                                                {intensity > 0 && <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20" />}
                                            </div>
                                        </div>

                                        {/* X-Axis Label */}
                                        <div className={cn(
                                            "text-[10px] font-mono transition-colors",
                                            isSelected ? "text-indigo-500 font-bold" : "text-muted-foreground/40"
                                        )}>
                                            {/* Show label every 3 hours or if selected */}
                                            {hour % 3 === 0 || isSelected ? format(new Date().setHours(hour, 0, 0, 0), 'HH') : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Hour Detail Panel */}
                    <div className="bg-background/50 rounded-xl p-6 border border-border/50 shadow-sm min-h-[140px] flex items-center justify-center transition-all">
                        {selectedData ? (
                            <div className="flex items-center gap-8 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Time Circle */}
                                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                                    <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 flex items-center justify-center bg-indigo-500/5 relative">
                                        <div className="absolute inset-0 border-4 border-indigo-500 rounded-full" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${selectedData.intensity}%, 0 ${selectedData.intensity}%)` }}></div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-bold text-muted-foreground uppercase opacity-70">Focus</span>
                                            <span className="text-xl font-black text-indigo-500">{selectedData.totalMinutes}m</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-mono font-medium text-muted-foreground">
                                        {format(new Date().setHours(selectedData.hour, 0, 0, 0), 'h:00 a')}
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className="w-px h-16 bg-border" />

                                {/* Primary App Info */}
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-secondary/50 px-2 py-0.5 rounded text-center">
                                            {t('analysis.primaryFocus') || "Primary Focus"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl font-bold truncate text-foreground leading-tight">
                                            {selectedData.primaryApp}
                                        </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-1 max-w-[300px]">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-500"
                                            style={{ width: `${selectedData.intensity}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground flex flex-col items-center gap-2 opacity-50">
                                <Clock className="w-8 h-8" />
                                <span>Select a time on the graph to see details</span>
                            </div>
                        )}
                    </div>

                </div>

            </DialogContent>
        </Dialog>
    );
}
