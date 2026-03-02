import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Session, Project } from '@/types';
import { useTodoStore } from '@/hooks/useTodoStore';

export function useDailyData(projects: Project[], settings: any, now: Date) {
    const { loadTodos, activeProjectId, setActiveProjectId } = useTodoStore();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [plannedSessions, setPlannedSessions] = useState<any[]>([]);
    const [manualQuote, setManualQuote] = useState<string | null>(null);
    const [firstOpenedAt, setFirstOpenedAt] = useState<number | null>(null);

    const [liveSession, setLiveSession] = useState<Session | null>(null);
    const [displayDate, setDisplayDate] = useState<string | null>(null);

    useEffect(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let nextId = activeProjectId;

        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.invoke('get-daily-log', todayStr).then((log: any) => {
                if (log && log.quote) {
                    setManualQuote(log.quote);
                }
            });
        }

        if (nextId) {
            const currentProject = projects.find(p => p.id === nextId);
            if (!currentProject || todayStr < currentProject.startDate || todayStr > currentProject.endDate) {
                nextId = "";
            }
        }

        if (!nextId) {
            const candidate = projects.find(p => todayStr >= p.startDate && todayStr <= p.endDate);
            if (candidate) {
                nextId = candidate.id;
            }
        }

        if (nextId !== activeProjectId) {
            setActiveProjectId(nextId || "");
        }
    }, [projects, activeProjectId, setActiveProjectId]);

    useEffect(() => {
        loadTodos();

        if ((window as any).ipcRenderer) {
            const loadSessionData = async () => {
                const todayStr = format(now, 'yyyy-MM-dd');
                let startViewDate = todayStr;

                try {
                    const logicalDate = await (window as any).ipcRenderer.invoke('get-logical-date');
                    if (logicalDate) {
                        startViewDate = logicalDate;
                    }
                } catch (e) {
                    console.warn("Failed to get logical date", e);
                }

                const loadDate = async (dateKey: string) => {
                    const yearMonth = dateKey.slice(0, 7);
                    const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                    return logs?.[dateKey] || null;
                };

                let mergedSessions: Session[] = [];
                let mergedScreenshots: string[] = [];
                let mergedPlanned: any[] = [];

                const primaryData = await loadDate(startViewDate);
                if (primaryData) {
                    mergedSessions = [...(primaryData.sessions || [])];
                    mergedScreenshots = [...(primaryData.screenshots || [])];
                    mergedPlanned = [...(primaryData.plannedSessions || [])];
                    if (primaryData.firstOpenedAt) setFirstOpenedAt(primaryData.firstOpenedAt);
                }

                if (settings?.dailyRecordMode === 'fixed' && startViewDate !== todayStr) {
                    const secondaryData = await loadDate(todayStr);
                    if (secondaryData) {
                        mergedSessions = [...mergedSessions, ...(secondaryData.sessions || [])];
                        mergedScreenshots = [...mergedScreenshots, ...(secondaryData.screenshots || [])];
                        mergedPlanned = [...mergedPlanned, ...(secondaryData.plannedSessions || [])];
                    }
                }

                setSessions(mergedSessions);
                setScreenshots(mergedScreenshots);
                setPlannedSessions(mergedPlanned);
                setDisplayDate(startViewDate !== todayStr ? startViewDate : null);
            };

            loadSessionData();

            const removeListener = (window as any).ipcRenderer.onTrackingUpdate((data: any) => {
                if (data.currentSession) {
                    setLiveSession(data.currentSession);
                } else {
                    setLiveSession(null);
                }
            });

            const removeSessionListener = (window as any).ipcRenderer.onSessionCompleted(() => {
                loadSessionData();
            });

            return () => {
                removeListener();
                if (removeSessionListener) removeSessionListener();
            };
        }
    }, [loadTodos, settings?.dailyRecordMode, format(now, 'yyyy-MM-dd')]);

    const filteredSessions = useMemo(() => {
        if (!settings?.filterTimelineByWorkApps) {
            return sessions;
        }
        return sessions.filter(session => {
            if (!session.process) return false;

            const isProject = projects.some(p => p.name.toLowerCase() === session.process!.toLowerCase());
            if (isProject) return true;

            const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => session.process!.toLowerCase().includes(pattern.toLowerCase()));
            if (isTracked) return true;

            if (!settings?.workApps?.length) return false;
            return settings.workApps.some((app: string) => session.process!.toLowerCase().includes(app.toLowerCase()));
        });
    }, [sessions, settings?.filterTimelineByWorkApps, settings?.workApps, settings?.targetProcessPatterns, projects]);

    const filteredLiveSession = useMemo(() => {
        if (!liveSession) return null;

        if (!settings?.filterTimelineByWorkApps) {
            return liveSession;
        }

        const processName = liveSession.process || "";

        const isProject = projects.some(p => p.name.toLowerCase() === processName.toLowerCase());
        if (isProject) return liveSession;

        const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => processName.toLowerCase().includes(pattern.toLowerCase()));
        if (isTracked) return liveSession;

        if (!settings?.workApps?.length) {
            return null;
        }

        const isWork = settings.workApps.some((app: string) => processName.toLowerCase().includes(app.toLowerCase()));
        return isWork ? liveSession : null;
    }, [liveSession, settings?.filterTimelineByWorkApps, settings?.workApps, settings?.targetProcessPatterns, projects]);

    return {
        sessions,
        screenshots,
        plannedSessions,
        manualQuote,
        firstOpenedAt,
        liveSession,
        displayDate,
        filteredSessions,
        filteredLiveSession
    };
}
