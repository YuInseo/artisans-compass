import { useMemo, useState, useEffect } from 'react';
import { format, differenceInSeconds, differenceInMinutes, getHours, isSameDay } from "date-fns";
import { AppSettings, Session, Project } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuTrigger,
    ContextMenuSeparator,
    ContextMenuItem,
    ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings2, X, Briefcase } from "lucide-react";

import { useTranslation } from "react-i18next";


import { cn } from "@/lib/utils";
// import { useDataStore } from "@/hooks/useDataStore"; // Removed

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
    settings?: AppSettings | null; // Added
    onUpdateSettings?: (settings: AppSettings) => void;
}

export function TimeTableGraph({ sessions, allSessions, date, liveSession, allLiveSession, hideAppUsage, projects = [], activeProjectId, nightTimeStart = 22, settings, onUpdateSettings }: TimeTableGraphProps) {
    const { t } = useTranslation();
    // const { settings } = useDataStore(); // Removed
    const [now, setNow] = useState(new Date());
    const [isIgnoredAppsModalOpen, setIsIgnoredAppsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'ignored' | 'work'>('ignored');
    const [appsToConfigure, setAppsToConfigure] = useState<{ name: string; duration: number }[]>([]);

    // Update 'now' every second to keep live session growing and enable seconds display
    useEffect(() => {
        if (!liveSession && !allLiveSession) return; // No need to tick if no live session

        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000); // Update every second

        setNow(new Date()); // Update immediately on mount/liveSession structure change
        return () => clearInterval(interval);
    }, [liveSession, allLiveSession]);

    // Helper to check for valid dates
    const isValidDate = (d: any) => {
        return d instanceof Date && !isNaN(d.getTime());
    };

    // Fit to view: 24h = 100% height OR Dynamic if sessions exceed 24h
    // We determine the maximum end time of all sessions to set the scale.
    const { maxSessionMins, eventsWithRelativeTime } = useMemo(() => {
        const allSessions = liveSession ? [...sessions, liveSession] : sessions;
        if (allSessions.length === 0) return { maxSessionMins: 24 * 60, eventsWithRelativeTime: [] };

        const dayStart = date ? new Date(date) : new Date(now);
        // Safety check for dayStart
        if (!isValidDate(dayStart)) {
            // Fallback to current time safely if date is invalid
            const safeNow = new Date();
            safeNow.setHours(0, 0, 0, 0);
            // If dayStart was invalid, we can't reliably calculate relative times for the requested day
            // But we can try to recover by using safeNow.
            // However, it's better to just return empty if critical reference is missing.
            // Let's assume a safe fallback to today 00:00
            dayStart.setTime(safeNow.getTime());
        } else {
            dayStart.setHours(0, 0, 0, 0);
        }

        let maxEnd = 24 * 60; // Default 24h

        const mapped = allSessions.map(session => {
            const s = new Date(session.start);
            const e = (session === liveSession) ? now : new Date(session.end);

            // Filter invalid sessions immediately
            if (!isValidDate(s) || !isValidDate(e)) {
                return null;
            }

            // Calculate minutes relative to the START of the day (00:00)
            // efficient logic: (s - dayStart) in minutes
            let startMins = differenceInMinutes(s, dayStart);
            let endMins = differenceInMinutes(e, dayStart);
            let durationMins = endMins - startMins;

            // Sanity check for negative start (shouldn't happen with correct data, but safe guard)
            if (startMins < 0) {
                // partial overlap or wrong day? Clamp to 0 if purely display
                // But if it's "Yesterday's" session shown on today, it might be weird.
                // Assuming sessions passed here belong to this logical day.
                // If data is messy, we might see negative.
            }

            if (endMins > maxEnd) maxEnd = endMins;

            return {
                ...session,
                s, e, startMins, endMins, durationMins
            };
        }).filter(Boolean) as any[]; // Filter out nulls

        // Add some padding at the bottom if we exceed 24h, or just fit tight?
        // Let's ceil to nearest hour if > 24h
        if (maxEnd > 24 * 60) {
            maxEnd = Math.ceil(maxEnd / 60) * 60;
        }

        return { maxSessionMins: maxEnd, eventsWithRelativeTime: mapped };
    }, [sessions, liveSession, date, now]);

    const TOTAL_MINUTES = maxSessionMins;
    const TOTAL_HOURS = TOTAL_MINUTES / 60;

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
        isIgnored?: boolean;
    }

    const sessionBlocks = useMemo(() => {
        // 1. Pre-process: Filter & Sort (Using pre-calculated relative times)
        // We reuse the mapping from above but need to shape it for the merge logic

        const rawEvents = eventsWithRelativeTime
            .map(session => {
                return {
                    start: session.s,
                    end: session.e,
                    title: session.process || t('calendar.focusSession'),
                    original: session,
                    // Pass pre-calculated mins to avoid re-calc issues with 'getHours' wrapping
                    _startMins: session.startMins,
                    _endMins: session.endMins
                };
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        // 2. Merge Logic: Two-Pass Strategy
        // Pass 1: Pre-Merge SAME APP sessions (gap <= 5m)
        const preMergedEvents: (typeof rawEvents[number] & { appDistribution: Record<string, number> })[] = [];

        rawEvents.forEach(evt => {
            const currentDuration = differenceInSeconds(evt.end, evt.start);

            if (preMergedEvents.length === 0) {
                preMergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
                return;
            }

            const last = preMergedEvents[preMergedEvents.length - 1];
            // Use time diff on Date objects for accuracy in gap check
            const timeDiff = differenceInSeconds(evt.start, last.end);

            // Pass 1: Pre-Merge SAME APP sessions (gap <= 5m)
            const isSameApp = last.title === evt.title;

            if (timeDiff <= 300 && isSameApp) {
                // Merge same app
                last.end = new Date(Math.max(last.end.getTime(), evt.end.getTime()));
                // Update cached endMins
                last._endMins = Math.max(last._endMins, evt._endMins);

                last.appDistribution[evt.title] = (last.appDistribution[evt.title] || 0) + currentDuration;
            } else {
                preMergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
            }
        });

        // Pass 2: Summary Merge (Cross App)
        const mergedEvents: (typeof rawEvents[number] & { appDistribution: Record<string, number> })[] = [];

        preMergedEvents.forEach(evt => {
            if (mergedEvents.length === 0) {
                mergedEvents.push(evt);
                return;
            }

            const last = mergedEvents[mergedEvents.length - 1];
            const timeDiff = differenceInSeconds(evt.start, last.end);
            const currentDuration = differenceInSeconds(evt.end, evt.start);
            const isSummaryView = !settings?.timelineShowDetail;
            const isSameApp = last.title === evt.title;

            let shouldMerge = false;

            if (isSummaryView) {
                // Summary View: Merge if gap is small
                if (timeDiff <= 300) {
                    shouldMerge = true;

                    // Exception: Different App AND Duration >= 15 mins
                    if (!isSameApp && currentDuration >= 900) {
                        shouldMerge = false;
                    }
                }
            } else {
                // Detail View: Merge if Same App (already done in Pass 1) OR Minor Interruption (< 2m)
                if (timeDiff <= 300 && currentDuration < 120) {
                    shouldMerge = true;
                }
            }

            if (shouldMerge) {
                last.end = new Date(Math.max(last.end.getTime(), evt.end.getTime()));
                last._endMins = Math.max(last._endMins, evt._endMins);

                // Merge app distribution
                Object.entries(evt.appDistribution).forEach(([app, dur]) => {
                    last.appDistribution[app] = (last.appDistribution[app] || 0) + (dur as number);
                });
            } else {
                mergedEvents.push(evt);
            }
        });

        // 3. Convert to RenderEvents & Determine Dominant Title for each merged block
        const events: RenderEvent[] = mergedEvents.map(session => {
            // Use the preserved relative minutes!
            const startMins = session._startMins;
            const endMins = session._endMins;
            const durationMins = Math.max(endMins - startMins, 5); // Minimum 5 mins

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

            // Check if it's an ignored app (Robust Matching)
            const isIgnored = settings?.ignoredApps?.some(ignored =>
                ignored === dominantTitle ||
                ignored.toLowerCase() === dominantTitle.toLowerCase() ||
                ignored.replace(/\s/g, "").toLowerCase() === dominantTitle.replace(/\s/g, "").toLowerCase() ||
                dominantTitle.toLowerCase().includes(ignored.toLowerCase())
            );
            const ignoredColor = settings?.ignoredAppsColor || '#808080';

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
                startHour: getHours(session.start), // Still useful for Night Mode color logic (0-24 cycle)
                color: isIgnored ? ignoredColor : matchedProject?.color,
                isIgnored
            };
        });

        // 4. Compute Layout Columns (Simple Greedy Packing) for remaining overlaps
        const columns: RenderEvent[][] = [];
        events.forEach(event => {
            let placed = false;

            // Force single column for Summary View (flatten overlaps)
            if (!settings?.timelineShowDetail) {
                if (columns.length === 0) columns.push([]);
                columns[0].push(event);
                event.colIndex = 0;
                return;
            }

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

            // In Summary View, use full width and ignore nesting
            const isSummary = !settings?.timelineShowDetail;
            const finalLeft = isSummary ? "0%" : `${leftPercent}%`;
            const finalWidth = isSummary ? "100%" : `${widthPercent}%`;

            const hours = Math.floor(event.durationMins / 60);
            const mins = event.durationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return {
                top: `${top}%`,
                height: `${Math.max(height, 0.5)}%`, // Ensure minimum height for visibility
                left: finalLeft,
                width: finalWidth,
                title: event.title,
                timeRange: `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`,
                duration: durationStr,
                durationMins: event.durationMins, // Added
                isShort: event.durationMins < 30,
                fullApps: Object.keys(event.appDistribution).join(", "), // For tooltip
                type: event.type,
                appDistribution: event.appDistribution, // Pass through for tooltip
                isNightTime: (() => {
                    if (event.isIgnored) return false; // Ignored apps should use their own color, not night time yellow
                    const h = event.startHour;
                    const limit = 5; // 5 AM morning start
                    if (h < limit) {
                        // Early morning (0-5)
                        if (nightTimeStart >= 24) return h >= (nightTimeStart - 24);
                        return false; // User requested: strictly strictly apply 'Start' logic linearly (02:00 is before 22:00)
                    } else {
                        // Day/Evening
                        if (nightTimeStart >= 24) return false;
                        return h >= nightTimeStart;
                    }
                })(),
                color: event.color
            };
        });
    }, [sessions, date, liveSession, now, projects, activeProjectId, nightTimeStart, settings]);

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
    }, [sessions, allSessions, liveSession, allLiveSession, now, t, settings]);

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

    const toggleAppIgnored = (appName: string, currentIgnored: boolean) => {
        if (!settings || !onUpdateSettings) return;

        const newIgnoredApps = currentIgnored
            ? settings.ignoredApps?.filter(app => app !== appName) || []
            : [...(settings.ignoredApps || []), appName];

        onUpdateSettings({ ...settings, ignoredApps: newIgnoredApps });
    };

    const toggleWorkApp = (appName: string, isCurrentlyWork: boolean) => {
        if (!settings || !onUpdateSettings) return;

        const newWorkApps = isCurrentlyWork
            ? settings.workApps?.filter(app => app !== appName) || []
            : [...(settings.workApps || []), appName];

        onUpdateSettings({ ...settings, workApps: newWorkApps });
    };

    const toggleWorkFilter = (checked: boolean) => {
        if (!settings || !onUpdateSettings) return;
        onUpdateSettings({ ...settings, filterTimelineByWorkApps: checked });
    };

    // Helper to open modal with specific mode (reusing existing state logic for ease)
    const openModal = (mode: 'ignored' | 'work', block: any) => {
        const apps = Object.entries(block.appDistribution)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([name, duration]) => ({ name, duration: duration as number }));

        if (apps.length === 0) {
            setAppsToConfigure([{ name: block.title, duration: block.durationMins * 60 }]);
        } else {
            setAppsToConfigure(apps);
        }
        setModalMode(mode);
        setIsIgnoredAppsModalOpen(true);
    };

    return (
        <div className="w-full h-full flex flex-col pointer-events-auto select-none">
            <Tabs defaultValue="timetable" className="flex-1 flex flex-col min-h-0">
                <div className="px-2 mb-2 shrink-0">
                    <TabsList className="flex w-full bg-muted/50 p-0.5 h-8">
                        <TabsTrigger value="timetable" className="flex-1 text-[10px] px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('settings.timelineLabel') || 'Timeline'}</TabsTrigger>
                        {!hideAppUsage && <TabsTrigger value="app-usage" className="flex-1 text-[10px] px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('calendar.appUsage')}</TabsTrigger>}
                    </TabsList>
                </div>

                <TabsContent value="timetable" className="flex-1 min-h-[200px] relative outline-none data-[state=inactive]:hidden mt-0 flex flex-col bg-transparent">
                    <div className="flex-1 mx-2 bg-card/30 rounded-xl overflow-hidden border border-border/40 relative select-none flex flex-col mb-2">
                        {/* GRAPH CONTENT */}
                        <div className="flex-1 relative mx-2 my-3">
                            {/* Subtle Grid Lines & Labels */}
                            {Array.from({ length: Math.ceil(TOTAL_HOURS / 2) + 1 }, (_, i) => i * 2).map(h => (
                                <div
                                    key={h}
                                    className="absolute w-full flex items-center group pointer-events-none"
                                    style={{ top: `${(h / TOTAL_HOURS) * 100}%`, transform: 'translateY(-50%)' }}
                                >
                                    {/* Time Label */}
                                    <div className="w-8 text-right pr-1">
                                        <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                            {h === 0 ? '00:00' : (
                                                h < 24
                                                    ? `${h.toString().padStart(2, '0')}:00`
                                                    : `+${(h - 24).toString().padStart(2, '0')}:00` // Show +01:00 for extended time
                                            )}
                                        </span>
                                    </div>
                                    {/* Line */}
                                    <div className="flex-1 border-t border-border/20 w-full" />
                                </div>
                            ))}


                            {/* Vertical Divider Line */}
                            <div className="absolute top-0 bottom-0 left-8 border-l border-border/20 h-full pointer-events-none"></div>

                            {/* Current Time Indicator */}
                            {(settings?.showCurrentTimeIndicator !== false) && (!date || isSameDay(date, now) || (settings?.dailyRecordMode === 'dynamic' && differenceInMinutes(now, date!) < TOTAL_MINUTES)) && (
                                <div
                                    className="absolute left-8 right-0 border-t-2 border-red-500/50 border-dashed z-20 pointer-events-none flex items-center"
                                    style={{
                                        top: `${(differenceInMinutes(now, (() => {
                                            const d = date ? new Date(date) : new Date(now);
                                            d.setHours(0, 0, 0, 0);
                                            return d;
                                        })()) / TOTAL_MINUTES) * 100}%`,
                                        transform: 'translateY(-50%)' // Center the line on the exact time
                                    }}
                                >
                                    <div className="absolute -left-1 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2" />
                                </div>
                            )}

                            {/* Events Layer */}
                            <div className="absolute top-0 bottom-0 left-8 right-0">
                                <TooltipProvider delayDuration={0}>
                                    {sessionBlocks.map((block, i) => (
                                        <ContextMenu key={i}>
                                            <ContextMenuTrigger>
                                                <Tooltip>
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
                                                    <TooltipContent side="right" className="flex flex-col gap-0.5 bg-background/95 backdrop-blur border-border p-3 shadow-xl z-50 min-w-[180px]">
                                                        <p className="font-bold text-sm text-foreground mb-1">{block.title}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                            <span className="font-mono">{block.timeRange}</span>
                                                            <span>•</span>
                                                            <span>{block.duration}</span>
                                                        </div>

                                                        {/* App Breakdown for Merged Blocks */}
                                                        {Object.keys(block.appDistribution).length > 0 && (
                                                            <div className="flex flex-col gap-1 border-t border-border/50 pt-2 mt-1">
                                                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Apps in this block</span>
                                                                {Object.entries(block.appDistribution)
                                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                                    .map(([appName, duration]) => {
                                                                        const d = duration as number;
                                                                        const m = Math.floor(d / 60);
                                                                        const s = d % 60;
                                                                        const durStr = m > 0 ? `${m}m` : `${s}s`;
                                                                        return (
                                                                            <div key={appName} className="flex justify-between items-center text-xs">
                                                                                <span className="truncate max-w-[120px] text-muted-foreground/80" title={appName}>{appName}</span>
                                                                                <span className="font-mono text-[10px] opacity-70 ml-2">{durStr}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent className="w-64">
                                                <ContextMenuCheckboxItem
                                                    checked={settings?.filterTimelineByWorkApps}
                                                    onCheckedChange={toggleWorkFilter}
                                                >
                                                    {t('settings.timeline.filterWorkApps') || "Show Only Work Apps"}
                                                </ContextMenuCheckboxItem>
                                                <ContextMenuSeparator />
                                                <ContextMenuItem
                                                    onSelect={() => openModal('work', block)}
                                                    className="gap-2 cursor-pointer"
                                                >
                                                    <Briefcase className="w-4 h-4" />
                                                    {t('settings.timeline.configureWorkApps') || "Configure Work Programs..."}
                                                </ContextMenuItem>
                                                <ContextMenuItem
                                                    onSelect={() => openModal('ignored', block)}
                                                    className="gap-2 cursor-pointer"
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    {t('settings.timeline.configureIgnoredApps') || "Configure Ignored Apps..."}
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
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

                                    const isIgnored = settings?.ignoredApps?.some(ignored =>
                                        ignored === app.name ||
                                        ignored.toLowerCase() === app.name.toLowerCase() ||
                                        ignored.replace(/\s/g, "").toLowerCase() === app.name.replace(/\s/g, "").toLowerCase() ||
                                        app.name.toLowerCase().includes(ignored.toLowerCase())
                                    );
                                    const ignoredColor = settings?.ignoredAppsColor || '#808080';

                                    return (
                                        <div key={i} className="flex items-center justify-between text-sm group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "w-2 h-2 rounded-full transition-colors shrink-0",
                                                        !isIgnored && "bg-blue-500/50 group-hover:bg-blue-500"
                                                    )}
                                                    style={isIgnored ? { backgroundColor: ignoredColor } : undefined}
                                                />
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

            <Dialog open={isIgnoredAppsModalOpen} onOpenChange={setIsIgnoredAppsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {modalMode === 'ignored'
                                ? (t('settings.timeline.configureIgnoredApps') || "Manage Ignored Apps")
                                : (t('settings.timeline.configureWorkApps') || "Configure Work Programs")}
                        </DialogTitle>
                        <DialogDescription>
                            {modalMode === 'ignored'
                                ? (t('settings.timeline.configureIgnoredAppsDesc') || "Select apps to ignore. Ignored apps will be excluded from focus time calculations.")
                                : (t('settings.timeline.configureWorkAppsDesc') || "Select apps to classify as Work. These will be visible when the Work Filter is active.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 py-4">
                        {/* 1. List of Currently Configured Apps (Badges) */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {modalMode === 'ignored'
                                    ? (t('settings.timeline.ignoredAppsList') || "Currently Ignored")
                                    : (t('settings.timeline.workAppsList') || "Current Work Apps")}
                            </h4>
                            <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-3 border rounded-md bg-muted/20">
                                {/* Check if empty */}
                                {appsToConfigure.filter(app => {
                                    const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                    return list?.includes(app.name);
                                }).length === 0 && (
                                        <span className="text-sm text-muted-foreground self-center italic">
                                            {modalMode === 'ignored'
                                                ? (t('settings.timeline.noIgnoredApps') || "No apps ignored in this block")
                                                : (t('settings.timeline.noAppsInList') || "No apps in this list")}
                                        </span>
                                    )}

                                {/* Render Badges */}
                                {appsToConfigure
                                    .filter(app => {
                                        const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                        return list?.includes(app.name);
                                    })
                                    .map(app => (
                                        <Badge
                                            key={app.name}
                                            variant={modalMode === 'ignored' ? "secondary" : "default"} // Different style for Work apps
                                            className={cn(
                                                "pl-2 pr-1 h-7 text-sm flex items-center gap-1",
                                                modalMode === 'work' && "bg-blue-600 hover:bg-blue-700 text-white" // Custom color for Work
                                            )}
                                        >
                                            {app.name}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-4 w-4 ml-1 hover:bg-transparent rounded-full",
                                                    modalMode === 'work' ? "text-blue-200 hover:text-white" : "text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => {
                                                    if (modalMode === 'ignored') {
                                                        toggleAppIgnored(app.name, true);
                                                    } else {
                                                        toggleWorkApp(app.name, true);
                                                    }
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </Badge>
                                    ))}
                            </div>
                        </div>

                        {/* 2. Dropdown to Add Apps to List */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {modalMode === 'ignored'
                                    ? (t('settings.timeline.addIgnoredApp') || "Add App to Ignore")
                                    : (t('settings.timeline.addWorkApp') || "Add Work App")}
                            </h4>
                            <Select onValueChange={(val) => {
                                if (modalMode === 'ignored') {
                                    toggleAppIgnored(val, false);
                                } else {
                                    toggleWorkApp(val, false);
                                }
                            }}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={
                                        modalMode === 'ignored'
                                            ? (t('settings.timeline.selectAppToIgnore') || "Select an app to ignore...")
                                            : (t('settings.timeline.selectAppToAdd') || "Select an app...")
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {appsToConfigure.filter(app => {
                                        const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                        return !list?.includes(app.name);
                                    }).length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            {modalMode === 'ignored'
                                                ? (t('settings.timeline.allAppsIgnored') || "All apps are already ignored")
                                                : (t('settings.timeline.allAppsAdded') || "All apps are already added")}
                                        </div>
                                    ) : (
                                        appsToConfigure
                                            .filter(app => {
                                                const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                                return !list?.includes(app.name);
                                            })
                                            .map((app) => {
                                                // Format duration
                                                const totalSeconds = app.duration;
                                                const m = Math.floor(totalSeconds / 60);
                                                const s = Math.floor(totalSeconds % 60);
                                                const durStr = m > 0 ? `${m}m` : `${s}s`;

                                                return (
                                                    <SelectItem key={app.name} value={app.name}>
                                                        <span className="flex justify-between w-full gap-4">
                                                            <span>{app.name}</span>
                                                            <span className="text-muted-foreground font-mono text-xs opacity-70">({durStr})</span>
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsIgnoredAppsModalOpen(false)}>
                            {t('common.done') || "Done"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div >
    );
}
