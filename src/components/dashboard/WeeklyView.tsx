import React, { useState, useRef, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, addMinutes, differenceInSeconds, setHours, setMinutes, setSeconds, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash, Pencil, Calendar, Repeat } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkSession, PlannedSession, DailyLog, Session, RoutineSession } from "@/types";
import { useDataStore } from "@/hooks/useDataStore";
import { PlanEditor } from "./PlanEditor";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [viewMode, setViewMode] = useState<'calendar' | 'routine'>('calendar');
    const [showRoutineOverlay, setShowRoutineOverlay] = useState(false);

    const [viewDate, setViewDate] = useState(currentDate);
    const [weekSessions, setWeekSessions] = useState<(WorkSession | Session)[]>([]);
    const [weekPlanned, setWeekPlanned] = useState<PlannedSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Partial<PlannedSession> | null>(null);

    // Drag and Drop State
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        type: 'move' | 'resize' | 'create';
        session: PlannedSession | null;
        startY: number;
        originalStart: number;
        originalDuration: number;
        currentStart: number;
        currentDuration: number;
        day: Date;
    } | null>(null);

    // Removed Sync Effect to prevent resetting view when parent updates time

    const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const loadData = async () => {
        if (!(window as any).ipcRenderer) return;
        setIsLoading(true);
        const monthsToFetch = new Set<string>();
        days.forEach(day => monthsToFetch.add(format(day, 'yyyy-MM')));

        const promises = Array.from(monthsToFetch).map(month => (window as any).ipcRenderer.getMonthlyLog(month));
        const results = await Promise.all(promises);

        const mergedLogs: Record<string, DailyLog> = {};
        results.forEach(res => {
            if (res) Object.assign(mergedLogs, res);
        });

        let allSessions: (WorkSession | Session)[] = [];
        let allPlanned: PlannedSession[] = [];

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');

            // Special handling for Today to use live data
            if (isSameDay(day, new Date())) {
                if (todaySessions) allSessions = [...allSessions, ...todaySessions];
                // Live session is handled separately in render
                const log = mergedLogs[dateKey];
                if (log && log.plannedSessions) {
                    allPlanned = [...allPlanned, ...log.plannedSessions];
                }
            } else {
                const log = mergedLogs[dateKey];
                if (log) {
                    if (log.sessions) allSessions = [...allSessions, ...log.sessions];
                    if (log.plannedSessions) allPlanned = [...allPlanned, ...log.plannedSessions];
                }
            }
        });

        setWeekSessions(allSessions);
        setWeekPlanned(allPlanned);
        setIsLoading(false);
    };

    // Load Data
    useEffect(() => {
        if (viewMode === 'calendar') {
            loadData();
        }
    }, [viewDate, viewMode]);

    // Routine Data Preparation
    const routineSessions = useMemo(() => {
        // Fetch if in routine mode OR if overlay is enabled in calendar mode
        const shouldFetch = viewMode === 'routine' || (viewMode === 'calendar' && showRoutineOverlay);
        if (!shouldFetch || !settings?.weeklyRoutine) return [];

        // Map routine sessions to the current week's dates for rendering


        return settings.weeklyRoutine.map(routine => {
            // routine.dayOfWeek: 0=Sun, 1=Mon... but date-fns 0=Sun
            // Let's assume our type uses 0=Sunday consistent with date-fns
            // We need to find the date in the current week that matches this day
            const targetDate = days.find(d => getDay(d) === routine.dayOfWeek);

            if (!targetDate) return null;

            const startHour = Math.floor(routine.startSeconds / 3600);
            const startMinute = Math.floor((routine.startSeconds % 3600) / 60);

            const start = setSeconds(setMinutes(setHours(targetDate, startHour), startMinute), 0).getTime();

            return {
                id: routine.id,
                start,
                duration: routine.durationSeconds,
                title: routine.title,
                description: routine.description,
                color: routine.color,
                isCompleted: false // Routine templates are never "completed"
            } as PlannedSession;
        }).filter(Boolean) as PlannedSession[];

    }, [settings?.weeklyRoutine, viewMode, viewDate, days]);

    const effectivePlanned = viewMode === 'routine' ? routineSessions : weekPlanned;

    const handleSaveRoutine = async (session: Partial<PlannedSession>) => {
        if (!session.start || !session.title || !settings) return;

        const date = new Date(session.start);
        const dayOfWeek = getDay(date);
        const startSeconds = date.getHours() * 3600 + date.getMinutes() * 60;
        const durationSeconds = session.duration || 3600;

        const newRoutine: RoutineSession = {
            id: session.id || crypto.randomUUID(),
            dayOfWeek,
            startSeconds,
            durationSeconds,
            title: session.title,
            description: session.description,
            color: session.color
        };

        let updatedRoutine = [...(settings.weeklyRoutine || [])];

        if (session.id && updatedRoutine.some(r => r.id === session.id)) {
            updatedRoutine = updatedRoutine.map(r => r.id === session.id ? newRoutine : r);
        } else {
            // Check if we are "moving" an existing routine (id change? no, id should persist)
            // If we are editing, session.id should exist.
            // If creating new, session.id is undefined.
            updatedRoutine.push(newRoutine);
        }

        await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
    };

    const handleDeleteRoutine = async (id: string) => {
        if (!settings) return;
        const updatedRoutine = (settings.weeklyRoutine || []).filter(r => r.id !== id);
        await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
    };

    const handleSavePlan = async (session: Partial<PlannedSession>, originalStart?: number) => {
        if (viewMode === 'routine') {
            await handleSaveRoutine(session);
            return;
        }

        if (!session.start || !session.title) return;

        const newStart = new Date(session.start);
        const newDateKey = format(newStart, 'yyyy-MM-dd');
        const newMonthKey = format(newStart, 'yyyy-MM');

        let oldDateKey: string | null = null;
        let oldMonthKey: string | null = null;

        // Determine if we are moving from another day
        if (originalStart && !isSameDay(originalStart, newStart)) {
            const oldStart = new Date(originalStart);
            oldDateKey = format(oldStart, 'yyyy-MM-dd');
            oldMonthKey = format(oldStart, 'yyyy-MM');
        }

        if (!(window as any).ipcRenderer) return;

        const ipc = (window as any).ipcRenderer;

        // Optimization: If same month, load once
        if (oldMonthKey === newMonthKey || !oldMonthKey) {
            const monthKey = newMonthKey;
            const logs = await ipc.getMonthlyLog(monthKey);

            // 1. Remove from old day if needed
            if (oldDateKey && logs[oldDateKey] && logs[oldDateKey].plannedSessions) {
                logs[oldDateKey].plannedSessions = logs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
            }

            // 2. Add/Update in new day
            if (!logs[newDateKey]) {
                logs[newDateKey] = { date: newDateKey, sessions: [], todos: [], stats: { totalWorkSeconds: 0, questAchieved: false }, assets: [], isRestDay: false };
            }
            const log = logs[newDateKey];
            const planned = log.plannedSessions || [];

            const newSession = {
                id: session.id || crypto.randomUUID(),
                start: session.start,
                duration: session.duration || 3600,
                title: session.title,
                description: session.description,
                color: session.color,
                isCompleted: session.isCompleted
            } as PlannedSession;

            // If it was a move, we already removed it from old day (if old day was in this month).
            // If it's the SAME day, we update.
            // We need to be careful: if we removed it above, we just ADD it here.
            // If we didn't remove it (because oldDateKey is null or same as newDateKey), we update or add.

            if (oldDateKey && oldDateKey !== newDateKey) {
                // Moved from different day (same month) -> Add as new
                log.plannedSessions = [...planned, newSession];
            } else {
                // Same day -> Update or Create
                if (session.id && planned.some((p: PlannedSession) => p.id === session.id)) {
                    log.plannedSessions = planned.map((p: PlannedSession) => p.id === session.id ? newSession : p);
                } else {
                    log.plannedSessions = [...planned, newSession];
                }
            }

            await ipc.saveMonthlyLog({ yearMonth: monthKey, data: logs });

        } else {
            // Different Months: Load Old, Remove, Save Old. Load New, Add, Save New.

            // 1. Remove from Old Month
            if (oldMonthKey && oldDateKey) {
                const oldLogs = await ipc.getMonthlyLog(oldMonthKey);
                if (oldLogs && oldLogs[oldDateKey] && oldLogs[oldDateKey].plannedSessions) {
                    oldLogs[oldDateKey].plannedSessions = oldLogs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
                    await ipc.saveMonthlyLog({ yearMonth: oldMonthKey, data: oldLogs });
                }
            }

            // 2. Add to New Month
            const newLogs = await ipc.getMonthlyLog(newMonthKey);
            if (!newLogs[newDateKey]) {
                newLogs[newDateKey] = { date: newDateKey, sessions: [], todos: [], stats: { totalWorkSeconds: 0, questAchieved: false }, assets: [], isRestDay: false };
            }
            const log = newLogs[newDateKey];
            const planned = log.plannedSessions || [];

            const newSession = {
                id: session.id || crypto.randomUUID(),
                start: session.start,
                duration: session.duration || 3600,
                title: session.title,
                description: session.description,
                color: session.color,
                isCompleted: session.isCompleted
            } as PlannedSession;

            log.plannedSessions = [...planned, newSession];
            await ipc.saveMonthlyLog({ yearMonth: newMonthKey, data: newLogs });
        }

        loadData(); // Reload all visible data
    };

    const handleDeletePlan = async (id: string) => {
        if (viewMode === 'routine') {
            await handleDeleteRoutine(id);
            return;
        }

        if (!selectedPlan || !selectedPlan.start) return;

        const sessionDate = new Date(selectedPlan.start);
        const dateStr = format(sessionDate, 'yyyy-MM-dd');
        const yearMonth = format(sessionDate, 'yyyy-MM');

        if ((window as any).ipcRenderer) {
            const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
            if (logs[dateStr] && logs[dateStr].plannedSessions) {
                logs[dateStr].plannedSessions = logs[dateStr].plannedSessions.filter((p: PlannedSession) => p.id !== id);
                await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
                loadData();
            }
        }
    };

    const handlePrevWeek = () => {
        const newDate = subWeeks(viewDate, 1);
        setViewDate(newDate);
        onDateChange(newDate);
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(viewDate, 1);
        setViewDate(newDate);
        onDateChange(newDate);
    };

    const handleToday = () => {
        const today = new Date();
        setViewDate(today);
        onDateChange(today);
    };

    // Current Time Indicator
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 400; // ~6:40 AM
        }
    }, []);

    // --- Horizontal Scroll Navigation ---
    const wheelAccumulator = useRef(0);
    const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

    // Native listener for non-passive preventDefault
    // Native listener for non-passive preventDefault
    useEffect(() => {
        const container = document.getElementById('weekly-view-container');
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            // Support both Horizontal (Trackpad) and Vertical (Mouse Wheel) scrolling
            // If deltaX is present, use it. If not, use deltaY.

            // Logic:
            // 1. If strict horizontal scroll (trackpad), use deltaX.
            // 2. If mostly vertical scroll (mouse wheel), use deltaY.

            let delta = 0;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                delta = e.deltaX;
            } else {
                delta = e.deltaY;
            }

            if (Math.abs(delta) > 0) {
                e.preventDefault();
                wheelAccumulator.current += delta;

                if (wheelTimeout.current) clearTimeout(wheelTimeout.current);

                const THRESHOLD = 50; // Reduced threshold for better sensitivity

                if (wheelAccumulator.current > THRESHOLD) {
                    handleNextWeek();
                    wheelAccumulator.current = 0;
                } else if (wheelAccumulator.current < -THRESHOLD) {
                    handlePrevWeek();
                    wheelAccumulator.current = 0;
                }

                // Reset accumulator if scrolling stops
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
    }, [handleNextWeek, handlePrevWeek]); // Dependencies are stable (hook wrappers)

    // Ref for mutable drag state to avoid stale closures in event listeners
    const dragRef = useRef<any>(null);
    const saveRef = useRef(handleSavePlan);
    useEffect(() => { saveRef.current = handleSavePlan }, [handleSavePlan]);

    const onMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;

        const prev = dragRef.current;
        const rect = prev.containerRect;
        if (!rect) return;

        const deltaY = e.clientY - prev.startY;
        // height = 1440 mins
        // pixels = rect.height
        // deltaMins = (deltaY / rect.height) * 1440
        const minutesPerPixel = 1440 / rect.height;
        // Smooth dragging (no snap during move) for 1:1 visual feedback
        const deltaMinutes = deltaY * minutesPerPixel;

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;

        if (prev.type === 'move') {
            // Snap move to 15m for easier alignment, or keep smooth?
            // "Ghost" usually looks better snapped for move, session follows grid lines.
            // Let's keep move snapped, but resize smooth.
            const snappedDelta = Math.round(deltaMinutes / 15) * 15;
            newStart = addMinutes(new Date(prev.originalStart), snappedDelta).getTime();
        } else if (prev.type === 'resize') {
            newDuration = Math.max(900, prev.originalDuration + (deltaMinutes * 60));
        }

        setDragState(curr => curr ? ({ ...curr, currentStart: newStart, currentDuration: newDuration }) : null);
    };

    const onMouseUp = (e: MouseEvent) => {
        if (!dragRef.current) return;

        // Recalc to be safe
        const prev = dragRef.current;
        const rect = prev.containerRect;
        // Use the same scale logic as onMouseMove
        const minutesPerPixel = 1440 / rect.height;
        const deltaY = e.clientY - prev.startY;

        // Final snap on release
        const deltaMinutes = Math.round((deltaY * minutesPerPixel) / 15) * 15;

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;

        if (prev.type === 'move') {
            newStart = addMinutes(new Date(prev.originalStart), deltaMinutes).getTime();
        } else if (prev.type === 'resize') {
            newDuration = Math.max(900, prev.originalDuration + (deltaMinutes * 60));
        }

        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        setDragState(null);
        dragRef.current = null;

        if (newStart !== prev.originalStart || newDuration !== prev.originalDuration) {
            const updated = {
                ...prev.session,
                start: newStart,
                duration: newDuration
            };
            saveRef.current(updated, prev.originalStart);
        }
    };

    const startDrag = (e: React.MouseEvent, type: 'move' | 'resize', session: PlannedSession) => {
        e.preventDefault();
        e.stopPropagation();

        // Get the height of the day column for calculations
        const dayColumn = e.currentTarget.closest('.group');
        if (!dayColumn) return;

        const rect = dayColumn.getBoundingClientRect();

        const state = {
            isDragging: true,
            type,
            session,
            startY: e.clientY,
            originalStart: session.start,
            originalDuration: session.duration,
            currentStart: session.start,
            currentDuration: session.duration,
            day: new Date(session.start),
            containerRect: rect // Store rect for move calc
        };

        setDragState(state);
        dragRef.current = state;

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // --- OPTION B: SESSION MERGING LOGIC (Ported from TimeTableGraph) ---
    const getMergedSessionsForDay = (day: Date) => {
        const daySessions = weekSessions.filter(s => isSameDay(getSessionStart(s), day));

        // Include live session if it's today
        const effectiveSessions = [...daySessions];
        if (liveSession && isSameDay(getSessionStart(liveSession), day)) {
            effectiveSessions.push(liveSession);
        }

        if (effectiveSessions.length === 0) return [];

        // 0. Prepare Data
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
                appDistribution: (s as any).appUsage || { [s.process || 'Focus']: durationSec } // Fallback or use existing
            };
        });

        // 1. PRE-MERGE: Group consecutive sessions (gap < 5m)
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

                // RELAXED MERGE: Merge if gap < 5 minutes
                if (gap < 5) {
                    currentBlock.endMins = Math.max(currentBlock.endMins, session.endMins);
                    currentBlock.e = session.e.getTime() > currentBlock.e.getTime() ? session.e : currentBlock.e;
                    currentBlock.durationMins = currentBlock.endMins - currentBlock.startMins;

                    // Accumulate App Usage (Simple fallback)
                    currentBlock.appDistribution[appName] = (currentBlock.appDistribution[appName] || 0) + sessionDurSec;

                    // Dominant App Logic
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

        // 2. FILTER & SNAP
        const snappedBlocks: any[] = [];
        mergedSessions.forEach(block => {
            // Snap to Grid (Nearest 15m)
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

        // 3. POST-SNAP MERGE (Merge touching blocks)
        const finalBlocks: any[] = [];
        if (snappedBlocks.length > 0) {
            snappedBlocks.sort((a, b) => a.startMins - b.startMins);
            let current = snappedBlocks[0];

            for (let i = 1; i < snappedBlocks.length; i++) {
                const next = snappedBlocks[i];
                const isTouching = current.endMins >= next.startMins; // Overlap or Touch

                if (isTouching) {
                    current.endMins = Math.max(current.endMins, next.endMins);
                    current.durationMins = current.endMins - current.startMins;

                    // Merge App Distribution
                    Object.entries(next.appDistribution || {}).forEach(([app, dur]) => {
                        current.appDistribution[app] = (current.appDistribution[app] || 0) + (dur as number);
                    });

                    // Recalc Title
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

    return (
        <div id="weekly-view-container" className="flex flex-col h-full bg-background text-foreground select-none animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    {/* Mode Toggle */}
                    <div className="flex bg-muted/30 p-1 rounded-lg border border-border/20">
                        <Button
                            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode('calendar')}
                        >
                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                            {t('weeklyView.calendarMode')}
                        </Button>
                        <Button
                            variant={viewMode === 'routine' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode('routine')}
                        >
                            <Repeat className="w-3.5 h-3.5 mr-1.5" />
                            {t('weeklyView.routineMode')}
                        </Button>
                    </div>

                    <h2 className="text-xl font-bold min-w-[200px] tracking-tight">
                        {viewMode === 'routine' ? t('weeklyView.weeklyRoutine') : format(viewDate, 'MMMM yyyy')}
                    </h2>

                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/20">
                            <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-7 w-7 rounded-md hover:bg-background/80">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-3 font-medium rounded-md hover:bg-background/80">
                                {t('weeklyView.today')}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-7 w-7 rounded-md hover:bg-background/80">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Routine Overlay Toggle (Calendar Mode Only) */}
                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-2 mr-12 bg-muted/30 px-2 py-1 rounded-md border border-border/20">
                            <Label htmlFor="routine-overlay" className="text-[10px] text-muted-foreground font-medium cursor-pointer uppercase tracking-tight">{t('weeklyView.showRoutine')}</Label>
                            <Switch
                                id="routine-overlay"
                                checked={showRoutineOverlay}
                                onCheckedChange={setShowRoutineOverlay}
                                className="scale-75 data-[state=checked]:bg-primary"
                            />
                        </div>
                    )}
                    {isLoading && <div className="text-xs text-muted-foreground animate-pulse mr-2">{t('weeklyView.loading')}</div>}
                </div>
            </div>

            {/* Grid Header (Days) */}
            {/* Grid Header (Days) */}
            <div className="flex border-b border-border/40 bg-card/30">
                <div className="w-14 shrink-0 border-r border-border/40"></div>
                {days.map(day => (
                    <div key={day.toString()} className={cn(
                        "flex-1 py-3 text-center border-r border-border/40 last:border-r-0 transition-colors",
                        viewMode === 'calendar' && isSameDay(day, new Date()) ? "bg-primary/5" : ""
                    )}>
                        <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", viewMode === 'calendar' && isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground")}>
                            {format(day, 'EEE')}
                        </div>
                        {/* Always render container for height consistency */}
                        <div className={cn(
                            "text-xl font-light w-8 h-8 flex items-center justify-center mx-auto rounded-full transition-all",
                            viewMode === 'calendar' && isSameDay(day, new Date()) ? "bg-primary text-primary-foreground shadow-sm scale-110" : "text-foreground/80",
                            viewMode === 'routine' && "invisible" // Hide content but keep layout
                        )}>
                            {format(day, 'd')}
                        </div>
                    </div>
                ))}
            </div>

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-hidden relative bg-background/50">
                <div className="flex h-full relative py-4 box-border">

                    {/* Time Axis */}
                    <div className="w-14 shrink-0 border-r border-border/20 bg-background/80 backdrop-blur-sm sticky left-0 z-20">
                        {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                            <div
                                key={h}
                                className="absolute w-full flex items-center justify-end pr-2"
                                style={{ top: `${(h / 24) * 100}% `, transform: 'translateY(-50%)' }}
                            >
                                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                    {h.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {days.map(day => (
                        <div
                            key={day.toString()}
                            className="flex-1 relative border-r border-border/20 last:border-r-0 min-w-[100px] group cursor-cell"
                            onMouseDown={(e) => {
                                if (e.target !== e.currentTarget) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickY = e.nativeEvent.offsetY; // relative to target
                                // logic: (clickY / height) * 1440
                                const minutes = (clickY / rect.height) * 1440;
                                const snapped = Math.floor(minutes / 15) * 15;

                                const newStart = new Date(day);
                                newStart.setHours(0, 0, 0, 0);
                                newStart.setMinutes(snapped);

                                setSelectedPlan({
                                    start: newStart.getTime(),
                                    duration: 3600, // 1 hour default
                                });
                                setIsEditorOpen(true);
                            }}
                        >
                            {/* Grid Lines - Every 2 hours visually matches TimeTableGraph */}
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-full border-b border-border/20 group-hover:border-border/30 transition-colors pointer-events-none"
                                    style={{ top: `${(i * 2 / 24) * 100}% `, height: '1px' }} // Every 2 hours
                                ></div>
                            ))}

                            {/* Current Time Indicator - Hide in Routine Mode */}
                            {viewMode === 'calendar' && isSameDay(day, now) && (
                                <div
                                    className="absolute left-0 right-0 h-[2px] bg-red-500 z-30 pointer-events-none flex items-center shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                    style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%` }}
                                >
                                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 ring-2 ring-background"></div>
                                </div>
                            )}

                            {/* Routine Overlay (Ghost Layer) - Calendar Mode Only */}
                            {viewMode === 'calendar' && showRoutineOverlay && routineSessions
                                .filter(s => isSameDay(new Date(s.start), day))
                                .map((session, idx) => {
                                    const start = new Date(session.start);
                                    const startMins = start.getHours() * 60 + start.getMinutes();
                                    const top = (startMins / 1440) * 100;
                                    const height = (session.duration / 60 / 1440) * 100;

                                    return (
                                        <div
                                            key={`routine-ghost-${idx}`}
                                            className={cn(
                                                "absolute left-[4px] right-[4px] rounded-sm border-2 border-dashed px-2 flex flex-col justify-center overflow-hidden opacity-30 pointer-events-none z-0",
                                                !session.color && "bg-muted border-foreground/20 text-foreground",
                                                session.color === 'blue' && "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
                                                session.color === 'green' && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
                                                session.color === 'orange' && "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
                                                session.color === 'purple' && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
                                            )}
                                            style={{ top: `${top}% `, height: `${height}% ` }}
                                        >
                                            <div className="font-semibold truncate text-[9px] leading-tight">{session.title}</div>
                                        </div>
                                    );
                                })}

                            {/* Render Work Sessions (Merged) - Only in Calendar Mode */}
                            {viewMode === 'calendar' && getMergedSessionsForDay(day).map((block, idx) => {
                                const top = (block.startMins / 1440) * 100;
                                const height = (block.durationMins / 1440) * 100;

                                return (
                                    <div
                                        key={`merged-${idx}`}
                                        className="absolute left-[2px] right-[2px] rounded-sm bg-primary/80 text-primary-foreground text-[10px] px-2 flex flex-col justify-center overflow-hidden hover:z-40 hover:opacity-100 hover:shadow-lg transition-all cursor-default group/session pointer-events-none"
                                        style={{ top: `${top}%`, height: `${height}%` }}
                                    >
                                        <div className="font-semibold truncate group-hover/session:whitespace-normal leading-tight">{block.title}</div>
                                        <div className="truncate opacity-75 text-[9px] mt-0.5 font-mono">
                                            {Math.floor(block.durationMins / 60)}h {block.durationMins % 60}m
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Drag Ghost */}
                            {dragState && dragState.isDragging && isSameDay(dragState.day, day) && (
                                <div
                                    className="absolute left-[4px] right-[4px] rounded-sm bg-primary/30 border border-primary z-50 pointer-events-none backdrop-blur-sm"
                                    style={{
                                        top: `${((new Date(dragState.currentStart).getHours() * 60 + new Date(dragState.currentStart).getMinutes()) / 1440) * 100}% `,
                                        height: `${(dragState.currentDuration / 60 / 1440) * 100}% `
                                    }}
                                >
                                    <div className="text-[10px] p-1 font-semibold text-primary-foreground">{dragState.session?.title}</div>
                                </div>
                            )}
                            {/* Render Planned Sessions (or Routine Sessions in Routine Mode) */}
                            {effectivePlanned
                                .filter(s => isSameDay(new Date(s.start), day))
                                .filter(s => !dragState?.isDragging || s.id !== dragState.session?.id) // Hide original when dragging
                                .map((session) => {
                                    const start = new Date(session.start);
                                    const startMins = start.getHours() * 60 + start.getMinutes();
                                    const top = (startMins / 1440) * 100;
                                    const height = (session.duration / 60 / 1440) * 100;

                                    return (
                                        <ContextMenu key={`planned - ${session.id} `}>
                                            <ContextMenuTrigger>
                                                <div
                                                    className={cn(
                                                        "absolute left-[4px] right-[4px] rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden transition-all cursor-pointer z-10 backdrop-blur-[1px] group/plan select-none border",
                                                        session.isCompleted ? "opacity-60 bg-muted/40 border-muted" : "",
                                                        // Color variants
                                                        !session.isCompleted && (!session.color || session.color === 'blue') && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40",
                                                        !session.isCompleted && session.color === 'green' && "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/20 hover:border-green-500/40",
                                                        !session.isCompleted && session.color === 'orange' && "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/40",
                                                        !session.isCompleted && session.color === 'purple' && "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40",
                                                    )}
                                                    style={{ top: `${top}% `, height: `${height}% ` }}
                                                    onMouseDown={(e) => startDrag(e, 'move', session)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Only open if not dragging (simple check handled by logic flow usually, but explicit check helps)
                                                        setSelectedPlan(session);
                                                        setIsEditorOpen(true);
                                                    }}
                                                >
                                                    <div className="font-semibold truncate text-foreground group-hover/plan:whitespace-normal leading-tight select-none">{session.title}</div>
                                                    <div className="truncate opacity-70 text-foreground/70 text-[9px] mt-0.5 select-none">{format(start, 'HH:mm')} · {Math.round(session.duration / 60)}m</div>

                                                    {/* Resize Handle */}
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/40 transition-colors bg-transparent"
                                                        onMouseDown={(e) => startDrag(e, 'resize', session)}
                                                    />
                                                </div>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent className="w-40">
                                                <ContextMenuItem
                                                    onSelect={() => {
                                                        setSelectedPlan(session);
                                                        setIsEditorOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                    Edit
                                                </ContextMenuItem>
                                                <ContextMenuSeparator />
                                                <ContextMenuItem
                                                    className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                                                    onSelect={() => handleDeletePlan(session.id!)}
                                                >
                                                    <Trash className="mr-2 h-3.5 w-3.5" />
                                                    Delete
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    );
                                })}
                        </div>
                    ))}

                </div>
            </div>

            <PlanEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                session={selectedPlan}
                onSave={handleSavePlan}
                onDelete={handleDeletePlan}
            />
        </div>
    );
}
