import { useMemo, useState, useEffect } from 'react';
import { differenceInMinutes, differenceInSeconds, getHours, getMinutes, format } from 'date-fns';
import { Session } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

interface TimeTableGraphProps {
    sessions: Session[];
    date?: Date;
    activeProjectId?: string;
    liveSession?: Session | null;
}

export function TimeTableGraph({ sessions, date, liveSession }: TimeTableGraphProps) {
    const { t } = useTranslation();
    const [now, setNow] = useState(new Date());

    // Update 'now' every second to keep live session growing and enable seconds display
    useEffect(() => {
        if (!liveSession) return; // No need to tick if no live session

        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000); // Update every second

        setNow(new Date()); // Update immediately on mount/liveSession structure change
        return () => clearInterval(interval);
    }, [liveSession]);

    // Fit to view: 24h = 100% height

    // Calculate total minutes in a day
    const TOTAL_MINUTES = 24 * 60;

    // Helper interface for the layout logic
    interface RenderEvent {
        id: string;
        title: string;
        startDate: Date;
        endDate: Date;
        startMins: number;
        endMins: number;
        durationMins: number;
        colIndex?: number; // Optional, as it's added during layout
        appDistribution: Record<string, number>; // New property to track app usage within a merged block
    }

    const sessionBlocks = useMemo(() => {
        // 1. Pre-process: Filter & Sort
        const allSessions = liveSession ? [...sessions, liveSession] : sessions;

        const rawEvents = allSessions
            .filter(session => {
                const s = new Date(session.start);
                const e = new Date(session.end);
                return !isNaN(s.getTime()) && !isNaN(e.getTime());
            })
            .map(session => {
                const isLive = session === liveSession;
                return {
                    start: new Date(session.start),
                    end: isLive ? now : new Date(session.end),
                    title: session.process || t('calendar.focusSession'),
                    original: session
                };
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        // 2. Merge Logic: Combine adjacent sessions regardless of App Title
        // This creates "work blocks" where small gaps are ignored.
        const mergedEvents: (typeof rawEvents[number] & { appDistribution: Record<string, number> })[] = [];

        rawEvents.forEach(evt => {
            const currentDuration = differenceInMinutes(evt.end, evt.start);

            if (mergedEvents.length === 0) {
                mergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
                return;
            }

            const last = mergedEvents[mergedEvents.length - 1];
            const timeDiff = differenceInMinutes(evt.start, last.end);

            // Merge if gap is small (<= 5 mins)
            if (timeDiff <= 5) {
                // Extend the last block's end time
                last.end = new Date(Math.max(last.end.getTime(), evt.end.getTime()));
                // Track app usage for naming the merged block later
                last.appDistribution[evt.title] = (last.appDistribution[evt.title] || 0) + currentDuration;
            } else {
                // If gap is too large, start a new merged block
                mergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
            }
        });

        // 3. Convert to RenderEvents & Determine Dominant Title for each merged block
        const events: RenderEvent[] = mergedEvents.map(session => {
            const startMins = getHours(session.start) * 60 + getMinutes(session.start);
            const durationMins = Math.max(differenceInMinutes(session.end, session.start), 5); // Minimum 5 mins
            const endMins = startMins + durationMins;

            // Find the dominant app within this merged block for its title
            let maxDuration = 0;
            let dominantTitle = t('calendar.activity'); // Default title if no apps or for very short sessions
            if (Object.keys(session.appDistribution).length > 0) {
                Object.entries(session.appDistribution).forEach(([app, dur]) => {
                    if ((dur as number) > maxDuration) {
                        maxDuration = (dur as number);
                        dominantTitle = app;
                    }
                });
            } else {
                dominantTitle = session.title; // Fallback to original title if appDistribution is empty
            }


            return {
                id: Math.random().toString(36),
                title: dominantTitle,
                startDate: session.start,
                endDate: session.end,
                startMins,
                endMins,
                durationMins,
                appDistribution: session.appDistribution
            };
        });

        // 4. Compute Layout Columns (Simple Greedy Packing) for remaining overlaps
        const columns: RenderEvent[][] = [];
        events.forEach(event => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastEventInCol = columns[i][columns[i].length - 1];
                // Check if the current event can fit into this column without overlapping the last event
                if (event.startMins >= lastEventInCol.endMins) {
                    columns[i].push(event);
                    event.colIndex = i; // Assign column index
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                // If it doesn't fit into any existing column, create a new one
                columns.push([event]);
                event.colIndex = columns.length - 1; // Assign new column index
            }
        });

        const totalTracks = columns.length > 0 ? columns.length : 1;

        return events.map((event) => {
            const top = (event.startMins / TOTAL_MINUTES) * 100;
            const height = (event.durationMins / TOTAL_MINUTES) * 100;

            const widthPercent = 100 / totalTracks;
            const leftPercent = (event.colIndex || 0) * widthPercent;

            const hours = Math.floor(event.durationMins / 60);
            const mins = event.durationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return {
                top: `${top}%`,
                height: `${Math.max(height, 0.5)}%`, // Ensure minimum height for visibility
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                title: event.title,
                timeRange: `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`,
                duration: durationStr,
                isShort: event.durationMins < 30,
                fullApps: Object.keys(event.appDistribution).join(", ") // For tooltip
            };
        });
    }, [sessions, date, liveSession, now]);

    // Calculate Summary Stats
    const { totalFocusTime, sortedApps } = useMemo(() => {
        let total = 0;
        const appMap: Record<string, number> = {};
        const allSessions = liveSession ? [...sessions, liveSession] : sessions;

        allSessions.forEach(session => {
            // Basic validation
            const s = new Date(session.start);
            const isLive = session === liveSession;
            const e = isLive ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

            const duration = differenceInSeconds(e, s); // Use seconds for precision
            if (duration <= 0) return;

            total += duration;
            const appName = session.process || t('calendar.focusSession');
            appMap[appName] = (appMap[appName] || 0) + duration;
        });

        const apps = Object.entries(appMap)
            .map(([name, duration]) => ({ name, duration }))
            .sort((a, b) => b.duration - a.duration);

        return { totalFocusTime: total, sortedApps: apps };
    }, [sessions, t, liveSession, now]);

    return (
        <div className="w-full h-full flex flex-col pointer-events-auto">
            <Tabs defaultValue="timetable" className="flex-1 flex flex-col min-h-0">
                <div className="px-2 mb-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="timetable" className="text-xs">{t('settings.timelineLabel') || 'TimeTable'}</TabsTrigger>
                        <TabsTrigger value="app-usage" className="text-xs">{t('calendar.appUsage')}</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="timetable" className="flex-1 min-h-[200px] relative outline-none data-[state=inactive]:hidden mt-0">
                    <div className="w-full h-full bg-card/30 rounded-xl overflow-hidden border border-border/40 relative select-none flex flex-col">
                        <div className="flex-1 relative m-4 mb-2">
                            {/* Subtle Grid Lines & Labels */}
                            {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                                <div
                                    key={h}
                                    className="absolute w-full flex items-center group pointer-events-none"
                                    style={{ top: `${(h / 24) * 100}%`, transform: 'translateY(-50%)' }}
                                >
                                    {/* Time Label */}
                                    <div className="w-12 text-right pr-3">
                                        <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                            {h === 24 ? '00:00' : `${h.toString().padStart(2, '0')}:00`}
                                        </span>
                                    </div>
                                    {/* Line */}
                                    <div className="flex-1 border-t border-border/20 w-full" />
                                </div>
                            ))}

                            {/* Vertical Divider Line */}
                            <div className="absolute top-0 bottom-0 left-12 border-l border-border/20 h-full pointer-events-none"></div>

                            {/* Events Layer */}
                            <div className="absolute top-0 bottom-0 left-12 right-0">
                                <TooltipProvider delayDuration={0}>
                                    {sessionBlocks.map((block, i) => (
                                        <Tooltip key={i}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="absolute rounded-sm bg-blue-500 hover:bg-blue-400 transition-colors cursor-pointer z-10 flex flex-col justify-center px-2 overflow-hidden"
                                                    style={{
                                                        top: block.top,
                                                        height: block.height,
                                                        left: block.left,
                                                        width: block.width
                                                    }}
                                                >

                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="flex flex-col gap-0.5 bg-background/95 backdrop-blur border-border p-3 shadow-xl z-50">
                                                <p className="font-bold text-sm text-foreground">{block.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="font-mono">{block.timeRange}</span>
                                                    <span>•</span>
                                                    <span>{block.duration}</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </TooltipProvider>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="app-usage" className="flex-1 min-h-0 overflow-y-auto px-1 outline-none data-[state=inactive]:hidden mt-0">
                    <div className="p-1 h-full">
                        {/* App Usage List - Now taking full height of this tab */}
                        <div className="bg-card/30 rounded-xl p-4 border border-border/40 space-y-3 min-h-full">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">{t('calendar.appUsage') || 'App Usage'}</div>
                            <div className="space-y-2">
                                {sortedApps.map((app, i) => {
                                    const totalMinutes = Math.floor(app.duration / 60);
                                    const hours = Math.floor(totalMinutes / 60);
                                    const minutes = totalMinutes % 60;

                                    return (
                                        <div key={i} className="flex items-center justify-between text-sm group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors shrink-0" />
                                                <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors font-medium" title={app.name}>
                                                    {app.name}
                                                </span>
                                            </div>
                                            <span className="font-mono text-xs text-muted-foreground shrink-0 bg-background/50 px-2 py-0.5 rounded-md border border-border/50">
                                                {hours > 0 && `${hours}h `}
                                                {minutes}m
                                            </span>
                                        </div>
                                    );
                                })}
                                {sortedApps.length === 0 && (
                                    <div className="text-xs text-muted-foreground italic py-2 text-center">
                                        {t('calendar.noActivity') || 'No activity'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Common Footer: Summary & Active Status */}
            <div className="mt-3 px-1 shrink-0 space-y-3">
                <div className="bg-card/30 rounded-xl p-4 border border-border/40 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">{t('calendar.totalFocus')}</div>
                        <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline gap-1">
                            {Math.floor(totalFocusTime / 3600)}<span className="text-sm font-sans font-medium text-muted-foreground">h</span>
                            {Math.floor((totalFocusTime % 3600) / 60)}<span className="text-sm font-sans font-medium text-muted-foreground">m</span>
                            {totalFocusTime % 60}<span className="text-sm font-sans font-medium text-muted-foreground">s</span>
                        </div>
                    </div>

                    {/* Active Session Indicator */}
                    {liveSession && (
                        <div className="flex flex-col items-end justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">{t('calendar.focusing')}</span>
                            </div>
                            <div className="text-xs font-medium text-foreground max-w-[120px] truncate text-right" title={liveSession.process}>
                                {liveSession.process || 'Unknown App'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
