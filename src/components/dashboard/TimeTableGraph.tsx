import { useMemo, useState, useEffect } from 'react';
import { differenceInMinutes, differenceInSeconds, getHours, getMinutes, format } from 'date-fns';
import { Session, Project } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useTranslation } from "react-i18next";


import { cn } from "@/lib/utils";

interface TimeTableGraphProps {
    sessions: Session[];
    allSessions?: Session[];
    date?: Date;
    activeProjectId?: string;
    liveSession?: Session | null;
    allLiveSession?: Session | null;
    hideAppUsage?: boolean;
    projects?: Project[];
    nightTimeStart?: number; // 0-24 or >24 for next day
}

export function TimeTableGraph({ sessions, allSessions, date, liveSession, allLiveSession, hideAppUsage, projects = [], activeProjectId, nightTimeStart = 22 }: TimeTableGraphProps) {
    const { t } = useTranslation();
    const [now, setNow] = useState(new Date());

    // Update 'now' every second to keep live session growing and enable seconds display
    useEffect(() => {
        if (!liveSession && !allLiveSession) return; // No need to tick if no live session

        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000); // Update every second

        setNow(new Date()); // Update immediately on mount/liveSession structure change
        return () => clearInterval(interval);
    }, [liveSession, allLiveSession]);

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
        type?: string;
        startHour: number;
        color?: string;
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

            // Find project type if available
            const matchedProject = projects.find(p => p.name === dominantTitle);
            const projectType = matchedProject?.type;

            return {
                id: Math.random().toString(36),
                title: dominantTitle,
                startDate: session.start,
                endDate: session.end,
                startMins,
                endMins,
                durationMins,
                appDistribution: session.appDistribution,
                type: projectType,
                startHour: getHours(session.start),
                color: matchedProject?.color
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
                fullApps: Object.keys(event.appDistribution).join(", "), // For tooltip
                type: event.type,
                isNightTime: (() => {
                    const h = event.startHour;
                    const limit = 5; // 5 AM morning start
                    if (h < limit) {
                        // Early morning (0-5)
                        if (nightTimeStart >= 24) return h >= (nightTimeStart - 24);
                        return true;
                    } else {
                        // Day/Evening
                        if (nightTimeStart >= 24) return false;
                        return h >= nightTimeStart;
                    }
                })(),
                color: event.color
            };
        });
    }, [sessions, date, liveSession, now, projects, activeProjectId, nightTimeStart]);

    // Calculate Summary Stats
    // 1. TIMELINE STATS (Filtered) - Calculate totalFocusTime from filtered 'sessions'
    const { totalFocusTime, peakActivityHour } = useMemo(() => {
        let total = 0;
        const allSessions = liveSession ? [...sessions, liveSession] : sessions;
        const hourlyDistribution = new Array(24).fill(0);

        allSessions.forEach(session => {
            const s = new Date(session.start);
            const isLive = session === liveSession;
            const e = isLive ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
            const duration = differenceInSeconds(e, s);
            if (duration <= 0) return;

            total += duration;

            // Hourly Distribution logic
            let currentStr = s;
            while (currentStr < e) {
                const currentHour = getHours(currentStr);
                const nextHourDate = new Date(currentStr);
                nextHourDate.setHours(currentHour + 1, 0, 0, 0);

                const segmentEnd = nextHourDate < e ? nextHourDate : e;
                const segmentDuration = differenceInSeconds(segmentEnd, currentStr);

                hourlyDistribution[currentHour] += segmentDuration;
                currentStr = segmentEnd;
            }
        });

        // Find max hour
        let maxHour = -1;
        let maxDuration = 0;
        hourlyDistribution.forEach((dur, hour) => {
            if (dur > maxDuration) {
                maxDuration = dur;
                maxHour = hour;
            }
        });

        let peakActivityHour = null;
        if (maxHour !== -1) {
            const ampm = maxHour >= 12 ? 'PM' : 'AM';
            const displayHour = maxHour % 12 || 12;
            peakActivityHour = `${displayHour} ${ampm}`;
        }

        return { totalFocusTime: total, peakActivityHour };
    }, [sessions, liveSession, now]);

    // 2. APP USAGE STATS (Unfiltered) - Calculate sortedApps from 'allSessions' (or sessions if not provided)
    const { sortedApps, totalAppUsageTime } = useMemo(() => {
        const effectiveAllSessions = allSessions || sessions;
        const effectiveLiveSession = allLiveSession !== undefined ? allLiveSession : liveSession;

        const allSessionsList = effectiveLiveSession ? [...effectiveAllSessions, effectiveLiveSession] : effectiveAllSessions;

        let total = 0;
        const appMap: Record<string, number> = {};

        allSessionsList.forEach(session => {
            const s = new Date(session.start);
            const isLive = session === effectiveLiveSession;
            const e = isLive ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

            const duration = differenceInSeconds(e, s);
            if (duration <= 0) return;

            total += duration;
            const appName = session.process || t('calendar.focusSession');
            appMap[appName] = (appMap[appName] || 0) + duration;
        });

        const apps = Object.entries(appMap)
            .map(([name, duration]) => ({ name, duration }))
            .sort((a, b) => b.duration - a.duration);

        return { sortedApps: apps, totalAppUsageTime: total };
    }, [sessions, allSessions, liveSession, allLiveSession, now, t]);

    // 1. Total Focus Time Footer (For TIMELINE Tab - Filtered)
    const TimelineFooter = (
        <div className="mt-2 mb-2 px-2 shrink-0">
            <div className="bg-card/30 rounded-xl p-3 border border-border/40 flex flex-col items-start text-left min-h-24 justify-center">
                <div className="flex flex-col items-start w-full">
                    {liveSession ? (
                        <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold mb-1 opacity-90 truncate max-w-[200px] flex items-center gap-1.5 pl-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            {liveSession.process}
                        </div>
                    ) : (
                        // Placeholder to maintain layout stability
                        <div className="h-[19px] mb-1 w-full" aria-hidden="true" />
                    )}

                    <div className="flex items-center gap-8 w-full">
                        {/* Total Focus Time */}
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.totalFocus')}</div>
                            <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                {Math.floor(totalFocusTime / 3600)}<span className="text-xs font-sans font-medium text-muted-foreground">h</span>
                                {Math.floor((totalFocusTime % 3600) / 60)}<span className="text-xs font-sans font-medium text-muted-foreground">m</span>
                                {totalFocusTime % 60}<span className="text-xs font-sans font-medium text-muted-foreground">s</span>
                            </div>
                        </div>

                        {/* Peak Activity Time */}
                        {peakActivityHour !== null && (
                            <div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.peakFocus')}</div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                    {peakActivityHour}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // 2. Total App Usage Footer (For APP USAGE Tab - Unfiltered)


    const AppUsageFooter = (
        <div className="mt-2 mb-2 px-2 shrink-0">
            <div className="bg-card/30 rounded-xl p-3 border border-border/40 flex flex-col items-start text-left">
                <div className="flex flex-col items-start w-full gap-0">
                    {liveSession ? (
                        <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold mb-1 opacity-90 truncate max-w-[200px] flex items-center gap-1.5 pl-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            {liveSession.process}
                        </div>
                    ) : (
                        // Placeholder to maintain layout stability
                        <div className="h-[19px] mb-1 w-full" aria-hidden="true" />
                    )}
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.totalWork') || "Total Work"}</div>
                            <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                {Math.floor(totalAppUsageTime / 3600)}<span className="text-xs font-sans font-medium text-muted-foreground">h</span>
                                {Math.floor((totalAppUsageTime % 3600) / 60)}<span className="text-xs font-sans font-medium text-muted-foreground">m</span>
                                {totalAppUsageTime % 60}<span className="text-xs font-sans font-medium text-muted-foreground">s</span>
                            </div>
                        </div>


                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col pointer-events-auto select-none">
            <Tabs defaultValue="timetable" className="flex-1 flex flex-col min-h-0">
                <div className="px-2 mb-2 shrink-0">
                    <TabsList className="flex w-full">
                        <TabsTrigger value="timetable" className="flex-1 text-xs">{t('settings.timelineLabel') || 'TimeTable'}</TabsTrigger>
                        {!hideAppUsage && <TabsTrigger value="app-usage" className="flex-1 text-xs">{t('calendar.appUsage')}</TabsTrigger>}
                    </TabsList>
                </div>

                <TabsContent value="timetable" className="flex-1 min-h-[200px] relative outline-none data-[state=inactive]:hidden mt-0 flex flex-col bg-transparent">
                    <div className="flex-1 mx-2 bg-card/30 rounded-xl overflow-hidden border border-border/40 relative select-none flex flex-col mb-2">
                        {/* GRAPH CONTENT */}
                        <div className="flex-1 relative mx-2 my-3">
                            {/* Subtle Grid Lines & Labels */}
                            {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                                <div
                                    key={h}
                                    className="absolute w-full flex items-center group pointer-events-none"
                                    style={{ top: `${(h / 24) * 100}%`, transform: 'translateY(-50%)' }}
                                >
                                    {/* Time Label */}
                                    <div className="w-8 text-right pr-1">
                                        <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                            {h === 24 ? '00:00' : `${h.toString().padStart(2, '0')}:00`}
                                        </span>
                                    </div>
                                    {/* Line */}
                                    <div className="flex-1 border-t border-border/20 w-full" />
                                </div>
                            ))}

                            {/* Vertical Divider Line */}
                            <div className="absolute top-0 bottom-0 left-8 border-l border-border/20 h-full pointer-events-none"></div>

                            {/* Events Layer */}
                            <div className="absolute top-0 bottom-0 left-8 right-0">
                                <TooltipProvider delayDuration={0}>
                                    {sessionBlocks.map((block, i) => (
                                        <Tooltip key={i}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "absolute rounded-sm transition-colors cursor-pointer z-10 flex flex-col justify-center px-2 overflow-hidden",
                                                        !block.color && !block.isNightTime && "bg-primary/80 text-primary-foreground", // Fallback class
                                                        block.isNightTime && "bg-yellow-500/90 dark:bg-yellow-600/90 text-yellow-950 dark:text-yellow-100" // Night time style
                                                    )}
                                                    style={{
                                                        top: block.top,
                                                        height: block.height,
                                                        left: block.left,
                                                        width: block.width,
                                                        backgroundColor: block.isNightTime ? undefined : (block.color || undefined)
                                                    }}
                                                >
                                                    {block.isNightTime && (
                                                        <div className="absolute top-1 right-1 z-20 opacity-100 drop-shadow-md">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-yellow-950 dark:text-yellow-100"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                                        </div>
                                                    )}
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
                    {/* FOOTER FOR TIMETABLE: ONLY TOTAL FOCUS TIME */}
                    {TimelineFooter}
                </TabsContent>

                <TabsContent value="app-usage" className="flex-1 min-h-0 outline-none data-[state=inactive]:hidden mt-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
                        {/* App Usage List - Scrollable Area */}
                        <div className="bg-card/30 rounded-xl p-4 border border-border/40 space-y-3">
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

                    {/* FOOTER FOR APP USAGE: ONLY AVERAGE TIME / LIVE APP */}
                    <div className="shrink-0 pt-0">
                        {AppUsageFooter}
                    </div>
                </TabsContent>
            </Tabs>


        </div >
    );
}
