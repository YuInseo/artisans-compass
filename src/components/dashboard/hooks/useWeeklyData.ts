import { useState, useEffect, useMemo } from 'react';
import { format, isSameDay, getDay, setSeconds, setMinutes, setHours } from 'date-fns';
import { WorkSession, Session, PlannedSession, RoutineSession, DailyLog } from '@/types';
import { useDataStore } from '@/hooks/useDataStore';

export function useWeeklyData(
    days: Date[],
    viewMode: 'calendar' | 'routine',
    viewDate: Date,
    showRoutineOverlay: boolean,
    isEditorOpen: boolean,
    setSelectedPlan: (plan: React.SetStateAction<Partial<PlannedSession> | null>) => void,
    todaySessions?: (WorkSession | Session)[]
) {
    const { settings, saveSettings } = useDataStore();

    const [weekSessions, setWeekSessions] = useState<(WorkSession | Session)[]>([]);
    const [weekPlanned, setWeekPlanned] = useState<PlannedSession[]>([]);
    const [localRoutine, setLocalRoutine] = useState<RoutineSession[] | null>(null);

    // Sync localRoutine with settings
    useEffect(() => {
        setLocalRoutine(settings?.weeklyRoutine || []);
    }, [settings?.weeklyRoutine]);

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
            if (isSameDay(day, new Date())) {
                if (todaySessions) allSessions = [...allSessions, ...todaySessions];
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

    // Load Data & Cleanup on View Mode Change
    useEffect(() => {
        if (viewMode === 'calendar') {
            loadData();
        }
    }, [viewDate, viewMode, days]);

    // Routine Data Preparation
    const routineSessions = useMemo(() => {
        const shouldFetch = viewMode === 'routine' || (viewMode === 'calendar' && showRoutineOverlay);
        const sourceRoutine = localRoutine || settings?.weeklyRoutine;
        if (!shouldFetch || !sourceRoutine) return [];

        return sourceRoutine.map(routine => {
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
                isCompleted: false
            } as PlannedSession;
        }).filter(Boolean) as PlannedSession[];
    }, [settings?.weeklyRoutine, localRoutine, viewMode, viewDate, days, showRoutineOverlay]);

    const effectivePlanned = useMemo(() => {
        if (viewMode === 'routine') return routineSessions;
        return showRoutineOverlay ? [...weekPlanned, ...routineSessions] : weekPlanned;
    }, [viewMode, showRoutineOverlay, weekPlanned, routineSessions]);

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

        let updatedRoutine = [...(localRoutine || settings?.weeklyRoutine || [])];

        if (session.id && updatedRoutine.some(r => r.id === session.id)) {
            if (originalStart) {
                const originalDay = getDay(new Date(originalStart));
                const targetIndex = updatedRoutine.findIndex(r => r.id === session.id && r.dayOfWeek === originalDay);

                if (targetIndex >= 0) {
                    updatedRoutine[targetIndex] = newRoutine;
                } else {
                    const idMatchIndex = updatedRoutine.findIndex(r => r.id === session.id);
                    if (idMatchIndex >= 0) updatedRoutine[idMatchIndex] = newRoutine;
                }
            } else {
                updatedRoutine = updatedRoutine.map(r => r.id === session.id ? newRoutine : r);
            }
        } else {
            updatedRoutine.push(newRoutine);
            if (isEditorOpen && !session.id) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: newRoutine.id }) : null);
            }
        }

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

        if (actualOriginalStart && !isSameDay(actualOriginalStart, newStart)) {
            const oldStart = new Date(actualOriginalStart);
            oldDateKey = format(oldStart, 'yyyy-MM-dd');
            oldMonthKey = format(oldStart, 'yyyy-MM');
        }

        if (!(window as any).ipcRenderer) return;
        const ipc = (window as any).ipcRenderer;

        if (oldMonthKey === newMonthKey || !oldMonthKey) {
            const logs = await ipc.getMonthlyLog(newMonthKey);

            if (oldDateKey && logs[oldDateKey] && logs[oldDateKey].plannedSessions) {
                logs[oldDateKey].plannedSessions = logs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
            }

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

            if (isEditorOpen && !session.id) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: newSession.id }) : null);
            }

            setWeekPlanned(prev => {
                const existingIndex = prev.findIndex(p => p.id === newSession.id);
                if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = newSession;
                    return next;
                } else {
                    return [...prev, newSession];
                }
            });

            if (oldDateKey && oldDateKey !== newDateKey) {
                log.plannedSessions = [...planned, newSession];
            } else {
                if (session.id && planned.some((p: PlannedSession) => p.id === session.id)) {
                    log.plannedSessions = planned.map((p: PlannedSession) => p.id === session.id ? newSession : p);
                } else {
                    log.plannedSessions = [...planned, newSession];
                }
            }

            await ipc.saveMonthlyLog({ yearMonth: newMonthKey, data: logs });
        } else {
            if (oldMonthKey && oldDateKey) {
                const oldLogs = await ipc.getMonthlyLog(oldMonthKey);
                if (oldLogs && oldLogs[oldDateKey] && oldLogs[oldDateKey].plannedSessions) {
                    oldLogs[oldDateKey].plannedSessions = oldLogs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
                    await ipc.saveMonthlyLog({ yearMonth: oldMonthKey, data: oldLogs });
                }
            }

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

        loadData();
    };

    const handleDeletePlan = async (id: string) => {
        if (viewMode === 'routine') {
            await handleDeleteRoutine(id);
            return;
        }

        const sessionToDelete = effectivePlanned.find(p => p.id === id);
        if (!sessionToDelete) return;

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

    return {
        weekSessions,
        weekPlanned, setWeekPlanned,
        localRoutine, setLocalRoutine,
        routineSessions,
        effectivePlanned,
        loadData,
        handleSavePlan,
        handleDeletePlan
    };
}
