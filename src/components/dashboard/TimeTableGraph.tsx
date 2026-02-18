import { useMemo, useState, useEffect } from 'react';
import { format, differenceInSeconds, differenceInMinutes, getHours, isSameDay } from "date-fns";
import { AppSettings, Session, Project, PlannedSession } from '@/types';
import { getDay } from 'date-fns';
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
    settings?: AppSettings | null; // Restored
    onUpdateSettings?: (settings: AppSettings) => void;
    renderMode?: 'fixed' | 'dynamic'; // New prop to control visualization behavior
    plannedSessions?: PlannedSession[]; // NEW: For overlay
    currentTime?: Date; // NEW: Allow parent to drive the clock
}

export function TimeTableGraph({
    sessions,
    date,
    liveSession,
    allSessions,
    allLiveSession,
    projects = [],
    activeProjectId,
    nightTimeStart = 24, // Default to 24 (Midnight)
    settings,
    onUpdateSettings,
    hideAppUsage, // Add this
    renderMode = 'dynamic', // Default to dynamic safely,
    plannedSessions = [], // Default to empty
    currentTime
}: TimeTableGraphProps & { hideAppUsage?: boolean }): React.ReactNode {
    console.log('[TimeTableGraph] Render Mode:', renderMode);
    const { t } = useTranslation();
    // const { settings } = useDataStore(); // Removed
    const [internalNow, setInternalNow] = useState(new Date());
    const now = currentTime || internalNow;

    const [isIgnoredAppsModalOpen, setIsIgnoredAppsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'ignored' | 'work'>('ignored');
    const [appsToConfigure, setAppsToConfigure] = useState<{ name: string; duration: number }[]>([]);

    // Update 'now' every second to keep live session growing and enable seconds display
    useEffect(() => {
        if (!liveSession && !allLiveSession && currentTime) return; // If parent provides time, no need to tick internal unless we want strictly internal fallback? Actually if currentTime is provided, we ignore internal.

        // If no external time, and we have live session, we tick.
        if (!currentTime && (liveSession || allLiveSession)) {
            const interval = setInterval(() => {
                setInternalNow(new Date());
            }, 1000); // Update every second
            setInternalNow(new Date());
            return () => clearInterval(interval);
        }

        // Fallback: If no external time and no live session, do we tick? 
        // Original logic: "if (!liveSession && !allLiveSession) return;"
        // We preserve original logic for internal timer, but prioritize currentTime.

    }, [liveSession, allLiveSession, currentTime]);

    // Helper to check for valid dates
    const isValidDate = (d: any) => {
        return d instanceof Date && !isNaN(d.getTime());
    };

    // Fit to view: 24h = 100% height OR Dynamic if sessions exceed 24h
    // We determine the maximum end time of all sessions to set the scale.
    const { eventsWithRelativeTime, TOTAL_MINUTES = 1440 } = useMemo(() => {
        // Deduplicate: If liveSession is present, filter it out from 'sessions' based on start time similarity
        const uniqueSessions = liveSession
            ? sessions.filter(s => Math.abs(new Date(s.start).getTime() - new Date(liveSession.start).getTime()) > 1000)
            : sessions;

        const allSessions = liveSession ? [...uniqueSessions, liveSession] : sessions;
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
            if (startMins < 0) startMins = 0;

            // Standardize maxEnd to clamp at 24h for visual scaling IF we are strictly splitting
            // BUT wait, we need to detect overflow first.
            if (endMins > maxEnd) maxEnd = endMins;

            return {
                ...session,
                s, e, startMins, endMins, durationMins
            };
        }).filter(Boolean) as any[]; // Filter out nulls

        // Force 24h Scale (1440 mins) to prevent axis extension
        // visually we want 00:00 to 24:00.
        maxEnd = 24 * 60;

        return { maxSessionMins: maxEnd, eventsWithRelativeTime: mapped, TOTAL_MINUTES: 1440 };
    }, [sessions, liveSession, date, now]);

    const TOTAL_HOURS = 24;

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
        forceSide?: 'left' | 'right'; // New property for visual separation
    }

    const sessionBlocks = useMemo(() => {
        const gridMode = settings?.timelineGridMode || '15min';
        console.log('[TimeTableGraph] Grid Mode:', gridMode, 'Raw Envents:', eventsWithRelativeTime.length);

        // --- OPTION A: CONTINUOUS MODE (Legacy/Exact) ---
        if (gridMode === 'continuous') {
            // 1. Pre-process: Split sessions crossing midnight (1440 mins)
            const splitSessions: any[] = [];
            const MIDNIGHT_MINS = 1440;

            eventsWithRelativeTime.forEach(evt => {
                if (evt.startMins < MIDNIGHT_MINS && evt.endMins > MIDNIGHT_MINS) {
                    // Split into two
                    // Part A: Start -> 1440
                    splitSessions.push({
                        ...evt,
                        endMins: MIDNIGHT_MINS,
                        durationMins: MIDNIGHT_MINS - evt.startMins,
                        e: new Date(evt.s.getTime() + (MIDNIGHT_MINS - evt.startMins) * 60000)
                    });
                    // Part B: 1440 -> End
                    splitSessions.push({
                        ...evt,
                        startMins: MIDNIGHT_MINS,
                        durationMins: evt.endMins - MIDNIGHT_MINS,
                        s: new Date(evt.s.getTime() + (MIDNIGHT_MINS - evt.startMins) * 60000)
                    });
                } else {
                    splitSessions.push(evt);
                }
            });

            const sortedSessions = splitSessions.sort((a, b) => a.startMins - b.startMins);

            const merged: RenderEvent[] = [];

            sortedSessions.forEach(session => {
                const last = merged[merged.length - 1];

                // Merge if overlap or gap < 1 minute (Continuity)
                // AND ensure we don't merge across the midnight boundary (Left vs Right)
                const isCrossingMidnightConfig = last && last.startMins < MIDNIGHT_MINS && session.startMins >= MIDNIGHT_MINS;

                if (last && session.startMins <= (last.endMins + 1) && !isCrossingMidnightConfig) {
                    // Update End
                    last.endMins = Math.max(last.endMins, session.endMins);
                    last.endDate = new Date(Math.max(last.endDate.getTime(), session.e.getTime())); // Use session.e (Date object)
                    last.durationMins = last.endMins - last.startMins;

                    // Add Duration (in seconds for appDistribution)
                    const sessionDurationSeconds = differenceInSeconds(session.e, session.s);
                    // last.duration (RenderEvent uses durationMins usually for logic, but we might want a 'totalSeconds' for stats?)
                    // The RenderEvent interface defined above has 'durationMins'. 
                    // Let's check the previous code... it used 'duration' (seconds?)? 
                    // RenderEvent definition: durationMins: number. 
                    // But in the previous invalid code I was using 'last.duration += ...' which might have been a type error if not defined.
                    // Let's assume RenderEvent needs a 'totalSeconds' or we just update appDistribution.

                    // Merge Apps
                    const appName = session.process || session.title || t('calendar.focusSession');
                    last.appDistribution[appName] = (last.appDistribution[appName] || 0) + sessionDurationSeconds;

                    // Update Dominant App
                    // Need to track maxAppDur in RenderEvent to keep this efficient? Or recalculate?
                    // Let's add maxAppDur to the pushed object for internal usage.
                    const currentMax = (last as any).maxAppDur || 0;
                    if (last.appDistribution[appName] > currentMax) {
                        (last as any).maxAppDur = last.appDistribution[appName];
                        last.title = appName;
                        // Re-check color
                        const p = projects.find(proj => proj.name === appName);
                        // Fix simplistic check
                        const isIgnored = settings?.ignoredApps?.some(ignored =>
                            ignored === appName ||
                            ignored.toLowerCase() === appName.toLowerCase() ||
                            ignored.replace(/\s/g, "").toLowerCase() === appName.replace(/\s/g, "").toLowerCase() ||
                            appName.toLowerCase().includes(ignored.toLowerCase())
                        );
                        last.color = isIgnored ? (settings?.ignoredAppsColor || '#808080') : p?.color;
                        last.isIgnored = isIgnored;
                        last.type = p?.type;
                    }

                } else {
                    // Start New Block
                    const appName = session.process || session.title || t('calendar.focusSession');
                    const p = projects.find(proj => proj.name === appName);
                    const isIgnored = settings?.ignoredApps?.some(ignored =>
                        ignored === appName ||
                        ignored.toLowerCase() === appName.toLowerCase() ||
                        ignored.replace(/\s/g, "").toLowerCase() === appName.replace(/\s/g, "").toLowerCase() ||
                        appName.toLowerCase().includes(ignored.toLowerCase())
                    );

                    // Determine Side
                    let forceSide: 'left' | 'right' | undefined = undefined;
                    let visualStartMins = session.startMins;
                    let visualEndMins = session.endMins;

                    if (renderMode === 'dynamic') {
                        if (plannedSessions && plannedSessions.length > 0) {
                            forceSide = 'right';
                        } else if (session.startMins >= MIDNIGHT_MINS) {
                            forceSide = 'right';
                            visualStartMins = session.startMins - MIDNIGHT_MINS;
                            visualEndMins = session.endMins - MIDNIGHT_MINS;
                        }
                    }

                    merged.push({
                        id: `block-${session.startMins}`,
                        title: appName,
                        startMins: visualStartMins, // Store VISUAL mins for rendering
                        endMins: visualEndMins,
                        startDate: session.s,
                        endDate: session.e,
                        durationMins: session.durationMins,
                        appDistribution: { [appName]: differenceInSeconds(session.e, session.s) },
                        color: isIgnored ? (settings?.ignoredAppsColor || '#808080') : p?.color,
                        type: p?.type,
                        startHour: Math.floor(visualStartMins / 60) % 24,
                        isIgnored,
                        forceSide: forceSide,
                        // Internal properties for merging logic
                        ...({ maxAppDur: differenceInSeconds(session.e, session.s) } as any)
                    });
                }
            });

            // Post-Process: Force 'Left' if any 'Right' exists (Split View)
            if (renderMode === 'dynamic') {
                const hasRight = merged.some(e => e.forceSide === 'right');
                if (hasRight) {
                    merged.forEach(e => {
                        if (e.forceSide !== 'right') {
                            e.forceSide = 'left';
                        }
                    });
                }
            }

            return merged.map(evt => {
                const top = (evt.startMins / TOTAL_MINUTES) * 100;
                const height = ((evt.endMins - evt.startMins) / TOTAL_MINUTES) * 100;
                const durationMins = Math.floor((evt.endMins - evt.startMins));

                let left = "0%";
                let width = "100%";
                if (evt.forceSide === 'left') {
                    width = "50%";
                } else if (evt.forceSide === 'right') {
                    left = "50%";
                    width = "50%";
                }

                return {
                    top: `${top}%`,
                    height: `${height}%`,
                    left,
                    width,
                    title: evt.title,
                    timeRange: `${format(evt.startDate, 'HH:mm')} - ${format(evt.endDate, 'HH:mm')}`,
                    duration: `${durationMins}m`,
                    durationMins,
                    isShort: durationMins < 10,
                    fullApps: Object.keys(evt.appDistribution).join(", "),
                    type: evt.type,
                    appDistribution: evt.appDistribution,
                    isNightTime: (() => {
                        if (evt.isIgnored) return false;
                        const h = evt.startHour;
                        const limit = 5;
                        if (h < limit) {
                            if (nightTimeStart < 24) return true;
                            return h >= (nightTimeStart - 24);
                        } else {
                            if (nightTimeStart >= 24) return false;
                            return h >= nightTimeStart;
                        }
                    })(),
                    color: evt.color,
                    forceSide: evt.forceSide
                };
            });
        }

        // --- OPTION B: SESSION-CENTRIC SNAPPING ---
        console.log('[TimeTableGraph] Entering Option B (Snapping)');
        // Refactored Logic: Pre-Merge -> Threshold -> Snap
        const events: RenderEvent[] = [];
        const MIDNIGHT_MINS = 1440;

        // 1. PRE-MERGE: Group consecutive sessions (gap < 5m) of the same app
        const mergedSessions: any[] = [];
        if (eventsWithRelativeTime.length > 0) {
            // Sort by start time logic
            const sorted = [...eventsWithRelativeTime].sort((a, b) => a.startMins - b.startMins);

            let currentBlock: any = null;

            sorted.forEach(session => {
                const appName = session.process || session.title || t('calendar.focusSession');
                const sessionDurSec = differenceInSeconds(session.e, session.s);

                if (!currentBlock) {
                    currentBlock = {
                        ...session,
                        title: appName,
                        appDistribution: { [appName]: sessionDurSec }
                    };
                    return;
                }

                // Calculate Gap (Minutes)
                const gap = session.startMins - currentBlock.endMins;
                // RELAXED MERGE: Merge if gap < 5 minutes, REGARDLESS of app name
                // This mimics "Continuous" mode behavior where we group by time, not just app
                if (gap < 5) {
                    // Extend Block
                    currentBlock.endMins = Math.max(currentBlock.endMins, session.endMins);
                    // Update End Date if extended
                    currentBlock.e = session.e.getTime() > currentBlock.e.getTime() ? session.e : currentBlock.e;
                    currentBlock.durationMins = currentBlock.endMins - currentBlock.startMins;

                    // Accumulate App Usage
                    currentBlock.appDistribution[appName] = (currentBlock.appDistribution[appName] || 0) + sessionDurSec;

                    // Update Title to Dominant App (on the fly or post-process? Let's do on-the-fly for simplicity)
                    const currentMax = (Object.values(currentBlock.appDistribution) as number[]).reduce((a, b) => Math.max(a, b), 0);
                    if ((currentBlock.appDistribution[appName] || 0) >= currentMax) {
                        currentBlock.title = appName;
                    }

                } else {
                    // Push and Start New
                    mergedSessions.push(currentBlock);
                    currentBlock = {
                        ...session,
                        title: appName,
                        appDistribution: { [appName]: sessionDurSec }
                    };
                }
            });
            if (currentBlock) mergedSessions.push(currentBlock);
        }
        console.log('[TimeTableGraph] Option B - Merged Sessions:', mergedSessions.length);

        // 2. FILTER & SNAP & POST-MERGE
        const snappedBlocks: any[] = [];

        mergedSessions.forEach(block => {
            // A. Threshold Filter (Disabled for debugging/usability)
            // if (block.durationMins < 8) return;

            // B. Snap to Grid (Nearest 15m)
            let snapStart = Math.round(block.startMins / 15) * 15;
            let snapEnd = Math.round(block.endMins / 15) * 15;

            // Prevent zero-duration blocks
            if (snapStart === snapEnd) return;

            // Add to intermediate array
            snappedBlocks.push({
                ...block,
                startMins: snapStart,
                endMins: snapEnd,
                durationMins: snapEnd - snapStart
            });
        });
        console.log('[TimeTableGraph] Option B - Snapped Blocks:', snappedBlocks.length);

        // 2.5 POST-SNAP MERGE
        // Merge adjacent blocks that snapped to touching times (End == Start) AND have same app
        const finalBlocks: any[] = [];
        if (snappedBlocks.length > 0) {
            // Sort by start time just in case, though they should be sorted
            snappedBlocks.sort((a, b) => a.startMins - b.startMins);

            let current = snappedBlocks[0];
            for (let i = 1; i < snappedBlocks.length; i++) {
                const next = snappedBlocks[i];
                const isTouching = current.endMins === next.startMins;
                const isOverlap = current.endMins > next.startMins; // Should not happen with sorting but safety

                // RELAXED MERGE: Always merge touching blocks in Grid Mode to form continuous chunks
                // const isSameApp = (current.title || "") === (next.title || ""); 

                if (isTouching || isOverlap) {
                    // Merge!
                    current.endMins = Math.max(current.endMins, next.endMins);
                    current.durationMins = current.endMins - current.startMins;
                    current.e = next.e; // Take later end date
                    // Merge app distribution
                    Object.entries(next.appDistribution).forEach(([app, dur]) => {
                        current.appDistribution[app] = (current.appDistribution[app] || 0) + (dur as number);
                    });

                    // Recalculate Dominant App for the merged block
                    let maxDur = 0;
                    let dominantApp = current.title;
                    Object.entries(current.appDistribution).forEach(([app, dur]) => {
                        if ((dur as number) > maxDur) {
                            maxDur = (dur as number);
                            dominantApp = app;
                        }
                    });
                    current.title = dominantApp;

                } else {
                    finalBlocks.push(current);
                    current = next;
                }
            }
            finalBlocks.push(current);
        }
        console.log('[TimeTableGraph] Option B - Final Blocks:', finalBlocks.length);

        // 3. GENERATE RENDER EVENTS
        finalBlocks.forEach(block => {
            const processName = block.title;
            const matchedProject = projects.find(p => p.name === processName);
            const isIgnored = settings?.ignoredApps?.some(ignored =>
                ignored === processName ||
                ignored.toLowerCase() === processName.toLowerCase() ||
                ignored.replace(/\s/g, "").toLowerCase() === processName.replace(/\s/g, "").toLowerCase() ||
                processName.toLowerCase().includes(ignored.toLowerCase())
            );
            const color = isIgnored ? (settings?.ignoredAppsColor || '#808080') : (matchedProject?.color || undefined);

            // Generate Render Event Function
            const createEvent = (sMins: number, eMins: number, side: 'left' | 'right' | undefined) => {
                const sDate = new Date(date || now); sDate.setHours(0, 0, 0, 0); sDate.setMinutes(sMins);
                const eDate = new Date(date || now); eDate.setHours(0, 0, 0, 0); eDate.setMinutes(eMins);

                events.push({
                    id: `block-${sMins}-${processName}`,
                    title: processName,
                    startDate: sDate,
                    endDate: eDate,
                    startMins: side === 'right' ? sMins - MIDNIGHT_MINS : sMins,
                    endMins: side === 'right' ? eMins - MIDNIGHT_MINS : eMins,
                    durationMins: eMins - sMins,
                    appDistribution: block.appDistribution,
                    type: matchedProject?.type,
                    startHour: Math.floor(sMins / 60) % 24,
                    color,
                    isIgnored,
                    forceSide: side
                });
            };

            // Handling Crossing Midnight
            const s = block.startMins;
            const e = block.endMins;

            if (renderMode === 'dynamic') {
                const hasPlanned = plannedSessions && plannedSessions.length > 0;

                if (hasPlanned) {
                    // Split View: Planned (Left) vs Actual (Right)
                    // Force Actual to Right
                    if (s < MIDNIGHT_MINS && e > MIDNIGHT_MINS) {
                        createEvent(s, MIDNIGHT_MINS, 'right');
                        createEvent(MIDNIGHT_MINS, e, 'right');
                    } else {
                        createEvent(s, e, 'right');
                    }
                } else {
                    // Standard Midnight Split: Day 1 (Left) vs Day 2 (Right)
                    if (s < MIDNIGHT_MINS && e > MIDNIGHT_MINS) {
                        createEvent(s, MIDNIGHT_MINS, 'left');
                        createEvent(MIDNIGHT_MINS, e, 'right');
                    } else if (s >= MIDNIGHT_MINS) {
                        createEvent(s, e, 'right');
                    } else {
                        createEvent(s, e, undefined);
                    }
                }
            } else {
                const clampedEnd = Math.min(e, 24 * 60);
                if (s < clampedEnd) {
                    createEvent(s, clampedEnd, undefined);
                }
            }
        });

        // 3. Post-Process: Force 'Left' logic for Split View
        if (renderMode === 'dynamic') {
            const hasRight = events.some(e => e.forceSide === 'right');
            if (hasRight) {
                events.forEach(e => {
                    if (e.forceSide !== 'right') {
                        e.forceSide = 'left';
                    }
                });
            }
        }

        // 4. Layout Generation
        return events.map(evt => {
            const top = (evt.startMins / TOTAL_MINUTES) * 100;
            const height = ((evt.endMins - evt.startMins) / TOTAL_MINUTES) * 100;

            let left = "0%";
            let width = "100%";

            if (evt.forceSide === 'left') {
                width = "50%";
            } else if (evt.forceSide === 'right') {
                left = "50%";
                width = "50%";
            }

            return {
                top: `${top}%`,
                height: `${height}%`,
                left,
                width,
                title: evt.title,
                timeRange: `${format(evt.startDate, 'HH:mm')} - ${format(evt.endDate, 'HH:mm')}`,
                duration: `${evt.durationMins}m`,
                durationMins: evt.durationMins,
                isShort: evt.durationMins < 15,
                fullApps: Object.keys(evt.appDistribution).join(", "),
                type: evt.type,
                appDistribution: evt.appDistribution,
                isNightTime: (() => {
                    if (evt.isIgnored) return false;
                    const h = evt.startHour;
                    const limit = 5;
                    if (h < limit) {
                        if (nightTimeStart < 24) return true;
                        return h >= (nightTimeStart - 24);
                    } else {
                        if (nightTimeStart >= 24) return false;
                        return h >= nightTimeStart;
                    }
                })(),
                color: evt.color,
                forceSide: evt.forceSide
            };
        });

    }, [sessions, date, liveSession, now, projects, activeProjectId, nightTimeStart, settings, renderMode, plannedSessions]);

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
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.totalWork')}</div>
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
                        <TabsTrigger value="timetable" className="flex-1 text-[10px] px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('settings.timelineLabel')}</TabsTrigger>
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
                            {/* Current Time Indicator */}
                            {(() => {
                                if (settings?.showCurrentTimeIndicator === false) return null;

                                const d = date ? new Date(date) : new Date(now);
                                d.setHours(0, 0, 0, 0);
                                const diffMins = differenceInMinutes(now, d);
                                const isNextDay = diffMins >= TOTAL_MINUTES;

                                // Condition: Show if within 24h OR (Dynamic Mode AND within 48h)
                                const shouldShow = diffMins >= 0 && (
                                    diffMins < TOTAL_MINUTES ||
                                    (settings?.dailyRecordMode === 'dynamic' && renderMode === 'dynamic' && diffMins < TOTAL_MINUTES * 2)
                                );

                                if (!shouldShow) return null;

                                const displayMins = isNextDay ? diffMins - TOTAL_MINUTES : diffMins;
                                const topPct = (displayMins / TOTAL_MINUTES) * 100;

                                return (
                                    <div
                                        className="absolute left-8 right-0 border-t-2 border-red-500/50 border-dashed z-20 pointer-events-none flex items-center"
                                        style={{
                                            top: `${topPct}%`,
                                            transform: 'translateY(-50%)'
                                        }}
                                    >
                                        <div className="absolute -left-1 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2" />
                                    </div>
                                );
                            })()}

                            {/* Events Layer */}
                            {/* GHOST LAYER (Routine + Planned) */}
                            <div className="absolute top-0 bottom-0 left-8 right-0 pointer-events-none z-0">
                                {(() => {
                                    // 1. Combine Routine & Planned
                                    const ghostBlocks: {
                                        startMins: number;
                                        durationMins: number;
                                        title: string;
                                        color?: string;
                                        source: 'routine' | 'plan';
                                    }[] = [];

                                    // A. Routine (from settings)
                                    // Only show routine if we have a valid date to check the day of week
                                    if (settings?.weeklyRoutine && date) {
                                        const currentDay = getDay(date); // 0-6
                                        settings.weeklyRoutine
                                            .filter(r => r.dayOfWeek === currentDay)
                                            .forEach(r => {
                                                ghostBlocks.push({
                                                    startMins: Math.floor(r.startSeconds / 60),
                                                    durationMins: Math.floor(r.durationSeconds / 60),
                                                    title: r.title,
                                                    color: r.color,
                                                    source: 'routine'
                                                });
                                            });
                                    }

                                    // B. Planned Sessions (from props)
                                    // These override routine (visually, we might want to show both or prioritize plan)
                                    // For now, let's just render them.
                                    if (plannedSessions) {
                                        plannedSessions.forEach(p => {
                                            const d = new Date(p.start);
                                            // Ensure it matches the view date (though props should probably filter this)
                                            if (date && !isSameDay(d, date)) return;

                                            const startMins = d.getHours() * 60 + d.getMinutes();
                                            ghostBlocks.push({
                                                startMins,
                                                durationMins: Math.floor(p.duration / 60),
                                                title: p.title,
                                                color: p.color,
                                                source: 'plan'
                                            });
                                        });
                                    }

                                    return ghostBlocks.map((block, i) => {
                                        // Calculate Position
                                        const startPercentage = (block.startMins / TOTAL_MINUTES) * 100;
                                        const endPercentage = ((block.startMins + block.durationMins) / TOTAL_MINUTES) * 100;
                                        const heightPercentage = endPercentage - startPercentage;

                                        // Skip if out of bounds (though dynamic mode usually expands)
                                        if (startPercentage > 100) return null;

                                        // Split View Logic: Planned on LEFT
                                        const isSplitView = renderMode === 'dynamic' && plannedSessions && plannedSessions.length > 0;
                                        const widthStyle = isSplitView ? '50%' : undefined;
                                        const rightStyle = isSplitView ? undefined : '1rem'; // Default right-4 is 1rem

                                        return (
                                            <div
                                                key={`ghost-${i}`}
                                                className={cn(
                                                    "absolute left-0 rounded-sm border-2 border-dashed flex flex-col justify-center px-2 overflow-hidden opacity-30",
                                                    // Color Logic
                                                    !block.color && "bg-muted border-foreground/20 text-foreground",
                                                    block.color === 'blue' && "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
                                                    block.color === 'green' && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
                                                    block.color === 'orange' && "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
                                                    block.color === 'purple' && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
                                                )}
                                                style={{
                                                    top: `${startPercentage}%`,
                                                    height: `${heightPercentage}%`,
                                                    width: widthStyle,
                                                    right: rightStyle
                                                }}
                                            >
                                                <div className="font-semibold text-[10px] truncate opacity-100 flex items-center gap-1">
                                                    {block.source === 'routine' && <span className="text-[8px] uppercase tracking-tighter opacity-70">[R]</span>}
                                                    {block.source === 'plan' && <span className="text-[8px] uppercase tracking-tighter opacity-70">[P]</span>}
                                                    {block.title}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

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
                                                    checked={!settings?.timelineGridMode || settings?.timelineGridMode === '15min'}
                                                    onCheckedChange={(checked) => {
                                                        onUpdateSettings?.({ ...settings!, timelineGridMode: checked ? '15min' : 'continuous' });
                                                    }}
                                                >
                                                    {t('settings.timeline.gridMode')}
                                                </ContextMenuCheckboxItem>
                                                <ContextMenuSeparator />
                                                <ContextMenuCheckboxItem
                                                    checked={settings?.filterTimelineByWorkApps}
                                                    onCheckedChange={toggleWorkFilter}
                                                >
                                                    {t('settings.timeline.filterWorkApps')}
                                                </ContextMenuCheckboxItem>
                                                <ContextMenuSeparator />
                                                <ContextMenuItem
                                                    onSelect={() => openModal('work', block)}
                                                    className="gap-2 cursor-pointer"
                                                >
                                                    <Briefcase className="w-4 h-4" />
                                                    {t('settings.timeline.configureWorkApps')}
                                                </ContextMenuItem>
                                                <ContextMenuItem
                                                    onSelect={() => openModal('ignored', block)}
                                                    className="gap-2 cursor-pointer"
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    {t('settings.timeline.configureIgnoredApps')}
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
                                        {t('calendar.noActivity')}
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
                                ? t('settings.timeline.configureIgnoredApps')
                                : t('settings.timeline.configureWorkApps')}
                        </DialogTitle>
                        <DialogDescription>
                            {modalMode === 'ignored'
                                ? t('settings.timeline.configureIgnoredAppsDesc')
                                : t('settings.timeline.configureWorkAppsDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 py-4">
                        {/* 1. List of Currently Configured Apps (Badges) */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {modalMode === 'ignored'
                                    ? t('settings.timeline.ignoredAppsList')
                                    : t('settings.timeline.workAppsList')}
                            </h4>
                            <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-3 border rounded-md bg-muted/20">
                                {/* Check if empty */}
                                {appsToConfigure.filter(app => {
                                    const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                    return list?.includes(app.name);
                                }).length === 0 && (
                                        <span className="text-sm text-muted-foreground self-center italic">
                                            {modalMode === 'ignored'
                                                ? t('settings.timeline.noIgnoredApps')
                                                : t('settings.timeline.noAppsInList')}
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
                                    ? t('settings.timeline.addIgnoredApp')
                                    : t('settings.timeline.addWorkApp')}
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
                                            ? t('settings.timeline.selectAppToIgnore')
                                            : t('settings.timeline.selectAppToAdd')
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {appsToConfigure.filter(app => {
                                        const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                        return !list?.includes(app.name);
                                    }).length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            {modalMode === 'ignored'
                                                ? t('settings.timeline.allAppsIgnored')
                                                : t('settings.timeline.allAppsAdded')}
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
                            {t('common.done')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div >
    );
}
