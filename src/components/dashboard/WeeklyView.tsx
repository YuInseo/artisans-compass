import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfWeek, addWeeks, subWeeks, isSameDay, addMinutes, differenceInSeconds, setHours, setMinutes, setSeconds, getDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash, Pencil, Calendar, Repeat, Clock, ArrowRight, Flag, Tag, X, Settings, Bell, MapPin } from 'lucide-react';

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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

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

import { useTimeStore } from "@/hooks/useTimeStore";

export function WeeklyView({ currentDate, onDateChange, liveSession, todaySessions }: WeeklyViewProps) {
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();

    const [viewMode, setViewMode] = useState<'calendar' | 'routine'>('calendar');

    // Time Management
    const { now: getNow, offset: timeOffset } = useTimeStore();
    const [now, setNow] = useState(getNow());

    useEffect(() => {
        setNow(getNow());
    }, [timeOffset, getNow]);

    useEffect(() => {
        const interval = setInterval(() => setNow(getNow()), 60000);
        return () => clearInterval(interval);
    }, [getNow]);
    const [showRoutineOverlay, setShowRoutineOverlay] = useState(false);
    const [showAppUsage, setShowAppUsage] = useState(true);


    const [viewDate, setViewDate] = useState(() => startOfWeek(currentDate, { weekStartsOn: 1 }));
    const [weekSessions, setWeekSessions] = useState<(WorkSession | Session)[]>([]);
    const [weekPlanned, setWeekPlanned] = useState<PlannedSession[]>([]);


    const [localRoutine, setLocalRoutine] = useState<RoutineSession[] | null>(null);

    // Sync localRoutine with settings
    useEffect(() => {
        setLocalRoutine(settings?.weeklyRoutine || []);
    }, [settings?.weeklyRoutine]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Partial<PlannedSession> | null>(null);
    const selectedPlanRef = useRef(selectedPlan);
    useEffect(() => { selectedPlanRef.current = selectedPlan; }, [selectedPlan]);
    const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | null>(null);

    // Drag and Drop State
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        type: 'move' | 'resize' | 'create';
        session: PlannedSession | null;
        startY: number;
        startX?: number;
        originalStart: number;
        originalDuration: number;
        currentStart: number;
        currentDuration: number;
        day: Date;
        // Global Ghost Fields
        currentX: number;
        currentY: number;
        initialOffsetX: number;
        initialOffsetY: number;
        ghostWidth: number;
        containerHeight: number;
    } | null>(null);

    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
    const selectionRef = useRef<{
        isSelecting: boolean;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        containerRect: DOMRect;
    } | null>(null);

    // Removed Sync Effect to prevent resetting view when parent updates time

    // Rolling Week Logic: viewDate is the first visible day
    const days = useMemo(() => {
        if (viewMode === 'routine') {
            // Standardize Routine View to always allow Mon-Sun (Fixed)
            // We use a reference week (e.g., this week) but ensuring Monday start
            const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 });
            return Array.from({ length: 7 }).map((_, i) => addDays(baseDate, i));
        }
        return Array.from({ length: 7 }).map((_, i) => addDays(viewDate, i));
    }, [viewDate, viewMode]);

    const loadData = async () => {
        if (!(window as any).ipcRenderer) return;

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

    };

    const handleEditPlan = (session: PlannedSession, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const container = document.getElementById('weekly-view-container');
            const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

            // Smart positioning: prioritize space availability
            const spaceRight = containerRect.width - (rect.right - containerRect.left);
            const isRightSide = (rect.left - containerRect.left) > containerRect.width * 0.6;
            const shouldPlaceLeft = spaceRight < 340 || isRightSide;

            let x = shouldPlaceLeft ? (rect.left - containerRect.left) - 340 : (rect.right - containerRect.left) - 4;
            x = Math.max(0, x);

            setPopoverPosition({ x, y: rect.top - containerRect.top });
        } else {
            setPopoverPosition(null);
        }
        setSelectedPlan(session);
        setIsEditorOpen(true);
    };

    // Load Data & Cleanup on View Mode Change
    useEffect(() => {
        // Clear selection and close editor when switching views
        setSelectedPlan(null);
        setIsEditorOpen(false);
        setPopoverPosition(null);

        if (viewMode === 'calendar') {
            loadData();
        }
    }, [viewDate, viewMode]);

    // Routine Data Preparation
    const routineSessions = useMemo(() => {
        // Fetch if in routine mode OR if overlay is enabled in calendar mode
        const shouldFetch = viewMode === 'routine' || (viewMode === 'calendar' && showRoutineOverlay);
        const sourceRoutine = localRoutine || settings?.weeklyRoutine;
        if (!shouldFetch || !sourceRoutine) return [];

        // Map routine sessions to the current week's dates for rendering


        return sourceRoutine.map(routine => {
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
                location: routine.location,
                alert: routine.alert,
                isCompleted: false // Routine templates are never "completed"
            } as PlannedSession;
        }).filter(Boolean) as PlannedSession[];

    }, [settings?.weeklyRoutine, localRoutine, viewMode, viewDate, days]);

    const effectivePlanned = viewMode === 'routine' ? routineSessions : weekPlanned;

    const handleSaveRoutine = async (session: Partial<PlannedSession>, originalStart?: number) => {
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
            color: session.color,
            location: session.location,
            alert: session.alert,
            priority: session.priority
        };

        // Important: Base updates on localRoutine first to capture recent optimistic updates
        let updatedRoutine = [...(localRoutine || settings?.weeklyRoutine || [])];

        if (session.id && updatedRoutine.some(r => r.id === session.id)) {
            // Logic: If originalStart is provided, find the specific instance for that day
            if (originalStart) {
                const originalDay = getDay(new Date(originalStart));
                const targetIndex = updatedRoutine.findIndex(r => r.id === session.id && r.dayOfWeek === originalDay);

                if (targetIndex >= 0) {
                    updatedRoutine[targetIndex] = newRoutine;
                } else {
                    // Fallback: Just push (create new?) or update all? 
                    // If we can't find the specific day instance, maybe ID is unique?
                    const idMatchIndex = updatedRoutine.findIndex(r => r.id === session.id);
                    if (idMatchIndex >= 0) updatedRoutine[idMatchIndex] = newRoutine;
                }
            } else {
                // No original start (maybe direct edit via modal without drag?), update all with same ID? 
                // Or just the first one?
                // Ideally, the Editor should know which one we are editing.
                // For now, if no originalStart, assume we update the one matches the NEW day? Or just ID match?
                // Safest is to update by ID.
                updatedRoutine = updatedRoutine.map(r => r.id === session.id ? newRoutine : r);
            }
        } else {
            updatedRoutine.push(newRoutine);

            if (isEditorOpen && !session.id) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: newRoutine.id }) : null);
            }
        }

        // Optimistic Update: Update Local State Immediately
        setLocalRoutine(updatedRoutine);

        await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
    };

    const handleDeleteRoutine = async (id: string) => {
        if (!settings) return;
        const updatedRoutine = (settings.weeklyRoutine || []).filter(r => r.id !== id);
        await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
    };

    const handleSavePlan = async (session: Partial<PlannedSession>, originalStart?: number) => {
        if (viewMode === 'routine') {
            await handleSaveRoutine(session, originalStart);
            return;
        }

        if (!session.start || !session.title) return;

        const newStart = new Date(session.start);
        const newDateKey = format(newStart, 'yyyy-MM-dd');
        const newMonthKey = format(newStart, 'yyyy-MM');

        let oldDateKey: string | null = null;
        let oldMonthKey: string | null = null;

        const actualOriginalStart = originalStart || (session.id ? weekPlanned.find(p => p.id === session.id)?.start : undefined);

        // Determine if we are moving from another day
        if (actualOriginalStart && !isSameDay(actualOriginalStart, newStart)) {
            const oldStart = new Date(actualOriginalStart);
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
                location: session.location,
                alert: session.alert,
                priority: session.priority,
                isCompleted: session.isCompleted
            } as PlannedSession;



            // Critical Fix: Propagate generated ID back to selectedPlan so subsequent saves are updates
            if (isEditorOpen && !session.id) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: newSession.id }) : null);
            }
            setWeekPlanned(prev => {
                const existingIndex = prev.findIndex(p => p.id === newSession.id);
                if (existingIndex >= 0) {
                    // Update existing
                    const next = [...prev];
                    next[existingIndex] = newSession;
                    return next;
                } else {
                    // Add new (if in range)
                    // Simple logic: just add it, view rendering filters by date anyway
                    return [...prev, newSession];
                }
            });

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
                location: session.location,
                alert: session.alert,
                priority: session.priority,
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

        const sessionToDelete = effectivePlanned.find(p => p.id === id);
        if (!sessionToDelete) return; // Session not found in current view

        const sessionDate = new Date(sessionToDelete.start);
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
        const start = startOfWeek(today, { weekStartsOn: 1 });
        setViewDate(start);
        onDateChange(start);
    };

    // Current Time Indicator (Managed at top)

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
            // Disable scroll navigation in Routine mode OR when Editor is open
            if (viewMode === 'routine' || isEditorOpen) return;

            // Prevent panning if dragging or selecting
            if ((dragRef.current && dragRef.current.isDragging) || (selectionRef.current && selectionRef.current.isSelecting)) {
                return;
            }

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
                    // Scroll Right -> Next Day
                    const newDate = addDays(viewDate, 1);
                    setViewDate(newDate);
                    // onDateChange(newDate); // Optional: notify parent?
                    wheelAccumulator.current = 0;
                } else if (wheelAccumulator.current < -THRESHOLD) {
                    // Scroll Left -> Prev Day
                    const newDate = addDays(viewDate, -1);
                    setViewDate(newDate);
                    wheelAccumulator.current = 0;
                }

                // Reset accumulator if scrolling stops
                wheelTimeout.current = setTimeout(() => {
                    wheelAccumulator.current = 0;
                }, 150);
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        // Clean up
        return () => {
            container.removeEventListener('wheel', onWheel);
            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
        };
    }, [viewDate, viewMode, isEditorOpen]); // Added isEditorOpen to dependencies

    // Ref for mutable drag state to avoid stale closures in event listeners
    const dragRef = useRef<any>(null);
    const saveRef = useRef(handleSavePlan);
    useEffect(() => { saveRef.current = handleSavePlan }, [handleSavePlan]);

    const onMouseMove = (e: MouseEvent) => {
        const selState = selectionRef.current;
        if (selState && selState.isSelecting) {
            selState.currentX = e.clientX;
            selState.currentY = e.clientY;

            setSelectionBox({
                startX: selState.startX,
                startY: selState.startY,
                currentX: selState.currentX,
                currentY: selState.currentY
            });
            return; // Skip drag logic
        }

        if (!dragRef.current) return;

        const prev = dragRef.current;
        if (!prev) return;

        // ... rest of drag logic ...
        if (!prev.isDragging) {
            const dx = Math.abs(e.clientX - (prev.startX || 0));
            const dy = Math.abs(e.clientY - prev.startY);
            if (dx < 5 && dy < 5) return; // Ignore small movements

            // Threshold exceeded, start dragging
            prev.isDragging = true;
            setDragState(curr => curr ? ({ ...curr, isDragging: true }) : null);
        }

        const rect = prev.containerRect;
        if (!rect) return;

        let currentHoverDay = prev.day;
        let hoverRect = rect;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dayColumn = elements.find(el => el.hasAttribute('data-day'));
        if (dayColumn) {
            const dateStr = dayColumn.getAttribute('data-day');
            if (dateStr) {
                currentHoverDay = new Date(dateStr);
                hoverRect = dayColumn.getBoundingClientRect();
            }
        }

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;
        let newDay = prev.day;

        if (prev.type === 'move') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const snappedDelta = Math.round(deltaMinutes / 15) * 15;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

            newStart = addMinutes(targetDate, snappedDelta).getTime();
            newDay = currentHoverDay;
        } else if (prev.type === 'resize') {
            const minutesPerPixel = 1440 / hoverRect.height;
            const hoverY = e.clientY - hoverRect.top;
            const hoverMinutes = hoverY * minutesPerPixel;

            const targetEndDate = new Date(currentHoverDay);
            targetEndDate.setHours(0, 0, 0, 0);

            const targetEndTime = targetEndDate.getTime() + (hoverMinutes * 60 * 1000);
            let calculatedDurationSec = (targetEndTime - prev.originalStart) / 1000;

            const newDurationSec = Math.max(900, calculatedDurationSec);
            newDuration = Math.round(newDurationSec / 900) * 900;
        } else if (prev.type === 'create') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const effectiveDelta = Math.max(15, deltaMinutes);
            newDuration = effectiveDelta * 60;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
            newStart = targetDate.getTime();
            newDay = currentHoverDay;
        }

        setDragState(curr => curr ? ({
            ...curr,
            currentStart: prev.type === 'resize' ? prev.originalStart : newStart,
            currentDuration: newDuration,
            day: newDay,
            currentX: e.clientX,
            currentY: e.clientY
        }) : null);
    };

    const onMouseUp = async (e: MouseEvent) => {
        // Multi-Selection Logic
        const selState = selectionRef.current;
        if (selState && selState.isSelecting) {
            const box = {
                left: Math.min(selState.startX, selState.currentX),
                top: Math.min(selState.startY, selState.currentY),
                width: Math.abs(selState.currentX - selState.startX),
                height: Math.abs(selState.currentY - selState.startY),
            };

            // Find overlapping sessions
            const sessionElements = document.querySelectorAll('[data-session-id]');
            const newSelection = new Set(selectedSessionIds); // Keep previous selection if Ctrl? No, replace unless Ctrl
            if (!e.ctrlKey && !e.shiftKey) {
                newSelection.clear();
            }

            sessionElements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                // Check intersection
                const intersect = !(rect.right < box.left ||
                    rect.left > box.left + box.width ||
                    rect.bottom < box.top ||
                    rect.top > box.top + box.height);

                if (intersect) {
                    const id = el.getAttribute('data-session-id');
                    if (id) newSelection.add(id);
                }
            });

            setSelectedSessionIds(newSelection);
            setSelectionBox(null);
            selectionRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            return;
        }

        if (!dragRef.current) return;

        const prev = dragRef.current;

        let currentHoverDay = prev.day;
        let hoverRect = prev.containerRect;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dayColumn = elements.find(el => el.hasAttribute('data-day'));
        if (dayColumn) {
            const dateStr = dayColumn.getAttribute('data-day');
            if (dateStr) {
                currentHoverDay = new Date(dateStr);
                hoverRect = dayColumn.getBoundingClientRect();
            }
        }

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;

        if (prev.type === 'move') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const snappedDelta = Math.round(deltaMinutes / 15) * 15;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

            newStart = addMinutes(targetDate, snappedDelta).getTime();
        } else if (prev.type === 'resize') {
            const minutesPerPixel = 1440 / hoverRect.height;
            const hoverY = e.clientY - hoverRect.top;
            const hoverMinutes = hoverY * minutesPerPixel;

            const targetEndDate = new Date(currentHoverDay);
            targetEndDate.setHours(0, 0, 0, 0);

            const targetEndTime = targetEndDate.getTime() + (hoverMinutes * 60 * 1000);
            let calculatedDurationSec = (targetEndTime - prev.originalStart) / 1000;

            const newDurationSec = Math.max(900, calculatedDurationSec);
            newDuration = Math.round(newDurationSec / 900) * 900;
        } else if (prev.type === 'create') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const effectiveDelta = Math.max(15, deltaMinutes);
            newDuration = effectiveDelta * 60;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
            newStart = targetDate.getTime();
        }

        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Click Handling
        if (!prev.isDragging && prev.type !== 'create') {
            setDragState(null);
            dragRef.current = null;

            if (prev.session) {
                const element = document.querySelector(`[data-session-id="${prev.session.id}"]`);

                // If the exact same session is currently open in the editor, toggle it OFF.
                if (document.querySelector('.plan-editor-card') && selectedPlanRef.current?.id === prev.session.id) {
                    setIsEditorOpen(false);
                    return; // Toggle off
                }

                // If closing an existing editor (but switching to a new session), save the old one first
                if (document.querySelector('.plan-editor-card')) {
                    const currentPlan = selectedPlanRef.current;
                    if (currentPlan && currentPlan.title && currentPlan.title.trim().length > 0) {
                        saveRef.current(currentPlan);
                    }
                }

                if (element) {
                    const rect = element.getBoundingClientRect();
                    const container = document.getElementById('weekly-view-container');
                    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                    let x = (rect.right - containerRect.left) - 4;
                    if (x + 340 > containerRect.width) x = (rect.left - containerRect.left) - 340;
                    setPopoverPosition({ x: Math.max(0, x), y: rect.top - containerRect.top });
                } else {
                    const container = document.getElementById('weekly-view-container');
                    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
                    setPopoverPosition({ x: Math.max(0, e.clientX - containerRect.left), y: Math.max(0, e.clientY - containerRect.top) });
                }
                setSelectedPlan(prev.session);
                setIsEditorOpen(true);
            }
            return;
        }

        if (prev.type === 'create') {
            setDragState(null);
            dragRef.current = null;

            if (newDuration >= 900) { // Min 15 mins to be valid
                const rect = prev.containerRect;
                const top = Math.min(prev.startY, e.clientY);
                const container = document.getElementById('weekly-view-container');
                const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                let x = (rect.right - containerRect.left) - 4;
                if (x + 340 > containerRect.width) x = (rect.left - containerRect.left) - 340;

                setPopoverPosition({ x: Math.max(0, x), y: top - containerRect.top });
                setSelectedPlan({
                    id: crypto.randomUUID(),
                    start: newStart,
                    duration: newDuration,
                } as any);
                setIsEditorOpen(true);
            }
        } else if (newStart !== prev.originalStart || newDuration !== prev.originalDuration) {
            // Dragged and Changed
            const updated = {
                ...prev.session!,
                start: newStart,
                duration: newDuration
            };

            // Keep ghost visible while saving to prevent flash
            await saveRef.current(updated, prev.originalStart);

            // Now clear ghost
            setDragState(null);
            dragRef.current = null;
        } else {
            // Dragged but dropped in same spot
            setDragState(null);
            dragRef.current = null;
        }
    };

    const handleBulkDelete = async () => {
        if (selectedSessionIds.size === 0) return;


        if (viewMode === 'routine') {
            if (!settings) return;
            // Filter out the selected IDs
            const updatedRoutine = (settings.weeklyRoutine || []).filter(r => !selectedSessionIds.has(r.id));
            await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
            setSelectedSessionIds(new Set());
            return;
        }

        // Group by YearMonth to handle batch updates efficiently
        const sessionsToDelete = effectivePlanned.filter(s => selectedSessionIds.has(s.id));
        const updatesByMonth = new Map<string, Set<string>>();

        sessionsToDelete.forEach(s => {
            const date = new Date(s.start);
            const key = format(date, 'yyyy-MM');
            if (!updatesByMonth.has(key)) {
                updatesByMonth.set(key, new Set());
            }
            updatesByMonth.get(key)!.add(s.id);
        });

        if ((window as any).ipcRenderer) {
            for (const [yearMonth, ids] of updatesByMonth) {
                const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                let changed = false;

                Object.keys(logs).forEach(dateKey => {
                    const log = logs[dateKey];
                    if (log.plannedSessions) {
                        const originalLen = log.plannedSessions.length;
                        log.plannedSessions = log.plannedSessions.filter((p: PlannedSession) => !ids.has(p.id));
                        if (log.plannedSessions.length !== originalLen) {
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
                }
            }
            loadData();
        }

        setSelectedSessionIds(new Set());
    };

    const handleBulkPriority = async (priority: 'high' | 'medium' | 'low' | undefined) => {
        if (selectedSessionIds.size === 0) return;

        const updates = effectivePlanned
            .filter(s => selectedSessionIds.has(s.id))
            .map(s => ({ ...s, priority }));

        // Use sequential await to prevent race conditions during IPC reads/writes
        for (const session of updates) {
            await handleSavePlan(session);
        }
    };

    const handleBulkDateChange = async (newDate: Date | undefined) => {
        if (!newDate || selectedSessionIds.size === 0) return;

        const sessionsToMove = effectivePlanned
            .filter(s => selectedSessionIds.has(s.id))
            .map(s => {
                const start = new Date(s.start);
                const target = new Date(newDate);
                target.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
                return { updated: { ...s, start: target.getTime() }, originalStart: s.start };
            });

        for (const { updated, originalStart } of sessionsToMove) {
            await handleSavePlan(updated, originalStart);
        }
        setSelectedSessionIds(new Set());
    };

    const startDrag = (e: React.MouseEvent, type: 'move' | 'resize', session: PlannedSession) => {
        if (e.button !== 0) return; // Only Left Click
        e.preventDefault();
        e.stopPropagation();

        // Get the height of the day column for calculations
        const dayColumn = (e.currentTarget as HTMLElement).closest('[data-day]');
        if (!dayColumn) return;

        const dayRect = dayColumn.getBoundingClientRect();
        const sessionElement = (e.currentTarget as HTMLElement).closest('[data-session-id]');
        const sessionRect = sessionElement ? sessionElement.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();

        const state = {
            isDragging: false, // Start as false, set to true on move > threshold
            type,
            session,
            startY: e.clientY,
            startX: e.clientX, // Track X for threshold
            originalStart: session.start,
            originalDuration: session.duration,
            currentStart: session.start,
            currentDuration: session.duration,
            day: new Date(session.start),
            containerRect: dayRect, // Store dayRect for height calc
            // Global Ghost Init
            currentX: e.clientX,
            currentY: e.clientY,
            initialOffsetX: e.clientX - dayRect.left,
            initialOffsetY: e.clientY - sessionRect.top,
            ghostWidth: dayRect.width,
            containerHeight: dayRect.height
        };

        setDragState(state);
        dragRef.current = state;

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // --- OPTION B: SESSION MERGING LOGIC (Ported from TimeTableGraph) ---
    const getMergedSessionsForDay = (day: Date) => {
        const daySessions = weekSessions.filter(s => {
            if (!isSameDay(getSessionStart(s), day)) return false;

            // Filter Non-Work Apps if setting is disabled
            // If showNonWorkApps is TRUE, we show everything.
            // If FALSE, we only show Work Apps.
            if (settings?.calendarSettings?.showNonWorkApps) return true;

            const proc = s.process || 'Focus';
            // Default to Work if no workApps defined, otherwise check list
            const isWork = !settings?.workApps?.length || settings.workApps.some(w => w.toLowerCase() === proc.toLowerCase());
            return isWork;
        });

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

    const portalTarget = typeof document !== 'undefined' ? document.getElementById('top-toolbar-portal') : null;

    const headerContent = (
        <div className="flex items-center justify-between w-full h-full px-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
                        반복 루틴
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {viewMode !== 'routine' && (
                    <h2 className="text-xl font-bold tracking-tight mr-2 whitespace-nowrap">
                        {format(viewDate, 'MMMM yyyy')}
                    </h2>
                )}
                {/* 1. Today Nav (Moved from Left) */}
                {viewMode === 'calendar' && (
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/20">
                        <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-7 w-7 rounded-md hover:bg-background/80">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-3 font-medium rounded-md hover:bg-background/80">
                            {t('weeklyView.today')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextWeek}
                            className="h-7 w-7 rounded-md hover:bg-background/80"
                            disabled={settings?.lockFutureDates && addWeeks(viewDate, 1) > new Date()}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* 2. View Options Menu */}
                {viewMode === 'calendar' && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-full">
                                <Settings className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <div className="space-y-2">
                                <div className="font-semibold text-xs text-muted-foreground px-2 py-1">View Options</div>
                                <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer" onClick={() => setShowRoutineOverlay(!showRoutineOverlay)}>
                                    <Checkbox
                                        id="routine-overlay"
                                        checked={showRoutineOverlay}
                                        className="h-4 w-4 pointer-events-none"
                                        readOnly
                                    />
                                    <Label htmlFor="routine-overlay" className="text-sm cursor-pointer flex-1 pointer-events-none">
                                        {t('weeklyView.showRoutine', 'Show Repeating Routine')}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer" onClick={() => setShowAppUsage(!showAppUsage)}>
                                    <Checkbox
                                        id="app-usage"
                                        checked={showAppUsage}
                                        className="h-4 w-4 pointer-events-none"
                                        readOnly
                                    />
                                    <Label htmlFor="app-usage" className="text-sm cursor-pointer flex-1 pointer-events-none">
                                        {t('weeklyView.showAppUsage', 'Show App Usage')}
                                    </Label>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );

    return (
        <div id="weekly-view-container" className="flex flex-col h-full bg-background text-foreground select-none animate-in fade-in duration-300 relative">
            {/* Header via Portal or Fallback */}
            {portalTarget ? createPortal(headerContent, portalTarget) : (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
                    {headerContent}
                </div>
            )}


            {/* Grid Header (Days) */}
            {/* Grid Header (Days) */}
            <div className="flex border-b border-border/40 bg-card/30 shrink-0">
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

            {/* Main Content & Sidebar Wrapper */}
            <div className="flex-1 flex overflow-hidden relative">
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
                                data-day={day.toISOString()}
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return; // Only Left Click

                                    // If editor is open, clicking background should close it ONLY
                                    // If editor is open, clicking background should close it ONLY
                                    if (isEditorOpen) {
                                        // Auto-save if title exists
                                        if (selectedPlan && selectedPlan.title && selectedPlan.title.trim().length > 0) {
                                            handleSavePlan(selectedPlan);
                                        }

                                        setIsEditorOpen(false);
                                        setSelectedPlan(null);
                                        setPopoverPosition(null);
                                        return;
                                    }

                                    // Clear multi-selection if clicking empty space without Ctrl
                                    if (!e.ctrlKey && selectedSessionIds.size > 0) {
                                        setSelectedSessionIds(new Set());
                                        return; // Just deselect, don't create new session yet
                                    }

                                    // Multi-Selection (Ctrl + Drag on Background)
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
                                        document.addEventListener('mousemove', onMouseMove);
                                        document.addEventListener('mouseup', onMouseUp);
                                        return;
                                    }

                                    if (e.target !== e.currentTarget) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const clickY = e.nativeEvent.offsetY; // relative to target
                                    // logic: (clickY / height) * 1440
                                    const minutes = (clickY / rect.height) * 1440;
                                    const snapped = Math.floor(minutes / 15) * 15;

                                    const newStart = new Date(day);
                                    newStart.setHours(0, 0, 0, 0);
                                    newStart.setMinutes(snapped);

                                    // START DRAG CREATE
                                    const state = {
                                        isDragging: true,
                                        type: 'create',
                                        session: null, // No session yet
                                        startY: e.clientY,
                                        originalStart: newStart.getTime(),
                                        originalDuration: 900, // Start with 15m
                                        currentStart: newStart.getTime(),
                                        currentDuration: 900,
                                        day: newStart,
                                        containerRect: rect
                                    };

                                    setDragState(state as any);
                                    dragRef.current = state;

                                    document.body.style.userSelect = 'none';
                                    document.addEventListener('mousemove', onMouseMove);
                                    document.addEventListener('mouseup', onMouseUp);
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

                                {/* Current Time Indicator - Red Solid */}
                                {isSameDay(day, now) && (
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-red-500 z-50 pointer-events-none flex items-center"
                                        style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%` }}
                                    >
                                        <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                    </div>
                                )}

                                {/* Bedtime Indicator - Yellow Dotted */}
                                {(
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-yellow-400 border-dashed z-0 pointer-events-none opacity-50"
                                        style={{ top: `${((23 * 60) / 1440) * 100}%` }} // Default 11 PM if no setting
                                    />
                                )}
                                {/* If settings.bedTime exists, use it. But for now hardcode or use existing if found */}

                                {/* Nighttime Indicator - Yellow Dotted Line */}
                                {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-dotted border-yellow-500/70 z-20 pointer-events-none"
                                        style={{ top: `${((settings.nightTimeStart || 22) / 24) * 100}%` }}
                                    />
                                )}

                                {/* Nighttime Overlay */}
                                {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                                    <div
                                        className="absolute left-0 right-0 bg-black/20 dark:bg-black/40 pointer-events-none z-0"
                                        style={{
                                            top: `${((settings.nightTimeStart || 22) / 24) * 100}%`,
                                            height: `${((24 - (settings.nightTimeStart || 22)) / 24) * 100}%`
                                        }}
                                    />
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
                                {viewMode === 'calendar' && showAppUsage && getMergedSessionsForDay(day).map((block, idx) => {
                                    const top = (block.startMins / 1440) * 100;
                                    const height = (block.durationMins / 1440) * 100;

                                    const isNonWork = settings?.workApps?.length && !settings.workApps.some(w => w.toLowerCase() === block.title.toLowerCase());

                                    return (
                                        <div
                                            key={`merged-${idx}`}
                                            className={cn(
                                                "absolute left-[2px] right-[2px] rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden hover:z-40 hover:opacity-100 hover:shadow-lg transition-all cursor-default group/session pointer-events-none",
                                                isNonWork
                                                    ? (settings?.calendarSettings?.nonWorkColor
                                                        ? `bg-[${settings.calendarSettings.nonWorkColor}] text-foreground`
                                                        : "bg-slate-200/50 dark:bg-slate-800/50 text-muted-foreground border border-slate-300 dark:border-slate-700")
                                                    : "bg-primary/80 text-primary-foreground"
                                            )}
                                            style={{ top: `${top}%`, height: `${height}%` }}
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

                                {/* Drag Ghost */}

                                {/* Render Planned Sessions (or Routine Sessions in Routine Mode) */}
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

                                    return daySegments.map((session) => {
                                        const startMins = (session.segmentStart - dayStartMs) / 60000;
                                        const top = (startMins / 1440) * 100;
                                        const heightStr = `${(session.segmentDuration / 60 / 1440) * 100}%`;

                                        const layout = layoutMap.get(session.id) || { left: 0, width: 100 };

                                        const isDragPreview = session.id === 'drag-ghost-session';

                                        // Use original start for display, not segment start
                                        const displayStart = new Date(session.originalStart);
                                        const displayEnd = addMinutes(displayStart, session.originalDuration / 60);

                                        return (
                                            <ContextMenu key={`planned-${session.id}-${session.segmentStart}`}>
                                                <ContextMenuTrigger>
                                                    <div
                                                        data-session-id={session.id}
                                                        className={cn(
                                                            "absolute rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden transition-colors cursor-pointer z-10 backdrop-blur-[1px] group/plan select-none border border-b-2",
                                                            !session.isEnd && "rounded-b-none border-b-transparent shadow-none",
                                                            !session.isStart && "rounded-t-none border-t-transparent pt-0",
                                                            session.isCompleted ? "opacity-60 bg-muted/40 border-muted" : "",
                                                            isDragPreview && "opacity-80 ring-2 ring-primary border-primary animate-pulse z-[40] pointer-events-none",
                                                            selectedSessionIds.has(session.id!) && "ring-2 ring-primary ring-offset-1 z-20",
                                                            selectedPlan?.id === session.id && "ring-2 ring-primary z-30 shadow-lg",
                                                            !session.isCompleted && (!session.color || session.color === 'blue') && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40",
                                                            !session.isCompleted && session.color === 'green' && "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/20 hover:border-green-500/40",
                                                            !session.isCompleted && session.color === 'orange' && "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/40",
                                                            !session.isCompleted && session.color === 'purple' && "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40",
                                                        )}
                                                        style={{
                                                            top: `${top}%`,
                                                            height: heightStr,
                                                            left: `${layout.left}%`,
                                                            width: `${layout.width}%`,
                                                            zIndex: isDragPreview ? 40 : 10 + Math.round(layout.left)
                                                        }}
                                                        onMouseDown={(e) => startDrag(e, 'move', session)}
                                                    >
                                                        {session.isStart && (
                                                            <div className="font-semibold truncate text-foreground group-hover/plan:whitespace-normal leading-tight select-none flex items-center gap-1">
                                                                {session.priority === 'high' && <Flag className="w-3 h-3 text-red-500 fill-red-500 flex-shrink-0" />}
                                                                {session.priority === 'medium' && <Flag className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />}
                                                                {session.priority === 'low' && <Flag className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />}
                                                                {session.alert !== undefined && <Bell className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                                                {session.location && <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                                                <span className="truncate">{session.title}</span>
                                                            </div>
                                                        )}

                                                        {session.isStart && (
                                                            <div className="truncate opacity-70 text-foreground/70 text-[9px] mt-0.5 select-none font-mono">
                                                                {format(displayStart, 'HH:mm')} - {format(displayEnd, 'HH:mm')}
                                                                {Math.round(layout.width) > 30 && (
                                                                    <span className="ml-1 opacity-70">
                                                                        ({Math.floor(session.originalDuration / 3600) > 0 ? `${Math.floor(session.originalDuration / 3600)}h ` : ''}{Math.round((session.originalDuration % 3600) / 60)}m)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {session.isEnd && (
                                                            <div
                                                                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/40 transition-colors bg-transparent"
                                                                onMouseDown={(e) => startDrag(e, 'resize', session)}
                                                            />
                                                        )}
                                                    </div>
                                                </ContextMenuTrigger>
                                                {!isDragPreview && (
                                                    <ContextMenuContent className="w-40">
                                                        <ContextMenuItem onSelect={() => handleEditPlan(session)}>
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
                                                )}
                                            </ContextMenu>
                                        );
                                    });
                                })()}
                            </div>
                        ))}

                    </div>
                </div>

                {/* Floating Editor Card */}
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
                                // Immediate update for UI responsiveness
                                setSelectedPlan(updatedSession);

                                if (viewMode === 'routine') {
                                    if (localRoutine) {
                                        // Convert PlannedSession payload to RoutineSession format specifically for the view
                                        // Note: We only update the visual properties here for speed.
                                        // Actual persistence happens via onSave -> handleSaveRoutine.

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
                                                    startSeconds: startSeconds, // Update time if changed
                                                    dayOfWeek: dayOfWeek // Update day if changed
                                                };
                                            }
                                            return r;
                                        }));
                                    }
                                } else {
                                    // Calendar Mode
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

                {/* Legacy/Fallback Dialog (if no position) */}
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

                {/* Selection Box Overlay - Portaled to Body to avoid transform context issues */}
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

                {/* Bulk Action Toolbar */}
                {selectedSessionIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border shadow-lg rounded-xl p-1 flex items-center gap-1 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Change Date">
                                    <Calendar className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" side="top" align="center">
                                <CalendarUI
                                    mode="single"
                                    disabled={viewMode === 'routine'} // Routine sessions don't really have dates in the same way, or maybe we want to allow changing day of week?
                                    onSelect={(date) => handleBulkDateChange(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Reschedule">
                            <Clock className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Move">
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-accent rounded-lg",
                                    (() => {
                                        const selectedSessions = effectivePlanned.filter(s => selectedSessionIds.has(s.id));
                                        const commonPriority = selectedSessions.length > 0 && selectedSessions.every(s => s.priority === selectedSessions[0].priority)
                                            ? selectedSessions[0].priority
                                            : undefined;
                                        return commonPriority ? "text-foreground" : "text-muted-foreground";
                                    })()
                                )} title="Flag">
                                    {(() => {
                                        const selectedSessions = effectivePlanned.filter(s => selectedSessionIds.has(s.id));
                                        const commonPriority = selectedSessions.length > 0 && selectedSessions.every(s => s.priority === selectedSessions[0].priority)
                                            ? selectedSessions[0].priority
                                            : undefined;

                                        return (
                                            <Flag className={cn("w-4 h-4",
                                                commonPriority === 'high' && "fill-red-500 text-red-500",
                                                commonPriority === 'medium' && "fill-orange-500 text-orange-500",
                                                commonPriority === 'low' && "fill-blue-500 text-blue-500"
                                            )} />
                                        );
                                    })()}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-32 p-1" side="top">
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('high')}>
                                        <Flag className="w-3 h-3 mr-2 text-red-500 fill-red-500" />
                                        높음
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('medium')}>
                                        <Flag className="w-3 h-3 mr-2 text-orange-500 fill-orange-500" />
                                        중간
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('low')}>
                                        <Flag className="w-3 h-3 mr-2 text-blue-500 fill-blue-500" />
                                        낮음
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority(undefined)}>
                                        <Flag className="w-3 h-3 mr-2 opacity-50" />
                                        없음
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Tag">
                            <Tag className="w-4 h-4" />
                        </Button>
                        <div className="w-[1px] h-4 bg-border mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={handleBulkDelete} title="Delete">
                            <Trash className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" onClick={() => setSelectedSessionIds(new Set())} title="Cancel Selection">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Global Drag Ghost */}
            {dragState && dragState.isDragging && createPortal(
                <div
                    className="fixed rounded-md bg-blue-500 text-white z-[9999] pointer-events-none flex flex-col px-2 py-1 shadow-lg opacity-90"
                    style={{
                        left: dragState.type === 'resize'
                            ? (dragState.startX || 0) - dragState.initialOffsetX
                            : dragState.currentX - dragState.initialOffsetX,
                        top: dragState.type === 'resize'
                            ? dragState.startY - dragState.initialOffsetY
                            : dragState.currentY - dragState.initialOffsetY,
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
