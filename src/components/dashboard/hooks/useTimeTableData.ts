import { useMemo } from 'react';
import { differenceInMinutes, differenceInSeconds, format } from 'date-fns';
import { Session, Project, PlannedSession, AppSettings } from '@/types';
import { useTranslation } from 'react-i18next';

export function useTimeTableData(
    sessions: Session[],
    date: Date | undefined,
    liveSession: Session | null | undefined,
    projects: Project[],
    now: Date,
    renderMode: 'fixed' | 'dynamic',
    plannedSessions: PlannedSession[],
    nightTimeStart: number,
    settings: AppSettings | null | undefined,
    activeProjectId: string | undefined
) {
    const { t } = useTranslation();

    const isValidDate = (d: any) => {
        return d instanceof Date && !isNaN(d.getTime());
    };

    const TOTAL_HOURS = 24;

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

    interface RenderEvent {
        id: string;
        title: string;
        startDate: Date;
        endDate: Date;
        startMins: number;
        endMins: number;
        durationMins: number;
        colIndex?: number;
        appDistribution: Record<string, number>;
        type?: string;
        startHour: number;
        color?: string;
        isIgnored?: boolean;
        forceSide?: 'left' | 'right';
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
                        if (settings?.showPlannedSessions && plannedSessions && plannedSessions.length > 0) {
                            forceSide = 'right';
                            if (session.startMins >= MIDNIGHT_MINS) {
                                visualStartMins = session.startMins - MIDNIGHT_MINS;
                                visualEndMins = session.endMins - MIDNIGHT_MINS;
                            }
                        } else if (session.startMins >= MIDNIGHT_MINS) {
                            forceSide = 'right';
                            visualStartMins = session.startMins - MIDNIGHT_MINS;
                            visualEndMins = session.endMins - MIDNIGHT_MINS;
                        }
                    }

                    merged.push({
                        id: `block - ${session.startMins} `,
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
                    top: `${top}% `,
                    height: `${height}% `,
                    left,
                    width,
                    title: evt.title,
                    timeRange: `${format(evt.startDate, 'HH:mm')} - ${format(evt.endDate, 'HH:mm')} `,
                    duration: `${durationMins} m`,
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
                    id: `block - ${sMins} -${processName} `,
                    title: processName,
                    startDate: sDate,
                    endDate: eDate,
                    startMins: sMins >= MIDNIGHT_MINS ? sMins - MIDNIGHT_MINS : sMins,
                    endMins: sMins >= MIDNIGHT_MINS ? eMins - MIDNIGHT_MINS : eMins,
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
                const hasPlanned = settings?.showPlannedSessions && plannedSessions && plannedSessions.length > 0;

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
                top: `${top}% `,
                height: `${height}% `,
                left,
                width,
                title: evt.title,
                timeRange: `${format(evt.startDate, 'HH:mm')} - ${format(evt.endDate, 'HH:mm')} `,
                duration: `${evt.durationMins} m`,
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

    return { sessionBlocks, TOTAL_MINUTES, TOTAL_HOURS };
}
