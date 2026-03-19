import { useState, useEffect, useMemo } from 'react';
import { format, isSameDay, getDay, setSeconds, setMinutes, setHours } from 'date-fns';
import { WorkSession, Session, PlannedSession, RoutineSession, DailyLog } from '@/types';
import { useDataStore } from '@/hooks/useDataStore';
import { useArtisansCompass } from '@/core/ArtisansCompassProvider';
export function useWeeklyData(
    days: Date[],
    viewMode: 'calendar' | 'routine',
    viewDate: Date,
    showRoutineOverlay: boolean,
    isEditorOpen: boolean,
    setSelectedPlan: (plan: React.SetStateAction<Partial<PlannedSession> | null>) => void,
    todaySessions?: (WorkSession | Session)[]
) {
    const { settings } = useDataStore();

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

    const { commandManager } = useArtisansCompass();

    const handleSaveRoutine = async (session: Partial<PlannedSession>, originalStart?: number) => {
        let finalSession = { ...session };
        if (!finalSession.id) {
            finalSession.id = crypto.randomUUID();
            if (isEditorOpen) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: finalSession.id }) : null);
            }
        }
        await commandManager.execute('cmd.saveRoutine', { session: finalSession, originalStart });
    };

    const handleDeleteRoutine = async (id: string) => {
        await commandManager.execute('cmd.deleteRoutine', { id });
    };

    const handleSavePlan = async (session: Partial<PlannedSession>, originalStart?: number) => {
        if (viewMode === 'routine') {
            await handleSaveRoutine(session, originalStart);
            return;
        }
        let finalSession = { ...session };
        if (!finalSession.id) {
            finalSession.id = crypto.randomUUID();
            if (isEditorOpen) {
                setSelectedPlan(prev => prev ? ({ ...prev, id: finalSession.id }) : null);
            }
        }
        await commandManager.execute('cmd.savePlan', { session: finalSession, originalStart });
    };

    const handleDeletePlan = async (id: string) => {
        if (viewMode === 'routine') {
            await handleDeleteRoutine(id);
            return;
        }
        const sessionToDelete = effectivePlanned.find(p => p.id === id);
        if (!sessionToDelete) return;

        const sessionDate = new Date(sessionToDelete.start);
        const dateKey = format(sessionDate, 'yyyy-MM-dd');

        await commandManager.execute('cmd.deletePlan', { id, dateKey });
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
