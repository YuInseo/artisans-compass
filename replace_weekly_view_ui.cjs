const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/components/dashboard/WeeklyView.tsx');

const newContent = `import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isSameDay, addMinutes, differenceInSeconds, getDay, addDays, format } from 'date-fns';

import { cn } from "@/lib/utils";
import { WorkSession, Session, PlannedSession } from "@/types";
import { PlanEditor } from "./PlanEditor";
import { Flag } from 'lucide-react';

import { useDataStore } from "@/hooks/useDataStore";

// Hooks
import { useWeeklyState } from "./hooks/useWeeklyState";
import { useWeeklyData } from "./hooks/useWeeklyData";
import { useWeeklyDragAndDrop } from "./hooks/useWeeklyDragAndDrop";
import { useWeeklyBulkActions } from "./hooks/useWeeklyBulkActions";

// UI Components
import { WeeklyHeader } from "./weekly/WeeklyHeader";
import { WeeklyDayHeaders } from "./weekly/WeeklyDayHeaders";
import { WeeklyBulkActionBar } from "./weekly/WeeklyBulkActionBar";
import { WeeklySessionCard } from "./weekly/WeeklySessionCard";

interface WeeklyViewProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    liveSession?: WorkSession | Session | null;
    todaySessions?: (WorkSession | Session)[];
}

const getSessionStart = (s: WorkSession | Session): Date => {
    if ('startTime' in s) return new Date(s.startTime);
    return new Date(s.start);
};

const getSessionDuration = (s: WorkSession | Session): number => {
    if ('durationSeconds' in s) return s.durationSeconds;
    return s.duration;
};

export function WeeklyView({ currentDate, onDateChange, liveSession, todaySessions }: WeeklyViewProps) {
    const { settings, saveSettings } = useDataStore();

    const {
        viewMode, setViewMode,
        now,
        showRoutineOverlay, setShowRoutineOverlay,
        showAppUsage, setShowAppUsage,
        viewDate, setViewDate,
        isEditorOpen, setIsEditorOpen,
        selectedPlan, setSelectedPlan, selectedPlanRef,
        popoverPosition, setPopoverPosition,
        days,
        handlePrevWeek, handleNextWeek, handleToday
    } = useWeeklyState(currentDate, onDateChange);

    const {
        weekSessions,
        localRoutine, setLocalRoutine,
        routineSessions,
        effectivePlanned,
        loadData,
        handleSavePlan,
        handleDeletePlan,
        setWeekPlanned
    } = useWeeklyData(
        days, viewMode, viewDate, showRoutineOverlay, isEditorOpen, setSelectedPlan, todaySessions
    );

    const {
        dragState, setDragState,
        selectionBox, setSelectionBox,
        selectedSessionIds, setSelectedSessionIds,
        selectionRef, dragRef,
        startDrag
    } = useWeeklyDragAndDrop({
        selectedPlanRef, setIsEditorOpen, setSelectedPlan, setPopoverPosition, handleSavePlan
    });

    const {
        handleBulkDelete,
        handleBulkPriority,
        handleBulkDateChange
    } = useWeeklyBulkActions({
        viewMode, settings, saveSettings, selectedSessionIds, setSelectedSessionIds, effectivePlanned, handleSavePlan, loadData
    });

    // Horizontal Scroll Navigation
    const wheelAccumulator = useRef(0);
    const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const container = document.getElementById('weekly-view-container');
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            if (viewMode === 'routine' || isEditorOpen) return;
            if ((dragRef.current && dragRef.current.isDragging) || (selectionRef.current && selectionRef.current.isSelecting)) {
                return;
            }

            let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (Math.abs(delta) > 0) {
                e.preventDefault();
                wheelAccumulator.current += delta;
                if (wheelTimeout.current) clearTimeout(wheelTimeout.current);

                const THRESHOLD = 50;

                if (wheelAccumulator.current > THRESHOLD) {
                    const newDate = addDays(viewDate, 1);
                    setViewDate(newDate);
                    wheelAccumulator.current = 0;
                } else if (wheelAccumulator.current < -THRESHOLD) {
                    const newDate = addDays(viewDate, -1);
                    setViewDate(newDate);
                    wheelAccumulator.current = 0;
                }

                wheelTimeout.current = setTimeout(() => {
                    wheelAccumulator.current = 0;
                }, 150);
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
        };
    }, [viewDate, viewMode, isEditorOpen, setViewDate]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 400; // ~6:40 AM
        }
    }, []);

    const getMergedSessionsForDay = (day: Date) => {
        const daySessions = weekSessions.filter(s => {
            if (!isSameDay(getSessionStart(s), day)) return false;

            if (settings?.calendarSettings?.showNonWorkApps) return true;

            const proc = s.process || 'Focus';
            const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => proc.toLowerCase().includes(pattern.toLowerCase()));
            if (isTracked) return true;

            const isWork = !settings?.workApps?.length || settings.workApps.some((w: string) => w.toLowerCase() === proc.toLowerCase());
            return isWork;
        });

        const effectiveSessions = [...daySessions];
        if (liveSession && isSameDay(getSessionStart(liveSession), day)) {
            effectiveSessions.push(liveSession);
        }

        if (effectiveSessions.length === 0) return [];

        const eventsWithRelativeTime = effectiveSessions.map(s => {
            const start = getSessionStart(s);
            const durationSec = getSessionDuration(s);
            const end = addMinutes(start, Math.ceil(durationSec / 60));
            const startMins = start.getHours() * 60 + start.getMinutes();
            const endMins = startMins + Math.ceil(durationSec / 60);

            return {
                ...s,
                s: start,
                e: end,
                startMins,
                endMins,
                process: s.process || 'Focus',
                appDistribution: (s as any).appUsage || { [s.process || 'Focus']: durationSec }
            };
        });

        const mergedSessions: any[] = [];
        if (eventsWithRelativeTime.length > 0) {
            const sorted = [...eventsWithRelativeTime].sort((a, b) => a.startMins - b.startMins);
            let currentBlock: any = null;

            sorted.forEach(session => {
                const appName = session.process;
                const sessionDurSec = differenceInSeconds(session.e, session.s);

                if (!currentBlock) {
                    currentBlock = {
                        ...session,
                        title: appName,
                        appDistribution: { [appName]: sessionDurSec }
                    };
                    return;
                }

                const gap = session.startMins - currentBlock.endMins;

                if (gap < 5) {
                    currentBlock.endMins = Math.max(currentBlock.endMins, session.endMins);
                    currentBlock.e = session.e.getTime() > currentBlock.e.getTime() ? session.e : currentBlock.e;
                    currentBlock.durationMins = currentBlock.endMins - currentBlock.startMins;

                    currentBlock.appDistribution[appName] = (currentBlock.appDistribution[appName] || 0) + sessionDurSec;

                    const currentMax = (Object.values(currentBlock.appDistribution) as number[]).reduce((a, b) => Math.max(a, b), 0);
                    if ((currentBlock.appDistribution[appName] || 0) >= currentMax) {
                        currentBlock.title = appName;
                    }

                } else {
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

        const snappedBlocks: any[] = [];
        mergedSessions.forEach(block => {
            let snapStart = Math.round(block.startMins / 15) * 15;
            let snapEnd = Math.round(block.endMins / 15) * 15;

            if (snapStart === snapEnd) return;

            snappedBlocks.push({
                ...block,
                startMins: snapStart,
                endMins: snapEnd,
                durationMins: snapEnd - snapStart
            });
        });

        const finalBlocks: any[] = [];
        if (snappedBlocks.length > 0) {
            snappedBlocks.sort((a, b) => a.startMins - b.startMins);
            let current = snappedBlocks[0];

            for (let i = 1; i < snappedBlocks.length; i++) {
                const next = snappedBlocks[i];
                const isTouching = current.endMins >= next.startMins;

                if (isTouching) {
                    current.endMins = Math.max(current.endMins, next.endMins);
                    current.durationMins = current.endMins - current.startMins;

                    Object.entries(next.appDistribution || {}).forEach(([app, dur]) => {
                        current.appDistribution[app] = (current.appDistribution[app] || 0) + (dur as number);
                    });

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

        return finalBlocks;
    };

    const portalTarget = typeof document !== 'undefined' ? document.getElementById('top-toolbar-portal') : null;

    const header = (
        <WeeklyHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewDate={viewDate}
            showRoutineOverlay={showRoutineOverlay}
            setShowRoutineOverlay={setShowRoutineOverlay}
            showAppUsage={showAppUsage}
            setShowAppUsage={setShowAppUsage}
            handlePrevWeek={handlePrevWeek}
            handleNextWeek={handleNextWeek}
            handleToday={handleToday}
            settings={settings}
        />
    );

    return (
        <div id="weekly-view-container" className="flex flex-col h-full bg-background text-foreground select-none animate-in fade-in duration-300 relative">
            {portalTarget ? createPortal(header, portalTarget) : (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
                    {header}
                </div>
            )}

            <WeeklyDayHeaders days={days} viewMode={viewMode} />

            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 overflow-hidden relative bg-background/50">
                    <div className="flex h-full relative py-4 box-border">

                        <div className="w-14 shrink-0 border-r border-border/20 bg-background/80 backdrop-blur-sm sticky left-0 z-20">
                            {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                                <div
                                    key={h}
                                    className="absolute w-full flex items-center justify-end pr-2"
                                    style={{ top: \`\${(h / 24) * 100}%\`, transform: 'translateY(-50%)' }}
                                >
                                    <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                        {h.toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                            ))}
                        </div>

                        {days.map(day => (
                            <div
                                key={day.toString()}
                                className="flex-1 relative border-r border-border/20 last:border-r-0 min-w-[100px] group cursor-cell"
                                data-day={day.toISOString()}
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return;

                                    if (isEditorOpen) {
                                        if (selectedPlan && selectedPlan.title && selectedPlan.title.trim().length > 0) {
                                            handleSavePlan(selectedPlan);
                                        }

                                        setIsEditorOpen(false);
                                        setSelectedPlan(null);
                                        setPopoverPosition(null);
                                        return;
                                    }

                                    if (!e.ctrlKey && selectedSessionIds.size > 0) {
                                        setSelectedSessionIds(new Set());
                                        return;
                                    }

                                    if (e.ctrlKey) {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        const container = document.getElementById('weekly-view-container');
                                        if (!container) return;

                                        const containerRect = container.getBoundingClientRect();
                                        const startX = e.clientX;
                                        const startY = e.clientY;

                                        setSelectionBox({ startX, startY, currentX: startX, currentY: startY });

                                        selectionRef.current = {
                                            isSelecting: true,
                                            startX,
                                            startY,
                                            currentX: startX,
                                            currentY: startY,
                                            containerRect: containerRect
                                        };

                                        document.body.style.userSelect = 'none';
                                        return;
                                    }

                                    if (e.target !== e.currentTarget) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const clickY = e.nativeEvent.offsetY; 
                                    const minutes = (clickY / rect.height) * 1440;
                                    const snapped = Math.floor(minutes / 15) * 15;

                                    const newStart = new Date(day);
                                    newStart.setHours(0, 0, 0, 0);
                                    newStart.setMinutes(snapped);

                                    const state = {
                                        isDragging: true,
                                        type: 'create',
                                        session: null,
                                        startY: e.clientY,
                                        originalStart: newStart.getTime(),
                                        originalDuration: 900,
                                        currentStart: newStart.getTime(),
                                        currentDuration: 900,
                                        day: newStart,
                                        containerRect: rect,
                                        currentX: e.clientX,
                                        currentY: e.clientY,
                                        initialOffsetX: e.clientX - rect.left,
                                        initialOffsetY: 0,
                                        ghostWidth: rect.width,
                                        containerHeight: rect.height
                                    };

                                    setDragState(state as any);
                                    dragRef.current = state;

                                    document.body.style.userSelect = 'none';
                                }}
                            >
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-full border-b border-border/20 group-hover:border-border/30 transition-colors pointer-events-none"
                                        style={{ top: \`\${(i * 2 / 24) * 100}%\`, height: '1px' }} 
                                    ></div>
                                ))}

                                {isSameDay(day, now) && (
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-red-500 z-50 pointer-events-none flex items-center"
                                        style={{ top: \`\${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%\` }}
                                    >
                                        <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                    </div>
                                )}

                                {(
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-yellow-400 border-dashed z-0 pointer-events-none opacity-50"
                                        style={{ top: \`\${((23 * 60) / 1440) * 100}%\` }}
                                    />
                                )}

                                {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-dotted border-yellow-500/70 z-20 pointer-events-none"
                                        style={{ top: \`\${((settings.nightTimeStart || 22) / 24) * 100}%\` }}
                                    />
                                )}

                                {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                                    <div
                                        className="absolute left-0 right-0 bg-black/20 dark:bg-black/40 pointer-events-none z-0"
                                        style={{
                                            top: \`\${((settings.nightTimeStart || 22) / 24) * 100}%\`,
                                            height: \`\${((24 - (settings.nightTimeStart || 22)) / 24) * 100}%\`
                                        }}
                                    />
                                )}

                                {viewMode === 'calendar' && showRoutineOverlay && routineSessions
                                    .filter(s => isSameDay(new Date(s.start), day))
                                    .map((session, idx) => {
                                        const start = new Date(session.start);
                                        const startMins = start.getHours() * 60 + start.getMinutes();
                                        const top = (startMins / 1440) * 100;
                                        const height = (session.duration / 60 / 1440) * 100;

                                        return (
                                            <div
                                                key={\`routine-ghost-\${idx}\`}
                                                className={cn(
                                                    "absolute left-[4px] right-[4px] rounded-sm border-2 border-dashed px-2 flex flex-col justify-center overflow-hidden opacity-30 pointer-events-none z-0",
                                                    !session.color && "bg-muted border-foreground/20 text-foreground",
                                                    session.color === 'blue' && "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
                                                    session.color === 'green' && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
                                                    session.color === 'orange' && "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
                                                    session.color === 'purple' && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
                                                )}
                                                style={{ top: \`\${top}%\`, height: \`\${height}%\` }}
                                            >
                                                <div className="font-semibold truncate text-[9px] leading-tight">{session.title}</div>
                                            </div>
                                        );
                                    })}

                                {viewMode === 'calendar' && showAppUsage && getMergedSessionsForDay(day).map((block, idx) => {
                                    const top = (block.startMins / 1440) * 100;
                                    const height = (block.durationMins / 1440) * 100;

                                    const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => block.title.toLowerCase().includes(pattern.toLowerCase()));
                                    const isNonWork = settings?.workApps?.length && !settings.workApps.some((w: string) => w.toLowerCase() === block.title.toLowerCase()) && !isTracked;

                                    return (
                                        <div
                                            key={\`merged-\${idx}\`}
                                            className={cn(
                                                "absolute left-[2px] right-[2px] rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden hover:z-40 hover:opacity-100 hover:shadow-lg transition-all cursor-default group/session pointer-events-none",
                                                isNonWork
                                                    ? (settings?.calendarSettings?.nonWorkColor
                                                        ? \`bg-[\${settings.calendarSettings.nonWorkColor}] text-foreground\`
                                                        : "bg-slate-200/50 dark:bg-slate-800/50 text-muted-foreground border border-slate-300 dark:border-slate-700")
                                                    : "bg-primary/80 text-primary-foreground"
                                            )}
                                            style={{ top: \`\${top}%\`, height: \`\${height}%\` }}
                                        >
                                            <div className="font-semibold truncate group-hover/session:whitespace-normal leading-tight flex items-center gap-1">
                                                {block.priority === 'high' && <Flag className="w-3 h-3 text-red-500 fill-red-500 flex-shrink-0" />}
                                                {block.priority === 'medium' && <Flag className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />}
                                                {block.priority === 'low' && <Flag className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />}
                                                <span className="truncate">{block.title}</span>
                                            </div>
                                            <div className="truncate opacity-75 text-[9px] mt-0.5 font-mono">
                                                {Math.floor(block.durationMins / 60)}h {block.durationMins % 60}m
                                            </div>
                                        </div>
                                    );
                                })}

                                {(() => {
                                    const dayStartMs = new Date(day).setHours(0, 0, 0, 0);
                                    const dayEndMs = dayStartMs + 86400000;

                                    const rawSessions = effectivePlanned
                                        .filter(s => !dragState?.isDragging || s.id !== dragState.session?.id);

                                    if (isEditorOpen && selectedPlan && !selectedPlan.id && selectedPlan.start) {
                                        rawSessions.push({ ...selectedPlan, id: 'temp-creating-session' } as PlannedSession);
                                    } else if (isEditorOpen && selectedPlan && selectedPlan.id && selectedPlan.start && !effectivePlanned.some(p => p.id === selectedPlan.id)) {
                                        rawSessions.push(selectedPlan as PlannedSession);
                                    }

                                    if (dragState && dragState.isDragging) {
                                        if (dragState.type === 'create') {
                                            rawSessions.push({
                                                id: 'drag-ghost-session',
                                                title: 'New Session',
                                                start: dragState.currentStart,
                                                duration: dragState.currentDuration,
                                            } as any);
                                        } else if (dragState.session) {
                                            rawSessions.push({
                                                ...dragState.session,
                                                id: 'drag-ghost-session',
                                                start: dragState.type === 'resize' ? dragState.originalStart : dragState.currentStart,
                                                duration: dragState.currentDuration,
                                            } as any);
                                        }
                                    }

                                    const daySegments: any[] = [];

                                    rawSessions.forEach((s) => {
                                        const startMs = new Date(s.start).getTime();
                                        const endMs = startMs + (s.duration * 1000);

                                        if (startMs < dayEndMs && endMs > dayStartMs) {
                                            const segmentStart = Math.max(startMs, dayStartMs);
                                            const segmentEnd = Math.min(endMs, dayEndMs);
                                            daySegments.push({
                                                ...s,
                                                originalStart: startMs,
                                                originalDuration: s.duration,
                                                segmentStart,
                                                segmentEnd,
                                                segmentDuration: (segmentEnd - segmentStart) / 1000,
                                                isStart: startMs >= dayStartMs,
                                                isEnd: endMs <= dayEndMs
                                            });
                                        }
                                    });

                                    if (daySegments.length === 0) return null;

                                    const layoutMap = new Map<string, { left: number, width: number }>();

                                    const sorted = [...daySegments].sort((a, b) => {
                                        if (a.segmentStart !== b.segmentStart) return a.segmentStart - b.segmentStart;
                                        return b.segmentDuration - a.segmentDuration;
                                    });

                                    const processed = new Set<any>();

                                    sorted.forEach(s => {
                                        if (processed.has(s)) return;

                                        const group: any[] = [s];
                                        const queue = [s];
                                        processed.add(s);

                                        let qIdx = 0;
                                        while (qIdx < queue.length) {
                                            const current = queue[qIdx++];
                                            const curStart = current.segmentStart;
                                            const curEnd = curStart + (current.segmentDuration * 1000);

                                            for (const other of sorted) {
                                                if (processed.has(other)) continue;

                                                const otherStart = other.segmentStart;
                                                const otherEnd = otherStart + (other.segmentDuration * 1000);

                                                if (curStart < otherEnd && curEnd > otherStart) {
                                                    group.push(other);
                                                    queue.push(other);
                                                    processed.add(other);
                                                }
                                            }
                                        }

                                        const groupCols: any[][] = [];
                                        group.sort((a, b) => a.segmentStart - b.segmentStart);

                                        group.forEach(gs => {
                                            let placedCol = -1;
                                            for (let i = 0; i < groupCols.length; i++) {
                                                const last = groupCols[i][groupCols[i].length - 1];
                                                const lastEnd = last.segmentStart + (last.segmentDuration * 1000);
                                                if (gs.segmentStart >= lastEnd) {
                                                    groupCols[i].push(gs);
                                                    placedCol = i;
                                                    break;
                                                }
                                            }
                                            if (placedCol === -1) {
                                                groupCols.push([gs]);
                                                placedCol = groupCols.length - 1;
                                            }
                                        });

                                        const width = 100 / groupCols.length;
                                        groupCols.forEach((col, colIdx) => {
                                            col.forEach(item => {
                                                layoutMap.set(item.id, {
                                                    left: colIdx * width,
                                                    width: width
                                                });
                                            });
                                        });
                                    });

                                    return daySegments.map((session) => (
                                        <WeeklySessionCard
                                            key={\`planned-\${session.id}-\${session.segmentStart}\`}
                                            session={session}
                                            layout={layoutMap.get(session.id) || { left: 0, width: 100 }}
                                            isDragPreview={session.id === 'drag-ghost-session'}
                                            isSelected={selectedSessionIds.has(session.id!)}
                                            isEditing={selectedPlan?.id === session.id}
                                            dayStartMs={dayStartMs}
                                            startDrag={startDrag}
                                            handleDeletePlan={handleDeletePlan}
                                            setSelectedPlan={setSelectedPlan}
                                            setIsEditorOpen={setIsEditorOpen}
                                            setPopoverPosition={setPopoverPosition}
                                        />
                                    ));
                                })()}
                            </div>
                        ))}

                    </div>
                </div>

                {isEditorOpen && popoverPosition && createPortal(
                    <div
                        className="absolute z-[9999] animate-in fade-in zoom-in-95 duration-200 plan-editor-card"
                        style={{
                            ...(popoverPosition.y > (document.getElementById('weekly-view-container')?.clientHeight || window.innerHeight) - 350
                                ? { bottom: Math.max(10, (document.getElementById('weekly-view-container')?.clientHeight || window.innerHeight) - popoverPosition.y - 40) }
                                : { top: popoverPosition.y }),
                            left: Math.min(popoverPosition.x, (document.getElementById('weekly-view-container')?.clientWidth || window.innerWidth) - 340),
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                    >
                        <PlanEditor
                            isOpen={isEditorOpen}
                            onClose={() => setIsEditorOpen(false)}
                            session={selectedPlan}
                            onSave={handleSavePlan}
                            onDelete={handleDeletePlan}
                            onChange={(updatedSession) => {
                                setSelectedPlan(updatedSession);

                                if (viewMode === 'routine') {
                                    if (localRoutine) {
                                        const date = new Date(updatedSession.start!);
                                        const dayOfWeek = getDay(date);
                                        const startSeconds = date.getHours() * 3600 + date.getMinutes() * 60;

                                        setLocalRoutine(prev => (prev || []).map(r => {
                                            if (r.id === updatedSession.id) {
                                                return {
                                                    ...r,
                                                    title: updatedSession.title || r.title,
                                                    description: updatedSession.description !== undefined ? updatedSession.description : r.description,
                                                    color: updatedSession.color || r.color,
                                                    durationSeconds: updatedSession.duration || r.durationSeconds,
                                                    startSeconds: startSeconds,
                                                    dayOfWeek: dayOfWeek 
                                                };
                                            }
                                            return r;
                                        }));
                                    }
                                } else {
                                    setWeekPlanned(prev => prev.map(p =>
                                        p.id === updatedSession.id ? { ...p, ...updatedSession } as PlannedSession : p
                                    ));
                                }
                            }}
                            mode="card"
                            tags={settings?.projectTags || []}
                        />
                    </div>,
                    document.getElementById('weekly-view-container') || document.body
                )}

                {isEditorOpen && !popoverPosition && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
                        <div className="bg-background rounded-lg shadow-lg">
                            <PlanEditor
                                isOpen={isEditorOpen}
                                onClose={() => setIsEditorOpen(false)}
                                session={selectedPlan}
                                onSave={handleSavePlan}
                                onDelete={handleDeletePlan}
                                onChange={(updatedSession) => {
                                    setSelectedPlan(updatedSession);
                                    if (viewMode !== 'routine') {
                                        setWeekPlanned(prev => prev.map(p =>
                                            p.id === updatedSession.id ? { ...p, ...updatedSession } as PlannedSession : p
                                        ));
                                    }
                                }}
                                mode="dialog"
                            />
                        </div>
                    </div>
                )}

                {selectionBox && createPortal(
                    <div
                        className="fixed border bg-blue-500/20 border-blue-500 z-[9999] pointer-events-none"
                        style={{
                            left: Math.min(selectionBox.startX, selectionBox.currentX),
                            top: Math.min(selectionBox.startY, selectionBox.currentY),
                            width: Math.abs(selectionBox.currentX - selectionBox.startX),
                            height: Math.abs(selectionBox.currentY - selectionBox.startY)
                        }}
                    />,
                    document.body
                )}

                <WeeklyBulkActionBar
                    viewMode={viewMode}
                    selectedSessionIds={selectedSessionIds}
                    effectivePlanned={effectivePlanned}
                    handleBulkDateChange={handleBulkDateChange}
                    handleBulkPriority={handleBulkPriority}
                    handleBulkDelete={handleBulkDelete}
                    setSelectedSessionIds={setSelectedSessionIds}
                />
            </div>

            {dragState && dragState.isDragging && createPortal(
                <div
                    className="fixed rounded-md bg-blue-500 text-white z-[9999] pointer-events-none flex flex-col px-2 py-1 shadow-lg opacity-90"
                    style={{
                        left: dragState.type === 'resize'
                            ? (dragState.startX || 0) - dragState.initialOffsetX
                            : dragState.currentX - dragState.initialOffsetX,
                        top: dragState.type === 'resize'
                            ? dragState.startY - dragState.initialOffsetY
                            : dragState.currentY - dragState.currentOffsetY,
                        width: dragState.ghostWidth,
                        height: (dragState.currentDuration / 86400) * dragState.containerHeight,
                    }}
                >
                    <div className="text-[10px] font-medium opacity-90">
                        {format(new Date(dragState.currentStart), 'HH:mm')} - {format(addMinutes(new Date(dragState.currentStart), dragState.currentDuration / 60), 'HH:mm')}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
`;

fs.writeFileSync(targetPath, newContent);
console.log('Successfully replaced WeeklyView.tsx with UI Extractions');
